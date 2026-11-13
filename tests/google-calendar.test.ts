import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { GoogleCalendar, eventIdForKey } from "@/server/calendar/google";
import {
  beginAuthorization,
  needsCalendarConnection,
  clearAccessTokenCache,
  completeAuthorization,
  connectionStatus,
  disconnect,
  storedAccessToken,
  verifyAuthorizationState,
  type AccessTokenSource,
} from "@/server/calendar/google-auth";
import { CalendarError, type ManagedEventData } from "@/server/calendar/provider";
import { pairWithExisting, pairingCandidates, requestNewInvite, resumeAfterReconnect, syncEvent, syncPending } from "@/server/calendar/sync";
import { googleCalendarConfig, googleCalendarConfigProblems } from "@/server/config";
import { getDb } from "@/server/db/client";
import { calendarLinks, integrationCredentials, users } from "@/server/db/schema";
import { snapshotOf } from "@/server/domain/snapshot";
import { openSecret, sealSecret } from "@/server/integrations/secret-box";
import { formValuesOf } from "@/server/services/detail";
import { loadEventRow, updateEvent, type EventInput } from "@/server/services/events";
import { inviteUser, updateAccess } from "@/server/services/users";
import { listTasks } from "@/server/services/journey";
import { PUBLISHED_RM, admin, organizer, participant, resetDemo } from "./helpers";

// Adaptér Google Kalendáře proti napodobenému HTTP. Ověřuje tvar požadavků a chování Wiki,
// NE skutečné chování Googlu. Živý test podle zadání (část 02) tyto testy nenahrazují.

const CALENDAR = "vzdelavani-test@group.calendar.google.com";
const RECIPIENT = "prijemce.test@example.com";

type Stored = Record<string, unknown> & { id: string; etag: string; status: string; recurrence?: string[] };
type Recorded = { method: string; url: URL; body: Record<string, unknown> | null; headers: Headers };

/** Napodobený Google: token endpoint a události jednoho kalendáře. */
class FakeGoogle {
  events = new Map<string, Stored>();
  requests: Recorded[] = [];
  /** Odpovědi, které se vrátí místo běžného zpracování (výpadky, limity). */
  forced: Array<{ status: number; body?: unknown }> = [];
  refreshTokens = new Set<string>();
  accessTokens = new Set<string>();
  private counter = 0;

  calls = (method: string, part = "/calendar/") => this.requests.filter((r) => r.method === method && r.url.pathname.includes(part));

  put(event: Partial<Stored> & { id: string }): Stored {
    const stored = { status: "confirmed", organizer: { email: CALENDAR, self: true }, ...event, etag: `"${++this.counter}"` } as Stored;
    this.events.set(event.id, stored);
    return stored;
  }

  issueAccessToken(): string {
    const token = `at-${++this.counter}`;
    this.accessTokens.add(token);
    return token;
  }

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const raw = typeof init?.body === "string" ? init.body : null;
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

    if (url.hostname === "oauth2.googleapis.com") {
      const form = new URLSearchParams(raw ?? "");
      this.requests.push({ method, url, body: Object.fromEntries(form), headers });
      if (url.pathname === "/revoke") {
        this.refreshTokens.delete(form.get("token") ?? "");
        return json(200, {});
      }
      if (form.get("grant_type") === "authorization_code") {
        if (form.get("code") !== "valid-code" || !form.get("code_verifier")) return json(400, { error: "invalid_grant" });
        const refresh = `rt-${++this.counter}`;
        this.refreshTokens.add(refresh);
        const idToken = `x.${Buffer.from(JSON.stringify({ email: "Organizator.Test@example.com" })).toString("base64url")}.x`;
        return json(200, {
          access_token: this.issueAccessToken(),
          refresh_token: refresh,
          expires_in: 3600,
          scope: "openid email https://www.googleapis.com/auth/calendar.events",
          id_token: idToken,
        });
      }
      if (!this.refreshTokens.has(form.get("refresh_token") ?? "")) return json(400, { error: "invalid_grant" });
      return json(200, { access_token: this.issueAccessToken(), expires_in: 3600 });
    }

    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    this.requests.push({ method, url, body, headers });
    const forced = this.forced.shift();
    if (forced) return json(forced.status, forced.body ?? {});
    if (!this.accessTokens.has((headers.get("authorization") ?? "").replace("Bearer ", ""))) return json(401, {});

    const [, calendarId, eventId] = /^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(url.pathname) ?? [];
    if (decodeURIComponent(calendarId ?? "") !== CALENDAR) return json(404, {});

    if (method === "GET" && !eventId) {
      const from = Date.parse(url.searchParams.get("timeMin")!);
      const to = Date.parse(url.searchParams.get("timeMax")!);
      const items = [...this.events.values()].filter((e) => {
        const start = Date.parse((e.start as { dateTime: string }).dateTime);
        // singleEvents=true: hlavní událost série se nevrací, jen její výskyty.
        return !e.recurrence && e.status !== "cancelled" && start >= from && start < to;
      });
      return json(200, { items });
    }
    if (method === "POST" && !eventId) {
      const id = String(body!.id);
      if (this.events.has(id)) return json(409, { error: { errors: [{ reason: "duplicate" }] } });
      return json(200, this.put({ ...body, id }));
    }
    const current = this.events.get(decodeURIComponent(eventId ?? ""));
    if (!current) return json(404, {});
    if (method === "GET") return json(200, current);
    if (method === "PATCH") {
      if (headers.get("if-match") && headers.get("if-match") !== current.etag) return json(412, {});
      return json(200, this.put({ ...current, ...body, id: current.id }));
    }
    return json(405, {});
  };
}

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
    expect(Object.keys(request.body!).sort()).toEqual(["description", "end", "start", "status", "summary"]);
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
    expect(await forced(403, "forbidden")).toBe("calendar_revoked:permanent");
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

const ENV = {
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
    const respond = (body: unknown) =>
      (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
    const input = { code: "valid-code", verifier: "v", userId: organizer.id };
    const cfg = googleCalendarConfig()!;
    expect(await completeAuthorization(db, cfg, input, respond({ access_token: "a", refresh_token: "r", scope: "openid email" }))).toBe("missing_scope");
    expect(
      await completeAuthorization(db, cfg, input, respond({ access_token: "a", scope: "https://www.googleapis.com/auth/calendar.events" })),
    ).toBe("no_refresh_token");
    expect(await completeAuthorization(db, cfg, { ...input, code: "spatny" })).toBe("exchange_failed");
    expect(await connectionStatus(db)).toBeNull();
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

  test("spárování s výskytem série: změna tématu upraví jen tento termín, opakování nic nezdvojí", async () => {
    await connect();
    putSeries(google);
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
