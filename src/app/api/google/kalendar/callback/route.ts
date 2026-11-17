import { NextResponse, after, type NextRequest } from "next/server";
import { audit, logError } from "@/server/audit";
import { getCurrentUser } from "@/server/auth/session";
import { completeAuthorization, verifyAuthorizationState } from "@/server/calendar/google-auth";
import { CalendarError } from "@/server/calendar/provider";
import { probeTargetCalendar, syncAfterReconnect } from "@/server/calendar/sync";
import { googleCalendarConfig } from "@/server/config";
import { getDb } from "@/server/db/client";
import { isOrganizer } from "@/server/policy";
import { AUTO_COOKIE, OAUTH_COOKIE, integrationsUrl, oauthCookieOptions, planUrl } from "../cookie";

// Návrat z Googlu. Kód se smění jen tehdy, když stav odpovídá podepsané cookie téhož správce.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const cfg = googleCalendarConfig();
  if (!user || !isOrganizer(user) || !cfg) return new Response(null, { status: 404 });

  // Automatické propojení se vrací na Plán. Když se nepovede, zůstane tam úkol „Propojit Kalendář“.
  const auto = request.cookies.get(AUTO_COOKIE)?.value === "1";
  // Jiný účet než organizátor vede vždy na Integrace: správce musí vidět, proč se nic nepropojilo.
  const finish = (result: string) => {
    const response = NextResponse.redirect(auto && result !== "jiny-ucet" ? planUrl() : integrationsUrl(result));
    response.cookies.set(OAUTH_COOKIE, "", { ...oauthCookieOptions, maxAge: 0 });
    response.cookies.set(AUTO_COOKIE, "", { ...oauthCookieOptions, maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  const params = request.nextUrl.searchParams;
  const verifier = verifyAuthorizationState(request.cookies.get(OAUTH_COOKIE)?.value, params.get("state"), user.id);
  if (!verifier) return finish("neplatny-stav");
  const code = params.get("code");
  // Uživatel souhlas odmítl, nebo Google vrátil chybu. Hodnota chyby se nikam nepropisuje.
  if (!code || code.length > 2048) return finish("zamitnuto");

  try {
    const db = await getDb();
    const result = await completeAuthorization(db, cfg, { code, verifier, userId: user.id });
    if (result === "wrong_account") {
      await audit(db, user.id, "calendar.wrong_account", "settings", "google-calendar");
      return finish("jiny-ucet");
    }
    if (result !== "connected") return finish(result === "missing_scope" ? "chybi-opravneni" : "nepripojeno");
    await audit(db, user.id, "calendar.connected", "settings", "google-calendar");
    // Účet bez přístupu k nastavenému kalendáři: propojení platí, ale správce se to musí dozvědět hned.
    if ((await probeTargetCalendar(db)) === "no_access") return finish("bez-pristupu");
    // Celá fronta (i akce zastavené dřívějším propojením) se odešle bez ručního opakování.
    after(() => syncAfterReconnect(db));
    return finish("pripojeno");
  } catch (error) {
    if (!(error instanceof CalendarError)) logError("google.oauth", "callback_failed", error);
    return finish("nepripojeno");
  }
}
