import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { beginLogin, verifyLoginState } from "@/server/auth/google-login";
import { PERSONAL_SCOPE, needsPersonalCalendar, personalCalendarState, savePersonalGrant, syncPersonalCalendar } from "@/server/calendar/personal";
import { calendarDelivery } from "@/server/config";
import { personalCalendarEntries, personalCalendars, users } from "@/server/db/schema";
import { participant, resetDemo } from "./helpers";

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
function fakeGoogle(opts: { revoked?: boolean; failEvents?: number } = {}) {
  const calls: Call[] = [];
  let failures = opts.failEvents ?? 0;
  const json = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status });
  const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = typeof init?.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : init?.body;
    calls.push({ method: init?.method ?? "GET", url, body });
    if (url.pathname === "/token") return opts.revoked ? json(400, { error: "invalid_grant" }) : json(200, { access_token: "at", expires_in: 3600 });
    if (url.pathname === "/revoke") return json(200, {});
    if (url.pathname.endsWith("/calendars") && init?.method === "POST") return json(200, { id: "cal-1" });
    if (url.pathname.includes("/calendarList/")) return json(200, {});
    if (url.pathname.includes("/events")) {
      if (failures-- > 0) return json(503, {});
      return init?.method === "DELETE" ? json(204, null) : json(200, { id: "x" });
    }
    if (init?.method === "DELETE") return json(204, null);
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
    const list = google.calls.find((c) => c.url.pathname.includes("/calendarList/"))!;
    expect((list.body as { notificationSettings: { notifications: unknown[] } }).notificationSettings.notifications).toHaveLength(4);
    const writes = google.calls.filter((c) => c.url.pathname.includes("/events"));
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      expect(w.url.searchParams.get("sendUpdates")).toBe("none");
      expect((w.body as { attendees?: unknown }).attendees).toBeUndefined();
    }
    expect(await needsPersonalCalendar(db, participant.id)).toBe(false);
    // Druhý běh bez změn Google vůbec nevolá.
    const idle = fakeGoogle();
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: idle.fetchImpl, clock })).toBe("synced");
    expect(idle.calls).toHaveLength(0);
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
    const removal = fakeGoogle();
    expect(await syncPersonalCalendar(db, participant.id, { fetchImpl: removal.fetchImpl, clock })).toBe("removed");
    expect(removal.calls.some((c) => c.url.pathname === "/revoke")).toBe(true);
    expect(await db.select().from(personalCalendars).where(eq(personalCalendars.userId, participant.id))).toHaveLength(0);
  });
});
