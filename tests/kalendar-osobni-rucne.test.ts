import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { PERSONAL_SCOPE, savePersonalGrant } from "@/server/calendar/personal";
import { personalCalendars } from "@/server/db/schema";
import { syncOwnCalendarNow } from "@/server/services/calendar-status";
import { DomainError } from "@/server/services/errors";
import { participant, resetDemo } from "./helpers";

// „Synchronizovat teď“ v menu Účet: jen v osobním režimu, jen s funkčním propojením a jen vlastní kalendář.

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

function fakeGoogle() {
  const calls: string[] = [];
  const json = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status });
  const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url.pathname}`);
    if (url.pathname === "/token") return json(200, { access_token: "at", expires_in: 3600 });
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

const deps = (g: ReturnType<typeof fakeGoogle>) => ({ fetchImpl: g.fetchImpl, clock: () => new Date("2026-11-10T08:00:00Z") });

describe("ruční synchronizace vlastního Kalendáře", () => {
  test("bez propojení odmítne a Google nevolá", async () => {
    const g = fakeGoogle();
    await expect(syncOwnCalendarNow(participant, deps(g))).rejects.toBeInstanceOf(DomainError);
    expect(g.calls).toEqual([]);
  });

  test("s funkčním propojením srovná kalendář a zapíše čas synchronizace", async () => {
    await savePersonalGrant(db, participant.id, { refreshToken: "rt", scopes: `openid email ${PERSONAL_SCOPE}`, accountEmail: "ucastnik@example.com" });
    const g = fakeGoogle();
    expect(await syncOwnCalendarNow(participant, deps(g))).toBe("synced");
    expect(g.calls.some((c) => c.startsWith("POST") && c.includes("/events"))).toBe(true);
    const [row] = await db.select({ syncedAt: personalCalendars.syncedAt }).from(personalCalendars).where(eq(personalCalendars.userId, participant.id));
    expect(row?.syncedAt).toBeTruthy();
    // Druhé kolo bez změn: jen kontrola přístupu, žádný zápis událostí.
    const again = fakeGoogle();
    expect(await syncOwnCalendarNow(participant, deps(again))).toBe("synced");
    expect(again.calls.filter((c) => !c.startsWith("GET") && c.includes("/events"))).toEqual([]);
  });

  test("mimo osobní režim odmítne", async () => {
    vi.stubEnv("CALENDAR_DELIVERY", "invite");
    await expect(syncOwnCalendarNow(participant, deps(fakeGoogle()))).rejects.toBeInstanceOf(DomainError);
    vi.stubEnv("CALENDAR_DELIVERY", "personal");
  });
});
