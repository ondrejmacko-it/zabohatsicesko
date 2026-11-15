import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { listPersonas } from "@/server/auth/personas";
import { expiredSessionCookieOptions, resolveSessionUser, sessionCookieOptions } from "@/server/auth/session";
import { config, liveWikiConfigProblems, now, wikiMode } from "@/server/config";
import { resetDatabase } from "@/server/seed";
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
