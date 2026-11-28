import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { PERSONAL_SCOPE, savePersonalGrant, syncPersonalCalendar } from "@/server/calendar/personal";
import { eventParticipation, events, personalCalendarEntries, personalCalendars } from "@/server/db/schema";
import { config } from "@/server/config";
import type { EventSnapshot } from "@/lib/types";
import { syncParticipation } from "@/server/calendar/sync";
import { runCalendarWorker } from "@/server/calendar/worker";
import { updateAccess } from "@/server/services/users";
import { PUBLISHED_RM, admin, lead, participant, resetDemo } from "./helpers";

// Regrese z živého testu 28. 11.: osobní kalendář se řídil jen publikem akce, přihláška ani omluva
// z `event_participation` se do Googlu nepropsaly. Kontroluje skutečné požadavky na Google API.

const ENV = {
  CALENDAR_MODE: "google-test",
  CALENDAR_DELIVERY: "personal",
  PARTICIPATION: "on",
  GOOGLE_OAUTH_CLIENT_ID: "c",
  GOOGLE_OAUTH_CLIENT_SECRET: "s",
  GOOGLE_CALENDAR_ID: "primary",
  GOOGLE_ALLOWED_CALENDAR_IDS: "primary",
  GOOGLE_ALLOWED_ATTENDEES: "a@example.com",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  APP_URL: "https://wiki.example.invalid",
};

type Call = { method: string; url: URL; body: unknown };
function fakeGoogle() {
  const calls: Call[] = [];
  const json = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status });
  const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: typeof init?.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : init?.body });
    if (url.pathname === "/token") return json(200, { access_token: "at", expires_in: 3600 });
    if (url.pathname.endsWith("/calendars") && method === "POST") return json(200, { id: "cal-1" });
    if (url.pathname.includes("/calendarList/")) return json(200, method === "GET" ? { id: "cal-1", accessRole: "owner", selected: true } : {});
    if (url.pathname.includes("/events")) return method === "DELETE" ? json(204, null) : json(200, { id: "x" });
    return json(200, { id: "cal-1" });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

let db: Awaited<ReturnType<typeof resetDemo>>;
beforeAll(async () => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  db = await resetDemo();
});
afterAll(() => vi.unstubAllEnvs());

const clock = () => new Date("2026-11-10T08:00:00Z");
const deps = (g: ReturnType<typeof fakeGoogle>) => ({ fetchImpl: g.fetchImpl, clock });
const entryIds = async () =>
  (await db.select({ eventId: personalCalendarEntries.eventId }).from(personalCalendarEntries).where(eq(personalCalendarEntries.userId, participant.id))).map((e) => e.eventId);
const setRecord = (eventId: string, kind: "voluntary_enrolled" | "withdrawn" | "excused") =>
  db
    .insert(eventParticipation)
    .values({ orgId: config.orgId, eventId, userId: participant.id, kind, excuseReason: kind === "excused" ? "illness" : null, actorId: participant.id })
    .onConflictDoUpdate({ target: [eventParticipation.orgId, eventParticipation.eventId, eventParticipation.userId], set: { kind, excuseReason: kind === "excused" ? "illness" : null } });
const request = () => db.update(personalCalendars).set({ syncRequestedAt: new Date() }).where(eq(personalCalendars.userId, participant.id));

describe("osobní kalendář podle účasti", () => {
  test("přihláška, odhlášení, omluva a zrušení omluvy mění události v Googlu", async () => {
    await savePersonalGrant(db, participant.id, { refreshToken: "rt", scopes: `openid email ${PERSONAL_SCOPE}`, accountEmail: "ucastnik@example.com" });
    expect(await syncPersonalCalendar(db, participant.id, deps(fakeGoogle()))).toBe("synced");
    const before = await entryIds();
    // Dobrovolná akce (publikum RM, účastník je FP) bez přihlášení v kalendáři není.
    expect(before).not.toContain(PUBLISHED_RM);
    const required = (await db.select({ id: events.id, published: events.published }).from(events))
      .filter((e) => e.published && (e.published as EventSnapshot).audience === "fp" && (e.published as EventSnapshot).status !== "cancelled" && new Date((e.published as EventSnapshot).startsAt) > clock())
      .map((e) => e.id)
      .find((id) => before.includes(id));
    expect(required).toBeTruthy();

    await setRecord(PUBLISHED_RM, "voluntary_enrolled");
    await setRecord(required!, "excused");
    await request();
    const g1 = fakeGoogle();
    expect(await syncPersonalCalendar(db, participant.id, deps(g1))).toBe("synced");
    const after = await entryIds();
    expect(after).toContain(PUBLISHED_RM);
    expect(after).not.toContain(required);
    expect(g1.calls.some((c) => c.method === "DELETE" && c.url.pathname.includes("/events/"))).toBe(true);
    expect(g1.calls.filter((c) => c.method !== "DELETE" && c.method !== "GET" && c.url.pathname.includes("/events")).length).toBeGreaterThan(0);

    await setRecord(PUBLISHED_RM, "withdrawn");
    await db.delete(eventParticipation).where(and(eq(eventParticipation.userId, participant.id), eq(eventParticipation.eventId, required!)));
    await request();
    const g2 = fakeGoogle();
    expect(await syncPersonalCalendar(db, participant.id, deps(g2))).toBe("synced");
    const last = await entryIds();
    expect(last).not.toContain(PUBLISHED_RM);
    expect(last).toContain(required);

    // Opakovaný běh bez změn nic nepíše (žádné duplicity).
    await request();
    const g3 = fakeGoogle();
    await syncPersonalCalendar(db, participant.id, deps(g3));
    expect(g3.calls.filter((c) => c.url.pathname.includes("/events") && c.method !== "GET").length).toBe(0);
  });

  test("po změně účasti se srovná jen kalendář toho, kdo účast změnil", async () => {
    await savePersonalGrant(db, lead.id, { refreshToken: "rt2", scopes: `openid email ${PERSONAL_SCOPE}`, accountEmail: "vedouci@example.com" });
    await db.update(personalCalendars).set({ syncRequestedAt: null, syncedAt: null }).where(eq(personalCalendars.userId, lead.id));
    await setRecord(PUBLISHED_RM, "voluntary_enrolled");
    await request();
    const g = fakeGoogle();
    vi.stubGlobal("fetch", g.fetchImpl);
    try {
      await syncParticipation(PUBLISHED_RM, participant.id);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(await entryIds()).toContain(PUBLISHED_RM);
    const [other] = await db.select({ syncedAt: personalCalendars.syncedAt, requested: personalCalendars.syncRequestedAt }).from(personalCalendars).where(eq(personalCalendars.userId, lead.id));
    expect(other).toEqual({ syncedAt: null, requested: null });
  });

  test("plánovač v osobním režimu dožene čekající změnu bez návštěvy Wiki", async () => {
    await setRecord(PUBLISHED_RM, "withdrawn");
    await request();
    const g = fakeGoogle();
    vi.stubGlobal("fetch", g.fetchImpl);
    try {
      expect(await runCalendarWorker("github")).toMatchObject({ status: "done", pending: 0 });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(await entryIds()).not.toContain(PUBLISHED_RM);
    expect(g.calls.some((c) => c.method === "DELETE" && c.url.pathname.includes("/events/"))).toBe(true);
  });

  test("změna skupin zařadí osobní kalendář dotčeného k synchronizaci", async () => {
    await db.update(personalCalendars).set({ syncRequestedAt: null }).where(eq(personalCalendars.userId, participant.id));
    await updateAccess(admin, participant.id, { role: "member", groups: ["vsichni", "fp", "rm"], status: "active" });
    const [row] = await db.select({ requested: personalCalendars.syncRequestedAt }).from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row?.requested).toBeInstanceOf(Date);
  });
});
