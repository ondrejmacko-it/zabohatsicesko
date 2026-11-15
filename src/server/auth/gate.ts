import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { hashKey, withinRateLimit } from "@/server/audit";
import { accessCodeMatches } from "@/server/auth/session";
import { config } from "@/server/config";
import type { Executor } from "@/server/db/client";

// Brána ukázky. Kdo jednou prokáže přístupový kód (zvacím odkazem nebo ručně), dostane podepsanou
// HttpOnly cookie a role pak vybírá bez psaní kódu. Cookie nese jen expiraci a otisk kódu:
// po změně `DEMO_ACCESS_CODE` přestanou platit všechny dříve vydané cookie.

const GATE_TTL_SEC = 7 * 24 * 60 * 60;
export const GATE_COOKIE = config.isProduction ? "__Host-zbc_gate" : "zbc_gate";
/** Stejný limit jako ruční zadání kódu, sdílený klíč: odkaz ani formulář nedají víc pokusů. */
const GATE_LIMIT = { attempts: 10, windowSec: 15 * 60 };

const sign = (data: string) => createHmac("sha256", config.sessionSecret).update(`gate:${data}`).digest("base64url");
const codeFingerprint = (code: string) => createHmac("sha256", config.sessionSecret).update(`gate-code:${code}`).digest("base64url").slice(0, 16);

export function encodeGate(code: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const data = Buffer.from(JSON.stringify({ exp: nowSec + GATE_TTL_SEC, k: codeFingerprint(code) })).toString("base64url");
  return `${data}.${sign(data)}`;
}

/** Platí cookie brány pro aktuální přístupový kód? Bez nastaveného kódu (lokálně) brána není. */
export function gateTokenValid(token: string | undefined, code: string | null, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!token || code === null) return false;
  const [data, signature] = token.split(".");
  if (!data || !signature) return false;
  const expected = Buffer.from(sign(data));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as { exp?: unknown; k?: unknown };
    return typeof payload.exp === "number" && payload.exp > nowSec && payload.k === codeFingerprint(code);
  } catch {
    return false;
  }
}

export const gateCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: GATE_TTL_SEC,
};

export async function hasGatePass(): Promise<boolean> {
  return gateTokenValid((await cookies()).get(GATE_COOKIE)?.value, config.accessCode);
}

/** Po ručním zadání kódu, aby příští vstup už kód nechtěl. */
export async function grantGatePass(code: string): Promise<void> {
  (await cookies()).set(GATE_COOKIE, encodeGate(code), gateCookieOptions);
}

export type AccessCodeCheck = "ok" | "wrong" | "limited";

/** Ověří přístupový kód s limitem pokusů na IP. Odkaz i ruční zadání jdou přes tuto funkci. */
export async function checkAccessCode(db: Executor, input: string, expected: string): Promise<AccessCodeCheck> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await withinRateLimit(db, `gate:${hashKey(ip)}`, GATE_LIMIT.attempts, GATE_LIMIT.windowSec))) return "limited";
  return accessCodeMatches(input, expected) ? "ok" : "wrong";
}
