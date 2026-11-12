import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { googleSessionAllowed } from "@/server/auth/google-login";
import { config } from "@/server/config";
import { getDb, type Executor } from "@/server/db/client";
import { users } from "@/server/db/schema";
import type { Viewer } from "@/server/policy";

// Bezstavová session v podepsané HttpOnly cookie. Obsahuje jen ID uživatele, způsob přihlášení a expiraci.
// Role a skupiny se při každém požadavku čtou z databáze, takže odebrání práv platí okamžitě.

const SESSION_TTL_SEC = 12 * 60 * 60;
export const SESSION_COOKIE = config.isProduction ? "__Host-zbc_session" : "zbc_session";

/** Jak session vznikla: výběrem fiktivní role, nebo přihlášením Google identitou. */
export type SignInMethod = "demo" | "google";
type Payload = { uid: string; exp: number; via?: "google" };

const sign = (data: string) => createHmac("sha256", config.sessionSecret).update(data).digest("base64url");

export function encodeSession(userId: string, nowSec = Math.floor(Date.now() / 1000), method: SignInMethod = "demo"): string {
  const payload: Payload = { uid: userId, exp: nowSec + SESSION_TTL_SEC, ...(method === "google" ? { via: "google" } : {}) };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function decodeSession(token: string | undefined, nowSec = Math.floor(Date.now() / 1000)): string | null {
  return readSession(token, nowSec)?.userId ?? null;
}

export function readSession(
  token: string | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): { userId: string; method: SignInMethod } | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Partial<Payload>;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number" || payload.exp <= nowSec) return null;
    return { userId: payload.uid, method: payload.via === "google" ? "google" : "demo" };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SEC,
};

export async function startSession(userId: string, method: SignInMethod = "demo"): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, encodeSession(userId, undefined, method), sessionCookieOptions);
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export type CurrentUser = Viewer & { name: string; email: string; signedInWith: SignInMethod };

/** Přihlášený uživatel pro aktuální požadavek, nebo null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? resolveSessionUser(await getDb(), session) : null;
});

/** Uživatel platné session podle aktuálního stavu v databázi. Role, skupiny i stav se čtou vždy znovu. */
export async function resolveSessionUser(
  db: Executor,
  session: { userId: string; method: SignInMethod },
): Promise<CurrentUser | null> {
  const { userId } = session;
  if (session.method === "google" && !(await googleSessionAllowed(db, userId))) return null;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  // Čekající žádost ani odebraný přístup dovnitř nepustí, ani se starší platnou cookie.
  if (!user || user.orgId !== config.orgId || user.status !== "active") return null;
  // Session z výběru fiktivní role nikdy neotevře skutečný účet z pozvánky nebo žádosti.
  if (session.method === "demo" && user.origin !== "demo") return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, groups: user.groups, signedInWith: session.method };
}

/** Pro stránky: bez session přesměruje na vstup. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/vstup");
  return user;
}

/** Constant-time porovnání přístupového kódu. Délka ani obsah kódu neuniknou časováním. */
export function accessCodeMatches(input: string, expected: string): boolean {
  const a = createHmac("sha256", config.sessionSecret).update(input).digest();
  const b = createHmac("sha256", config.sessionSecret).update(expected).digest();
  return timingSafeEqual(a, b);
}
