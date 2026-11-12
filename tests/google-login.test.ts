import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  beginLogin,
  clearSigningKeyCache,
  completeLogin,
  googleSessionAllowed,
  verifyIdToken,
  verifyLoginState,
} from "@/server/auth/google-login";
import { encodeSession, readSession } from "@/server/auth/session";
import { googleLoginConfig, googleLoginConfigProblems } from "@/server/config";
import { getDb } from "@/server/db/client";
import { userIdentities, users } from "@/server/db/schema";
import { resetDatabase } from "@/server/seed";
import { resetDemo } from "./helpers";

// Přihlášení Google identitou proti napodobenému Googlu (token endpoint a veřejné klíče).
// Ověřuje pravidla Wiki, NE skutečné chování Googlu. Živé přihlášení tyto testy nenahrazují.

const CLIENT_ID = "wiki-test.apps.googleusercontent.com";
const ORGANIZER_EMAIL = "organizator.test@example.com";
const MEMBER_EMAIL = "kolega.test@example.com";
const NOW = 1_800_000_000;
const NONCE = "nonce-teto-zadosti";

const ENV = {
  LOGIN_MODE: "google-test",
  GOOGLE_OAUTH_CLIENT_ID: CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: "tajemstvi-jen-pro-test",
  GOOGLE_LOGIN_ACCOUNTS: `${ORGANIZER_EMAIL}=demo-organizator, ${MEMBER_EMAIL}=demo-ucastnik`,
  APP_URL: "https://wiki.test.invalid",
};

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** Napodobený Google: vydává ID tokeny podepsané vlastním klíčem a zveřejňuje jeho veřejnou část. */
class FakeGoogle {
  private pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  kid = "klic-1";
  /** ID token, který vrátí další výměna kódu. */
  nextIdToken: string | null = null;
  tokenRequests: URLSearchParams[] = [];
  jwksRequests = 0;

  claims(overrides: Record<string, unknown> = {}) {
    return {
      iss: "https://accounts.google.com",
      aud: CLIENT_ID,
      azp: CLIENT_ID,
      sub: "google-sub-organizator",
      email: ORGANIZER_EMAIL,
      email_verified: true,
      nonce: NONCE,
      iat: NOW - 5,
      exp: NOW + 3600,
      ...overrides,
    };
  }

  sign(claims: Record<string, unknown>, options: { key?: KeyObject; header?: Record<string, unknown> } = {}): string {
    const input = `${b64({ alg: "RS256", kid: this.kid, typ: "JWT", ...options.header })}.${b64(claims)}`;
    const signature = createSign("RSA-SHA256").update(input).sign(options.key ?? this.pair.privateKey).toString("base64url");
    return `${input}.${signature}`;
  }

  rotateKey() {
    this.pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    this.kid = "klic-2";
  }

  fetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/oauth2/v3/certs")) {
      this.jwksRequests += 1;
      const jwk = { ...this.pair.publicKey.export({ format: "jwk" }), kid: this.kid, alg: "RS256", use: "sig" };
      return Response.json({ keys: [jwk] }, { headers: { "cache-control": "public, max-age=3600" } });
    }
    if (url.includes("/token")) {
      this.tokenRequests.push(new URLSearchParams(String(init?.body)));
      if (!this.nextIdToken) return Response.json({ error: "invalid_grant" }, { status: 400 });
      return Response.json({ access_token: "nepouzity", id_token: this.nextIdToken });
    }
    throw new Error(`Nečekaný požadavek: ${url}`);
  };
}

let google: FakeGoogle;
const verifyToken = (token: string) => verifyIdToken(token, { clientId: CLIENT_ID, nonce: NONCE }, google.fetch, NOW);
const login = async (claims: Record<string, unknown> = {}) => {
  google.nextIdToken = google.sign(google.claims(claims));
  return completeLogin(await getDb(), googleLoginConfig()!, { code: "kod", verifier: "overovac", nonce: NONCE }, google.fetch, NOW);
};

beforeAll(() => {
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
});
afterAll(() => {
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  google = new FakeGoogle();
  clearSigningKeyCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const db = await resetDemo();
  await db.delete(userIdentities);
});

describe("konfigurace přihlášení", () => {
  test("zapíná se výslovně a neúplná konfigurace přihlášení nezapne", () => {
    expect(googleLoginConfig()?.accounts.get(MEMBER_EMAIL)).toBe("demo-ucastnik");
    vi.stubEnv("LOGIN_MODE", "");
    expect(googleLoginConfig()).toBeNull();
    vi.stubEnv("LOGIN_MODE", "google-test");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "");
    expect(googleLoginConfig()).toBeNull();
    expect(googleLoginConfigProblems()).toEqual(["GOOGLE_OAUTH_CLIENT_SECRET"]);
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", ENV.GOOGLE_OAUTH_CLIENT_SECRET);
    // Zaváděcí seznam je volitelný. Bez něj pouští dovnitř jen pozvánky a schválené žádosti.
    vi.stubEnv("GOOGLE_LOGIN_ACCOUNTS", "");
    expect(googleLoginConfig()?.accounts.size).toBe(0);
    vi.stubEnv("GOOGLE_LOGIN_ACCOUNTS", ENV.GOOGLE_LOGIN_ACCOUNTS);
  });

  test("odmítne seznam, kde má jeden uživatel dva účty nebo položka nemá tvar adresa=uživatel", () => {
    vi.stubEnv("GOOGLE_LOGIN_ACCOUNTS", `${ORGANIZER_EMAIL}=demo-organizator,${MEMBER_EMAIL}=demo-organizator`);
    expect(googleLoginConfig()).toBeNull();
    vi.stubEnv("GOOGLE_LOGIN_ACCOUNTS", "example.com=demo-organizator");
    expect(googleLoginConfig()).toBeNull();
    vi.stubEnv("GOOGLE_LOGIN_ACCOUNTS", ENV.GOOGLE_LOGIN_ACCOUNTS);
  });
});

describe("stav žádosti", () => {
  test("žádá jen identitu, používá PKCE a nonce a platí pro stejný prohlížeč a krátkou dobu", () => {
    const start = beginLogin(googleLoginConfig()!, NOW);
    const url = new URL(start.url);
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("redirect_uri")).toBe("https://wiki.test.invalid/api/google/prihlaseni/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = url.searchParams.get("state");
    const verified = verifyLoginState(start.cookieValue, state, NOW + 60);
    expect(verified?.nonce).toBe(url.searchParams.get("nonce"));
    expect(verified?.verifier).toBeTruthy();

    expect(verifyLoginState(start.cookieValue, "cizi-stav", NOW + 60)).toBeNull();
    expect(verifyLoginState(undefined, state, NOW + 60)).toBeNull();
    expect(verifyLoginState(start.cookieValue, state, NOW + 11 * 60)).toBeNull();
    const [data, signature] = start.cookieValue.split(".");
    expect(verifyLoginState(`${data}x.${signature}`, state, NOW + 60)).toBeNull();
    // Cookie druhé žádosti k první odpovědi nepasuje.
    expect(verifyLoginState(beginLogin(googleLoginConfig()!, NOW).cookieValue, state, NOW + 60)).toBeNull();
  });
});

describe("ověření ID tokenu", () => {
  test("přijme platný token a vrátí sub a e-mail malými písmeny", async () => {
    const result = await verifyToken(google.sign(google.claims({ email: "Organizator.Test@Example.com" })));
    expect(result).toEqual({ ok: true, identity: { sub: "google-sub-organizator", email: ORGANIZER_EMAIL, name: null } });
  });

  test.each([
    ["cizí vydavatel", { iss: "https://accounts.example.com" }, "bad_issuer"],
    ["cizí příjemce", { aud: "jiny-klient.apps.googleusercontent.com" }, "bad_audience"],
    ["token vydaný pro jiného klienta", { aud: [CLIENT_ID, "jiny"], azp: "jiny" }, "bad_audience"],
    ["prošlý token", { exp: NOW - 120 }, "expired"],
    ["token z budoucnosti", { iat: NOW + 600 }, "expired"],
    ["cizí nonce", { nonce: "jina-zadost" }, "bad_nonce"],
    ["chybějící nonce", { nonce: undefined }, "bad_nonce"],
    ["neověřený e-mail", { email_verified: false }, "email_unverified"],
    ["ověření jako text", { email_verified: "true" }, "email_unverified"],
    ["chybějící sub", { sub: "" }, "malformed"],
  ])("odmítne: %s", async (_name, overrides, problem) => {
    expect(await verifyToken(google.sign(google.claims(overrides)))).toEqual({ ok: false, problem });
  });

  test("odmítne podpis cizím klíčem, pozměněný obsah a jiný algoritmus", async () => {
    const foreign = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    expect(await verifyToken(google.sign(google.claims(), { key: foreign }))).toEqual({ ok: false, problem: "bad_signature" });

    const [header, , signature] = google.sign(google.claims()).split(".");
    const tampered = `${header}.${b64(google.claims({ email: MEMBER_EMAIL }))}.${signature}`;
    expect(await verifyToken(tampered)).toEqual({ ok: false, problem: "bad_signature" });

    const unsigned = `${b64({ alg: "none", kid: google.kid })}.${b64(google.claims())}.`;
    expect(await verifyToken(unsigned)).toEqual({ ok: false, problem: "malformed" });
    expect(await verifyToken(google.sign(google.claims(), { header: { alg: "HS256" } }))).toEqual({ ok: false, problem: "unsupported_alg" });
    expect(await verifyToken(google.sign(google.claims(), { header: { kid: "neznamy" } }))).toEqual({ ok: false, problem: "unknown_key" });
    expect(await verifyToken("neni-token")).toEqual({ ok: false, problem: "malformed" });
  });

  test("klíče drží v paměti a po výměně klíče u Googlu je stáhne znovu", async () => {
    await verifyToken(google.sign(google.claims()));
    await verifyToken(google.sign(google.claims()));
    expect(google.jwksRequests).toBe(1);
    google.rotateKey();
    expect((await verifyToken(google.sign(google.claims()))).ok).toBe(true);
    expect(google.jwksRequests).toBe(2);
  });
});

describe("dokončení přihlášení", () => {
  const identities = async () => (await getDb()).select().from(userIdentities);

  test("první přihlášení sváže účet se sub, další ho jen pozná a role zůstává z databáze", async () => {
    expect(await login()).toEqual({ ok: true, userId: "demo-organizator" });
    expect(google.tokenRequests[0]?.get("code_verifier")).toBe("overovac");
    expect(await identities()).toMatchObject([{ provider: "google", subject: "google-sub-organizator", userId: "demo-organizator" }]);
    expect(await login()).toEqual({ ok: true, userId: "demo-organizator" });
    expect(await identities()).toHaveLength(1);
    const [user] = await (await getDb()).select().from(users).where(eq(users.id, "demo-organizator"));
    expect(user?.role).toBe("organizer");
    // Tvrzení o roli v tokenu nic nezmění, Wiki ho nečte.
    expect(await login({ sub: "google-sub-kolega", email: MEMBER_EMAIL, role: "organizer" })).toEqual({ ok: true, userId: "demo-ucastnik" });
    const [member] = await (await getDb()).select().from(users).where(eq(users.id, "demo-ucastnik"));
    expect(member?.role).toBe("member");
  });

  test("neplatný token a selhání výměny dovnitř nepustí a nic neuloží", async () => {
    expect(await login({ email_verified: false })).toEqual({ ok: false, reason: "invalid_token" });
    google.nextIdToken = null;
    const cfg = googleLoginConfig()!;
    expect(await completeLogin(await getDb(), cfg, { code: "kod", verifier: "v", nonce: NONCE }, google.fetch, NOW)).toEqual({
      ok: false,
      reason: "exchange_failed",
    });
    expect(await identities()).toHaveLength(0);
  });

  test("stejná adresa s jiným sub ani stejný sub u jiného uživatele neprojde", async () => {
    await login();
    // Adresu později získal jiný účet Google.
    expect(await login({ sub: "jiny-ucet-se-stejnou-adresou" })).toEqual({ ok: false, reason: "account_conflict" });
    // Tentýž účet Google si změnil adresu na adresu jiného uživatele: rozhoduje `sub`, ne adresa.
    expect(await login({ email: MEMBER_EMAIL })).toEqual({ ok: true, userId: "demo-organizator" });
    // Uživatel se svázaným účtem nedostane druhý účet Google, ani přes zaváděcí seznam.
    await login({ sub: "google-sub-kolega", email: MEMBER_EMAIL });
    expect(await login({ sub: "dalsi-ucet", email: MEMBER_EMAIL })).toEqual({ ok: false, reason: "account_conflict" });
    expect(await identities()).toHaveLength(2);
  });

  test("do logu jde jen kód důvodu, ne adresa ani sub", async () => {
    await login({ email: "cizi@example.com", sub: "cizi-sub-123" });
    await (await getDb()).update(users).set({ status: "disabled" }).where(eq(users.email, "cizi@example.com"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await login({ email: "cizi@example.com", sub: "cizi-sub-123" })).toEqual({ ok: false, reason: "not_allowed" });
    const written = log.mock.calls.flat().join(" ");
    expect(written).toContain("not_allowed");
    expect(written).not.toContain("cizi@example.com");
    expect(written).not.toContain("cizi-sub-123");
  });
});

describe("session z přihlášení Google", () => {
  test("nese způsob přihlášení a starší cookie bez něj je fiktivní role", () => {
    expect(readSession(encodeSession("demo-organizator", NOW, "google"), NOW + 1)).toEqual({ userId: "demo-organizator", method: "google" });
    expect(readSession(encodeSession("demo-organizator", NOW), NOW + 1)).toEqual({ userId: "demo-organizator", method: "demo" });
  });

  test("přestane platit po zrušení vazby i vypnutí režimu", async () => {
    const db = await getDb();
    expect(await googleSessionAllowed(db, "demo-organizator")).toBe(false);
    await login();
    expect(await googleSessionAllowed(db, "demo-organizator")).toBe(true);
    expect(await googleSessionAllowed(db, "demo-ucastnik")).toBe(false);

    vi.stubEnv("LOGIN_MODE", "");
    expect(await googleSessionAllowed(db, "demo-organizator")).toBe(false);
    vi.stubEnv("LOGIN_MODE", "google-test");

    await db.delete(userIdentities);
    expect(await googleSessionAllowed(db, "demo-organizator")).toBe(false);
  });

  test("obnova ukázkových dat vazby na účty zachová", async () => {
    await login();
    const db = await getDb();
    await db.transaction((tx) => resetDatabase(tx));
    expect(await googleSessionAllowed(db, "demo-organizator")).toBe(true);
  });
});
