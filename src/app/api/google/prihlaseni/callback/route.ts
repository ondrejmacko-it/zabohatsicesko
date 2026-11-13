import { and, eq } from "drizzle-orm";
import { NextResponse, after, type NextRequest } from "next/server";
import { audit, logError } from "@/server/audit";
import { completeLogin, verifyLoginState, type LoginFailure } from "@/server/auth/google-login";
import { SESSION_COOKIE, encodeSession, sessionCookieOptions } from "@/server/auth/session";
import { config, googleLoginConfig } from "@/server/config";
import { grantsCalendar, needsCalendarConnection, revokeToken, saveGrant } from "@/server/calendar/google-auth";
import { resumeAfterReconnect, syncEvent } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { canPlan } from "@/server/policy";
import { CONNECT_PATH } from "../../kalendar/cookie";
import { HINT_COOKIE, LOGIN_COOKIE, encodeHint, gateUrl, hintCookieOptions, loginCookieOptions } from "../cookie";

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
  // Po odmítnuté žádosti o Kalendář nabídne brána přihlášení bez něj, ať se správce nezasekne.
  if (!code || code.length > 2048) return finish(gateUrl(pending.calendar === "ask" ? "zruseno-kalendar" : "zruseno"));

  try {
    const db = await getDb();
    const result = await completeLogin(db, cfg, { code, nonce: pending.nonce, verifier: pending.verifier });
    const grant = result.grant;
    if (!result.ok) {
      // Oprávnění ke Kalendáři od účtu, který se dovnitř nedostal, Wiki nedrží.
      if (grant) await revokeToken(grant.refreshToken);
      if (result.reason === "pending") {
        if (result.created) await audit(db, result.userId, "user.requested", "user", result.userId);
        return finish(gateUrl("ceka-na-schvaleni"));
      }
      return finish(gateUrl(FAILURES[result.reason]));
    }
    await audit(db, result.userId, "session.start.google", "user", result.userId);
    const [account] = await db.select({ id: users.id, role: users.role, groups: users.groups }).from(users).where(and(eq(users.orgId, config.orgId), eq(users.id, result.userId))).limit(1);
    const plans = account ? canPlan(account) : false;
    const missing = await needsCalendarConnection(db, plans);

    // Správce dal souhlas ke Kalendáři už na přihlašovací obrazovce: propojení se uloží hned, bez dalšího kroku.
    let connected = false;
    if (grant) {
      if (missing && grantsCalendar(grant.scopes)) {
        await saveGrant(db, { ...grant, userId: result.userId });
        await audit(db, result.userId, "calendar.connected", "settings", "google-calendar");
        connected = true;
        // Změny zveřejněné během odpojení se po novém propojení odešlou bez ručního opakování.
        const resumed = await resumeAfterReconnect(db);
        if (resumed.length) {
          after(async () => {
            for (const eventId of resumed) await syncEvent(eventId);
          });
        }
      } else {
        // Přihlásil se někdo, kdo neplánuje, propojení mezitím vzniklo, nebo rozsah Kalendáře odškrtl.
        await revokeToken(grant.refreshToken);
      }
    }
    // Druhé automatické přesměrování jen tehdy, když o Kalendář ještě nikdo nežádal (první přihlášení
    // správce z tohoto prohlížeče). Po odmítnutí nebo výslovném „bez Kalendáře“ zůstává úkol na Plánu.
    const connectNext = missing && !connected && pending.calendar === "later";
    const response = finish(`${config.appUrl}${connectNext ? CONNECT_PATH : "/"}`);
    response.cookies.set(SESSION_COOKIE, encodeSession(result.userId, undefined, "google"), sessionCookieOptions);
    response.cookies.set(HINT_COOKIE, encodeHint(result.userId), hintCookieOptions);
    return response;
  } catch (error) {
    logError("google.login", "callback_failed", error);
    return finish(gateUrl("nepodarilo-se"));
  }
}
