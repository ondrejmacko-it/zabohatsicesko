import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { logError } from "@/server/audit";
import { config, googleLoginConfig, type GoogleLoginConfig } from "@/server/config";
import type { Executor } from "@/server/db/client";
import { userIdentities, users } from "@/server/db/schema";

// Přihlášení uživatele Google identitou (OpenID Connect, tok s autorizačním kódem a PKCE).
// Oddělené od OAuth pro Kalendář: žádá jen `openid email`, žádný token se neukládá.
// Google tu říká jen KDO se přihlásil. Role a skupiny zůstávají v databázi Wiki.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const PROVIDER = "google" as const;
const TIMEOUT_MS = 10_000;
const STATE_TTL_SEC = 10 * 60;
/** Tolerance rozdílu hodin mezi serverem a Googlem. */
const CLOCK_SKEW_SEC = 60;

export type FetchLike = typeof fetch;

// ——— Stav, nonce a PKCE ———

const signState = (data: string) => createHmac("sha256", config.sessionSecret).update(`google-login:${data}`).digest("base64url");

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export type LoginStart = { url: string; cookieValue: string };

/**
 * Připraví přesměrování na Google. Stav, nonce a PKCE ověřovač zůstávají v podepsané HttpOnly cookie
 * téhož prohlížeče, takže cizí odpověď od Googlu nejde podstrčit (login CSRF) ani přehrát.
 */
export function beginLogin(cfg: GoogleLoginConfig, nowSec = Math.floor(Date.now() / 1000)): LoginStart {
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const data = Buffer.from(JSON.stringify({ state, nonce, verifier, exp: nowSec + STATE_TTL_SEC })).toString("base64url");
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "openid email",
    // Vždy nabídnout výběr účtu, aby se tester nepřihlásil omylem jiným účtem z prohlížeče.
    prompt: "select_account",
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return { url: url.toString(), cookieValue: `${data}.${signState(data)}` };
}

/** Ověří stav z callbacku proti cookie. Vrací nonce a PKCE ověřovač, nebo null. */
export function verifyLoginState(
  cookieValue: string | undefined,
  state: string | null,
  nowSec = Math.floor(Date.now() / 1000),
): { nonce: string; verifier: string } | null {
  if (!cookieValue || !state) return null;
  const [data, signature] = cookieValue.split(".");
  if (!data || !signature || !safeEqual(signState(data), signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof payload.state !== "string" || typeof payload.nonce !== "string" || typeof payload.verifier !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp <= nowSec) return null;
    return safeEqual(payload.state, state) ? { nonce: payload.nonce, verifier: payload.verifier } : null;
  } catch {
    return null;
  }
}

// ——— Veřejné klíče Googlu ———

type Jwk = JsonWebKey & { kid?: string };
let keyCache: { keys: Jwk[]; expiresAt: number } | null = null;

async function fetchKeys(fetchImpl: FetchLike): Promise<Jwk[]> {
  const response = await fetchImpl(JWKS_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`jwks_http_${response.status}`);
  const body = (await response.json()) as { keys?: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1] ?? 3600);
  keyCache = { keys: body.keys ?? [], expiresAt: Date.now() + Math.min(maxAge, 24 * 3600) * 1000 };
  return keyCache.keys;
}

/** Klíč podle `kid`. Neznámé `kid` vyvolá jedno nové stažení, protože Google klíče průběžně střídá. */
async function signingKey(kid: string, fetchImpl: FetchLike): Promise<Jwk | null> {
  const cached = keyCache && keyCache.expiresAt > Date.now() ? keyCache.keys.find((key) => key.kid === kid) : undefined;
  if (cached) return cached;
  return (await fetchKeys(fetchImpl)).find((key) => key.kid === kid) ?? null;
}

/** Jen pro testy: zahodí stažené klíče. */
export const clearSigningKeyCache = () => {
  keyCache = null;
};

// ——— Ověření ID tokenu ———

export type IdTokenProblem =
  | "malformed"
  | "unsupported_alg"
  | "unknown_key"
  | "bad_signature"
  | "bad_issuer"
  | "bad_audience"
  | "expired"
  | "bad_nonce"
  | "email_unverified";

export type VerifiedIdentity = { sub: string; email: string };

const parsePart = (part: string | undefined): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(Buffer.from(part ?? "", "base64url").toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/**
 * Ověří ID token podle části 02 zadání: podpis klíčem Googlu, vydavatel, příjemce, platnost,
 * nonce této žádosti a ověřený e-mail. Obsahu tokenu se věří až po úspěšném ověření podpisu.
 */
export async function verifyIdToken(
  idToken: string,
  expected: { clientId: string; nonce: string },
  fetchImpl: FetchLike = fetch,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<{ ok: true; identity: VerifiedIdentity } | { ok: false; problem: IdTokenProblem }> {
  const fail = (problem: IdTokenProblem) => ({ ok: false as const, problem });
  const parts = idToken.split(".");
  const header = parsePart(parts[0]);
  const claims = parsePart(parts[1]);
  if (parts.length !== 3 || !header || !claims || !parts[2]) return fail("malformed");
  // Pevně RS256. Algoritmus se nikdy nepřebírá z tokenu, jinak by šel podpis obejít ("none", HS256).
  if (header.alg !== "RS256" || typeof header.kid !== "string") return fail("unsupported_alg");

  const jwk = await signingKey(header.kid, fetchImpl);
  if (!jwk || jwk.kty !== "RSA") return fail("unknown_key");
  let signatureValid = false;
  try {
    const key = createPublicKey({ key: jwk, format: "jwk" });
    signatureValid = verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], "base64url"));
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return fail("bad_signature");

  if (typeof claims.iss !== "string" || !ISSUERS.includes(claims.iss)) return fail("bad_issuer");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(expected.clientId)) return fail("bad_audience");
  // Token pro více příjemců musí výslovně říct, že ho smí použít tento klient.
  if ((audiences.length > 1 || claims.azp !== undefined) && claims.azp !== expected.clientId) return fail("bad_audience");
  if (typeof claims.exp !== "number" || claims.exp <= nowSec - CLOCK_SKEW_SEC) return fail("expired");
  if (typeof claims.iat !== "number" || claims.iat > nowSec + CLOCK_SKEW_SEC) return fail("expired");
  if (typeof claims.nonce !== "string" || !safeEqual(claims.nonce, expected.nonce)) return fail("bad_nonce");
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255) return fail("malformed");
  if (typeof claims.email !== "string" || claims.email_verified !== true) return fail("email_unverified");
  return { ok: true, identity: { sub: claims.sub, email: claims.email.toLowerCase() } };
}

// ——— Dokončení přihlášení ———

export type LoginFailure = "exchange_failed" | "invalid_token" | "not_allowed" | "account_conflict";
export type LoginResult = { ok: true; userId: string } | { ok: false; reason: LoginFailure };

/**
 * Vymění kód, ověří ID token a najde uživatele Wiki.
 *
 * Kdo smí dovnitř, určuje seznam testovacích účtů (ověřený e-mail → uživatel). Účet se při prvním
 * přihlášení sváže se stabilním `sub`. Když později stejnou adresu získá jiný účet Google, nebo se
 * účet objeví u jiného uživatele, přihlášení se odmítne a vazbu musí vědomě změnit správce.
 */
export async function completeLogin(
  db: Executor,
  cfg: GoogleLoginConfig,
  input: { code: string; verifier: string; nonce: string },
  fetchImpl: FetchLike = fetch,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<LoginResult> {
  const fail = (reason: LoginFailure, code: string = reason): LoginResult => {
    // Do logu jde jen kód důvodu. Adresa ani `sub` neúspěšného pokusu se nezapisují.
    logError("google.login", code);
    return { ok: false, reason };
  };

  let idToken: string | undefined;
  try {
    const response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        code_verifier: input.verifier,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => ({}))) as { id_token?: unknown };
    if (response.status !== 200 || typeof body.id_token !== "string") return fail("exchange_failed", `http_${response.status}`);
    idToken = body.id_token;
  } catch {
    return fail("exchange_failed", "unavailable");
  }

  let verified: Awaited<ReturnType<typeof verifyIdToken>>;
  try {
    verified = await verifyIdToken(idToken, { clientId: cfg.clientId, nonce: input.nonce }, fetchImpl, nowSec);
  } catch {
    return fail("exchange_failed", "jwks_unavailable");
  }
  if (!verified.ok) return fail("invalid_token", verified.problem);
  const { sub, email } = verified.identity;

  const userId = cfg.accounts.get(email);
  if (!userId) return fail("not_allowed");
  const [user] = await db.select({ id: users.id, orgId: users.orgId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.orgId !== config.orgId) return fail("not_allowed", "unknown_user");

  // Vložení bez přepsání: při souběhu dvou prvních přihlášení vyhraje jedno a druhé se jen porovná.
  await db.insert(userIdentities).values({ provider: PROVIDER, subject: sub, userId, email }).onConflictDoNothing();
  const [bound] = await db
    .select()
    .from(userIdentities)
    .where(and(eq(userIdentities.provider, PROVIDER), eq(userIdentities.subject, sub)))
    .limit(1);
  if (!bound || bound.userId !== userId) return fail("account_conflict");
  await db
    .update(userIdentities)
    .set({ email, lastLoginAt: new Date() })
    .where(and(eq(userIdentities.provider, PROVIDER), eq(userIdentities.subject, sub)));
  return { ok: true, userId };
}

/**
 * Platí ještě session založená přes Google? Čte se při každém požadavku, takže odebrání účtu ze
 * seznamu, zrušení vazby nebo vypnutí režimu ukončí přístup hned, ne až po vypršení cookie.
 */
export async function googleSessionAllowed(db: Executor, userId: string): Promise<boolean> {
  const cfg = googleLoginConfig();
  if (!cfg) return false;
  const [identity] = await db
    .select({ email: userIdentities.email })
    .from(userIdentities)
    .where(and(eq(userIdentities.provider, PROVIDER), eq(userIdentities.userId, userId)))
    .limit(1);
  return identity !== undefined && cfg.accounts.get(identity.email) === userId;
}
