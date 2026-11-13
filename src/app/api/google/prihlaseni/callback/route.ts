import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { audit, logError } from "@/server/audit";
import { completeLogin, verifyLoginState, type LoginFailure } from "@/server/auth/google-login";
import { SESSION_COOKIE, encodeSession, sessionCookieOptions } from "@/server/auth/session";
import { config, googleLoginConfig } from "@/server/config";
import { needsCalendarConnection } from "@/server/calendar/google-auth";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { isOrganizer } from "@/server/policy";
import { CONNECT_PATH } from "../../kalendar/cookie";
import { LOGIN_COOKIE, gateUrl, loginCookieOptions } from "../cookie";

const FAILURES: Record<LoginFailure, string> = {
  exchange_failed: "nepodarilo-se",
  invalid_token: "nepodarilo-se",
  not_allowed: "ucet-neni-povoleny",
  account_conflict: "ucet-neni-povoleny",
  requests_full: "ucet-neni-povoleny",
};

// Návrat z Googlu. Kód se smění jen tehdy, když stav odpovídá podepsané cookie téhož prohlížeče.
export async function GET(request: NextRequest) {
  const cfg = googleLoginConfig();
  if (!cfg) return new Response(null, { status: 404 });

  const finish = (url: string) => {
    const response = NextResponse.redirect(url);
    response.cookies.set(LOGIN_COOKIE, "", { ...loginCookieOptions, maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  const params = request.nextUrl.searchParams;
  const pending = verifyLoginState(request.cookies.get(LOGIN_COOKIE)?.value, params.get("state"));
  if (!pending) return finish(gateUrl("neplatny-stav"));
  const code = params.get("code");
  // Uživatel přihlášení zrušil, nebo Google vrátil chybu. Hodnota chyby se nikam nepropisuje.
  if (!code || code.length > 2048) return finish(gateUrl("zruseno"));

  try {
    const db = await getDb();
    const result = await completeLogin(db, cfg, { code, ...pending });
    if (!result.ok && result.reason === "pending") {
      if (result.created) await audit(db, result.userId, "user.requested", "user", result.userId);
      return finish(gateUrl("ceka-na-schvaleni"));
    }
    if (!result.ok) return finish(gateUrl(FAILURES[result.reason]));
    await audit(db, result.userId, "session.start.google", "user", result.userId);
    // Kdo spravuje plán, propojí Kalendář rovnou při přihlášení: jedna souhlasová obrazovka, žádné nastavování.
    const [account] = await db.select({ id: users.id, role: users.role, groups: users.groups }).from(users).where(and(eq(users.orgId, config.orgId), eq(users.id, result.userId))).limit(1);
    const connect = account ? await needsCalendarConnection(db, isOrganizer(account)) : false;
    const response = finish(`${config.appUrl}${connect ? CONNECT_PATH : "/"}`);
    response.cookies.set(SESSION_COOKIE, encodeSession(result.userId, undefined, "google"), sessionCookieOptions);
    return response;
  } catch (error) {
    logError("google.login", "callback_failed", error);
    return finish(gateUrl("nepodarilo-se"));
  }
}
