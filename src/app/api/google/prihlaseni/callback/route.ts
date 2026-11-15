import { and, eq } from "drizzle-orm";
import { NextResponse, after, type NextRequest } from "next/server";
import { audit, logError } from "@/server/audit";
import { DEVICE_COOKIE, deviceCookieOptions, deviceLabel, findDevice, inviteOnlyLogin, registerBootstrapDevice, touchDevice } from "@/server/auth/devices";
import { completeLogin, verifyLoginState, type LoginFailure } from "@/server/auth/google-login";
import { SESSION_COOKIE, encodeSession, sessionCookieOptions } from "@/server/auth/session";
import { config, googleLoginConfig } from "@/server/config";
import { grantsCalendar, needsCalendarConnection, revokeToken, saveGrant } from "@/server/calendar/google-auth";
import { syncAfterReconnect } from "@/server/calendar/sync";
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
  wrong_account: "jiny-ucet",
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
    const scope = pending.scope;
    if (inviteOnlyLogin()) {
      // Zařízení se ověřuje znovu: mezi začátkem přihlášení a návratem ho mohl správce zneplatnit.
      if (!scope) return finish(gateUrl("neplatny-stav"));
      if (scope.kind === "device") {
        const device = await findDevice(db, request.cookies.get(DEVICE_COOKIE)?.value);
        if (!device || device.id !== scope.deviceId || device.userId !== scope.userId) return finish(gateUrl("neplatny-stav"));
      }
    }
    const result = await completeLogin(db, cfg, { code, nonce: pending.nonce, verifier: pending.verifier, ...(scope ? { scope } : {}) });
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
    // Nový souhlas vždy přepíše starý záznam, i kdyby starý ještě vypadal platně.
    let connected = false;
    if (grant) {
      if (plans && grantsCalendar(grant.scopes)) {
        await saveGrant(db, { ...grant, userId: result.userId });
        await audit(db, result.userId, "calendar.connected", "settings", "google-calendar");
        connected = true;
        after(() => syncAfterReconnect(db));
      } else if (!plans) {
        // Oprávnění od někoho, kdo plán nespravuje, Wiki nedrží.
        await revokeToken(grant.refreshToken);
      }
      // Správce, který rozsah Kalendáře odškrtl, se nezneplatňuje: zneplatnění u Googlu by shodilo
      // celé oprávnění účtu včetně dřív uloženého propojení Kalendáře.
    }
    // Druhé automatické přesměrování jen tehdy, když o Kalendář ještě nikdo nežádal (první přihlášení
    // správce z tohoto prohlížeče). Po odmítnutí nebo výslovném „bez Kalendáře“ zůstává úkol na Plánu.
    const connectNext = missing && !connected && pending.calendar === "later";
    const response = finish(`${config.appUrl}${connectNext ? CONNECT_PATH : "/"}`);
    let deviceId: string | undefined;
    if (scope?.kind === "device") {
      deviceId = scope.deviceId;
      await touchDevice(db, deviceId);
    } else if (scope?.kind === "bootstrap") {
      const device = await registerBootstrapDevice(db, result.userId, deviceLabel(request.headers.get("user-agent")));
      deviceId = device.id;
      response.cookies.set(DEVICE_COOKIE, device.cookieValue, deviceCookieOptions);
    }
    response.cookies.set(SESSION_COOKIE, encodeSession(result.userId, undefined, "google", deviceId), sessionCookieOptions);
    response.cookies.set(HINT_COOKIE, encodeHint(result.userId), hintCookieOptions);
    return response;
  } catch (error) {
    logError("google.login", "callback_failed", error);
    return finish(gateUrl("nepodarilo-se"));
  }
}
