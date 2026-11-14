import { createHash } from "node:crypto";
import type { SimAttendee } from "@/lib/types";
import { logError } from "@/server/audit";
import type { AccessTokenSource, FetchLike } from "./google-auth";
import { CalendarError, type CalendarProvider, type ExternalEvent, type GuestChange, type ManagedEventData } from "./provider";

// Adaptér Google Calendar API v3 pro testovací režim. Zatím ověřený jen proti napodobenému HTTP
// v tests/google-calendar.test.ts, živý test podle zadání (část 02) čeká na testovací účty.

const API = "https://www.googleapis.com/calendar/v3";
const TIMEOUT_MS = 10_000;
const TIME_ZONE = "Europe/Prague";
/** Soukromá vlastnost události se stabilním klíčem vytvoření. Pozvaní ji nevidí. */
const KEY_PROPERTY = "zbcKey";

type GoogleDate = { dateTime?: string; date?: string; timeZone?: string };
type GoogleEvent = {
  id: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: GoogleDate;
  end?: GoogleDate;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: GoogleDate;
  organizer?: { email?: string; self?: boolean };
  /** Další pole hosta (komentář, počet doprovodu) se při úpravě hostů posílají zpět beze změny. */
  attendees?: Array<Record<string, unknown> & { email?: string; displayName?: string; responseStatus?: string; resource?: boolean }>;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
};

export type GoogleCalendarOptions = {
  tokens: AccessTokenSource;
  allowedCalendarIds: readonly string[];
  /** Přesné adresy testovacích příjemců malými písmeny. `null`: hosty určuje publikum akce ve Wiki. */
  allowedAttendees: readonly string[] | null;
  fetchImpl?: FetchLike;
};

/**
 * ID události odvozené z klíče vytvoření. Google přijímá vlastní ID ze znaků base32hex,
 * (a až v, 0 až 9), hexadecimální otisk i prefix jsou jejich podmnožinou. Opakované vytvoření tak skončí 409 a duplicita nevznikne.
 */
export const eventIdForKey = (key: string) => `akce${createHash("sha256").update(key).digest("hex").slice(0, 40)}`;

const RESPONSES = new Set(["needsAction", "accepted", "declined", "tentative"]);
const TRANSIENT_403 = new Set(["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded", "backendError"]);

const toDate = (value: GoogleDate | undefined): Date | null => {
  const raw = value?.dateTime ?? value?.date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

function toExternal(event: GoogleEvent): ExternalEvent | null {
  const startsAt = toDate(event.start);
  const endsAt = toDate(event.end);
  if (!startsAt || !endsAt) return null;
  return {
    id: event.id,
    summary: event.summary ?? "",
    description: event.description ?? "",
    startsAt,
    endsAt,
    cancelled: event.status === "cancelled",
    attendees: (event.attendees ?? [])
      .filter((a) => a.email && !a.resource)
      .map((a) => ({
        email: a.email!,
        name: a.displayName ?? a.email!,
        responseStatus: (RESPONSES.has(a.responseStatus ?? "") ? a.responseStatus : "needsAction") as SimAttendee["responseStatus"],
      })),
    meetingUrl: event.hangoutLink ?? event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? null,
    recurringEventId: event.recurringEventId ?? null,
    originalStartTime: toDate(event.originalStartTime),
  };
}

/** Jen spravovaná pole. Hosté, RSVP ani konferenční údaje se v těle nikdy neposílají, takže zůstanou. */
const managedBody = (data: ManagedEventData) => ({
  summary: data.summary,
  description: data.description,
  start: { dateTime: data.startsAt.toISOString(), timeZone: TIME_ZONE },
  end: { dateTime: data.endsAt.toISOString(), timeZone: TIME_ZONE },
  status: data.cancelled ? "cancelled" : "confirmed",
});

export class GoogleCalendar implements CalendarProvider {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: GoogleCalendarOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private assertCalendar(calendarId: string): void {
    if (!this.options.allowedCalendarIds.includes(calendarId)) throw new CalendarError("calendar_not_allowed", false);
  }

  /** Druhá kontrola příjemců těsně před zápisem. První dělá synchronizace při sestavení seznamu. */
  private assertAttendees(attendees: readonly SimAttendee[]): void {
    const allowed = this.options.allowedAttendees;
    if (!allowed) return;
    if (attendees.some((a) => !allowed.includes(a.email.toLowerCase()))) throw new CalendarError("attendee_not_allowed", false);
  }

  private async request(
    method: "GET" | "POST" | "PATCH",
    calendarId: string,
    path: string,
    init: { query?: Record<string, string>; body?: unknown; ifMatch?: string } = {},
  ): Promise<{ status: number; body: unknown }> {
    this.assertCalendar(calendarId);
    const url = new URL(`${API}/calendars/${encodeURIComponent(calendarId)}/events${path}`);
    for (const [name, value] of Object.entries(init.query ?? {})) url.searchParams.set(name, value);

    for (let attempt = 0; ; attempt += 1) {
      const token = await this.options.tokens.get(attempt > 0);
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            accept: "application/json",
            ...(init.body ? { "content-type": "application/json" } : {}),
            ...(init.ifMatch ? { "if-match": init.ifMatch } : {}),
          },
          body: init.body ? JSON.stringify(init.body) : undefined,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        // Síťová chyba nebo vypršení času. Výsledek zápisu je nejasný, opakování řeší synchronizace.
        throw new CalendarError("calendar_unavailable", true);
      }
      // Prošlý přístupový token: jednou ho obnovíme. Odvolaný přístup ohlásí až zdroj tokenů.
      if (response.status === 401 && attempt === 0) continue;
      const body: unknown = await response.json().catch(() => null);
      if (response.ok || [404, 409, 410, 412].includes(response.status)) return { status: response.status, body };
      throw this.toError(response.status, body);
    }
  }

  private toError(status: number, body: unknown): CalendarError {
    const reason = (body as { error?: { errors?: Array<{ reason?: string }> } } | null)?.error?.errors?.[0]?.reason ?? "";
    // Do logu jde jen stav a strojový důvod, nikdy text odpovědi ani obsah události.
    logError("google.calendar", `http_${status}${reason ? `_${reason}` : ""}`);
    if (status === 401) return new CalendarError("calendar_revoked", false);
    if (status === 403) return TRANSIENT_403.has(reason) ? new CalendarError("calendar_unavailable", true) : new CalendarError("calendar_revoked", false);
    if (status === 429 || status >= 500) return new CalendarError("calendar_unavailable", true);
    return new CalendarError("calendar_unavailable", false);
  }

  private async getRaw(calendarId: string, eventId: string): Promise<GoogleEvent | null> {
    const { status, body } = await this.request("GET", calendarId, `/${encodeURIComponent(eventId)}`);
    return status === 200 ? (body as GoogleEvent) : null;
  }

  async get(calendarId: string, eventId: string): Promise<ExternalEvent | null> {
    const event = await this.getRaw(calendarId, eventId);
    return event ? toExternal(event) : null;
  }

  async findByKey(calendarId: string, key: string): Promise<ExternalEvent | null> {
    // ID je z klíče odvozené, takže stačí přímé čtení. Na rozdíl od hledání je okamžitě konzistentní.
    return this.get(calendarId, eventIdForKey(key));
  }

  async create(calendarId: string, key: string, data: ManagedEventData, attendees: SimAttendee[]): Promise<ExternalEvent> {
    this.assertAttendees(attendees);

    const id = eventIdForKey(key);
    const { status, body } = await this.request("POST", calendarId, "", {
      query: { sendUpdates: "all" },
      body: {
        id,
        ...managedBody({ ...data, cancelled: false }),
        attendees: attendees.map((a) => ({ email: a.email, displayName: a.name })),
        extendedProperties: { private: { [KEY_PROPERTY]: id } },
        guestsCanModify: false,
      },
    });
    const created = status === 200 ? toExternal(body as GoogleEvent) : status === 409 ? await this.get(calendarId, id) : null;
    if (!created) throw new CalendarError("calendar_unavailable", status === 409);
    // Akce zrušená ještě před prvním propsáním: pozvánka vznikne a hned se zruší stejnou cestou jako jindy.
    return data.cancelled && !created.cancelled ? this.patch(calendarId, created.id, data) : created;
  }

  async patch(calendarId: string, eventId: string, data: ManagedEventData, guests?: GuestChange): Promise<ExternalEvent> {
    if (guests) this.assertAttendees(guests.add);
    const current = await this.getRaw(calendarId, eventId);
    if (!current) throw new CalendarError("calendar_missing", false);
    // Hlavní událost série nese pravidlo opakování. Zápis do ní by změnil všechny termíny.
    if (current.recurrence?.length) throw new CalendarError("calendar_series_master", false);
    // Změna kopie u pozvaného by se nepropsala ostatním. Wiki upravuje jen originál správce.
    if (current.organizer && current.organizer.self !== true) throw new CalendarError("calendar_not_organizer", false);

    const { status, body } = await this.request("PATCH", calendarId, `/${encodeURIComponent(eventId)}`, {
      query: { sendUpdates: "all" },
      body: {
        ...managedBody(data),
        // Seznam hostů Google nahrazuje celý. Stávající hosté se proto posílají zpět tak, jak přišli
        // (včetně odpovědí), jen bez odebraných a s přidanými. Bez změny hostů se pole neposílá vůbec.
        ...(guests && (guests.add.length || guests.remove.length)
          ? {
              attendees: [
                ...(current.attendees ?? []).filter((a) => !guests.remove.includes((a.email ?? "").toLowerCase())),
                ...guests.add.map((a) => ({ email: a.email, displayName: a.name })),
              ],
            }
          : {}),
      },
      // Podmíněný zápis: změna provedená mezi čtením a zápisem se nepřepíše, další pokus ji uvidí.
      ifMatch: current.etag,
    });
    if (status === 412 || status === 409) throw new CalendarError("calendar_unavailable", true);
    const patched = status === 200 ? toExternal(body as GoogleEvent) : null;
    if (!patched) throw new CalendarError("calendar_missing", false);
    return patched;
  }

  async listBetween(calendarId: string, from: Date, to: Date): Promise<ExternalEvent[]> {
    const { status, body } = await this.request("GET", calendarId, "", {
      query: {
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        // Opakované události rozbalené na výskyty, aby šlo spárovat konkrétní termín.
        singleEvents: "true",
        showDeleted: "false",
        orderBy: "startTime",
        maxResults: "50",
      },
    });
    if (status !== 200) throw new CalendarError("calendar_missing", false);
    const items = (body as { items?: GoogleEvent[] }).items ?? [];
    return items
      // Celodenní události a kopie cizích pozvánek nejsou kandidáty: Wiki mění jen originál správce.
      .filter((event) => event.start?.dateTime && (!event.organizer || event.organizer.self === true))
      .map(toExternal)
      .filter((event): event is ExternalEvent => event !== null);
  }
}
