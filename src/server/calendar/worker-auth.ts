import { createHash, createPublicKey, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";
import { calendarWorkerOidcRepository, calendarWorkerTokens } from "@/server/config";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

export const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
/** Audience, o kterou si workflow `kalendar-fronta.yml` žádá. Token pro jiné účely (cloud, registry) neprojde. */
export const WORKER_OIDC_AUDIENCE = "zbc-kalendar-fronta";
const WORKFLOW_PATH = ".github/workflows/kalendar-fronta.yml@";
const CLOCK_SKEW_S = 60;
const JWKS_TTL_MS = 60 * 60 * 1000;

type Jwk = JsonWebKey & { kid?: string };
let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;

/** Jen pro testy: zahodí uložené klíče GitHubu. */
export function clearOidcKeyCache() {
  jwksCache = null;
}

async function githubKeys(refresh: boolean): Promise<Jwk[]> {
  if (jwksCache && !refresh && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  // Neznámé `kid` smí klíče obnovit nejvýš jednou za minutu, aby se z endpointu nedalo spamovat GitHub.
  if (jwksCache && refresh && Date.now() - jwksCache.fetchedAt < 60_000) return jwksCache.keys;
  const response = await fetch(`${GITHUB_OIDC_ISSUER}/.well-known/jwks`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`jwks ${response.status}`);
  const body = (await response.json()) as { keys?: Jwk[] };
  jwksCache = { keys: Array.isArray(body.keys) ? body.keys : [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

const decodePart = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;

/**
 * Ověří GitHub Actions OIDC token: podpis RS256 klíčem GitHubu, vydavatele, audience, platnost a že ho
 * vydal workflow `kalendar-fronta.yml` povoleného repozitáře. Jakákoli odchylka nebo chyba = odmítnutí.
 */
export async function githubOidcAuthorized(jwt: string, repository: string | null = calendarWorkerOidcRepository()) {
  if (!repository) return false;
  const parts = jwt.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = decodePart(parts[0]!);
    const claims = decodePart(parts[1]!);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return false;
    let key = (await githubKeys(false)).find((candidate) => candidate.kid === header.kid);
    if (!key) key = (await githubKeys(true)).find((candidate) => candidate.kid === header.kid);
    if (!key) return false;
    const signed = verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key, format: "jwk" }),
      Buffer.from(parts[2]!, "base64url"),
    );
    if (!signed) return false;
    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    return (
      claims.iss === GITHUB_OIDC_ISSUER &&
      audiences.includes(WORKER_OIDC_AUDIENCE) &&
      typeof claims.exp === "number" && claims.exp + CLOCK_SKEW_S > now &&
      (typeof claims.nbf !== "number" || claims.nbf - CLOCK_SKEW_S <= now) &&
      claims.repository === repository &&
      typeof claims.workflow_ref === "string" && claims.workflow_ref.startsWith(`${repository}/${WORKFLOW_PATH}`)
    );
  } catch {
    return false;
  }
}

/**
 * Ověří `Authorization: Bearer <token>` plánovače. Sdílené tokeny porovnává přes otisky stejné délky
 * v konstantním čase, délka ani obsah tokenu tak z doby odpovědi nevyplyne. Token tvaru JWT zkusí
 * navíc jako GitHub OIDC (je-li zapnuté). Bez nastavení neprojde nic.
 */
export async function workerRequestAuthorized(header: string | null): Promise<boolean> {
  const match = /^Bearer (\S+)$/.exec(header ?? "");
  if (!match) return false;
  const given = digest(match[1]!);
  // Projde všechny tokeny bez předčasného konce.
  const shared = calendarWorkerTokens().reduce((ok, token) => timingSafeEqual(given, digest(token)) || ok, false);
  return shared || (match[1]!.split(".").length === 3 && githubOidcAuthorized(match[1]!));
}
