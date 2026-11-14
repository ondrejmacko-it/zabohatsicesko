import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { withinRateLimit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth/session";
import { beginAuthorization } from "@/server/calendar/google-auth";
import { googleCalendarConfig } from "@/server/config";
import { getDb } from "@/server/db/client";
import { userIdentities } from "@/server/db/schema";
import { isOrganizer } from "@/server/policy";
import { AUTO_COOKIE, OAUTH_COOKIE, oauthCookieOptions } from "../cookie";

// Začátek připojení Kalendáře. Jen správce a jen v nakonfigurovaném testovacím režimu.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const cfg = googleCalendarConfig();
  if (!user || !isOrganizer(user) || !cfg) return new Response(null, { status: 404 });
  const db = await getDb();
  if (!(await withinRateLimit(db, `google-oauth:${user.id}`, 10, 600))) return new Response(null, { status: 429 });

  const auto = request.nextUrl.searchParams.get("auto") === "1";
  // Kdo se přihlásil Googlem, propojuje Kalendář stejným účtem, bez dalšího výběru.
  const [identity] = auto
    ? await db.select({ email: userIdentities.email }).from(userIdentities).where(and(eq(userIdentities.provider, "google"), eq(userIdentities.userId, user.id))).limit(1)
    : [];
  const { url, cookieValue } = beginAuthorization(cfg, user.id, undefined, identity?.email);
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, cookieValue, oauthCookieOptions);
  if (auto) response.cookies.set(AUTO_COOKIE, "1", oauthCookieOptions);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
