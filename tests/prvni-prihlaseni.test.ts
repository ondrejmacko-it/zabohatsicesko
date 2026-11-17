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

const cookieHeader = (cookies: Record<string, string>) =>
  Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

/** Odkaz bez e-mailu (důvěryhodné zařízení, `?kalendar=…`). */
async function start(query: string, cookies: Record<string, string>) {
  const { GET } = await import("@/app/api/google/prihlaseni/route");
  const response = await GET(new NextRequest(`${BASE}/api/google/prihlaseni${query}`, { headers: { cookie: cookieHeader(cookies) } }));
  return new URL(response.headers.get("location")!, BASE);
}

/** Ručně zadaná adresa: jen v těle POST, tak jak ji posílá `GoogleStart`. */
async function post(email: string, cookies: Record<string, string>, init: { query?: string; origin?: string | null; type?: string } = {}) {
  const { POST } = await import("@/app/api/google/prihlaseni/route");
  const headers: Record<string, string> = { cookie: cookieHeader(cookies), "content-type": init.type ?? "application/json" };
  if (init.origin !== null) headers.origin = init.origin ?? BASE;
  return POST(new NextRequest(`${BASE}/api/google/prihlaseni${init.query ?? ""}`, { method: "POST", headers, body: JSON.stringify({ email }) }));
}

async function startTyped(email: string, cookies: Record<string, string>, query = "") {
  const response = await post(email, cookies, { query });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const { url } = (await response.json()) as { url: string };
  return { url: new URL(url, BASE), cookie: response.headers.get("set-cookie") ?? "" };
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
    const { url, cookie } = await startTyped(" Jiny@Example.com ", { [INVITE_COOKIE]: token });
    expect(url.host).toBe("accounts.google.com");
    expect(url.searchParams.get("login_hint")).toBe("jiny@example.com");
    // Stav přihlášení (state, nonce, PKCE) je v podepsané HttpOnly cookie, bez adresy.
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie.toLowerCase()).not.toContain("jiny");
    expect(url.searchParams.get("prompt")).toContain("select_account");
    // Pozvánka zůstává platná: spotřebuje ji až úspěšné přihlášení pozvaným účtem.
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  test("neplatný tvar adresy se zahodí, nikdy se nenahradí adresou z pozvánky", async () => {
    const { url } = await startTyped("neni-adresa", { [INVITE_COOKIE]: await invite() });
    expect(url.searchParams.get("login_hint")).toBeNull();
    expect(url.toString()).not.toContain(encodeURIComponent(KOLEGA));
  });

  test("GET adresu z URL nikdy nečte (e-mail patří jen do těla POST)", async () => {
    const url = await start(`?email=${encodeURIComponent("jiny@example.com")}`, { [INVITE_COOKIE]: await invite() });
    expect(url.host).toBe("accounts.google.com");
    expect(url.searchParams.get("login_hint")).toBeNull();
  });

  test("zaváděcí správce: zadaná adresa jde do login_hint, výběr účtu zůstává", async () => {
    const { url } = await startTyped("zakladatel@gmail.test", {}, "?spravce=1");
    expect(url.host).toBe("accounts.google.com");
    expect(url.searchParams.get("login_hint")).toBe("zakladatel@gmail.test");
    expect(url.searchParams.get("prompt")).toContain("select_account");
  });

  test("POST přijme jen JSON ze stejného původu", async () => {
    const token = await invite();
    expect((await post(KOLEGA, { [INVITE_COOKIE]: token }, { origin: "https://cizi.example" })).status).toBe(403);
    expect((await post(KOLEGA, { [INVITE_COOKIE]: token }, { origin: null })).status).toBe(403);
    expect((await post(KOLEGA, { [INVITE_COOKIE]: token }, { type: "application/x-www-form-urlencoded" })).status).toBe(403);
  });

  test("důvěryhodné zařízení smí účet předvyplnit", async () => {
    const token = await invite();
    const claimed = await (await getDb()).transaction((tx) => claimInvite(tx, token, "Chrome · Windows"));
    if (!claimed.ok) throw new Error("odkaz měl platit");
    const url = await start("", { [DEVICE_COOKIE]: claimed.cookieValue });
    expect(url.searchParams.get("login_hint")).toBe(KOLEGA);
  });

  test("bez pozvánky i zařízení se na Google nepokračuje", async () => {
    const url = await start("", {});
    expect(url.pathname).toBe("/vstup");
    const { url: typed, cookie } = await startTyped(KOLEGA, {});
    expect(typed.pathname).toBe("/vstup");
    expect(typed.search).toBe("");
    expect(cookie).toBe("");
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
