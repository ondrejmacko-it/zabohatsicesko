import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { hashKey, withinRateLimit } from "@/server/audit";
import { beginLogin } from "@/server/auth/google-login";
import { googleLoginConfig } from "@/server/config";
import { getDb } from "@/server/db/client";
import { LOGIN_COOKIE, loginCookieOptions } from "./cookie";

// Začátek přihlášení Google identitou. Jen v nakonfigurovaném testovacím režimu.
export async function GET() {
  const cfg = googleLoginConfig();
  if (!cfg) return new Response(null, { status: 404 });
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await withinRateLimit(await getDb(), `google-login:${hashKey(ip)}`, 20, 600))) return new Response(null, { status: 429 });

  const { url, cookieValue } = beginLogin(cfg);
  const response = NextResponse.redirect(url);
  response.cookies.set(LOGIN_COOKIE, cookieValue, loginCookieOptions);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
