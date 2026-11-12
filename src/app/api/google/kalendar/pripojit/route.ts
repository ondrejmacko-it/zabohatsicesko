import { NextResponse } from "next/server";
import { withinRateLimit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth/session";
import { beginAuthorization } from "@/server/calendar/google-auth";
import { googleCalendarConfig } from "@/server/config";
import { getDb } from "@/server/db/client";
import { isOrganizer } from "@/server/policy";
import { OAUTH_COOKIE, oauthCookieOptions } from "../cookie";

// Začátek připojení Kalendáře. Jen organizátor a jen v nakonfigurovaném testovacím režimu.
export async function GET() {
  const user = await getCurrentUser();
  const cfg = googleCalendarConfig();
  if (!user || !isOrganizer(user) || !cfg) return new Response(null, { status: 404 });
  if (!(await withinRateLimit(await getDb(), `google-oauth:${user.id}`, 10, 600))) return new Response(null, { status: 429 });

  const { url, cookieValue } = beginAuthorization(cfg, user.id);
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, cookieValue, oauthCookieOptions);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
