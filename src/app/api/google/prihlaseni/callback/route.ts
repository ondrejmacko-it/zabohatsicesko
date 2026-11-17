import { and, eq } from "drizzle-orm";
import { NextResponse, after, type NextRequest } from "next/server";
import { audit, logError } from "@/server/audit";
import { DEVICE_COOKIE, INVITE_COOKIE, checkInvite, claimInvite, deviceCookieOptions, deviceLabel, findDevice, inviteCookieOptions, inviteOnlyLogin, registerBootstrapDevice, touchDevice } from "@/server/auth/devices";
import { completeLogin, verifyLoginState, type LoginFailure } from "@/server/auth/google-login";
import { PRIMARY_ADMIN_SESSION_TTL_SEC, SESSION_COOKIE, encodeSession, sessionCookieOptions } from "@/server/auth/session";
import { config, googleCalendarConfig, googleLoginConfig, isPrimaryAdmin, personalDelivery } from "@/server/config";
import { grantsCalendar, isAllowedCalendarAccount, needsCalendarConnection, revokeToken, saveGrant } from "@/server/calendar/google-auth";
import { grantsPersonalCalendar, markPersonalDeclined, savePersonalGrant, syncPersonalCalendar, syncPersonalCalendars } from "@/server/calendar/personal";
import { syncAfterReconnect } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { canPlan } from "@/server/policy";
import { CONNECT_PATH } from "../../kalendar/cookie";
import { HINT_COOKIE, LOGIN_COOKIE, encodeHint, gateUrl, hintCookieOptions, loginCookieOptions } from "../cookie";

/** Jak dlouho přihlášení počká na první zápis do osobního kalendáře, než přesměruje na Úvod. */
const FIRST_SYNC_WAIT_MS = 6_000;

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
  if (!code || code.length > 2048) return finish(gateUrl(pending.calendar === "ask" || pending.calendar === "personal" ? "zruseno-kalendar" : "zruseno"));

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
      // Pozvánku mohl mezitím správce zneplatnit nebo ji použilo jiné okno.
      if (scope.kind === "invite") {
        const invite = await checkInvite(db, request.cookies.get(INVITE_COOKIE)?.value);
        if (!invite || invite.userId !== scope.userId) return finish(gateUrl("neplatny-stav"));
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
    // Pozvánka se spotřebuje teprve teď, po přihlášení pozvaným účtem, a jen pro něj (kontrola `userId`
    // v podmíněném UPDATE). Souběžné druhé okno už neprojde, zařízení vznikne jen jednou.
    let claimed: { deviceId: string; cookieValue: string } | undefined;
    if (scope?.kind === "invite") {
      const token = request.cookies.get(INVITE_COOKIE)?.value ?? "";
      const label = deviceLabel(request.headers.get("user-agent"));
      const claim = result.userId === scope.userId ? await db.transaction((tx) => claimInvite(tx, token, label, new Date(), result.userId)) : { ok: false as const };
      if (!claim.ok) {
        if (grant) await revokeToken(grant.refreshToken);
        await audit(db, null, "invite.rejected", "invite", "-");
        const rejected = finish(gateUrl("neplatny-stav"));
        rejected.cookies.set(INVITE_COOKIE, "", { ...inviteCookieOptions, maxAge: 0 });
        return rejected;
      }
      claimed = { deviceId: claim.deviceId, cookieValue: claim.cookieValue };
    }
    await audit(db, result.userId, "session.start.google", "user", result.userId);
    const [account] = await db.select({ id: users.id, role: users.role, groups: users.groups, email: users.email }).from(users).where(and(eq(users.orgId, config.orgId), eq(users.id, result.userId))).limit(1);
    const plans = account ? canPlan(account) : false;
    const missing = await needsCalendarConnection(db, plans);
    // Režim organizátora: přihlášení propojí Kalendář jen tehdy, když se přihlásil přímo účet organizátora
    // (ověřený e-mail z podepsaného ID tokenu). Osobní účet správce se nepropojí ani automaticky nenabídne.
    const calendarCfg = googleCalendarConfig();
    const allowedAccount = calendarCfg ? isAllowedCalendarAccount(calendarCfg, grant?.accountEmail ?? account?.email.toLowerCase() ?? null) : false;

    // Správce dal souhlas ke Kalendáři už na přihlašovací obrazovce: propojení se uloží hned, bez dalšího kroku.
    // Nový souhlas vždy přepíše starý záznam, i kdyby starý ještě vypadal platně.
    let connected = false;
    const personal = personalDelivery() && grant !== undefined && grantsPersonalCalendar(grant.scopes);
    if (personal && grant) {
      // Vlastní kalendář „Vzdělávání ZBC“: token jde šifrovaně do databáze, akce se zapíšou hned po přesměrování.
      await savePersonalGrant(db, result.userId, grant);
      // První zápis počká krátce před přesměrováním, aby Úvod rovnou ukázal „Propojeno“. Co nestihne,
      // dokončí se po odpovědi (zámek v synchronizaci brání dvojímu běhu).
      const first = syncPersonalCalendar(db, result.userId).catch((error: unknown) => {
        logError("calendar.personal", "first_sync_failed", error);
        return "retry" as const;
      });
      await Promise.race([first, new Promise((resolve) => setTimeout(resolve, FIRST_SYNC_WAIT_MS))]);
      after(async () => {
        await first;
        await syncPersonalCalendars(db);
      });
    } else if ((pending.calendar === "personal" || pending.calendar === "skip") && personalDelivery() && account) {
      // Kalendář odškrtnutý: Wiki se znovu neptá, uživatel má na Úvodu tlačítko „Propojit Kalendář“.
      await markPersonalDeclined(db, result.userId, account.email);
      if (grant && !plans) await revokeToken(grant.refreshToken);
    } else if (grant) {
      if (plans && allowedAccount && grantsCalendar(grant.scopes)) {
        await saveGrant(db, { ...grant, userId: result.userId });
        await audit(db, result.userId, "calendar.connected", "settings", "google-calendar");
        connected = true;
        after(() => syncAfterReconnect(db));
      } else if (!plans || !allowedAccount) {
        // Oprávnění od někoho, kdo plán nespravuje, nebo od jiného účtu než organizátora Wiki nedrží.
        await revokeToken(grant.refreshToken);
      }
      // Správce, který rozsah Kalendáře odškrtl, se nezneplatňuje: zneplatnění u Googlu by shodilo
      // celé oprávnění účtu včetně dřív uloženého propojení Kalendáře.
    }
    // Druhé automatické přesměrování jen tehdy, když o Kalendář ještě nikdo nežádal (první přihlášení
    // správce z tohoto prohlížeče). Po odmítnutí nebo výslovném „bez Kalendáře“ zůstává úkol na Plánu.
    const connectNext = missing && !connected && allowedAccount && pending.calendar === "later";
    const response = finish(`${config.appUrl}${connectNext ? CONNECT_PATH : "/"}`);
    let deviceId: string | undefined;
    if (scope?.kind === "device") {
      deviceId = scope.deviceId;
      await touchDevice(db, deviceId);
      // Obnoví lhůtu cookie zařízení (prohlížeč drží nejvýš 400 dní), platnost dál rozhoduje databáze.
      const deviceCookie = request.cookies.get(DEVICE_COOKIE)?.value;
      if (deviceCookie) response.cookies.set(DEVICE_COOKIE, deviceCookie, deviceCookieOptions);
    } else if (claimed) {
      deviceId = claimed.deviceId;
      response.cookies.set(DEVICE_COOKIE, claimed.cookieValue, deviceCookieOptions);
      response.cookies.set(INVITE_COOKIE, "", { ...inviteCookieOptions, maxAge: 0 });
    } else if (scope?.kind === "bootstrap") {
      const device = await registerBootstrapDevice(db, result.userId, deviceLabel(request.headers.get("user-agent")));
      deviceId = device.id;
      response.cookies.set(DEVICE_COOKIE, device.cookieValue, deviceCookieOptions);
    }
    // Hlavní správce se na svém zařízení znovu nepřihlašuje. Ostatní jednou za 12 hodin jen tlačítkem Google.
    const primary = account ? isPrimaryAdmin(account) : false;
    const ttl = primary ? PRIMARY_ADMIN_SESSION_TTL_SEC : undefined;
    response.cookies.set(SESSION_COOKIE, encodeSession(result.userId, undefined, "google", deviceId, ttl), {
      ...sessionCookieOptions,
      ...(ttl ? { maxAge: ttl } : {}),
    });
    response.cookies.set(HINT_COOKIE, encodeHint(result.userId), hintCookieOptions);
    return response;
  } catch (error) {
    logError("google.login", "callback_failed", error);
    return finish(gateUrl("nepodarilo-se"));
  }
}
