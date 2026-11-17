import { randomBytes } from "node:crypto";
import { eq, ne } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { GoogleCalendar, eventIdForKey } from "@/server/calendar/google";
import {
  beginAuthorization,
  needsCalendarConnection,
  clearAccessTokenCache,
  calendarLoginHint,
  completeAuthorization,
  isAllowedCalendarAccount,
  connectionStatus,
  disconnect,
  storedAccessToken,
  verifyAuthorizationState,
  type AccessTokenSource,
} from "@/server/calendar/google-auth";
import { CalendarError, type ManagedEventData } from "@/server/calendar/provider";
import { linkPublishedWithoutInvite, looksLikeSameInvite, mergeDescription, pairWithExisting, pairingCandidates, requestNewInvite, probeTargetCalendar, resumeAfterReconnect, syncAfterReconnect, syncEvent, syncPending, syncPublished } from "@/server/calendar/sync";
import { googleCalendarConfig, googleCalendarConfigProblems } from "@/server/config";
import { getDb } from "@/server/db/client";
import { calendarLinks, integrationCredentials, users } from "@/server/db/schema";
import { calendarSummary, snapshotOf } from "@/server/domain/snapshot";
import { openSecret, sealSecret } from "@/server/integrations/secret-box";
import { formValuesOf, getEventDetail } from "@/server/services/detail";
import { loadEventRow, updateEvent, type EventInput } from "@/server/services/events";
import { inviteUser, updateAccess } from "@/server/services/users";
import { listTasks } from "@/server/services/journey";
import { PUBLISHED_RM, admin, organizer, participant, resetDemo } from "./helpers";

// Adaptér Google Kalendáře proti napodobenému HTTP. Ověřuje tvar požadavků a chování Wiki,
// NE skutečné chování Googlu. Živý test podle zadání (část 02) tyto testy nenahrazují.

import { CALENDAR, FakeGoogle, RECIPIENT } from "./fake-google";

const data = (change: Partial<ManagedEventData> = {}): ManagedEventData => ({
  summary: "Trénink RM: Rozbor",
  description: "Podrobnosti ve Wiki",
  startsAt: new Date("2026-11-19T08:00:00Z"),
  endsAt: new Date("2026-11-19T10:00:00Z"),
  cancelled: false,
  ...change,
});

const errorCode = (promise: Promise<unknown>) =>
  promise.then(() => "ok", (e: unknown) => (e instanceof CalendarError ? `${e.code}:${e.transient ? "transient" : "permanent"}` : String(e)));

function adapter(google: FakeGoogle) {
  const tokens: AccessTokenSource = { get: async () => google.issueAccessToken() };
  return new GoogleCalendar({ tokens, allowedCalendarIds: [CALENDAR], allowedAttendees: [RECIPIENT], fetchImpl: google.fetch });
}

/** Opakovaná série se třemi týdenními výskyty, každý s hostem, RSVP a odkazem na schůzku. */
function putSeries(google: FakeGoogle) {
  google.put({
    id: "serie1",
    summary: "Trénink RM",
    start: { dateTime: "2026-11-05T09:00:00+01:00" },
    end: { dateTime: "2026-11-05T11:00:00+01:00" },
    recurrence: ["RRULE:FREQ=WEEKLY;COUNT=3"],
  });
  for (const day of ["05", "12", "19"]) {
    google.put({
      id: `serie1_202611${day}T080000Z`,
      recurringEventId: "serie1",
      originalStartTime: { dateTime: `2026-11-${day}T09:00:00+01:00` },
      summary: "Trénink RM",
      start: { dateTime: `2026-11-${day}T09:00:00+01:00` },
      end: { dateTime: `2026-11-${day}T11:00:00+01:00` },
      attendees: [{ email: RECIPIENT, displayName: "Testovací příjemce", responseStatus: "accepted" }],
      hangoutLink: "https://meet.example.invalid/abc",
    });
  }
}

describe("adaptér Google Kalendáře (napodobené HTTP)", () => {
  test("vytvoření je idempotentní a žádá o oznámení pozvaným", async () => {
    const google = new FakeGoogle();
    const calendar = adapter(google);
    const key = "zbc-demo:akce-1";
    const attendee = { email: RECIPIENT, name: "Testovací příjemce", responseStatus: "needsAction" as const };

    expect(await calendar.findByKey(CALENDAR, key)).toBeNull();
    const first = await calendar.create(CALENDAR, key, data(), [attendee]);
    const second = await calendar.create(CALENDAR, key, data(), [attendee]); // nejasný výsledek, opakování
    expect(second.id).toBe(first.id);
    expect(first.id).toBe(eventIdForKey(key));
    expect(first.id).toMatch(/^[a-v0-9]{5,1024}$/); // znaky, které Google přijme jako vlastní ID
    expect(google.events.size).toBe(1);
    expect((await calendar.findByKey(CALENDAR, key))?.id).toBe(first.id);

    const insert = google.calls("POST")[0]!;
    expect(insert.url.searchParams.get("sendUpdates")).toBe("all");
    expect(insert.body).toMatchObject({
      summary: "Trénink RM: Rozbor",
      start: { dateTime: "2026-11-19T08:00:00.000Z", timeZone: "Europe/Prague" },
      attendees: [{ email: RECIPIENT, displayName: "Testovací příjemce" }],
    });
  });

  test("úprava posílá jen spravovaná pole, hosté, RSVP a odkaz na schůzku zůstanou", async () => {
    const google = new FakeGoogle();
    putSeries(google);
    const calendar = adapter(google);
    const patched = await calendar.patch(CALENDAR, "serie1_20261112T080000Z", data({ summary: "Trénink RM: Nové téma" }));

    const request = google.calls("PATCH")[0]!;
    expect(Object.keys(request.body!).sort()).toEqual([
      "description", "end", "guestsCanInviteOthers", "guestsCanModify", "guestsCanSeeOtherGuests", "start", "status", "summary",
    ]);
    expect(request.body).toMatchObject({ guestsCanSeeOtherGuests: false, guestsCanModify: false, guestsCanInviteOthers: false });
    expect(request.url.searchParams.get("sendUpdates")).toBe("all");
    expect(request.headers.get("if-match")).toBeTruthy();
    expect(patched.summary).toBe("Trénink RM: Nové téma");
    expect(patched.attendees).toEqual([{ email: RECIPIENT, name: "Testovací příjemce", responseStatus: "accepted" }]);
    expect(patched.meetingUrl).toBe("https://meet.example.invalid/abc");
  });

  test("změna i zrušení se týká jednoho výskytu, série a sousední termíny zůstanou", async () => {
    const google = new FakeGoogle();
    putSeries(google);
    const calendar = adapter(google);

    const candidates = await calendar.listBetween(CALENDAR, new Date("2026-11-11T23:00:00Z"), new Date("2026-11-12T23:00:00Z"));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: "serie1_20261112T080000Z", recurringEventId: "serie1" });
    expect(candidates[0]!.originalStartTime?.toISOString()).toBe("2026-11-12T08:00:00.000Z");
    expect(google.calls("GET")[0]!.url.searchParams.get("singleEvents")).toBe("true");

    const before = structuredClone([google.events.get("serie1"), google.events.get("serie1_20261105T080000Z"), google.events.get("serie1_20261119T080000Z")]);
    const cancelled = await calendar.patch(CALENDAR, candidates[0]!.id, data({ cancelled: true }));
    expect(cancelled.cancelled).toBe(true);
    expect([google.events.get("serie1"), google.events.get("serie1_20261105T080000Z"), google.events.get("serie1_20261119T080000Z")]).toEqual(before);

    // Zápis do hlavní události série adaptér odmítne ještě před odesláním změny.
    expect(await errorCode(calendar.patch(CALENDAR, "serie1", data()))).toBe("calendar_series_master:permanent");
    expect(google.calls("PATCH")).toHaveLength(1);
  });

  test("kalendář a příjemce mimo povolený seznam se zastaví před voláním Googlu", async () => {
    const google = new FakeGoogle();
    const calendar = adapter(google);
    expect(await errorCode(calendar.get("jiny-kalendar@example.com", "x"))).toBe("calendar_not_allowed:permanent");
    expect(await errorCode(calendar.listBetween("primary", new Date(), new Date()))).toBe("calendar_not_allowed:permanent");
    const stranger = { email: "nekdo.jiny@example.com", name: "Někdo", responseStatus: "needsAction" as const };
    expect(await errorCode(calendar.create(CALENDAR, "k", data(), [stranger]))).toBe("attendee_not_allowed:permanent");
    expect(google.requests).toHaveLength(0);
  });

  test("kopii cizí pozvánky Wiki nemění ani nenabízí ke spárování", async () => {
    const google = new FakeGoogle();
    google.put({
      id: "cizi",
      summary: "Cizí schůzka",
      organizer: { email: "nekdo@example.com" },
      start: { dateTime: "2026-11-12T13:00:00+01:00" },
      end: { dateTime: "2026-11-12T14:00:00+01:00" },
    });
    const calendar = adapter(google);
    expect(await calendar.listBetween(CALENDAR, new Date("2026-11-12T00:00:00Z"), new Date("2026-11-13T00:00:00Z"))).toEqual([]);
    expect(await errorCode(calendar.patch(CALENDAR, "cizi", data()))).toBe("calendar_not_organizer:permanent");
    expect(google.calls("PATCH")).toHaveLength(0);
  });

  test("chyby Googlu se dělí na přechodné a trvalé", async () => {
    const google = new FakeGoogle();
    putSeries(google);
    const calendar = adapter(google);
    const id = "serie1_20261112T080000Z";
    const forced = async (status: number, reason?: string) => {
      google.forced.push({ status, body: reason ? { error: { errors: [{ reason }] } } : {} });
      return errorCode(calendar.get(CALENDAR, id));
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await forced(503)).toBe("calendar_unavailable:transient");
    expect(await forced(429)).toBe("calendar_unavailable:transient");
    expect(await forced(403, "rateLimitExceeded")).toBe("calendar_unavailable:transient");
    expect(await forced(403, "forbidden")).toBe("calendar_forbidden:permanent");
    expect(await forced(400)).toBe("calendar_unavailable:permanent");
    expect(await calendar.get(CALENDAR, "neexistuje")).toBeNull();
    expect(await errorCode(calendar.patch(CALENDAR, "neexistuje", data()))).toBe("calendar_missing:permanent");

    // Změna mezi čtením a zápisem: podmíněný zápis selže přechodně, další pokus uvidí nový stav.
    const original = google.fetch;
    const racing: typeof fetch = async (input, init) => {
      const response = await original(input, init);
      if ((init?.method ?? "GET") === "GET") google.put({ ...google.events.get(id)!, summary: "Upraveno ručně" });
      return response;
    };
    const racingCalendar = new GoogleCalendar({
      tokens: { get: async () => google.issueAccessToken() },
      allowedCalendarIds: [CALENDAR],
      allowedAttendees: [],
      fetchImpl: racing,
    });
    expect(await errorCode(racingCalendar.patch(CALENDAR, id, data()))).toBe("calendar_unavailable:transient");
    expect(google.events.get(id)!.summary).toBe("Upraveno ručně");

    const failing: typeof fetch = async () => {
      throw new TypeError("network");
    };
    const offline = new GoogleCalendar({ tokens: { get: async () => "t" }, allowedCalendarIds: [CALENDAR], allowedAttendees: [], fetchImpl: failing });
    expect(await errorCode(offline.get(CALENDAR, id))).toBe("calendar_unavailable:transient");
  });

  test("prošlý přístupový token se jednou obnoví", async () => {
    const google = new FakeGoogle();
    putSeries(google);
    const asked: boolean[] = [];
    const tokens: AccessTokenSource = {
      get: async (refresh = false) => {
        asked.push(refresh);
        return refresh ? google.issueAccessToken() : "prosly-token";
      },
    };
    const calendar = new GoogleCalendar({ tokens, allowedCalendarIds: [CALENDAR], allowedAttendees: [], fetchImpl: google.fetch });
    expect((await calendar.get(CALENDAR, "serie1_20261112T080000Z"))?.summary).toBe("Trénink RM");
    expect(asked).toEqual([false, true]);
  });
});

const idTokenFor = (email: string, aud: string, verified = true) =>
  `x.${Buffer.from(JSON.stringify({ email, email_verified: verified, aud })).toString("base64url")}.x`;

const ENV = {
  GOOGLE_ORGANIZER_EMAIL: "organizator.test@example.com",
  CALENDAR_MODE: "google-test",
  GOOGLE_OAUTH_CLIENT_ID: "test-client.apps.example",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-client-secret",
  GOOGLE_CALENDAR_ID: CALENDAR,
  GOOGLE_ALLOWED_CALENDAR_IDS: CALENDAR,
  GOOGLE_ALLOWED_ATTENDEES: RECIPIENT,
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  APP_URL: "https://wiki-test.example.invalid",
};

describe("testovací režim Google Kalendáře ve Wiki (napodobené HTTP)", () => {
  let google: FakeGoogle;

  beforeAll(() => {
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });
  beforeEach(async () => {
    google = new FakeGoogle();
    vi.stubGlobal("fetch", google.fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
    clearAccessTokenCache();
    const db = await resetDemo();
    await db.delete(integrationCredentials);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const connect = async () => {
    const db = await getDb();
    return completeAuthorization(db, googleCalendarConfig()!, { code: "valid-code", verifier: "v".repeat(64), userId: organizer.id });
  };
  const link = async (id: string) => (await (await getDb()).select().from(calendarLinks).where(eq(calendarLinks.eventId, id)))[0];

  test("o propojení Kalendáře žádá Wiki jen toho, kdo spravuje plán, a jen dokud propojení chybí", async () => {
    const db = await getDb();
    expect(await needsCalendarConnection(db, true)).toBe(true);
    expect(await needsCalendarConnection(db, false)).toBe(false);
    expect((await listTasks(organizer))[0]).toMatchObject({ key: "kalendar-propojeni", external: true });
    expect((await listTasks(participant)).some((t) => t.key === "kalendar-propojeni")).toBe(false);

    expect(await connect()).toBe("connected");
    expect(await needsCalendarConnection(db, true)).toBe(false);
    expect((await listTasks(organizer)).some((t) => t.key === "kalendar-propojeni")).toBe(false);
  });

  async function publishTopic(id: string, topicTitle: string) {
    const row = (await loadEventRow(await getDb(), id))!;
    const v = formValuesOf(snapshotOf(row));
    const input: EventInput = {
      type: v.type, label: v.label, date: v.date, endDate: v.endDate, startTime: v.startTime, endTime: v.endTime,
      topicTitle, topicId: null, audience: v.audience, leadId: v.leadId || null, reviewerId: v.reviewerId || null,
    };
    await updateEvent(organizer, id, row.revision, input, "publish");
  }

  test("neúplná konfigurace režim nespustí a nespadne do simulace", async () => {
    vi.stubEnv("GOOGLE_ALLOWED_CALENDAR_IDS", "jiny@example.com");
    expect(googleCalendarConfig()).toBeNull();
    expect(googleCalendarConfigProblems()).toEqual(["GOOGLE_CALENDAR_ID není v GOOGLE_ALLOWED_CALENDAR_IDS"]);
    await requestNewInvite(organizer, PUBLISHED_RM);
    await syncEvent(PUBLISHED_RM);
    expect(await link(PUBLISHED_RM)).toMatchObject({ syncStatus: "attention", errorCode: "calendar_not_configured", externalEventId: null });
    expect(google.requests).toHaveLength(0);
    vi.stubEnv("GOOGLE_ALLOWED_CALENDAR_IDS", CALENDAR);
  });

  test("připojení uloží obnovovací token jen šifrovaně a odpojení ho smaže", async () => {
    expect(await connect()).toBe("connected");
    const db = await getDb();
    const [row] = await db.select().from(integrationCredentials);
    const issued = [...google.refreshTokens][0]!;
    expect(row!.accountEmail).toBe("organizator.test@example.com");
    expect(JSON.stringify(row)).not.toContain(issued);
    expect(row!.encryptedRefreshToken.startsWith("v1.")).toBe(true);
    expect((await connectionStatus(db))?.accountEmail).toBe("organizator.test@example.com");

    await disconnect(db);
    expect(await connectionStatus(db)).toBeNull();
    expect(google.refreshTokens.size).toBe(0); // zneplatněno i u Googlu
  });

  test("bez oprávnění ke Kalendáři nebo bez obnovovacího tokenu se nic neuloží", async () => {
    const db = await getDb();
    const cfg = googleCalendarConfig()!;
    const id_token = idTokenFor("organizator.test@example.com", cfg.clientId);
    const respond = (body: unknown) =>
      (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
    const input = { code: "valid-code", verifier: "v", userId: organizer.id };
    expect(await completeAuthorization(db, cfg, input, respond({ access_token: "a", refresh_token: "r", scope: "openid email", id_token }))).toBe("missing_scope");
    expect(
      await completeAuthorization(db, cfg, input, respond({ access_token: "a", scope: "https://www.googleapis.com/auth/calendar.events", id_token })),
    ).toBe("no_refresh_token");
    expect(await completeAuthorization(db, cfg, { ...input, code: "spatny" })).toBe("exchange_failed");
    expect(await connectionStatus(db)).toBeNull();
  });

  test("propojit smí jen účet organizátora podle ověřeného ID tokenu, jiný účet se zneplatní a neuloží", async () => {
    const db = await getDb();
    const cfg = googleCalendarConfig()!;
    const input = { code: "valid-code", verifier: "v", userId: organizer.id };
    const revoked: string[] = [];
    const respond = (body: Record<string, unknown>) =>
      (async (url: URL | string, init?: RequestInit) => {
        if (String(url).includes("/revoke")) {
          revoked.push(new URLSearchParams(String(init?.body)).get("token") ?? "");
          return new Response("{}", { status: 200 });
        }
        return new Response(JSON.stringify({ access_token: "a", refresh_token: "r-osobni", scope: "openid email https://www.googleapis.com/auth/calendar.events", ...body }), { status: 200 });
      }) as unknown as typeof fetch;
    // Osobní účet správce, neověřený e-mail, token pro jiného klienta, chybějící ID token.
    for (const id_token of [
      idTokenFor("spravce.osobni@example.com", cfg.clientId),
      idTokenFor("organizator.test@example.com", cfg.clientId, false),
      idTokenFor("organizator.test@example.com", "cizi-klient"),
      undefined,
    ]) {
      expect(await completeAuthorization(db, cfg, input, respond({ id_token }))).toBe("wrong_account");
    }
    expect(revoked).toEqual(["r-osobni", "r-osobni", "r-osobni", "r-osobni"]);
    expect(await connectionStatus(db)).toBeNull();
    // Velikost písmen v adrese nehraje roli.
    expect(await completeAuthorization(db, cfg, input, respond({ id_token: idTokenFor("Organizator.Test@Example.com", cfg.clientId) }))).toBe("connected");
    expect((await connectionStatus(db))?.accountEmail).toBe("organizator.test@example.com");
    await disconnect(db);
  });

  test("režim organizátora: osobní účet správce se při přihlášení nepropojí a Google nabídne účet organizátora", () => {
    const cfg = googleCalendarConfig()!;
    expect(isAllowedCalendarAccount(cfg, "spravce.osobni@example.com")).toBe(false);
    expect(isAllowedCalendarAccount(cfg, null)).toBe(false);
    expect(isAllowedCalendarAccount(cfg, "organizator.test@example.com")).toBe(true);
    expect(calendarLoginHint(cfg, "spravce.osobni@example.com")).toBe("organizator.test@example.com");
    // Osobní režim: kdo se přihlásil, propojuje svůj účet.
    const personal = { ...cfg, organizerEmail: null };
    expect(isAllowedCalendarAccount(personal, "spravce.osobni@example.com")).toBe(true);
    expect(calendarLoginHint(personal, "spravce.osobni@example.com")).toBe("spravce.osobni@example.com");
  });

  test("bez GOOGLE_ORGANIZER_EMAIL v režimu organizátora konfigurace není úplná a pozvánky se neposílají", () => {
    vi.stubEnv("GOOGLE_ORGANIZER_EMAIL", "");
    expect(googleCalendarConfigProblems()).toEqual(["GOOGLE_ORGANIZER_EMAIL"]);
    expect(googleCalendarConfig()).toBeNull();
    vi.stubEnv("GOOGLE_ORGANIZER_EMAIL", "organizator");
    expect(googleCalendarConfigProblems()).toEqual(["GOOGLE_ORGANIZER_EMAIL musí být celá adresa"]);
    // Osobní režim adresu organizátora nepotřebuje.
    vi.stubEnv("CALENDAR_DELIVERY", "personal");
    vi.stubEnv("GOOGLE_ORGANIZER_EMAIL", "");
    expect(googleCalendarConfigProblems()).toEqual([]);
    expect(googleCalendarConfig()?.organizerEmail).toBeNull();
    vi.stubEnv("CALENDAR_DELIVERY", "");
    vi.stubEnv("GOOGLE_ORGANIZER_EMAIL", ENV.GOOGLE_ORGANIZER_EMAIL);
  });

  test("odvolaný přístup u Googlu odpojí integraci a synchronizace žádá znovupřipojení", async () => {
    await connect();
    google.refreshTokens.clear(); // uživatel odebral přístup v nastavení Google účtu
    clearAccessTokenCache();
    const db = await getDb();
    await expect(storedAccessToken(db, googleCalendarConfig()!).get()).rejects.toMatchObject({ code: "calendar_revoked" });
    expect(await connectionStatus(db)).toBeNull();

    await requestNewInvite(organizer, PUBLISHED_RM);
    await syncEvent(PUBLISHED_RM);
    expect(await link(PUBLISHED_RM)).toMatchObject({ syncStatus: "attention", errorCode: "calendar_revoked" });
    expect(google.events.size).toBe(0);

    // Po novém připojení se zastavená akce vrátí do fronty sama, bez ručního opakování.
    await connect();
    expect(await resumeAfterReconnect(db)).toEqual([PUBLISHED_RM]);
    await syncEvent(PUBLISHED_RM);
    expect(await link(PUBLISHED_RM)).toMatchObject({ syncStatus: "synced", errorCode: null });
    expect(google.events.size).toBe(1);
  });

  test("přístup odebraný u Googlu se pozná při přihlášení: záznam zmizí a Wiki znovu požádá o Kalendář", async () => {
    await connect();
    const db = await getDb();
    expect(await needsCalendarConnection(db, true)).toBe(false);
    google.refreshTokens.clear(); // uživatel smazal oprávnění v účtu Google, záznam ve Wiki zůstal
    expect(await connectionStatus(db)).not.toBeNull();
    expect(await needsCalendarConnection(db, true)).toBe(true);
    expect(await connectionStatus(db)).toBeNull();
  });

  test("nové propojení přepíše staré a datum připojení se posune", async () => {
    await connect();
    const db = await getDb();
    const first = (await connectionStatus(db))!.connectedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await connect();
    expect((await db.select().from(integrationCredentials)).length).toBe(1);
    expect((await connectionStatus(db))!.connectedAt.getTime()).toBeGreaterThan(first.getTime());
  });

  test("účet bez přístupu ke kalendáři se pozná hned a po opravě se odešle celá fronta", async () => {
    const OTHER = "cizi-kalendar@group.calendar.google.com";
    vi.stubEnv("GOOGLE_CALENDAR_ID", OTHER);
    vi.stubEnv("GOOGLE_ALLOWED_CALENDAR_IDS", OTHER);
    await connect();
    const db = await getDb();
    expect(await probeTargetCalendar(db)).toBe("no_access");
    await requestNewInvite(organizer, PUBLISHED_RM);
    await syncEvent(PUBLISHED_RM);
    // Dřív to vypadalo jako „Kalendář je dočasně nedostupný“, ve skutečnosti účet kalendář nevidí.
    expect(await link(PUBLISHED_RM)).toMatchObject({ syncStatus: "attention", errorCode: "calendar_no_access", calendarId: OTHER });
    await db.update(calendarLinks).set({ syncStatus: "attention", errorCode: "calendar_unavailable" }).where(ne(calendarLinks.eventId, PUBLISHED_RM));

    // Oprava nastavení (hlavní kalendář účtu) a nové připojení: vše se převede a odešle bez ručního opakování.
    vi.stubEnv("GOOGLE_CALENDAR_ID", CALENDAR);
    vi.stubEnv("GOOGLE_ALLOWED_CALENDAR_IDS", CALENDAR);
    await connect();
    expect(await probeTargetCalendar(db)).toBe("ok");
    const resumed = await syncAfterReconnect(db);
    expect(resumed).toContain(PUBLISHED_RM);
    expect(await link(PUBLISHED_RM)).toMatchObject({ syncStatus: "synced", errorCode: null, calendarId: CALENDAR });
    const left = await db.select().from(calendarLinks).where(ne(calendarLinks.syncStatus, "synced"));
    expect(left.filter((l) => l.errorCode !== "external_change")).toEqual([]);
    expect(google.events.size).toBeGreaterThan(0);
  });

  test("po novém připojení se neobnoví akce zastavené jinou chybou než odvoláním přístupu", async () => {
    await connect();
    const db = await getDb();
    await requestNewInvite(organizer, PUBLISHED_RM);
    await db
      .update(calendarLinks)
      .set({ syncStatus: "attention", errorCode: "external_change" })
      .where(eq(calendarLinks.eventId, PUBLISHED_RM));
    expect(await resumeAfterReconnect(db)).toEqual([]);
    expect(await link(PUBLISHED_RM)).toMatchObject({ syncStatus: "attention", errorCode: "external_change" });
  });

  test("obnova ukázkových dat nechá Kalendář připojený", async () => {
    await connect();
    const db = await resetDemo();
    expect(await connectionStatus(db)).toMatchObject({ accountEmail: expect.any(String) });
  });

  test("zveřejněné budoucí akce ze seedu dostanou pozvánku samy, i po obnově ukázkových dat", async () => {
    // Bez propojeného Kalendáře se nic nezakládá, vazby by jen spadly do chyby.
    expect(await linkPublishedWithoutInvite()).toEqual([]);

    await connect();
    await syncPublished();
    const db = await getDb();
    const links = await db.select().from(calendarLinks);
    expect(links.length).toBeGreaterThan(2);
    expect(links.every((l) => l.syncStatus === "synced" && l.externalEventId)).toBe(true);
    expect(links.map((l) => l.eventId)).toContain("ev-11-26");
    // Proběhlé, zrušené akce ani návrhy pozvánku nedostanou.
    for (const id of ["ev-11-3", "ev-11-4", "ev-11-19"]) expect(await link(id)).toBeUndefined();
    const created = google.calls("POST").length;
    expect(created).toBe(links.length);

    // Obnova dat vazby smaže. Pozvánky v Googlu zůstaly, Wiki je pozná podle klíče a nezaloží je podruhé.
    await resetDemo();
    expect(await link("ev-11-26")).toBeUndefined();
    await syncPublished();
    await syncPublished();
    expect((await db.select().from(calendarLinks)).length).toBe(links.length);
    expect(google.calls("POST")).toHaveLength(created);
    expect((await link("ev-11-26"))?.syncStatus).toBe("synced");
  });

  test("cizí pozvánka ve stejném čase: akce počká na rozhodnutí, dvojí pozvánka nevznikne", async () => {
    await connect();
    const row = (await loadEventRow(await getDb(), "ev-11-26"))!;
    google.put({ id: "cizi1", summary: "Trénink RM", start: { dateTime: row.startsAt.toISOString() }, end: { dateTime: row.endsAt.toISOString() } });
    await syncPublished();
    expect(await link("ev-11-26")).toBeUndefined();
    expect((await link("ev-11-24"))?.syncStatus).toBe("synced");
    expect((await pairingCandidates(organizer, "ev-11-26")).map((c) => c.id)).toEqual(["cizi1"]);
  });

  test("cizí pozvánka posunutá o 15 minut nebo se stejným názvem automatiku zastaví, vzdálená jiná ne", async () => {
    await connect();
    const db = await getDb();
    const shifted = (await loadEventRow(db, "ev-11-26"))!;
    const plus15 = (d: Date) => new Date(d.getTime() + 15 * 60_000);
    google.put({ id: "posunuta", summary: "Úplně jiný název", start: { dateTime: plus15(shifted.startsAt).toISOString() }, end: { dateTime: plus15(shifted.endsAt).toISOString() } });
    const titled = (await loadEventRow(db, "ev-11-24"))!;
    const evening = (d: Date) => new Date(d.getTime() + 8 * 3_600_000);
    google.put({ id: "stejny-nazev", summary: ` ${calendarSummary(titled.published!).toUpperCase()} `, start: { dateTime: evening(titled.startsAt).toISOString() }, end: { dateTime: evening(titled.endsAt).toISOString() } });

    await syncPublished();
    await syncPublished();
    expect(await link("ev-11-26")).toBeUndefined();
    expect(await link("ev-11-24")).toBeUndefined();
    expect((await pairingCandidates(organizer, "ev-11-26")).map((c) => c.id)).toContain("posunuta");
    // Ostatní akce pozvánku dostaly a vlastní pozvánky Wiki se navzájem neblokují.
    const synced = (await db.select().from(calendarLinks)).filter((l) => l.syncStatus === "synced");
    expect(synced.length).toBeGreaterThan(0);
    expect(google.calls("POST")).toHaveLength(synced.length);
  });

  test("popis pozvánky: Wiki vymění jen svůj řádek, ruční text zůstane", () => {
    const url = "https://wiki.example.invalid/vzdelavani/akce/ev-1";
    const before = `Podrobnosti a zápis ve firemní Wiki: ${url}`;
    const after = `Zápis z akce je zveřejněný: ${url}#zapis\nPodrobnosti ve firemní Wiki: ${url}`;
    expect(mergeDescription("", before, url)).toBe(before);
    expect(mergeDescription(`Agenda\n- úvod\n\n${before}`, after, url)).toBe(`Agenda\n- úvod\n\n${after}`);
    expect(mergeDescription(`Agenda<br>${before}<br>`, after, url)).toBe(`Agenda<br><br>${after.replace("\n", "<br>")}`);
    // Opakované propsání je stabilní, nic se nezdvojí.
    const once = mergeDescription("Agenda", after, url);
    expect(mergeDescription(once, after, url)).toBe(once);
  });

  test("podobnost pozvánek: blízký začátek nebo stejný název, zrušená se nepočítá", () => {
    const target = { startsAt: new Date("2026-11-26T09:00:00Z"), endsAt: new Date("2026-11-26T10:00:00Z"), summary: "Trénink RM" };
    const at = (iso: string, summary = "Jiná porada", cancelled = false) => ({ startsAt: new Date(iso), summary, cancelled });
    expect(looksLikeSameInvite(at("2026-11-26T09:15:00Z"), target)).toBe(true);
    expect(looksLikeSameInvite(at("2026-11-26T12:00:00Z"), target)).toBe(true);
    expect(looksLikeSameInvite(at("2026-11-26T12:01:00Z"), target)).toBe(false);
    expect(looksLikeSameInvite(at("2026-11-26T17:00:00Z", "trénink  rm"), target)).toBe(true);
    expect(looksLikeSameInvite(at("2026-11-26T09:00:00Z", "Trénink RM", true), target)).toBe(false);
  });

  test("spárování s výskytem série: změna tématu upraví jen tento termín, opakování nic nezdvojí", async () => {
    await connect();
    putSeries(google);
    // Ruční agenda v HTML, jak ji uloží Google po úpravě v Kalendáři. Wiki ji nesmí přepsat (A05).
    google.events.get("serie1_20261112T080000Z")!.description = "<b>Agenda</b><br>1. Úvod<br>Materiály: https://docs.example.invalid/x";
    expect(await link(PUBLISHED_RM)).toBeUndefined(); // ukázkové pozvánky patří simulaci

    const candidates = await pairingCandidates(organizer, PUBLISHED_RM);
    expect(candidates.map((c) => c.id)).toEqual(["serie1_20261112T080000Z"]);
    await pairWithExisting(organizer, PUBLISHED_RM, candidates[0]!.id);
    const paired = (await link(PUBLISHED_RM))!;
    expect(paired).toMatchObject({ calendarId: CALENDAR, recurringEventId: "serie1" });
    expect(paired.originalStartTime?.toISOString()).toBe("2026-11-12T08:00:00.000Z");

    await syncEvent(PUBLISHED_RM);
    await publishTopic(PUBLISHED_RM, "Nové téma tréninku");
    await syncEvent(PUBLISHED_RM);
    const patches = google.calls("PATCH").length;
    await syncEvent(PUBLISHED_RM); // stejná revize podruhé

    expect(google.calls("PATCH")).toHaveLength(patches);
    expect(google.calls("POST")).toHaveLength(0);
    expect(google.calls("PATCH").every((r) => r.url.pathname.endsWith("/serie1_20261112T080000Z"))).toBe(true);
    const instance = google.events.get("serie1_20261112T080000Z")!;
    expect(instance.summary).toBe("Trénink RM: Nové téma tréninku");
    expect(instance.attendees).toEqual([{ email: RECIPIENT, displayName: "Testovací příjemce", responseStatus: "accepted" }]);
    expect(instance.hangoutLink).toBe("https://meet.example.invalid/abc");
    expect(String(instance.description)).toContain("https://wiki-test.example.invalid/vzdelavani/akce/");
    expect(String(instance.description)).toMatch(/^<b>Agenda<\/b><br>1\. Úvod<br>Materiály: https:\/\/docs\.example\.invalid\/x<br><br>Podrobnosti/);
    expect(String(instance.description).split("/vzdelavani/akce/")).toHaveLength(2);
    expect(google.events.get("serie1_20261119T080000Z")!.summary).toBe("Trénink RM");
    expect(google.events.get("serie1")!.summary).toBe("Trénink RM");
    expect(await link(PUBLISHED_RM)).toMatchObject({ syncStatus: "synced" });
  });

  test("nová pozvánka jde jen testovacím příjemcům a po výpadku nevznikne dvakrát", async () => {
    await connect();
    await requestNewInvite(organizer, PUBLISHED_RM);
    // Google zápis přijal, ale odpověď se ztratila. Další pokus musí najít existující událost.
    const original = google.fetch;
    let lost = false;
    vi.stubGlobal("fetch", (async (input, init) => {
      const response = await original(input, init);
      if (init?.method === "POST" && String(input).includes("/calendar/") && !lost) {
        lost = true;
        throw new TypeError("connection reset");
      }
      return response;
    }) as typeof fetch);
    await syncEvent(PUBLISHED_RM);

    expect(google.events.size).toBe(1);
    expect(google.calls("POST")).toHaveLength(1);
    const [created] = [...google.events.values()];
    expect(created!.attendees).toEqual([{ email: RECIPIENT, displayName: RECIPIENT }]);
    expect(await link(PUBLISHED_RM)).toMatchObject({ syncStatus: "synced", externalEventId: created!.id });

    // Pevný seznam příjemců se podle účtů neřídí: nový kolega pozvánku nezmění.
    await inviteUser(admin, { email: "kolega@example.com", name: "Nový Kolega", role: "member", groups: ["vsichni", "rm"] });
    expect((await link(PUBLISHED_RM))?.syncStatus).toBe("synced");
  });

  test("zdroj hostů „publikum“ zve skutečné účty skupiny, fiktivní role ne, a spravuje jen své hosty", async () => {
    vi.stubEnv("CALENDAR_ATTENDEES", "audience");
    try {
      await inviteUser(admin, { email: "Kolega@Example.com", name: "Nový Kolega", role: "member", groups: ["vsichni", "rm"] });
      await inviteUser(admin, { email: "jina@example.com", name: "Jiná Skupina", role: "member", groups: ["vsichni", "fp"] });
      await connect();
      await requestNewInvite(organizer, PUBLISHED_RM);
      await syncEvent(PUBLISHED_RM);
      const [created] = [...google.events.values()];
      expect(created!.attendees).toEqual([{ email: "kolega@example.com", displayName: "Nový Kolega" }]);

      // Kolega odpověděl a organizátor přidal hosta ručně v Kalendáři.
      google.put({
        ...created!,
        attendees: [
          { email: "kolega@example.com", responseStatus: "accepted" },
          { email: "host@example.org", responseStatus: "tentative", comment: "dorazím později" },
        ],
      });
      const { id: second } = (await getDb().then((db) => db.select().from(users).where(eq(users.email, "jina@example.com"))))[0]!;
      await updateAccess(admin, second, { role: "member", groups: ["vsichni", "rm"], status: "active" });
      expect((await link(PUBLISHED_RM))?.syncStatus).toBe("pending");
      await syncPending();
      let patch = google.calls("PATCH").at(-1)!;
      expect(patch.url.searchParams.get("sendUpdates")).toBe("all");
      expect(patch.body!.attendees).toEqual([
        { email: "kolega@example.com", responseStatus: "accepted" },
        { email: "host@example.org", responseStatus: "tentative", comment: "dorazím později" },
        { email: "jina@example.com", displayName: "Jiná Skupina" },
      ]);

      // Odebraný přístup: Wiki odebere svého hosta, ručně přidaný zůstane i s odpovědí.
      const { id: first } = (await getDb().then((db) => db.select().from(users).where(eq(users.email, "kolega@example.com"))))[0]!;
      await updateAccess(admin, first, { role: "member", groups: ["vsichni", "rm"], status: "disabled" });
      await syncPending();
      patch = google.calls("PATCH").at(-1)!;
      expect((patch.body!.attendees as Array<{ email: string }>).map((a) => a.email)).toEqual(["host@example.org", "jina@example.com"]);
      expect((await link(PUBLISHED_RM))?.managedAttendees).toEqual(["jina@example.com"]);

      // Beze změny publika se hosté do Googlu neposílají vůbec.
      const before = google.calls("PATCH").length;
      await publishTopic(PUBLISHED_RM, "Jiné téma");
      await syncEvent(PUBLISHED_RM);
      expect(google.calls("PATCH")).toHaveLength(before + 1);
      expect(google.calls("PATCH").at(-1)!.body).not.toHaveProperty("attendees");
    } finally {
      vi.stubEnv("CALENDAR_ATTENDEES", "");
    }
  });

  test("režim organizátora: chybějící vazba je „bez pozvánky“, nikdy „synchronizováno“", async () => {
    await connect();
    const db = await getDb();
    await db.delete(calendarLinks).where(eq(calendarLinks.eventId, PUBLISHED_RM));
    const detail = await getEventDetail(organizer, PUBLISHED_RM);
    expect(detail!.sync).toMatchObject({ personal: false, status: "unlinked", personalDelivery: null, legacyInviteId: null });
    expect(detail!.card.syncStatus).toBe("unlinked");
  });

  test("osobní režim: chybějící vazba nevolá kalendář organizátora ani nenabízí pozvánku", async () => {
    await connect();
    const db = await getDb();
    await db.delete(calendarLinks).where(eq(calendarLinks.eventId, PUBLISHED_RM));
    vi.stubEnv("CALENDAR_DELIVERY", "personal");
    try {
      const before = google.calls("GET").length + google.calls("POST").length;
      const detail = await getEventDetail(organizer, PUBLISHED_RM);
      expect(google.calls("GET").length + google.calls("POST").length).toBe(before);
      expect(detail!.sync).toMatchObject({ personal: true, status: "personal", candidates: [], unlinkedReason: null, calendarUnavailable: false });
      expect(detail!.card.syncStatus).toBe("personal");
    } finally {
      vi.stubEnv("CALENDAR_DELIVERY", "");
    }
  });
});

describe("OAuth stav a šifrování tokenů", () => {
  beforeAll(() => {
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  test("stav z callbacku platí jen pro téhož organizátora, stejný prohlížeč a krátkou dobu", () => {
    const cfg = googleCalendarConfig()!;
    const start = beginAuthorization(cfg, "demo-organizator", 1000);
    // Po přihlášení Googlem jde účet jako nápověda a Google se neptá na výběr účtu.
    const hinted = new URL(beginAuthorization(cfg, "demo-organizator", 1000, "organizator@example.invalid").url).searchParams;
    expect(hinted.get("login_hint")).toBe("organizator@example.invalid");
    expect(hinted.get("prompt")).toBe("consent");
    expect(new URL(start.url).searchParams.get("login_hint")).toBeNull();
    const url = new URL(start.url);
    const state = url.searchParams.get("state")!;
    expect(url.searchParams.get("scope")).toBe("openid email https://www.googleapis.com/auth/calendar.events");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe("https://wiki-test.example.invalid/api/google/kalendar/callback");
    expect(start.url).not.toContain(ENV.GOOGLE_OAUTH_CLIENT_SECRET);

    expect(verifyAuthorizationState(start.cookieValue, state, "demo-organizator", 1001)).toBeTruthy();
    expect(verifyAuthorizationState(start.cookieValue, "jiny-stav", "demo-organizator", 1001)).toBeNull();
    expect(verifyAuthorizationState(start.cookieValue, state, "demo-vedouci", 1001)).toBeNull();
    expect(verifyAuthorizationState(start.cookieValue, state, "demo-organizator", 1000 + 601)).toBeNull();
    expect(verifyAuthorizationState(`${start.cookieValue.split(".")[0]}.podvrh`, state, "demo-organizator", 1001)).toBeNull();
    expect(verifyAuthorizationState(undefined, state, "demo-organizator", 1001)).toBeNull();
  });

  test("šifru nejde otevřít jiným klíčem ani v jiném kontextu", () => {
    const key = randomBytes(32);
    const sealed = sealSecret("refresh-token", key, "org:google-calendar");
    expect(sealed).not.toContain("refresh-token");
    expect(openSecret(sealed, key, "org:google-calendar")).toBe("refresh-token");
    expect(openSecret(sealed, randomBytes(32), "org:google-calendar")).toBeNull();
    expect(openSecret(sealed, key, "jina-org:google-calendar")).toBeNull();
    expect(openSecret(`${sealed}x`, key, "org:google-calendar")).toBeNull();
    expect(sealSecret("refresh-token", key, "org:google-calendar")).not.toBe(sealed); // náhodné IV
  });
});

describe("zrušená akce", () => {
  test("nedostane novou pozvánku ani spárování, server to odmítne", async () => {
    await expect(requestNewInvite(organizer, "ev-11-4")).rejects.toThrow();
    await expect(pairWithExisting(organizer, "ev-11-4", "cizi-pozvanka")).rejects.toThrow();
  });
});
