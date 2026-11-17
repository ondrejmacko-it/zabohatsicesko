import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { migrationInventory, retireWikiCalendars } from "@/server/calendar/migration";
import { PERSONAL_SCOPE, savePersonalGrant } from "@/server/calendar/personal";
import { calendarLinks, personalCalendars } from "@/server/db/schema";
import { participant, resetDemo } from "./helpers";

// Přechod na organizátora (PR B): inventura jen čte, úklid osobních kalendářů je bez schváleného otisku
// jen dry-run a v osobním režimu se odmítne. Ostré adresy Googlu se nevolají.

const ENV = {
  CALENDAR_MODE: "google-test",
  CALENDAR_DELIVERY: "personal",
  GOOGLE_OAUTH_CLIENT_ID: "c",
  GOOGLE_OAUTH_CLIENT_SECRET: "s",
  GOOGLE_CALENDAR_ID: "primary",
  GOOGLE_ALLOWED_CALENDAR_IDS: "primary",
  GOOGLE_ALLOWED_ATTENDEES: "a@example.com",
  // Režim organizátora bez známého účtu organizátora konfiguraci nepovolí (pojistka z #57).
  GOOGLE_ORGANIZER_EMAIL: "organizator@example.com",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  APP_URL: "https://wiki.example.invalid",
};
const saved: Record<string, string | undefined> = {};

function recordingFetch(deleteStatus = 204) {
  const calls: Array<{ method: string; path: string }> = [];
  const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ method: init?.method ?? "GET", path: url.pathname });
    if (url.pathname === "/token") return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), { status: 200 });
    if (init?.method === "DELETE") {
      if (deleteStatus === 204) return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ error: { errors: [{ reason: deleteStatus === 403 ? "forbidden" : "backendError" }] } }), { status: deleteStatus });
    }
    return new Response("{}", { status: 200 });
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
  await savePersonalGrant(db, participant.id, { refreshToken: "rt", scopes: `openid email ${PERSONAL_SCOPE}`, accountEmail: "ucastnik@example.com" });
  await db.update(personalCalendars).set({ calendarId: "cal-1" }).where(eq(personalCalendars.userId, participant.id));
});
afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("přechod na organizátora", () => {
  test("inventura jen čte a vrací počty bez adres", async () => {
    const linksBefore = await db.select().from(calendarLinks);
    const inventory = await migrationInventory(db);
    expect(inventory.futureEvents).toBeGreaterThan(0);
    expect(inventory.invitations).toBeGreaterThanOrEqual(inventory.recipients);
    expect(inventory.personalCalendars).toEqual({ total: 1, active: 1, withCalendar: 1, removalFailed: 0 });
    expect(inventory.fingerprint).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(inventory)).not.toContain("@");
    expect(await db.select().from(calendarLinks)).toEqual(linksBefore);
    expect((await migrationInventory(db)).fingerprint).toBe(inventory.fingerprint);
  });

  test("bez otisku jen dry-run: žádné volání Googlu, nic se nesmaže", async () => {
    const google = recordingFetch();
    const result = await retireWikiCalendars(db, { fetchImpl: google.fetchImpl });
    expect(result).toMatchObject({ mode: "dry-run", wouldRemove: 1 });
    expect(google.calls).toEqual([]);
    expect(await db.select().from(personalCalendars)).toHaveLength(1);
  });

  test("v osobním režimu a se špatným otiskem se úklid odmítne", async () => {
    const google = recordingFetch();
    const { fingerprint } = await migrationInventory(db);
    await expect(retireWikiCalendars(db, { approvedFingerprint: fingerprint, fetchImpl: google.fetchImpl })).rejects.toThrow(/osobní režim/);
    process.env.CALENDAR_DELIVERY = "organizer";
    await expect(retireWikiCalendars(db, { approvedFingerprint: "000000000000", fetchImpl: google.fetchImpl })).rejects.toThrow(/otisk/);
    expect(google.calls).toEqual([]);
    expect(await db.select().from(personalCalendars)).toHaveLength(1);
  });

  test("když Google smazání odmítne, token ani řádek se nemažou a další úklid to zopakuje", async () => {
    process.env.CALENDAR_DELIVERY = "organizer";
    const refused = recordingFetch(403);
    const { fingerprint } = await migrationInventory(db);
    expect(await retireWikiCalendars(db, { approvedFingerprint: fingerprint, fetchImpl: refused.fetchImpl })).toEqual({ mode: "done", removed: 0, failed: 1 });
    expect(refused.calls).toContainEqual({ method: "DELETE", path: "/calendar/v3/calendars/cal-1" });
    expect(refused.calls.some((c) => c.path === "/revoke")).toBe(false);
    const [row] = await db.select().from(personalCalendars);
    expect(row).toMatchObject({ status: "removal_failed", errorCode: "forbidden_forbidden", calendarId: "cal-1" });
    expect(row!.encryptedRefreshToken).not.toBe("");
    const after = await migrationInventory(db);
    expect(after.personalCalendars.removalFailed).toBe(1);
    expect(after.fingerprint).not.toBe(fingerprint);

    const unavailable = recordingFetch(503);
    expect(await retireWikiCalendars(db, { approvedFingerprint: after.fingerprint, fetchImpl: unavailable.fetchImpl })).toEqual({ mode: "done", removed: 0, failed: 1 });
    expect((await db.select().from(personalCalendars))[0]).toMatchObject({ status: "removal_failed", errorCode: "calendar_unavailable" });
  });

  test("se schváleným otiskem po přepnutí smaže kalendář Wiki a zneplatní token", async () => {
    process.env.CALENDAR_DELIVERY = "organizer";
    const google = recordingFetch();
    const { fingerprint } = await migrationInventory(db);
    expect(await retireWikiCalendars(db, { approvedFingerprint: fingerprint, fetchImpl: google.fetchImpl })).toEqual({ mode: "done", removed: 1, failed: 0 });
    expect(google.calls).toContainEqual({ method: "DELETE", path: "/calendar/v3/calendars/cal-1" });
    expect(google.calls.some((c) => c.path === "/revoke")).toBe(true);
    expect(await db.select().from(personalCalendars)).toHaveLength(0);
    expect((await migrationInventory(db)).fingerprint).not.toBe(fingerprint);
  });

  test("kalendář už smazaný v Googlu (404) je úspěch", async () => {
    process.env.CALENDAR_DELIVERY = "personal";
    await savePersonalGrant(db, participant.id, { refreshToken: "rt2", scopes: `openid email ${PERSONAL_SCOPE}`, accountEmail: "ucastnik@example.com" });
    await db.update(personalCalendars).set({ calendarId: "cal-2" }).where(eq(personalCalendars.userId, participant.id));
    process.env.CALENDAR_DELIVERY = "organizer";
    const gone = recordingFetch(404);
    const { fingerprint } = await migrationInventory(db);
    expect(await retireWikiCalendars(db, { approvedFingerprint: fingerprint, fetchImpl: gone.fetchImpl })).toEqual({ mode: "done", removed: 1, failed: 0 });
    expect(gone.calls.some((c) => c.path === "/revoke")).toBe(true);
    expect(await db.select().from(personalCalendars)).toHaveLength(0);
  });
});
