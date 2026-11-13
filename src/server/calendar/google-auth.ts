import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { logError } from "@/server/audit";
import { config, googleCalendarConfig, tokenEncryptionKey, type GoogleCalendarConfig } from "@/server/config";
import type { Executor } from "@/server/db/client";
import { integrationCredentials } from "@/server/db/schema";
import { openSecret, sealSecret } from "@/server/integrations/secret-box";
import { CalendarError } from "./provider";

// OAuth pro zápis do Kalendáře. Oddělené od přihlášení uživatele do Wiki: připojuje se jeden
// účet za organizaci, který vlastní kalendář vzdělávání. Tokeny neopouštějí server.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
/** Nejmenší funkční rozsah: čtení a zápis událostí. Bez správy kalendářů a sdílení. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const PROVIDER = "google-calendar" as const;
const TIMEOUT_MS = 10_000;
const STATE_TTL_SEC = 10 * 60;

export type FetchLike = typeof fetch;

const secretContext = () => `${config.orgId}:${PROVIDER}`;

// ——— Stav a PKCE ———

const signState = (data: string) => createHmac("sha256", config.sessionSecret).update(`google-oauth:${data}`).digest("base64url");

export type OAuthStart = { url: string; cookieValue: string };

/**
 * Připraví přesměrování na souhlas. Stav a PKCE ověřovač zůstávají v podepsané HttpOnly cookie
 * vázané na prohlížeč organizátora, takže callback nejde podvrhnout z cizí relace.
 */
export function beginAuthorization(
  cfg: GoogleCalendarConfig,
  userId: string,
  nowSec = Math.floor(Date.now() / 1000),
  /** Adresa účtu, kterým se organizátor právě přihlásil. Google pak nenabízí výběr účtu. */
  loginHint?: string,
): OAuthStart {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const data = Buffer.from(JSON.stringify({ state, verifier, uid: userId, exp: nowSec + STATE_TTL_SEC })).toString("base64url");
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: `openid email ${CALENDAR_SCOPE}`,
    // Offline přístup a výslovný souhlas, aby Google vrátil obnovovací token i při opakovaném připojení.
    access_type: "offline",
    // Výběr účtu vždy: prohlížeč s více přihlášenými účty by jinak mohl připojit jiný než testovací.
    // Po přihlášení Googlem účet známe a posíláme ho jako nápovědu, stačí tedy jen souhlas.
    prompt: loginHint ? "consent" : "consent select_account",
    ...(loginHint ? { login_hint: loginHint } : {}),
    include_granted_scopes: "false",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return { url: url.toString(), cookieValue: `${data}.${signState(data)}` };
}

/** Ověří stav z callbacku proti cookie. Vrací PKCE ověřovač, nebo null. */
export function verifyAuthorizationState(
  cookieValue: string | undefined,
  state: string | null,
  userId: string,
  nowSec = Math.floor(Date.now() / 1000),
): string | null {
  if (!cookieValue || !state) return null;
  const [data, signature] = cookieValue.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(signState(data));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof payload.state !== "string" || typeof payload.verifier !== "string") return null;
    if (payload.uid !== userId || typeof payload.exp !== "number" || payload.exp <= nowSec) return null;
    const a = Buffer.from(payload.state);
    const b = Buffer.from(state);
    return a.length === b.length && timingSafeEqual(a, b) ? payload.verifier : null;
  } catch {
    return null;
  }
}

// ——— Token endpoint ———

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; id_token?: string; error?: string };

async function tokenRequest(fetchImpl: FetchLike, params: Record<string, string>): Promise<{ status: number; body: TokenResponse }> {
  let response: Response;
  try {
    response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new CalendarError("calendar_unavailable", true);
  }
  const body = (await response.json().catch(() => ({}))) as TokenResponse;
  return { status: response.status, body };
}

/** E-mail z ID tokenu. Token přišel přímo od Googlu po TLS výměnou kódu, slouží jen k zobrazení účtu. */
function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken?.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: unknown };
    return typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export type ConnectResult = "connected" | "missing_scope" | "no_refresh_token" | "exchange_failed";

/** Vymění autorizační kód a uloží šifrovaný obnovovací token. Přístupový token se neukládá. */
export async function completeAuthorization(
  db: Executor,
  cfg: GoogleCalendarConfig,
  input: { code: string; verifier: string; userId: string },
  fetchImpl: FetchLike = fetch,
): Promise<ConnectResult> {
  const { status, body } = await tokenRequest(fetchImpl, {
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.verifier,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
  });
  if (status !== 200 || !body.access_token) {
    logError("google.oauth", body.error ?? `http_${status}`);
    return "exchange_failed";
  }
  // Uživatel může na obrazovce souhlasu rozsah odškrtnout. Bez něj by integrace jen selhávala.
  if (!grantsCalendar(body.scope ?? "")) return "missing_scope";
  if (!body.refresh_token) return "no_refresh_token";
  await saveGrant(db, {
    refreshToken: body.refresh_token,
    scopes: body.scope ?? "",
    accountEmail: emailFromIdToken(body.id_token) ?? "neznámý účet",
    userId: input.userId,
  });
  return "connected";
}

/** Má oprávnění od Googlu rozsah pro zápis událostí? Uživatel ho může na obrazovce souhlasu odškrtnout. */
export const grantsCalendar = (scopes: string) => scopes.split(" ").includes(CALENDAR_SCOPE);

/** Uloží propojení Kalendáře pro celou Wiki. Obnovovací token jde do databáze jen šifrovaný. */
export async function saveGrant(
  db: Executor,
  grant: { refreshToken: string; scopes: string; accountEmail: string; userId: string },
): Promise<void> {
  const values = {
    accountEmail: grant.accountEmail,
    encryptedRefreshToken: sealSecret(grant.refreshToken, tokenEncryptionKey(), secretContext()),
    scopes: grant.scopes,
    connectedBy: grant.userId,
    connectedAt: new Date(),
  };
  await db
    .insert(integrationCredentials)
    .values({ orgId: config.orgId, provider: PROVIDER, ...values })
    .onConflictDoUpdate({ target: [integrationCredentials.orgId, integrationCredentials.provider], set: values });
  accessCache.delete(config.orgId);
}

/** Zneplatní token u Googlu. Používá se pro oprávnění, které Wiki dostala, ale neuloží. */
export async function revokeToken(token: string, fetchImpl: FetchLike = fetch): Promise<void> {
  try {
    await fetchImpl(REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Zneplatnění lze dokončit v nastavení účtu Google. Token se u nás nikam neuložil.
    logError("google.oauth", "revoke_failed");
  }
}

// ——— Přístupový token pro volání API ———

export interface AccessTokenSource {
  /** @param refresh vynutí nový token, když ho API odmítlo */
  get(refresh?: boolean): Promise<string>;
}

// Přístupový token žije jen v paměti procesu. Po studeném startu se obnoví z šifrovaného tokenu.
const accessCache = new Map<string, { token: string; expiresAt: number }>();

const whereCredential = () => and(eq(integrationCredentials.orgId, config.orgId), eq(integrationCredentials.provider, PROVIDER));

async function forgetCredential(db: Executor): Promise<void> {
  accessCache.delete(config.orgId);
  await db.delete(integrationCredentials).where(whereCredential());
}

export function storedAccessToken(db: Executor, cfg: GoogleCalendarConfig, fetchImpl: FetchLike = fetch): AccessTokenSource {
  return {
    async get(refresh = false) {
      const cached = accessCache.get(config.orgId);
      if (!refresh && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
      const [row] = await db.select().from(integrationCredentials).where(whereCredential()).limit(1);
      if (!row) throw new CalendarError("calendar_revoked", false);
      const refreshToken = openSecret(row.encryptedRefreshToken, tokenEncryptionKey(), secretContext());
      if (!refreshToken) {
        // Jiný klíč nebo poškozený záznam. Token je nepoužitelný, integraci je potřeba připojit znovu.
        logError("google.oauth", "token_undecryptable");
        throw new CalendarError("calendar_revoked", false);
      }
      const { status, body } = await tokenRequest(fetchImpl, {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
      });
      if (status === 400 && body.error === "invalid_grant") {
        // Přístup byl odvolán u Googlu. Odpojíme integraci i u nás, token už nemá smysl držet.
        await forgetCredential(db);
        throw new CalendarError("calendar_revoked", false);
      }
      if (status !== 200 || !body.access_token) {
        logError("google.oauth", body.error ?? `http_${status}`);
        throw new CalendarError("calendar_unavailable", status >= 500 || status === 429);
      }
      accessCache.set(config.orgId, { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 });
      return body.access_token;
    },
  };
}

export type ConnectionStatus = { accountEmail: string; connectedAt: Date } | null;

export async function connectionStatus(db: Executor): Promise<ConnectionStatus> {
  const [row] = await db.select().from(integrationCredentials).where(whereCredential()).limit(1);
  return row ? { accountEmail: row.accountEmail, connectedAt: row.connectedAt } : null;
}

/**
 * Má Wiki po přihlášení sama požádat o propojení Kalendáře? Jen v režimu Googlu, jen u toho, kdo plán
 * spravuje, a jen když propojení chybí. Ostatní role žádné oprávnění navíc nedostávají.
 */
export async function needsCalendarConnection(db: Executor, managesPlan: boolean): Promise<boolean> {
  return managesPlan && googleCalendarConfig() !== null && (await connectionStatus(db)) === null;
}

/** Odpojí integraci: zneplatní token u Googlu (pokud to jde) a vždy smaže uložený záznam. */
export async function disconnect(db: Executor, fetchImpl: FetchLike = fetch): Promise<void> {
  const [row] = await db.select().from(integrationCredentials).where(whereCredential()).limit(1);
  if (!row) return;
  const refreshToken = googleCalendarConfig() ? openSecret(row.encryptedRefreshToken, tokenEncryptionKey(), secretContext()) : null;
  await forgetCredential(db);
  if (refreshToken) await revokeToken(refreshToken, fetchImpl);
}

/** Jen pro testy: zahodí přístupové tokeny v paměti. */
export const clearAccessTokenCache = () => accessCache.clear();
