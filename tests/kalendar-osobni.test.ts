import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { beginLogin, verifyLoginState } from "@/server/auth/google-login";
import { EVENT_FORMAT, PERSONAL_SCOPE, needsPersonalCalendar, personalSyncNeeded, personalCalendarState, savePersonalGrant, syncPersonalCalendar } from "@/server/calendar/personal";
import { calendarDelivery, config } from "@/server/config";
import { personalCalendarView } from "@/features/vzdelavani/components/PersonalCalendarStatus";
import { statusAdvice } from "@/features/vzdelavani/status";
import { calendarLinks, events, personalCalendarEntries, personalCalendars, users } from "@/server/db/schema";
import type { EventSnapshot } from "@/lib/types";
import { getEventDetail } from "@/server/services/detail";
import { getEventCard } from "@/server/services/events";
import { PUBLISHED_RM, lead, organizer, participant, resetDemo } from "./helpers";

// Osobní kalendář „Vzdělávání ZBC“ s napodobeným HTTP Googlu: založení, zápis bez hostů, opakování,
// odvolání a odebraný účet. Ostré adresy Googlu se nevolají.

const ENV = {
  CALENDAR_MODE: "google-test",
  CALENDAR_DELIVERY: "personal",
  GOOGLE_OAUTH_CLIENT_ID: "c",
  GOOGLE_OAUTH_CLIENT_SECRET: "s",
  GOOGLE_CALENDAR_ID: "primary",
  GOOGLE_ALLOWED_CALENDAR_IDS: "primary",
  GOOGLE_ALLOWED_ATTENDEES: "a@example.com",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  APP_URL: "https://wiki.example.invalid",
};
const saved: Record<string, string | undefined> = {};

type Call = { method: string; url: URL; body: unknown };
type FakeOptions = {
  revoked?: boolean;
  failEvents?: number;
  /** Kolikrát po sobě odpoví `calendarList.patch` 403 `insufficientPermissions`. */
  forbidSetup?: number;
  /** Zápis událostí odpovídá 403 s tímto důvodem. */
  forbidEvents?: string;
  /** Kalendář, který Wiki dřív založila, uživatel mezitím smazal. */
  calendarGone?: boolean;
  /** Kolikrát po sobě odpoví zápis do `calendarList` 401 `authError` (živě 16. 11.: `none|full:401`). */
  unauthorizedSetup?: number;
  /** Položka v seznamu kalendářů je skrytá a nezaškrtnutá. */
  listHidden?: boolean;
  /** Smazání kalendáře odpoví 403 (úklid odebraného účtu). */
  forbidDelete?: boolean;
};
const forbidden = (reason: string) => ({ error: { code: 403, errors: [{ reason }] } });

function fakeGoogle(opts: FakeOptions = {}) {
  const calls: Call[] = [];
  let failures = opts.failEvents ?? 0;
  let setupFailures = opts.forbidSetup ?? 0;
  let setupUnauthorized = opts.unauthorizedSetup ?? 0;
  const json = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status });
  const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = typeof init?.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : init?.body;
    calls.push({ method: init?.method ?? "GET", url, body });
    if (url.pathname === "/token") return opts.revoked ? json(400, { error: "invalid_grant" }) : json(200, { access_token: "at", expires_in: 3600 });
    if (url.pathname === "/revoke") return json(200, {});
    if (url.pathname.endsWith("/calendars") && init?.method === "POST") return json(200, { id: "cal-1" });
    if (url.pathname.includes("/calendarList/")) {
      if ((init?.method ?? "GET") === "GET") return json(200, { kind: "calendar#calendarListEntry", id: "cal-1", accessRole: "owner", ...(opts.listHidden ? { hidden: true } : { selected: true }) });
      if (setupUnauthorized-- > 0) return json(401, { error: { code: 401, status: "UNAUTHENTICATED", errors: [{ reason: "authError" }] } });
      return setupFailures-- > 0 ? json(403, forbidden("insufficientPermissions")) : json(200, {});
    }
    if (/\/calendars\/[^/]+$/.test(url.pathname) && (init?.method ?? "GET") === "GET") return opts.calendarGone ? json(404, {}) : json(200, { id: "cal-1" });
    if (url.pathname.includes("/events")) {
      if (opts.forbidEvents) return json(403, forbidden(opts.forbidEvents));
      if (failures-- > 0) return json(503, {});
      return init?.method === "DELETE" ? json(204, null) : json(200, { id: "x" });
    }
    if (init?.method === "DELETE") return opts.forbidDelete ? json(403, forbidden("forbidden")) : json(204, null);
    return json(404, {});
  }) as typeof fetch;
  return { calls, fetchImpl };
}

let db: Awaited<ReturnType<typeof resetDemo>>;
beforeAll(async () => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  db = await resetDemo();
});
afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const grant = { refreshToken: "rt-secret", scopes: `openid email ${PERSONAL_SCOPE}`, accountEmail: "ucastnik@example.com" };
const clock = () => new Date("2026-11-10T08:00:00Z");

describe("osobní kalendář", () => {
  test("přepínač je výslovný, přihlášení žádá jen calendar.app.created", () => {
    expect(calendarDelivery()).toBe("personal");
    const cfg = { clientId: "c", clientSecret: "s", redirectUri: "https://x/cb", accounts: new Map<string, string>() };
    const { url, cookieValue } = beginLogin(cfg, undefined, { calendar: "personal" });
    const q = new URL(url).searchParams;
    expect(q.get("scope")?.split(" ")).toEqual(["openid", "email", "profile", PERSONAL_SCOPE]);
    expect(q.get("access_type")).toBe("offline");
    expect(verifyLoginState(cookieValue, q.get("state"))?.calendar).toBe("personal");
  });

  test("souhlas uloží jen šifrovaný token, synchronizace založí kalendář a zapíše akce bez hostů", async () => {
    expect(await needsPersonalCalendar(db, participant.id)).toBe(true);
    await savePersonalGrant(db, participant.id, grant);
    const [row] = await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row!.encryptedRefreshToken).not.toContain("rt-secret");
    const google = fakeGoogle();
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: google.fetchImpl, clock })).toBe("synced");
    // Nejdřív `calendarList.get` (je kalendář v seznamu a vidět?), pak `calendarList.update` s celou položkou.
    const [get, update] = google.calls.filter((c) => c.url.pathname.includes("/calendarList/"));
    expect(get!.method).toBe("GET");
    expect(update!.method).toBe("PUT");
    expect(update!.body).toMatchObject({ id: "cal-1", selected: true, hidden: false });
    expect((update!.body as { notificationSettings: { notifications: unknown[] } }).notificationSettings.notifications).toHaveLength(4);
    const writes = google.calls.filter((c) => c.url.pathname.includes("/events"));
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      expect(w.url.searchParams.get("sendUpdates")).toBe("none");
      expect((w.body as { attendees?: unknown }).attendees).toBeUndefined();
      if (w.method !== "DELETE") expect((w.body as { reminders: unknown }).reminders).toEqual({ useDefault: false, overrides: [{ method: "email", minutes: 10080 }, { method: "email", minutes: 1440 }, { method: "popup", minutes: 60 }, { method: "popup", minutes: 30 }, { method: "popup", minutes: 10 }] });
    }
    expect(await needsPersonalCalendar(db, participant.id)).toBe(false);
    // Druhý běh bez změn nic nezapisuje, jen obnoví token (pozná tak odvolání přístupu).
    const idle = fakeGoogle();
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: idle.fetchImpl, clock })).toBe("synced");
    expect(idle.calls.map((c) => c.url.pathname)).toEqual(["/token"]);
  });

  test("změna skupiny smaže akce, které už uživateli nepatří", async () => {
    const before = await db.select().from(personalCalendarEntries).where(eq(personalCalendarEntries.userId, participant.id));
    await db.update(users).set({ groups: ["vsichni"] }).where(eq(users.id, participant.id));
    const google = fakeGoogle();
    await syncPersonalCalendar(db, participant.id, { fetchImpl: google.fetchImpl, clock });
    const after = await db.select().from(personalCalendarEntries).where(eq(personalCalendarEntries.userId, participant.id));
    expect(after.length).toBeLessThan(before.length);
    expect(google.calls.some((c) => c.method === "DELETE" && c.url.searchParams.get("sendUpdates") === "none")).toBe(true);
    await db.update(users).set({ groups: participant.groups }).where(eq(users.id, participant.id));
  });

  test("výpadek Googlu nechá stav aktivní k opakování, odvolání přepne na „odvoláno“ a smaže token", async () => {
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: fakeGoogle({ failEvents: 1 }).fetchImpl, clock })).toBe("retry");
    expect((await personalCalendarState(db, participant.id)).retrying).toBe(true);
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: fakeGoogle({ revoked: true }).fetchImpl, clock })).toBe("revoked");
    const [row] = await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row!.status).toBe("revoked");
    expect(row!.encryptedRefreshToken).toBe("");
    expect(await needsPersonalCalendar(db, participant.id)).toBe(true);
  });

  test("souběžný běh pod zámkem se přeskočí, vypnutý účet přijde o kalendář i token", async () => {
    await savePersonalGrant(db, participant.id, grant);
    const google = fakeGoogle();
    const [a, b] = await Promise.all([
      syncPersonalCalendar(db, participant.id, { fetchImpl: google.fetchImpl, clock }),
      syncPersonalCalendar(db, participant.id, { fetchImpl: google.fetchImpl, clock }),
    ]);
    expect([a, b].sort()).toEqual(["skipped", "synced"]);
    await db.update(users).set({ status: "disabled" }).where(eq(users.id, participant.id));
    // Google smazání kalendáře odmítne: token zůstane, řádek čeká na další pokus.
    const refused = fakeGoogle({ forbidDelete: true });
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: refused.fetchImpl, clock })).toBe("retry");
    expect(refused.calls.some((c) => c.url.pathname === "/revoke")).toBe(false);
    const [kept] = await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(kept).toMatchObject({ status: "removal_failed", errorCode: "forbidden_forbidden" });
    expect(kept!.encryptedRefreshToken).not.toBe("");
    expect(await personalSyncNeeded(db)).toBe(true);
    const removal = fakeGoogle();
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: removal.fetchImpl, clock })).toBe("removed");
    expect(removal.calls.some((c) => c.url.pathname === "/revoke")).toBe(true);
    expect(await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id))).toHaveLength(0);
  });

  test("403 u nastavení seznamu kalendářů není odvolání: kalendář se uloží a akce se zapíšou", async () => {
    await db.update(users).set({ status: "active" }).where(eq(users.id, participant.id));
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await savePersonalGrant(db, participant.id, grant);
    const google = fakeGoogle({ forbidSetup: 1 });
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: google.fetchImpl, clock })).toBe("synced");
    const writes = google.calls.filter((c) => c.url.pathname.includes("/calendarList/") && c.method !== "GET");
    // Odmítnutý `update` → `patch` se vším, upozornění i připomínky zůstávají.
    expect(writes.map((c) => c.method)).toEqual(["PUT", "PATCH"]);
    expect((writes[1]!.body as { notificationSettings?: unknown }).notificationSettings).toBeDefined();
    const [row] = await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row).toMatchObject({ status: "active", calendarId: "cal-1", errorCode: null, setupCode: "full|list:200|update:403_insufficientPermissions" });
    expect(row!.encryptedRefreshToken).not.toBe("");
    expect(google.calls.some((c) => c.url.pathname.includes("/events"))).toBe(true);
  });

  test("odmítnuté nastavení kalendáře uloží strojový důvod každého pokusu, akce se přesto zapíšou", async () => {
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await savePersonalGrant(db, participant.id, grant);
    const google = fakeGoogle({ forbidSetup: 5 });
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: google.fetchImpl, clock })).toBe("synced");
    const [row] = await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row!.setupCode).toBe(["none", "list:200", ...["update", "full", "nocolor", "basic", "reminders"].map((l) => `${l}:403_insufficientPermissions`)].join("|"));
    expect(row!.setupCode).not.toContain("ucastnik");
    expect(google.calls.some((c) => c.url.pathname.includes("/events"))).toBe(true);
  });

  test("nasazení nové podoby akcí samo spustí přepis všech akcí a nové nastavení kalendáře", async () => {
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await savePersonalGrant(db, participant.id, grant);
    await syncPersonalCalendar(db, participant.id, { fetchImpl: fakeGoogle().fetchImpl });
    expect(await personalSyncNeeded(db)).toBe(false);
    const entries = await db.select().from(personalCalendarEntries).where(eq(personalCalendarEntries.userId, participant.id));
    expect(entries.length).toBeGreaterThan(0);
    // Stav jako v produkci před nasazením: akce zapsané starší podobou, kalendář srovnaný starou verzí.
    await db.update(personalCalendarEntries).set({ dataHash: "stary-otisk" });
    await db.update(personalCalendars).set({ eventFormat: EVENT_FORMAT - 1 });
    expect(await personalSyncNeeded(db)).toBe(true);
    const google = fakeGoogle();
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: google.fetchImpl })).toBe("synced");
    expect(google.calls.filter((c) => c.url.pathname.includes("/calendarList/")).map((c) => c.method)).toEqual(["GET", "PUT"]);
    expect(google.calls.filter((c) => c.url.pathname.includes("/events") && c.method !== "DELETE")).toHaveLength(entries.length);
    const [row] = await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row!.eventFormat).toBe(EVENT_FORMAT);
    expect(await personalSyncNeeded(db)).toBe(false);
  });

  test("zkušební režim self-invite: host je jen účet vlastníka, Google pošle e-mail o změně i zrušení", async () => {
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await savePersonalGrant(db, participant.id, grant);
    process.env.CALENDAR_PERSONAL_NOTIFY = "self-invite";
    try {
      const google = fakeGoogle();
      expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: google.fetchImpl })).toBe("synced");
      const writes = google.calls.filter((c) => c.url.pathname.includes("/events"));
      expect(writes.length).toBeGreaterThan(0);
      for (const w of writes) {
        expect(w.url.searchParams.get("sendUpdates")).toBe("all");
        expect(w.body).toMatchObject({ attendees: [{ email: "ucastnik@example.com" }], guestsCanModify: false, guestsCanSeeOtherGuests: false });
      }
      // Akce, která uživateli přestala patřit, se smaže s upozorněním (e-mail o zrušení).
      const [entry] = await db.select().from(personalCalendarEntries).where(eq(personalCalendarEntries.userId, participant.id)).limit(1);
      await db.insert(personalCalendarEntries).values({ userId: participant.id, eventId: "zrusena-akce", externalEventId: "ext-zrusena", dataHash: entry!.dataHash });
      await db.update(personalCalendars).set({ syncRequestedAt: new Date(Date.now() + 60_000) });
      const again = fakeGoogle();
      await syncPersonalCalendar(db, participant.id, { fetchImpl: again.fetchImpl });
      const deletion = again.calls.find((c) => c.method === "DELETE" && c.url.pathname.endsWith("/ext-zrusena"))!;
      expect(deletion.url.searchParams.get("sendUpdates")).toBe("all");
    } finally {
      delete process.env.CALENDAR_PERSONAL_NOTIFY;
    }
    // Vypnutí režimu přepíše akce zpět bez hosta a bez e-mailů.
    const off = fakeGoogle();
    await db.update(personalCalendars).set({ syncRequestedAt: new Date(Date.now() + 120_000) });
    await syncPersonalCalendar(db, participant.id, { fetchImpl: off.fetchImpl });
    const rewrites = off.calls.filter((c) => c.url.pathname.includes("/events"));
    expect(rewrites.length).toBeGreaterThan(0);
    for (const w of rewrites) {
      expect(w.url.searchParams.get("sendUpdates")).toBe("none");
      expect((w.body as { attendees?: unknown }).attendees).toBeUndefined();
    }
  });

  test("403 insufficientPermissions u akcí nechá token i kalendář a ukáže „Nedaří se zapsat“, ne odvolání", async () => {
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await savePersonalGrant(db, participant.id, grant);
    const google = fakeGoogle({ forbidEvents: "insufficientPermissions" });
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: google.fetchImpl, clock })).toBe("retry");
    const [row] = await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row).toMatchObject({ status: "active", calendarId: "cal-1", errorCode: "forbidden_insufficientPermissions" });
    expect(row!.encryptedRefreshToken).not.toBe("");
    const state = await personalCalendarState(db, participant.id);
    expect(state).toMatchObject({ status: "active", blocked: true, retrying: false });
    expect(await needsPersonalCalendar(db, participant.id)).toBe(false);
    // Další běh kalendář nezakládá znovu, jen dopíše akce.
    const retry = fakeGoogle();
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: retry.fetchImpl, clock })).toBe("synced");
    expect(retry.calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith("/calendars"))).toHaveLength(0);
    expect((await personalCalendarState(db, participant.id)).blocked).toBe(false);
  });

  test("opakované propojení stejného účtu použije dřívější kalendář, smazaný nahradí jedním novým", async () => {
    // Po odvolání a novém souhlasu: uložený kalendář existuje → žádný druhý „Vzdělávání ZBC“.
    await db.update(personalCalendars).set({ status: "revoked", errorCode: "calendar_revoked", encryptedRefreshToken: "" }).where(eq(personalCalendars.userId, participant.id));
    await savePersonalGrant(db, participant.id, grant);
    const again = fakeGoogle();
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: again.fetchImpl, clock })).toBe("synced");
    expect(again.calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith("/calendars"))).toHaveLength(0);
    expect(again.calls.some((c) => c.method === "GET" && c.url.pathname.endsWith("/calendars/cal-1"))).toBe(true);
    // Uživatel kalendář mezitím smazal: nový souhlas založí právě jeden nový a akce zapíše znovu.
    await savePersonalGrant(db, participant.id, grant);
    const gone = fakeGoogle({ calendarGone: true });
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: gone.fetchImpl, clock })).toBe("synced");
    expect(gone.calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith("/calendars"))).toHaveLength(1);
    expect(gone.calls.filter((c) => c.method === "POST" && c.url.pathname.includes("/events")).length).toBeGreaterThan(0);
    const [row] = await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row).toMatchObject({ status: "active", calendarId: "cal-1" });
  });

  test("401 na zápisu do seznamu kalendářů není odvolání: zkusí se další varianty a akce se zapíšou", async () => {
    // Živě 16. 11.: `setup_code = none|full:401`, zápis akcí stejným tokenem prošel. Dřív se po prvním 401
    // skončilo bez důvodu a nastavení (upozornění, viditelnost) se už nikdy nezkusilo jinak.
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await savePersonalGrant(db, participant.id, grant);
    // `update` i první `patch`: 401, nový token, znovu 401. Druhý `patch` (bez barvy) projde.
    const google = fakeGoogle({ unauthorizedSetup: 4 });
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: google.fetchImpl, clock })).toBe("synced");
    const [row] = await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row).toMatchObject({ status: "active", calendarId: "cal-1", errorCode: null, setupCode: "full|list:200|update:401_authError|full:401_authError" });
    expect(row!.encryptedRefreshToken).not.toBe("");
    // Po 401 se token obnoví, teprve druhé 401 se zapíše.
    expect(google.calls.filter((c) => c.url.pathname === "/token").length).toBeGreaterThanOrEqual(3);
    expect(google.calls.some((c) => c.url.pathname.includes("/events"))).toBe(true);
    expect((await personalCalendarState(db, participant.id)).status).toBe("active");
  });

  test("skrytý kalendář v seznamu kalendářů se zviditelní a zaškrtne", async () => {
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await savePersonalGrant(db, participant.id, grant);
    const google = fakeGoogle({ listHidden: true });
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: google.fetchImpl, clock })).toBe("synced");
    const update = google.calls.find((c) => c.url.pathname.includes("/calendarList/") && c.method === "PUT")!;
    expect(update.body).toMatchObject({ selected: true, hidden: false });
    const [row] = await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row!.setupCode).toBe("full|list:200_hidden_unselected");
  });

  test("odvolání v účtu Google pozná Wiki i bez změny akcí, nové připojení vše obnoví bez duplicit", async () => {
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await savePersonalGrant(db, participant.id, grant);
    const t0 = new Date("2026-11-10T08:00:00Z");
    await syncPersonalCalendar(db, participant.id, { fetchImpl: fakeGoogle().fetchImpl, clock: () => t0 });
    const entries = await db.select().from(personalCalendarEntries).where(eq(personalCalendarEntries.userId, participant.id));
    expect(entries.length).toBeGreaterThan(0);
    // Úvod spustí kontrolu bez změn až po 10 minutách od posledního běhu.
    await db.update(personalCalendars).set({ syncedAt: new Date(Date.now() - 5 * 60_000), syncRequestedAt: new Date(Date.now() - 6 * 60_000) });
    expect(await personalSyncNeeded(db)).toBe(false);
    await db.update(personalCalendars).set({ syncedAt: new Date(Date.now() - 11 * 60_000), syncRequestedAt: new Date(Date.now() - 12 * 60_000) });
    expect(await personalSyncNeeded(db)).toBe(true);
    // Uživatel odebral přístup v účtu Google: kontrola to pozná, i když se v akcích nic nezměnilo.
    const later = () => new Date(t0.getTime() + 11 * 60_000);
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: fakeGoogle({ revoked: true }).fetchImpl, clock: later })).toBe("revoked");
    const state = await personalCalendarState(db, participant.id);
    expect(state.status).toBe("revoked");
    expect(personalCalendarView(state)).toMatchObject({ badge: "Kalendář odpojen", action: "Připojit Kalendář znovu" });
    expect(await needsPersonalCalendar(db, participant.id)).toBe(true);
    // Nové připojení (callback uloží nový token): stejný kalendář, žádný nový, akce se nepřidají podruhé.
    await savePersonalGrant(db, participant.id, { ...grant, refreshToken: "rt-nove" });
    const reconnect = fakeGoogle();
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: reconnect.fetchImpl, clock: later })).toBe("synced");
    expect(reconnect.calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith("/calendars"))).toHaveLength(0);
    expect(reconnect.calls.filter((c) => c.method === "POST" && c.url.pathname.includes("/events"))).toHaveLength(0);
    const token = reconnect.calls.find((c) => c.url.pathname === "/token")!;
    expect(String(token.body)).toContain("refresh_token=rt-nove");
    const [row] = await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row).toMatchObject({ status: "active", calendarId: "cal-1", errorCode: null });
    expect(await db.select().from(personalCalendarEntries).where(eq(personalCalendarEntries.userId, participant.id))).toHaveLength(entries.length);
  });
});

describe("stav akce v osobním režimu", () => {
  const personalRow = (userId: string, values: Partial<typeof personalCalendars.$inferInsert> = {}) => ({
    userId,
    orgId: config.orgId,
    accountEmail: `${userId}@example.com`,
    encryptedRefreshToken: "",
    scopes: PERSONAL_SCOPE,
    calendarId: "cal-1",
    status: "active" as const,
    syncedAt: new Date("2026-11-10T07:00:00Z"),
    ...values,
  });

  async function detailWithoutGoogle() {
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const detail = await getEventDetail(organizer, PUBLISHED_RM);
      return { detail: detail!, calls: fetchSpy.mock.calls.length };
    } finally {
      vi.unstubAllGlobals();
    }
  }

  test("chybějící vazba: kalendář organizátora se nevolá, nenabízí se pozvánka ani párování, nic se netvrdí", async () => {
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await db.delete(calendarLinks).where(eq(calendarLinks.eventId, PUBLISHED_RM));
    const { detail, calls } = await detailWithoutGoogle();
    expect(calls).toBe(0);
    const sync = detail.sync!;
    expect(sync.personal).toBe(true);
    expect(sync.status).toBe("personal");
    expect(sync.status).not.toBe("synced");
    expect(sync.candidates).toEqual([]);
    expect(sync.unlinkedReason).toBeNull();
    expect(sync.calendarUnavailable).toBe(false);
    expect(sync.calendarErrorCode).toBeNull();
    expect(sync.external).toBeNull();
    expect(sync.legacyInviteId).toBeNull();
    // Bez propojených kalendářů není zapsáno nikde a nikdo není „v chybě“.
    expect(sync.personalDelivery).toMatchObject({ expected: true, written: 0, current: 0, outdated: 0, missing: 0, failing: [] });
    expect(sync.personalDelivery!.notConnected).toBe(sync.personalDelivery!.audience);

    const found = await getEventCard(organizer, PUBLISHED_RM);
    expect(found!.card.syncStatus).toBe("personal");
    expect(statusAdvice(found!.card)).toBeNull();
  });

  test("evidence zápisu: zapsané kalendáře, čekající a chyby jednotlivých lidí zvlášť", async () => {
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await db.insert(personalCalendars).values([
      personalRow(organizer.id),
      personalRow(lead.id, { errorCode: "forbidden_insufficientPermissions" }),
    ]);
    await db.insert(personalCalendarEntries).values({ userId: organizer.id, eventId: PUBLISHED_RM, externalEventId: "x", dataHash: "h" });
    const { detail, calls } = await detailWithoutGoogle();
    expect(calls).toBe(0);
    const delivery = detail.sync!.personalDelivery!;
    expect(delivery.written).toBe(1);
    // Otisk „h“ neodpovídá současné podobě akce: zapsáno je, ale zastarale.
    expect(delivery).toMatchObject({ current: 0, outdated: 1, missing: 0 });
    expect(delivery.failing).toEqual([{ name: expect.any(String), reason: "blocked" }]);
    expect(delivery.notConnected).toBe(delivery.audience - 2);
    expect(delivery.lastSyncedAt).toBe("2026-11-10T07:00:00.000Z");
    // Záznamy jiných akcí ani lidí mimo publikum se nepočítají.
    await db.insert(personalCalendars).values(personalRow(participant.id));
    await db.insert(personalCalendarEntries).values({ userId: participant.id, eventId: PUBLISHED_RM, externalEventId: "y", dataHash: "h" });
    expect((await detailWithoutGoogle()).detail.sync!.personalDelivery!.written).toBe(1);
  });

  test("změna termínu před synchronizací: zápis je zastaralý, po synchronizaci znovu aktuální", async () => {
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await savePersonalGrant(db, organizer.id, { ...grant, accountEmail: "organizator@example.com" });
    expect(await syncPersonalCalendar(db, organizer.id, { fetchImpl: fakeGoogle().fetchImpl, clock })).toBe("synced");
    const fresh = (await detailWithoutGoogle()).detail.sync!.personalDelivery!;
    expect(fresh).toMatchObject({ written: 1, current: 1, outdated: 0, missing: 0, failing: [] });

    const [event] = await db.select({ published: events.published }).from(events).where(eq(events.id, PUBLISHED_RM));
    const original = event!.published as EventSnapshot;
    const shift = (iso: string) => new Date(new Date(iso).getTime() + 3600_000).toISOString();
    await db.update(events).set({ published: { ...original, startsAt: shift(original.startsAt), endsAt: shift(original.endsAt) } }).where(eq(events.id, PUBLISHED_RM));
    try {
      const stale = await detailWithoutGoogle();
      expect(stale.calls).toBe(0);
      expect(stale.detail.sync!.personalDelivery).toMatchObject({ written: 1, current: 0, outdated: 1, missing: 0 });

      const google = fakeGoogle();
      expect(await syncPersonalCalendar(db, organizer.id, { fetchImpl: google.fetchImpl, clock })).toBe("synced");
      expect(google.calls.some((c) => c.method === "PUT" && c.url.pathname.includes("/events"))).toBe(true);
      expect((await detailWithoutGoogle()).detail.sync!.personalDelivery).toMatchObject({ written: 1, current: 1, outdated: 0 });
    } finally {
      await db.update(events).set({ published: original }).where(eq(events.id, PUBLISHED_RM));
    }
  });

  test("propojený kalendář bez zápisu akce je chybějící, ne zapsaný", async () => {
    await db.delete(personalCalendars);
    await db.delete(personalCalendarEntries);
    await db.insert(personalCalendars).values(personalRow(organizer.id));
    expect((await detailWithoutGoogle()).detail.sync!.personalDelivery).toMatchObject({ written: 0, current: 0, outdated: 0, missing: 1, failing: [] });
  });

  test("starší pozvánka organizátora je jen historická informace, Google se nevolá", async () => {
    await db.delete(calendarLinks).where(eq(calendarLinks.eventId, PUBLISHED_RM));
    await db.insert(calendarLinks).values({ eventId: PUBLISHED_RM, calendarId: "primary", externalEventId: "stara-pozvanka", syncedRevision: 1, syncStatus: "attention", errorCode: "calendar_unavailable", attempts: 3 });
    const { detail, calls } = await detailWithoutGoogle();
    expect(calls).toBe(0);
    expect(detail.sync).toMatchObject({ status: "personal", legacyInviteId: "stara-pozvanka", errorCode: null, external: null, candidates: [] });
    // Stará chyba vazby se v osobním režimu nehlásí jako chyba akce.
    const found = await getEventCard(organizer, PUBLISHED_RM);
    expect(found!.card.syncStatus).toBe("personal");
    await db.delete(calendarLinks).where(eq(calendarLinks.eventId, PUBLISHED_RM));
  });
});
