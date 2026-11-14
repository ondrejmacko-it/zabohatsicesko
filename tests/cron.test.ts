import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/cron/kalendar/route";
import { getDb } from "@/server/db/client";
import { calendarLinks } from "@/server/db/schema";
import { isCronRequest } from "@/server/cron";
import { resetDemo } from "./helpers";

// Chráněná cesta pro Vercel Cron: bez správného tajemství nic nespustí, s ním doručí pozvánky.

const SECRET = "tajemstvi-pro-test-cronu-0123456789";
const call = (authorization?: string) => GET(new Request("https://wiki.example.invalid/api/cron/kalendar", { headers: authorization ? { authorization } : {} }));
const links = async () => (await getDb()).select().from(calendarLinks).where(eq(calendarLinks.eventId, "ev-11-24"));

beforeEach(resetDemo);
afterEach(() => vi.unstubAllEnvs());

describe("cron pozvánek", () => {
  test("bez nastaveného tajemství je cesta zavřená i pro správnou hlavičku", async () => {
    expect(isCronRequest(`Bearer ${SECRET}`, undefined)).toBe(false);
    expect(isCronRequest("Bearer kratke", "kratke")).toBe(false);
    expect((await call(`Bearer ${SECRET}`)).status).toBe(401);
  });

  test("špatné nebo chybějící tajemství nic nespustí", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    for (const header of [undefined, "Bearer spatne-tajemstvi-0123456789", SECRET, `bearer ${SECRET}`]) expect((await call(header)).status).toBe(401);
    expect(await links()).toEqual([]);
  });

  test("se správným tajemstvím dostane zveřejněná akce pozvánku bez otevření Plánu", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("SIM_LATENCY_MS", "0");
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect((await links())[0]?.syncStatus).toBe("synced");
  });
});
