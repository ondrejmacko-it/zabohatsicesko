import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { config } from "@/server/config";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import type { Viewer } from "@/server/policy";

// Bezstavová session v podepsané HttpOnly cookie. Obsahuje jen ID fiktivního uživatele a expiraci.
// Role a skupiny se při každém požadavku čtou z databáze, takže odebrání práv platí okamžitě.

const SESSION_TTL_SEC = 12 * 60 * 60;
export const SESSION_COOKIE = config.isProduction ? "__Host-zbc_session" : "zbc_session";

type Payload = { uid: string; exp: number };

const sign = (data: string) => createHmac("sha256", config.sessionSecret).update(data).digest("base64url");

export function encodeSession(userId: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const data = Buffer.from(JSON.stringify({ uid: userId, exp: nowSec + SESSION_TTL_SEC } satisfies Payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function decodeSession(token: string | undefined, nowSec = Math.floor(Date.now() / 1000)): string | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Partial<Payload>;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number" || payload.exp <= nowSec) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export async function startSession(userId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, encodeSession(userId), {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export type CurrentUser = Viewer & { name: string; email: string };

/** Přihlášený uživatel pro aktuální požadavek, nebo null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.orgId !== config.orgId) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, groups: user.groups };
});

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
