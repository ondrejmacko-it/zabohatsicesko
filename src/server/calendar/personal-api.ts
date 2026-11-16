import { logError } from "@/server/audit";
import type { FetchLike } from "./google-auth";
import { CalendarError, type ManagedEventData } from "./provider";

// Volání Google Calendar API pro osobní kalendář „Vzdělávání ZBC“ s tokenem samotného uživatele.
// Rozsah `calendar.app.created` dovolí jen kalendáře, které Wiki sama vytvořila. Žádní hosté, a proto
// žádné pozvánkové e-maily (`sendUpdates=none`). Do logu jde jen stav a strojový důvod chyby.

const API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 10_000;
const TIME_ZONE = "Europe/Prague";

export const PERSONAL_CALENDAR_NAME = "Vzdělávání ZBC";
/** Barva kalendáře v Google Kalendáři: tmavě zelená Wiki, bílý text. */
const CALENDAR_COLORS = { backgroundColor: "#1f6f5c", foregroundColor: "#ffffff" } as const;
/**
 * Výchozí připomínky kalendáře: e-mail den předem a oznámení 30 minut předem. E-mail o změně, kterou
 * zapíše aplikace tokenem samotného uživatele, Google neposílá (změnu „udělal“ on sám). Připomínky
 * a ranní přehled („agenda“) Google posílá vždy, proto jsou hlavní cestou, jak se o akci dozvědět.
 */
export const DEFAULT_REMINDERS = [
  { method: "email", minutes: 24 * 60 },
  { method: "popup", minutes: 30 },
] as const;
export const NOTIFICATIONS = ["eventCreation", "eventChange", "eventCancellation", "agenda"].map((type) => ({ type, method: "email" }));

export type PersonalApiOptions = { clientId: string; clientSecret: string; fetchImpl?: FetchLike };

const TRANSIENT_403 = new Set(["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded", "backendError"]);
/** Důvod od Googlu zkrácený na bezpečný strojový kód (jen písmena a číslice). */
const safeReason = (reason: string) => reason.replace(/[^A-Za-z0-9]/g, "").slice(0, 40);

/**
 * Výsledek nastavení položky v seznamu kalendářů: `full` = barva, připomínky i e-mailová upozornění,
 * `basic` = bez e-mailových upozornění (Google je odmítl), `none` = nastavení se nepodařilo vůbec.
 */
export type CalendarSetup = "full" | "basic" | "none";

export class PersonalCalendarApi {
  private readonly fetchImpl: FetchLike;
  private token: string | null = null;

  constructor(
    private readonly options: PersonalApiOptions,
    private readonly refreshToken: string,
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Nový přístupový token. `invalid_grant` = uživatel přístup u Googlu odvolal. */
  private async accessToken(force = false): Promise<string> {
    if (this.token && !force) return this.token;
    let response: Response;
    try {
      response = await this.fetchImpl(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.refreshToken,
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
        }).toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new CalendarError("calendar_unavailable", true);
    }
    const body = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string };
    if (response.status === 400 && body.error === "invalid_grant") throw new CalendarError("calendar_revoked", false);
    if (response.status !== 200 || !body.access_token) {
      logError("google.personal", body.error ?? `token_http_${response.status}`);
      throw new CalendarError("calendar_unavailable", response.status >= 500 || response.status === 429);
    }
    this.token = body.access_token;
    return this.token;
  }

  private async request(method: string, path: string, init: { query?: Record<string, string>; body?: unknown } = {}): Promise<{ status: number; body: unknown }> {
    const url = new URL(`${API}${path}`);
    for (const [name, value] of Object.entries(init.query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; ; attempt += 1) {
      const token = await this.accessToken(attempt > 0);
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers: { authorization: `Bearer ${token}`, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
          body: init.body ? JSON.stringify(init.body) : undefined,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        throw new CalendarError("calendar_unavailable", true);
      }
      if (response.status === 401 && attempt === 0) continue;
      const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
      if (response.ok || [404, 409, 410].includes(response.status)) return { status: response.status, body };
      const reason = safeReason((body as { error?: { errors?: Array<{ reason?: string }> } } | null)?.error?.errors?.[0]?.reason ?? "");
      logError("google.personal", `http_${response.status}${reason ? `_${reason}` : ""}`);
      // 401 i po čerstvém tokenu = token neplatí. Skutečné odvolání pozná už obnova tokenu (`invalid_grant`).
      if (response.status === 401) throw new CalendarError("calendar_revoked", false, reason);
      // 403 neznamená odvolání: Google odmítl jen tuto operaci (např. `insufficientPermissions` u jedné
      // metody). Token i kalendář zůstávají, Wiki to zkusí znovu a uloží si kód důvodu.
      if (response.status === 403) throw new CalendarError(TRANSIENT_403.has(reason) ? "calendar_unavailable" : "calendar_forbidden", true, reason);
      throw new CalendarError("calendar_unavailable", response.status === 429 || response.status >= 500, reason);
    }
  }

  /**
   * Založí prázdný kalendář „Vzdělávání ZBC“ a vrátí jeho ID. Nastavení (barva, připomínky) je
   * samostatný krok `configureCalendar`, aby volající ID uložil dřív, než cokoli dalšího může selhat.
   */
  async insertCalendar(): Promise<string> {
    const { status, body } = await this.request("POST", "/calendars", {
      body: { summary: PERSONAL_CALENDAR_NAME, description: "Akce vzdělávání z firemní Wiki. Spravuje je Wiki, změny dělejte tam.", timeZone: TIME_ZONE },
    });
    const id = (body as { id?: unknown } | null)?.id;
    if (status !== 200 || typeof id !== "string") throw new CalendarError("calendar_unavailable", true);
    return id;
  }

  /** Existuje kalendář ještě a má k němu Wiki přístup? `false` = smazaný (404/410). */
  async calendarExists(calendarId: string): Promise<boolean> {
    const { status } = await this.request("GET", `/calendars/${encodeURIComponent(calendarId)}`);
    return status === 200;
  }

  /**
   * Nastaví položku v seznamu kalendářů uživatele: připomínky, e-mailová upozornění a barvu. Zkouší se od
   * nejúplnějšího nastavení po nejmenší, aby šlo poznat, kterou část Google odmítá. Nic z toho není
   * podmínkou zápisu akcí, proto chyba nikdy nevyletí ven. Vrací i strojový kód každého neúspěchu
   * (`full:403_insufficientPermissions`), který se uloží do `personal_calendars.setup_code` kvůli diagnostice.
   */
  async configureCalendar(calendarId: string): Promise<{ setup: CalendarSetup; failures: string[] }> {
    const path = `/users/me/calendarList/${encodeURIComponent(calendarId)}`;
    const reminders = { defaultReminders: DEFAULT_REMINDERS };
    const notifications = { notificationSettings: { notifications: NOTIFICATIONS } };
    const attempts: Array<[string, CalendarSetup, Record<string, unknown>, boolean]> = [
      ["full", "full", { ...CALENDAR_COLORS, ...reminders, ...notifications }, true],
      ["nocolor", "full", { ...reminders, ...notifications }, false],
      ["basic", "basic", { ...CALENDAR_COLORS, ...reminders }, true],
      ["reminders", "basic", reminders, false],
    ];
    const failures: string[] = [];
    for (const [label, setup, body, colors] of attempts) {
      try {
        const { status } = await this.request("PATCH", path, { query: colors ? { colorRgbFormat: "true" } : {}, body });
        if (status === 200) return { setup, failures };
        failures.push(`${label}:${status}`);
      } catch (error) {
        if (!(error instanceof CalendarError)) throw error;
        // Odvolaný token nemá smysl zkoušet dál, synchronizace ho pozná u první akce.
        if (error.code === "calendar_revoked") return { setup: "none", failures: [...failures, `${label}:401`] };
        failures.push(`${label}:${error.code === "calendar_forbidden" ? "403" : "err"}${error.reason ? `_${error.reason}` : ""}`);
      }
      logError("google.personal", `configure_${failures.at(-1)}`);
    }
    return { setup: "none", failures };
  }

  async deleteCalendar(calendarId: string): Promise<void> {
    await this.request("DELETE", `/calendars/${encodeURIComponent(calendarId)}`);
  }

  /**
   * Zapíše událost s pevným ID. Nová: insert (409 = už existuje, přepíše se). Známá: update celé
   * události (Wiki spravuje všechna pole), 404 = mezitím smazaná, založí se znovu.
   * @returns `calendar_missing`, když uživatel smazal celý kalendář
   */
  async putEvent(calendarId: string, eventId: string, data: ManagedEventData, known: boolean, guest?: string): Promise<"ok" | "calendar_missing"> {
    const body = {
      id: eventId,
      summary: data.summary,
      description: data.description,
      start: { dateTime: data.startsAt.toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: data.endsAt.toISOString(), timeZone: TIME_ZONE },
      status: "confirmed",
      // Připomínky přímo v akci: výchozí připomínky kalendáře Google přes `calendarList.patch` živě odmítá
      // (audit `calendar.personal.setup_none`), zápis akce ale projde. Bez toho by akce neměla žádnou.
      reminders: { useDefault: false, overrides: DEFAULT_REMINDERS.map((r) => ({ ...r })) },
      transparency: "opaque",
      // Zkušební režim `self-invite`: host je jen sám vlastník kalendáře, nic víc nesmí měnit ani vidět.
      ...(guest ? { attendees: [{ email: guest }], guestsCanModify: false, guestsCanInviteOthers: false, guestsCanSeeOtherGuests: false } : {}),
    };
    const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
    const query = { sendUpdates: guest ? "all" : "none" };
    const update = () => this.request("PUT", `${base}/${encodeURIComponent(eventId)}`, { query, body });
    const insert = () => this.request("POST", base, { query, body });
    let result = known ? await update() : await insert();
    if (known && result.status === 404) result = await insert();
    else if (!known && result.status === 409) result = await update();
    if (result.status === 200) return "ok";
    if (result.status === 404) return "calendar_missing";
    throw new CalendarError("calendar_unavailable", true);
  }

  /** Smaže událost. Už smazaná (404, 410) je v pořádku. */
  async deleteEvent(calendarId: string, eventId: string, notify = false): Promise<void> {
    await this.request("DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { query: { sendUpdates: notify ? "all" : "none" } });
  }
}
