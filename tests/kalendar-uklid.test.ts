import { eq, isNotNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { personalCalendarLabel, personalCalendarView } from "@/features/vzdelavani/components/PersonalCalendarStatus";
import { clearAccessTokenCache, saveGrant } from "@/server/calendar/google-auth";
import { cleanupLegacyInvites, legacyInviteCount } from "@/server/calendar/legacy-invites";
import { EVENT_FORMAT, personalSyncNeeded, savePersonalGrant } from "@/server/calendar/personal";
import { calendarLinks, events, integrationCredentials, personalCalendars } from "@/server/db/schema";
import { loadPersonalCalendars } from "@/server/services/calendar-status";
import { DomainError } from "@/server/services/errors";
import { admin, participant, resetDemo } from "./helpers";

// Úklid starých pozvánek z kalendáře správce a stavy osobního kalendáře v UI. HTTP Googlu je napodobené.

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

type Call = { method: string; url: URL };
/** Kalendář správce: `wiki` nesou `zbcKey`, `foreign` ne, `gone` už neexistují, `failing` vrací 503. */
function fakeAdminCalendar(kinds: Record<string, "wiki" | "foreign" | "gone" | "failing">) {
  const calls: Call[] = [];
  const json = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status });
  const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, url });
    if (url.pathname === "/token") return json(200, { access_token: "at", expires_in: 3600 });
    const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const kind = kinds[id] ?? "gone";
    if (kind === "failing") return json(503, {});
    if (kind === "gone") return json(404, {});
    if (method === "DELETE") return json(204, null);
    return json(200, {
      id,
      status: "confirmed",
      start: { dateTime: "2026-11-20T09:00:00+01:00" },
      end: { dateTime: "2026-11-20T10:00:00+01:00" },
      ...(kind === "wiki" ? { extendedProperties: { private: { zbcKey: `k-${id}` } } } : {}),
    });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

let db: Awaited<ReturnType<typeof resetDemo>>;
let eventIds: string[] = [];

async function linkInvites(map: Record<string, string>) {
  await db.delete(calendarLinks);
  for (const [eventId, externalEventId] of Object.entries(map)) {
    await db.insert(calendarLinks).values({ eventId, calendarId: "primary", externalEventId, managedAttendees: ["a@example.com"], syncStatus: "synced", syncedRevision: 1, attempts: 0 });
  }
}

beforeAll(async () => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  db = await resetDemo();
  await db.delete(integrationCredentials);
  clearAccessTokenCache();
  await saveGrant(db, { refreshToken: "rt-admin", scopes: "https://www.googleapis.com/auth/calendar.events", accountEmail: "spravce@example.com", userId: admin.id });
  eventIds = (await db.select({ id: events.id }).from(events).where(isNotNull(events.published)).limit(4)).map((e) => e.id);
});
afterAll(async () => {
  await db.delete(calendarLinks);
  await db.delete(integrationCredentials);
  await db.delete(personalCalendars);
  clearAccessTokenCache();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("úklid starých pozvánek", () => {
  test("jen správce: účastník nesmí počet ani úklid", async () => {
    await expect(legacyInviteCount(participant)).rejects.toBeInstanceOf(DomainError);
    await expect(cleanupLegacyInvites(participant)).rejects.toBeInstanceOf(DomainError);
    await expect(loadPersonalCalendars(participant)).rejects.toBeInstanceOf(DomainError);
  });

  test("smaže jen pozvánky Wiki bez e-mailu, cizí nechá, vazby přepne a druhý běh nic nedělá", async () => {
    const [a, b, c, d] = eventIds;
    await linkInvites({ [a!]: "wiki1", [b!]: "wiki2", [c!]: "cizi1", [d!]: "pryc1" });
    expect(await legacyInviteCount(admin)).toBe(4);
    const google = fakeAdminCalendar({ wiki1: "wiki", wiki2: "wiki", cizi1: "foreign", pryc1: "gone" });
    expect(await cleanupLegacyInvites(admin, { fetchImpl: google.fetchImpl })).toEqual({ deleted: 2, keptForeign: 1, failed: 0 });

    const deletes = google.calls.filter((call) => call.method === "DELETE");
    expect(deletes.map((call) => call.url.pathname.split("/").pop()).sort()).toEqual(["wiki1", "wiki2"]);
    for (const call of deletes) expect(call.url.searchParams.get("sendUpdates")).toBe("none");
    // Každé mazání předchází čtení, které ověří `zbcKey`.
    expect(google.calls.filter((call) => call.method === "GET" && call.url.pathname.includes("/events/"))).toHaveLength(4);

    const links = await db.select().from(calendarLinks);
    expect(links.every((l) => l.externalEventId === null && l.syncStatus === "synced" && l.leaseUntil === null && l.managedAttendees === null)).toBe(true);
    expect(await legacyInviteCount(admin)).toBe(0);

    const again = fakeAdminCalendar({});
    expect(await cleanupLegacyInvites(admin, { fetchImpl: again.fetchImpl })).toEqual({ deleted: 0, keptForeign: 0, failed: 0 });
    expect(again.calls.filter((call) => call.url.pathname.includes("/events"))).toHaveLength(0);
  });

  test("souběžný druhý klik nesmaže nic dvakrát", async () => {
    const [a, b] = eventIds;
    await linkInvites({ [a!]: "wiki1", [b!]: "wiki2" });
    const google = fakeAdminCalendar({ wiki1: "wiki", wiki2: "wiki" });
    const results = await Promise.all([cleanupLegacyInvites(admin, { fetchImpl: google.fetchImpl }), cleanupLegacyInvites(admin, { fetchImpl: google.fetchImpl })]);
    expect(results[0]!.deleted + results[1]!.deleted).toBe(2);
    expect(google.calls.filter((call) => call.method === "DELETE")).toHaveLength(2);
  });

  test("výpadek Googlu vazbu nechá na příští pokus", async () => {
    const [a] = eventIds;
    await linkInvites({ [a!]: "wiki1" });
    const failing = fakeAdminCalendar({ wiki1: "failing" });
    expect(await cleanupLegacyInvites(admin, { fetchImpl: failing.fetchImpl })).toEqual({ deleted: 0, keptForeign: 0, failed: 1 });
    const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, a!));
    expect(link!.externalEventId).toBe("wiki1");
    expect(link!.leaseUntil).toBeNull();
    expect(await cleanupLegacyInvites(admin, { fetchImpl: fakeAdminCalendar({ wiki1: "wiki" }).fetchImpl })).toEqual({ deleted: 1, keptForeign: 0, failed: 0 });
  });

  test("v režimu pozvánek se nic neuklízí", async () => {
    process.env.CALENDAR_DELIVERY = "organizer";
    try {
      expect(await legacyInviteCount(admin)).toBe(0);
      await expect(cleanupLegacyInvites(admin)).rejects.toBeInstanceOf(DomainError);
    } finally {
      process.env.CALENDAR_DELIVERY = "personal";
    }
  });
});

describe("stav osobního kalendáře", () => {
  test("každý stav má srozumitelný text a nejvýš jednu akci", () => {
    const base = { accountEmail: "ucastnik@example.com", syncedAt: null, retrying: false, blocked: false };
    expect(personalCalendarView({ ...base, status: "none" }).action).toBe("Propojit Kalendář");
    expect(personalCalendarView({ ...base, status: "declined" }).action).toBe("Propojit Kalendář");
    expect(personalCalendarView({ ...base, status: "revoked" })).toMatchObject({ badge: "Kalendář odpojen", action: "Připojit Kalendář znovu" });
    expect(personalCalendarView({ ...base, status: "calendar_deleted" }).action).toBe("Vytvořit znovu");
    const active = personalCalendarView({ ...base, status: "active", syncedAt: "2026-11-16T08:05:00Z" });
    expect(active.action).toBeNull();
    expect(active.text).toContain("ucastnik@example.com");
    expect(active.text).toContain("16. 11. v 09:05");
    expect(active.text).toContain("Připomínka přijde e-mailem týden a den před akcí");
    expect(personalCalendarView({ ...base, status: "active", retrying: true }).tone).toBe("warn");
    const blocked = personalCalendarView({ ...base, status: "active", blocked: true });
    expect(blocked.action).toBe("Připojit Kalendář znovu");
    expect(blocked.text).not.toContain("odvolán");
    expect(personalCalendarLabel(undefined)).toBe("Kalendář: nepropojen");
  });

  test("Úvod spustí synchronizaci jen tehdy, když je co dohánět", async () => {
    await db.delete(personalCalendars);
    expect(await personalSyncNeeded(db)).toBe(false);
    await savePersonalGrant(db, participant.id, { refreshToken: "rt", scopes: "x", accountEmail: "ucastnik@example.com" });
    expect(await personalSyncNeeded(db)).toBe(true);
    const later = new Date(Date.now() + 60_000);
    await db.update(personalCalendars).set({ syncedAt: later, errorCode: null, eventFormat: EVENT_FORMAT });
    expect(await personalSyncNeeded(db)).toBe(false);
    await db.update(personalCalendars).set({ errorCode: "calendar_unavailable" });
    expect(await personalSyncNeeded(db)).toBe(true);
  });
});
