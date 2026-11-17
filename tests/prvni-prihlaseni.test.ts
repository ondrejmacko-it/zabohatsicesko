import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { DEVICE_COOKIE, INVITE_COOKIE, claimInvite } from "@/server/auth/devices";
import { beginLogin, typedLoginHint } from "@/server/auth/google-login";
import { googleLoginConfig } from "@/server/config";
import { getDb } from "@/server/db/client";
import { userIdentities } from "@/server/db/schema";
import { inviteUser } from "@/server/services/users";
import { admin, resetDemo } from "./helpers";

// Začátek přihlášení na novém zařízení: adresa z pozvánky se Googlu nikdy nepředá ani nezobrazí.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const KOLEGA = "nova.kolegyne@gmail.test";
const BASE = "https://wiki.test.invalid";

beforeAll(() => {
  vi.stubEnv("LOGIN_MODE", "google-test");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "wiki-test.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "test");
  vi.stubEnv("APP_URL", BASE);
  vi.stubEnv("BOOTSTRAP_ADMIN_EMAILS", "zakladatel@gmail.test");
});
beforeEach(async () => {
  vi.stubEnv("WIKI_MODE", "");
  const db = await resetDemo();
  await db.delete(userIdentities);
  vi.stubEnv("WIKI_MODE", "production");
});
afterEach(() => vi.stubEnv("WIKI_MODE", ""));

async function start(query: string, cookies: Record<string, string>) {
  const { GET } = await import("@/app/api/google/prihlaseni/route");
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  const response = await GET(new NextRequest(`${BASE}/api/google/prihlaseni${query}`, { headers: { cookie } }));
  return new URL(response.headers.get("location")!, BASE);
}

const invite = async () => (await inviteUser(admin, { email: KOLEGA, name: "Kolegyně", role: "member", groups: ["vsichni"] })).link!.token;

describe("první přihlášení s pozvánkou", () => {
  test("bez zadané adresy Google nedostane žádnou nápovědu a nabídne výběr účtu", async () => {
    const url = await start("", { [INVITE_COOKIE]: await invite() });
    expect(url.host).toBe("accounts.google.com");
    expect(url.searchParams.get("login_hint")).toBeNull();
    expect(url.searchParams.get("prompt")).toContain("select_account");
    expect(url.toString()).not.toContain(encodeURIComponent(KOLEGA));
  });

  test("ručně zadaná adresa je jen nápověda, i když k pozvánce nepatří", async () => {
    const token = await invite();
    const url = await start(`?email=${encodeURIComponent(" Jiny@Example.com ")}`, { [INVITE_COOKIE]: token });
    expect(url.searchParams.get("login_hint")).toBe("jiny@example.com");
    expect(url.searchParams.get("prompt")).toContain("select_account");
    // Pozvánka zůstává platná: spotřebuje ji až úspěšné přihlášení pozvaným účtem.
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  test("neplatný tvar adresy se zahodí, nikdy se nenahradí adresou z pozvánky", async () => {
    const url = await start("?email=neni-adresa", { [INVITE_COOKIE]: await invite() });
    expect(url.searchParams.get("login_hint")).toBeNull();
  });

  test("důvěryhodné zařízení smí účet předvyplnit", async () => {
    const token = await invite();
    const claimed = await (await getDb()).transaction((tx) => claimInvite(tx, token, "Chrome · Windows"));
    if (!claimed.ok) throw new Error("odkaz měl platit");
    const url = await start("", { [DEVICE_COOKIE]: claimed.cookieValue });
    expect(url.searchParams.get("login_hint")).toBe(KOLEGA);
  });

  test("bez pozvánky i zařízení se na Google nepokračuje", async () => {
    const url = await start(`?email=${encodeURIComponent(KOLEGA)}`, {});
    expect(url.pathname).toBe("/vstup");
  });
});

describe("nápověda účtu", () => {
  test("typedLoginHint přijme jen rozumný tvar adresy", () => {
    expect(typedLoginHint("a@b.cz")).toBe("a@b.cz");
    expect(typedLoginHint(" A@B.CZ ")).toBe("a@b.cz");
    expect(typedLoginHint("a@b")).toBeUndefined();
    expect(typedLoginHint("a b@c.cz")).toBeUndefined();
    expect(typedLoginHint(`${"a".repeat(250)}@b.cz`)).toBeUndefined();
    expect(typedLoginHint(null)).toBeUndefined();
  });

  test("nové zařízení se souhlasem ke Kalendáři dál nabízí výběr účtu", () => {
    const cfg = googleLoginConfig()!;
    const url = new URL(beginLogin(cfg, undefined, { calendar: "personal", scope: { kind: "invite", userId: "u" }, loginHint: "a@b.cz" }).url);
    expect(url.searchParams.get("prompt")).toBe("select_account consent");
    const known = new URL(beginLogin(cfg, undefined, { calendar: "personal", scope: { kind: "device", deviceId: "d", userId: "u" }, loginHint: "a@b.cz" }).url);
    expect(known.searchParams.get("prompt")).toBe("consent");
  });
});
