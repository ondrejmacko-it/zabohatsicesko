import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { encodeGate, gateTokenValid } from "@/server/auth/gate";
import { listPersonas } from "@/server/auth/personas";
import { expiredSessionCookieOptions, resolveSessionUser, sessionCookieOptions } from "@/server/auth/session";
import { config, liveWikiConfigProblems, now, wikiMode } from "@/server/config";
import { resetDatabase, seedDatabase } from "@/server/seed";
import { resetDemo } from "./helpers";

// Oddělení ukázky od ostré Wiki (WIKI_MODE=production) a funkční odhlášení.

beforeAll(async () => {
  await resetDemo();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("odhlášení", () => {
  test("mazací cookie nese stejné atributy jako uložení, jinak prohlížeč __Host- cookie ponechá", () => {
    expect(expiredSessionCookieOptions.secure).toBe(sessionCookieOptions.secure);
    expect(expiredSessionCookieOptions.path).toBe("/");
    expect(expiredSessionCookieOptions.httpOnly).toBe(true);
    expect(expiredSessionCookieOptions.maxAge).toBe(0);
    expect(expiredSessionCookieOptions.expires.getTime()).toBe(0);
  });
});

describe("ostrá Wiki", () => {
  test("bez proměnné běží ukázka", () => {
    vi.stubEnv("WIKI_MODE", "");
    expect(wikiMode()).toBe("demo");
    vi.stubEnv("WIKI_MODE", "produkce");
    expect(wikiMode()).toBe("demo");
  });

  test("odmítne session fiktivní role, i platně podepsanou", async () => {
    const { getDb } = await import("@/server/db/client");
    const db = await getDb();
    expect(await resolveSessionUser(db, { userId: "demo-spravce", method: "demo" })).not.toBeNull();
    vi.stubEnv("WIKI_MODE", "production");
    expect(await resolveSessionUser(db, { userId: "demo-spravce", method: "demo" })).toBeNull();
  });

  test("nenabízí fiktivní role a neobnoví ukázková data", async () => {
    vi.stubEnv("WIKI_MODE", "production");
    expect(await listPersonas()).toEqual([]);
    const { getDb } = await import("@/server/db/client");
    const db = await getDb();
    await expect(db.transaction((tx) => resetDatabase(tx))).rejects.toThrow(/zakázaná/);
  });

  test("běží ve skutečném čase i s ukázkovými hodinami", () => {
    vi.stubEnv("WIKI_MODE", "production");
    expect(config.useRealClock).toBe(true);
    expect(now().getTime()).not.toBe(config.referenceNow.getTime());
  });

  test("hlásí chybějící přihlášení Googlem a Kalendář jen názvy proměnných", () => {
    vi.stubEnv("WIKI_MODE", "production");
    vi.stubEnv("LOGIN_MODE", "");
    vi.stubEnv("CALENDAR_MODE", "");
    expect(liveWikiConfigProblems()).toEqual(["LOGIN_MODE", "CALENDAR_MODE"]);
    vi.stubEnv("WIKI_MODE", "");
    expect(liveWikiConfigProblems()).toEqual([]);
  });
});

describe("Kalendář ostré Wiki", () => {
  test("testovací příjemci jsou povinní jen při omezení pozvánek na ně", async () => {
    const { googleCalendarConfigProblems } = await import("@/server/config");
    vi.stubEnv("GOOGLE_ALLOWED_ATTENDEES", "");
    vi.stubEnv("CALENDAR_ATTENDEES", "");
    expect(googleCalendarConfigProblems()).toContain("GOOGLE_ALLOWED_ATTENDEES");
    vi.stubEnv("CALENDAR_ATTENDEES", "audience");
    expect(googleCalendarConfigProblems()).not.toContain("GOOGLE_ALLOWED_ATTENDEES");
  });
});

describe("prázdná databáze ostré Wiki", () => {
  test("dostane jen pravidelný týden, žádné fiktivní osoby, akce ani témata", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { prepareDatabase, queryRows } = await import("@/server/db/client");
    const schema = await import("@/server/db/schema");
    const { sql } = await import("drizzle-orm");
    const db = drizzle({ client: new PGlite(), schema }) as unknown as Parameters<typeof prepareDatabase>[0];
    vi.stubEnv("WIKI_MODE", "production");
    await prepareDatabase(db);
    await prepareDatabase(db); // opakovaný start nic nezdvojí
    const [counts] = await queryRows<Record<string, number>>(
      db,
      sql`SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM events) AS events,
        (SELECT count(*)::int FROM topics) AS topics, (SELECT count(*)::int FROM template_slots) AS slots`,
    );
    expect(counts).toEqual({ users: 0, events: 0, topics: 0, slots: 4 });
    await expect(db.transaction((tx) => seedDatabase(tx))).rejects.toThrow(/zakázaný/);
  });
});

describe("zvací odkaz ukázky", () => {
  const CODE = "kod-pro-ukazku-123";
  const NOW = 1_800_000_000;

  test("cookie brány platí jen pro aktuální kód a do vypršení", () => {
    const token = encodeGate(CODE, NOW);
    expect(gateTokenValid(token, CODE, NOW + 60)).toBe(true);
    expect(gateTokenValid(token, "jiny-kod-po-zmene", NOW + 60)).toBe(false);
    expect(gateTokenValid(token, CODE, NOW + 8 * 24 * 3600)).toBe(false);
    expect(gateTokenValid(token, null, NOW)).toBe(false);
    const [data] = token.split(".");
    expect(gateTokenValid(`${data}.podvrh`, CODE, NOW)).toBe(false);
    expect(gateTokenValid(undefined, CODE, NOW)).toBe(false);
  });
});
