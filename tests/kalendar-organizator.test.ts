import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { GET as cronGet, POST as githubPost } from "@/app/api/kalendar/fronta/route";
import { eventIdForKey } from "@/server/calendar/google";
import { clearAccessTokenCache, completeAuthorization } from "@/server/calendar/google-auth";
import { gmailSearchHref, invitationsFor, syncResponses } from "@/server/calendar/rsvp";
import { calendarProvider, errorKind, requestNewInvite, syncEvent, syncPending } from "@/server/calendar/sync";
import { runCalendarWorker, runWorkerIfDue, workerHealth } from "@/server/calendar/worker";
import { workerRequestAuthorized } from "@/server/calendar/worker-auth";
import { config, googleCalendarConfig } from "@/server/config";
import { getDb } from "@/server/db/client";
import { calendarLinks, calendarResponses, calendarSyncState, calendarWorkerRuns, integrationCredentials, users } from "@/server/db/schema";
import { snapshotOf } from "@/server/domain/snapshot";
import { formValuesOf } from "@/server/services/detail";
import { cancelEvent, loadEventRow, updateEvent, type EventInput } from "@/server/services/events";
import { inviteUser, updateAccess } from "@/server/services/users";
import type { Viewer } from "@/server/policy";
import { CALENDAR, FakeGoogle, type Stored } from "./fake-google";
import { PUBLISHED_RM, admin, organizer, resetDemo } from "./helpers";

// Režim organizátora (CALENDAR_DELIVERY=organizer) proti napodobenému Googlu: skutečné pozvánky,
// fronta s opakováním, odpovědi pozvaných přes syncToken a chráněný endpoint plánovače.
// Ověřuje chování Wiki, NE skutečného Googlu (živý test čeká na účet organizátora).

const WORKER_TOKEN = "t".repeat(40);
const ENV = {
  GOOGLE_ORGANIZER_EMAIL: "organizator.test@example.com",
  CALENDAR_MODE: "google-test",
  CALENDAR_DELIVERY: "organizer",
  CALENDAR_ATTENDEES: "audience",
  GOOGLE_OAUTH_CLIENT_ID: "test-client.apps.example",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-client-secret",
  GOOGLE_CALENDAR_ID: CALENDAR,
  GOOGLE_ALLOWED_CALENDAR_IDS: CALENDAR,
  GOOGLE_ALLOWED_ATTENDEES: "",
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  APP_URL: "https://wiki-test.example.invalid",
  CALENDAR_WORKER_TOKEN: WORKER_TOKEN,
};

const KOLEGA = "kolega@example.com";
const DRUHA = "druha@example.com";
const KEY_ID = () => eventIdForKey(`${config.orgId}:${PUBLISHED_RM}`);

let google: FakeGoogle;

beforeAll(() => {
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(async () => {
  google = new FakeGoogle();
  vi.stubGlobal("fetch", google.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
  clearAccessTokenCache();
  const db = await resetDemo();
  await db.delete(integrationCredentials);
  await db.delete(calendarResponses);
  await db.delete(calendarSyncState);
  await db.delete(calendarWorkerRuns);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const connect = async () =>
  completeAuthorization(await getDb(), googleCalendarConfig()!, { code: "valid-code", verifier: "v".repeat(64), userId: organizer.id });

const link = async (id = PUBLISHED_RM) => (await (await getDb()).select().from(calendarLinks).where(eq(calendarLinks.eventId, id)))[0]!;
const writes = () => google.requests.filter((r) => r.method !== "GET" && r.url.hostname !== "oauth2.googleapis.com");
const invite = () => google.events.get(KEY_ID())!;
const emails = (event: Stored) => ((event.attendees as Array<{ email: string }> | undefined) ?? []).map((a) => a.email);

async function viewerOf(email: string): Promise<Viewer> {
  const [row] = await (await getDb()).select().from(users).where(eq(users.email, email));
  return { id: row!.id, role: row!.role, groups: row!.groups };
}

async function setResponse(email: string, responseStatus: string) {
  const current = invite();
  google.put({
    ...current,
    attendees: (current.attendees as Array<Record<string, unknown>>).map((a) => (a.email === email ? { ...a, responseStatus } : a)),
  });
}

async function publishTopic(topicTitle: string) {
  const row = (await loadEventRow(await getDb(), PUBLISHED_RM))!;
  const v = formValuesOf(snapshotOf(row));
  const input: EventInput = {
    type: v.type, label: v.label, date: v.date, endDate: v.endDate, startTime: v.startTime, endTime: v.endTime,
    topicTitle, topicId: null, audience: v.audience, leadId: v.leadId || null, reviewerId: v.reviewerId || null,
  };
  await updateEvent(organizer, PUBLISHED_RM, row.revision, input, "publish");
}

/** Propojený organizátor, dva kolegové ve skupině RM a odeslaná pozvánka na budoucí akci RM. */
async function invited() {
  await inviteUser(admin, { email: KOLEGA, name: "Nový Kolega", role: "member", groups: ["vsichni", "rm"] });
  await inviteUser(admin, { email: DRUHA, name: "Druhá Kolegyně", role: "member", groups: ["vsichni", "rm"] });
  await connect();
  await requestNewInvite(organizer, PUBLISHED_RM);
  await syncEvent(PUBLISHED_RM);
  expect((await link()).syncStatus).toBe("synced");
}

describe("pozvánky organizátora", () => {
  test("založení: stabilní ID z akce, sendUpdates=all, soukromí hostů a pražský čas", async () => {
    await invited();
    const insert = google.calls("POST")[0]!;
    expect(insert.url.searchParams.get("sendUpdates")).toBe("all");
    expect(insert.body).toMatchObject({
      id: KEY_ID(),
      guestsCanSeeOtherGuests: false,
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      start: { timeZone: "Europe/Prague" },
      end: { timeZone: "Europe/Prague" },
    });
    expect(emails(invite()).sort()).toEqual([DRUHA, KOLEGA]);
    // Opakované zpracování nic dalšího nepošle a duplicitu nezaloží. (Worker navíc dozaloží pozvánky
    // ostatních budoucích akcí ze seedu, každou jednou.)
    await syncPending();
    expect(google.calls("POST")).toHaveLength(1);
    await runCalendarWorker("github");
    const created = google.calls("POST").length;
    await runCalendarWorker("github");
    expect(google.calls("POST")).toHaveLength(created);
    expect(new Set(google.calls("POST").map((p) => p.body!.id)).size).toBe(created);
    expect(writes().filter((w) => w.method === "PATCH")).toHaveLength(0);
  });

  test("úprava zachová odpovědi pozvaných a hosty bez změny neposílá", async () => {
    await invited();
    await setResponse(KOLEGA, "accepted");
    await setResponse(DRUHA, "declined");
    await publishTopic("Nové téma");
    await syncEvent(PUBLISHED_RM);
    const patch = google.calls("PATCH").at(-1)!;
    expect(patch.url.searchParams.get("sendUpdates")).toBe("all");
    expect(patch.body).not.toHaveProperty("attendees");
    expect(patch.body).toMatchObject({ guestsCanSeeOtherGuests: false });
    expect(invite().attendees).toEqual([
      expect.objectContaining({ email: DRUHA, responseStatus: "declined" }),
      expect.objectContaining({ email: KOLEGA, responseStatus: "accepted" }),
    ]);
  });

  test("odmítnutý host se znovu nezve, nový zaměstnanec dostane pozvánku jen na budoucí akce", async () => {
    await invited();
    await setResponse(DRUHA, "declined");
    const patchesBefore = google.calls("PATCH").length;
    await inviteUser(admin, { email: "novy@example.com", name: "Nový Zaměstnanec", role: "member", groups: ["vsichni", "rm"] });
    await syncPending();
    const patches = google.calls("PATCH").slice(patchesBefore);
    // Jediná úprava: budoucí akce RM (proběhlé akce se nemění).
    expect(patches.map((p) => decodeURIComponent(p.url.pathname.split("/").at(-1)!))).toEqual([KEY_ID()]);
    const attendees = patches[0]!.body!.attendees as Array<{ email: string; responseStatus?: string }>;
    expect(attendees).toEqual([
      expect.objectContaining({ email: DRUHA, responseStatus: "declined" }),
      expect.objectContaining({ email: KOLEGA }),
      expect.objectContaining({ email: "novy@example.com" }),
    ]);
  });

  test("změna skupiny odebere hosta jen z akcí, které už nevidí", async () => {
    await invited();
    const kolega = await viewerOf(KOLEGA);
    await updateAccess(admin, kolega.id, { role: "member", groups: ["vsichni", "fp"], status: "active" });
    await syncPending();
    expect(emails(invite())).toEqual([DRUHA]);
    expect((await link()).managedAttendees).toEqual([DRUHA]);
  });

  test("zrušení akce = status cancelled na původní pozvánce, nic se nemaže", async () => {
    await invited();
    const row = (await loadEventRow(await getDb(), PUBLISHED_RM))!;
    await cancelEvent(organizer, PUBLISHED_RM, row.revision, "Lektor onemocněl");
    await syncEvent(PUBLISHED_RM);
    const patch = google.calls("PATCH").at(-1)!;
    expect(decodeURIComponent(patch.url.pathname.split("/").at(-1)!)).toBe(KEY_ID());
    expect(patch.body).toMatchObject({ status: "cancelled" });
    expect(patch.url.searchParams.get("sendUpdates")).toBe("all");
    expect(google.calls("DELETE")).toHaveLength(0);
    expect(google.events.size).toBe(1);
  });
});

describe("chyby Googlu a fronta", () => {
  test("401 i po obnově tokenu není odvolání: propojení zůstane, akce čeká s upozorněním", async () => {
    await connect();
    await requestNewInvite(organizer, PUBLISHED_RM);
    google.forced.push({ status: 401 }, { status: 401 });
    await syncEvent(PUBLISHED_RM);
    const current = await link();
    expect(current).toMatchObject({ syncStatus: "attention", errorCode: "calendar_forbidden" });
    expect(current.nextAttemptAt).not.toBeNull();
    expect(await (await getDb()).select().from(integrationCredentials)).toHaveLength(1);
  });

  test("403 bez důvodu kvóty = odmítnutá operace (přístup), 403 rateLimitExceeded = přechodná", async () => {
    await connect();
    await requestNewInvite(organizer, PUBLISHED_RM);
    google.forced.push({ status: 403, body: { error: { errors: [{ reason: "forbidden" }] } } });
    await syncEvent(PUBLISHED_RM);
    expect((await link()).errorCode).toBe("calendar_forbidden");
    expect(errorKind("calendar_forbidden")).toBe("access");
    expect(await (await getDb()).select().from(integrationCredentials)).toHaveLength(1);

    // Limit: jeden pokus selže, druhý projde. Pozvánka vznikne jednou.
    await (await getDb()).update(calendarLinks).set({ syncStatus: "pending", attempts: 0, errorCode: null });
    google.forced.push({ status: 403, body: { error: { errors: [{ reason: "rateLimitExceeded" }] } } });
    await syncEvent(PUBLISHED_RM);
    expect((await link()).syncStatus).toBe("synced");
    expect(google.events.size).toBe(1);
  });

  test("404 u odeslané pozvánky = chybí v Kalendáři, rozhoduje správce (bez nového pokusu)", async () => {
    await invited();
    google.events.delete(KEY_ID());
    await publishTopic("Jiné téma");
    await syncEvent(PUBLISHED_RM);
    const current = await link();
    expect(current).toMatchObject({ syncStatus: "attention", errorCode: "calendar_missing" });
    expect(current.nextAttemptAt).toBeNull();
    expect(google.calls("POST")).toHaveLength(1);
  });

  test("409 při založení (pozvánka mezitím vznikla) převezme existující, bez duplicity", async () => {
    await connect();
    await requestNewInvite(organizer, PUBLISHED_RM);
    google.put({ id: KEY_ID(), summary: "x", start: { dateTime: "2026-11-12T08:00:00Z" }, end: { dateTime: "2026-11-12T10:00:00Z" } });
    google.forced.push({ status: 404 }); // findByKey ještě pozvánku „nevidí“
    await syncEvent(PUBLISHED_RM);
    expect(google.calls("POST")).toHaveLength(1);
    expect(google.events.size).toBe(1);
    expect((await link()).syncStatus).toBe("synced");
  });

  test("429 a 5xx: opakování s prodlevou, po prodlevě fronta dožene bez duplicit", async () => {
    await connect();
    await requestNewInvite(organizer, PUBLISHED_RM);
    google.forced.push({ status: 429 }, { status: 503 }, { status: 500 });
    await syncEvent(PUBLISHED_RM);
    let current = await link();
    expect(current).toMatchObject({ syncStatus: "attention", errorCode: "calendar_unavailable", attempts: 3 });
    expect(current.failingSince).not.toBeNull();
    // Před splatností další pokus nenastane.
    await syncPending();
    expect(google.calls("POST")).toHaveLength(0);
    await (await getDb()).update(calendarLinks).set({ nextAttemptAt: sql`now() - interval '1 minute'` });
    await syncPending();
    current = await link();
    expect(current).toMatchObject({ syncStatus: "synced", errorCode: null, failingSince: null, nextAttemptAt: null });
    expect(google.events.size).toBe(1);
  }, 15_000);

  test("vypršení času (timeout) je přechodná chyba, ne odvolání", async () => {
    await connect();
    await requestNewInvite(organizer, PUBLISHED_RM);
    const real = google.fetch;
    let failures = 1;
    vi.stubGlobal("fetch", (async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.hostname !== "oauth2.googleapis.com" && failures-- > 0) throw new DOMException("timeout", "TimeoutError");
      return real(input, init);
    }) as typeof fetch);
    await syncEvent(PUBLISHED_RM);
    expect((await link()).syncStatus).toBe("synced");
    expect(google.events.size).toBe(1);
  });
});

describe("odpovědi pozvaných (RSVP)", () => {
  test("stavy na Úvodu: čeká, přijata, možná, odmítnuto; čtení nic nezapisuje", async () => {
    await invited();
    const kolega = await viewerOf(KOLEGA);
    const db = await getDb();
    const before = writes().length;
    expect(await syncResponses(db, calendarProvider(db))).toBe("full");
    let view = (await invitationsFor(db, kolega))!;
    expect(view.items).toHaveLength(1);
    expect(view.items[0]).toMatchObject({ eventId: PUBLISHED_RM, status: "needsAction" });
    expect(view.organizerEmail).toBe("organizator.test@example.com");

    for (const status of ["accepted", "tentative", "declined"] as const) {
      await setResponse(KOLEGA, status);
      expect(await syncResponses(db, calendarProvider(db))).toBe("incremental");
      view = (await invitationsFor(db, kolega))!;
      expect(view.items[0]!.status).toBe(status);
      expect(view.items[0]!.urgent).toBe(false);
    }
    expect(writes()).toHaveLength(before);
    // Přírůstkové čtení posílá uložený token a stejné parametry jako úplné.
    const last = google.calls("GET").filter((r) => !r.url.pathname.match(/events\/./)).at(-1)!;
    expect(last.url.searchParams.get("syncToken")).toMatch(/^st-/);
    expect(last.url.searchParams.get("showDeleted")).toBe("true");
  });

  test("410 Gone: token se zahodí a proběhne úplná synchronizace; stránkování projde všechny stránky", async () => {
    await invited();
    const db = await getDb();
    google.pageSize = 1;
    // Další (cizí) událost v kalendáři organizátora, aby výpis měl dvě stránky.
    google.put({ id: "rucni1", summary: "Ruční", start: { dateTime: "2026-11-20T08:00:00Z" }, end: { dateTime: "2026-11-20T09:00:00Z" } });
    expect(await syncResponses(db, calendarProvider(db))).toBe("full");
    expect(google.calls("GET").some((r) => r.url.searchParams.get("pageToken") === "1")).toBe(true);
    await setResponse(KOLEGA, "accepted");
    google.expireSyncTokens = true;
    const listCalls = () => google.calls("GET").filter((r) => r.url.searchParams.get("showDeleted") === "true");
    const before = listCalls().length;
    // První čtení s tokenem dostane 410, Wiki pak čte úplně (bez tokenu).
    expect(await syncResponses(db, calendarProvider(db))).toBe("full");
    const calls = listCalls().slice(before);
    expect(calls[0]!.url.searchParams.has("syncToken")).toBe(true);
    expect(calls.slice(1).every((c) => !c.url.searchParams.has("syncToken"))).toBe(true);
    const [state] = await db.select().from(calendarSyncState);
    expect(state!.syncToken).toMatch(/^st-/);
    expect((await invitationsFor(db, await viewerOf(KOLEGA)))!.items[0]!.status).toBe("accepted");
  });

  test("Google nedostupný: stav nelze ověřit, Úvod nic nevymýšlí", async () => {
    await invited();
    const db = await getDb();
    google.forced.push({ status: 503 });
    await expect(syncResponses(db, calendarProvider(db))).rejects.toThrow();
    const view = (await invitationsFor(db, await viewerOf(KOLEGA)))!;
    expect(view.verified).toBe(false);
    expect(view.items[0]!.status).toBe("unknown");
    expect(view.items[0]!.urgent).toBe(false);
  });

  test("zrušená akce: odpovědi se smažou a pozvánka z Úvodu zmizí", async () => {
    await invited();
    const db = await getDb();
    await setResponse(KOLEGA, "accepted");
    await syncResponses(db, calendarProvider(db));
    expect(await db.select().from(calendarResponses)).toHaveLength(2);
    const row = (await loadEventRow(db, PUBLISHED_RM))!;
    await cancelEvent(organizer, PUBLISHED_RM, row.revision, "Zrušeno");
    await syncEvent(PUBLISHED_RM);
    await syncResponses(db, calendarProvider(db));
    expect(await db.select().from(calendarResponses)).toHaveLength(0);
    expect((await invitationsFor(db, await viewerOf(KOLEGA)))!.items).toHaveLength(0);
  });

  test("souběžná čtení: druhé skončí na zámku bez práce", async () => {
    await invited();
    const db = await getDb();
    const [a, b] = await Promise.all([syncResponses(db, calendarProvider(db)), syncResponses(db, calendarProvider(db))]);
    expect([a, b].sort()).toEqual(["busy", "full"]);
  });

  test("odkaz Gmailu hledá podle odesílatele všude, včetně Spamu", () => {
    expect(gmailSearchHref("organizator@example.com")).toBe(
      "https://mail.google.com/mail/u/0/#search/from%3Aorganizator%40example.com%20in%3Aanywhere",
    );
  });
});

describe("plánovač a endpoint fronty", () => {
  const request = (method: "GET" | "POST", authorization?: string) =>
    new NextRequest("https://wiki-test.example.invalid/api/kalendar/fronta", {
      method,
      headers: authorization ? { authorization } : {},
    });

  test("bez tokenu nebo se špatným tokenem 401, se správným jen počty a no-store", async () => {
    await invited();
    expect((await githubPost(request("POST"))).status).toBe(401);
    expect((await githubPost(request("POST", `Bearer ${"x".repeat(40)}`))).status).toBe(401);
    expect((await cronGet(request("GET", WORKER_TOKEN))).status).toBe(401); // bez „Bearer“
    const ok = await githubPost(request("POST", `Bearer ${WORKER_TOKEN}`));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    const body = (await ok.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["attention", "pending", "responses", "status"]);
    expect(JSON.stringify(body)).not.toContain("@");
  });

  test("krátký token se nepřijme, bez nastavení neprojde nic", async () => {
    vi.stubEnv("CALENDAR_WORKER_TOKEN", "kratky");
    vi.stubEnv("CRON_SECRET", "");
    try {
      expect(await workerRequestAuthorized("Bearer kratky")).toBe(false);
      expect(await workerRequestAuthorized(null)).toBe(false);
    } finally {
      vi.stubEnv("CALENDAR_WORKER_TOKEN", WORKER_TOKEN);
    }
  });

  test("stav ve Správě: bez plánovače upozornění, po běhu GitHubu v pořádku, po 30 min výpadek", async () => {
    await invited();
    const db = await getDb();
    expect((await workerHealth(db))!.alerts).toEqual([{ kind: "scheduler_never" }]);
    await runCalendarWorker("github");
    expect((await workerHealth(db))!.alerts).toEqual([]);
    await db.update(calendarWorkerRuns).set({ lastSuccessAt: sql`now() - interval '45 minutes'` });
    expect((await workerHealth(db))!.alerts[0]).toMatchObject({ kind: "scheduler_stale" });
  });

  test("dlouhá chyba přístupu se správci hlásí podle druhu", async () => {
    await connect();
    await requestNewInvite(organizer, PUBLISHED_RM);
    google.forced.push({ status: 403, body: { error: { errors: [{ reason: "forbidden" }] } } });
    await syncEvent(PUBLISHED_RM);
    const alerts = (await workerHealth(await getDb()))!.alerts;
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "queue", errorKind: "access", count: 1 }));
  });

  test("návštěva spustí zpracování nejvýš jednou za 5 minut", async () => {
    await invited();
    const db = await getDb();
    await runWorkerIfDue("visit");
    const calls = google.requests.length;
    await runWorkerIfDue("visit");
    expect(google.requests.length).toBe(calls);
    const runs = await db.select().from(calendarWorkerRuns);
    expect(runs.map((r) => r.source)).toEqual(["visit"]);
  });

  test("osobní režim: plánovač bez osobních kalendářů, odpovědi ani karta pozvánek nic nedělají (žádný souběh)", async () => {
    await invited();
    vi.stubEnv("CALENDAR_DELIVERY", "personal");
    try {
      const db = await getDb();
      const calls = google.requests.length;
      expect(await runCalendarWorker("github")).toMatchObject({ status: "done", pending: 0, responses: null });
      expect(await syncResponses(db, calendarProvider(db))).toBe("skipped");
      expect(await invitationsFor(db, await viewerOf(KOLEGA))).toBeNull();
      expect(await workerHealth(db)).toBeNull();
      expect(google.requests.length).toBe(calls);
    } finally {
      vi.stubEnv("CALENDAR_DELIVERY", "organizer");
    }
  });
});
