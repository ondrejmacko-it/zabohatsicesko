import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import {
  clearOidcKeyCache,
  GITHUB_OIDC_ISSUER,
  WORKER_OIDC_AUDIENCE,
  workerRequestAuthorized,
} from "@/server/calendar/worker-auth";

// Ověření GitHub OIDC tokenu plánovače fronty bez sítě: JWKS GitHubu nahrazuje vlastní testovací klíč.
const REPO = "vlastnik/repo";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "test-kid";

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
function jwt(claims: Record<string, unknown>, options: { key?: typeof privateKey; kid?: string; alg?: string } = {}) {
  const head = b64({ alg: options.alg ?? "RS256", kid: options.kid ?? KID, typ: "JWT" });
  const body = b64(claims);
  const signature = sign("RSA-SHA256", Buffer.from(`${head}.${body}`), options.key ?? privateKey).toString("base64url");
  return `${head}.${body}.${signature}`;
}
const now = () => Math.floor(Date.now() / 1000);
const valid = (overrides: Record<string, unknown> = {}) => ({
  iss: GITHUB_OIDC_ISSUER,
  aud: WORKER_OIDC_AUDIENCE,
  repository: REPO,
  workflow_ref: `${REPO}/.github/workflows/kalendar-fronta.yml@refs/heads/main`,
  iat: now(),
  nbf: now(),
  exp: now() + 300,
  ...overrides,
});
const bearer = (token: string) => workerRequestAuthorized(`Bearer ${token}`);

let fetchMock: ReturnType<typeof vi.fn>;
beforeAll(() => {
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  clearOidcKeyCache();
  vi.unstubAllEnvs();
});

describe("GitHub OIDC plánovače fronty", () => {
  test("platný token workflow kalendar-fronta.yml povoleného repa projde", async () => {
    vi.stubEnv("CALENDAR_WORKER_OIDC_REPOSITORY", REPO);
    expect(await bearer(jwt(valid()))).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(`${GITHUB_OIDC_ISSUER}/.well-known/jwks`, expect.anything());
  });

  test("bez CALENDAR_WORKER_OIDC_REPOSITORY je OIDC vypnuté", async () => {
    vi.stubEnv("CALENDAR_WORKER_OIDC_REPOSITORY", "");
    vi.stubEnv("CALENDAR_WORKER_TOKEN", "");
    vi.stubEnv("CRON_SECRET", "");
    expect(await bearer(jwt(valid()))).toBe(false);
  });

  test.each([
    ["cizí repo", { repository: "utocnik/repo", workflow_ref: "utocnik/repo/.github/workflows/kalendar-fronta.yml@refs/heads/main" }],
    ["jiný workflow téhož repa", { workflow_ref: `${REPO}/.github/workflows/ci.yml@refs/heads/main` }],
    ["jiná audience", { aud: "sts.amazonaws.com" }],
    ["jiný vydavatel", { iss: "https://example.invalid" }],
    ["prošlý token", { exp: now() - 120 }],
    ["token z budoucnosti", { nbf: now() + 600 }],
  ])("odmítne: %s", async (_name, overrides) => {
    vi.stubEnv("CALENDAR_WORKER_OIDC_REPOSITORY", REPO);
    expect(await bearer(jwt(valid(overrides)))).toBe(false);
  });

  test("odmítne podvržený podpis, neznámý klíč, alg none a nesmysl", async () => {
    vi.stubEnv("CALENDAR_WORKER_OIDC_REPOSITORY", REPO);
    expect(await bearer(jwt(valid(), { key: other.privateKey }))).toBe(false);
    expect(await bearer(jwt(valid(), { kid: "jiny" }))).toBe(false);
    const [head, body] = jwt(valid()).split(".");
    expect(await bearer(`${b64({ alg: "none", kid: KID })}.${body}.`)).toBe(false);
    expect(await bearer(`${head}.${body}.AAAA`)).toBe(false);
    expect(await bearer("a.b.c")).toBe(false);
  });

  test("výpadek JWKS GitHubu znamená odmítnutí, ne výjimku", async () => {
    vi.stubEnv("CALENDAR_WORKER_OIDC_REPOSITORY", REPO);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    expect(await bearer(jwt(valid()))).toBe(false);
  });
});
