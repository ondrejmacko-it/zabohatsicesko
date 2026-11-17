import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { hashKey, withinRateLimit } from "@/server/audit";
import { DEVICE_COOKIE, INVITE_COOKIE, checkInvite, findDevice, inviteOnlyLogin } from "@/server/auth/devices";
import { beginLogin, typedLoginHint, type LoginOptions, type LoginScope } from "@/server/auth/google-login";
import { needsCalendarConnection } from "@/server/calendar/google-auth";
import { needsPersonalCalendar } from "@/server/calendar/personal";
import { config, googleCalendarConfig, googleLoginConfig, personalDelivery } from "@/server/config";
import { getDb, type Executor } from "@/server/db/client";
import { userIdentities, users } from "@/server/db/schema";
import { canPlan } from "@/server/policy";
import { HINT_COOKIE, LOGIN_COOKIE, decodeHint, loginCookieOptions } from "./cookie";

/**
 * Účet, který se z tohoto prohlížeče naposledy přihlásil, je aktivní správce a Wiki nemá propojený
 * Kalendář: Google dostane žádost o přihlášení i o Kalendář najednou. Jinak běžné přihlášení.
 */
async function calendarRequestFor(db: Executor, hintedUserId: string | null, scope?: LoginScope): Promise<LoginOptions> {
  // Osobní kalendáře: první přihlášení (pozvánka, zaváděcí správce) rovnou požádá o Kalendář.
  if (scope && scope.kind !== "device" && (await needsPersonalCalendar(db, scope.kind === "invite" ? scope.userId : null))) return { calendar: "personal" };
  if (!hintedUserId) return {};
  const [known] = await db
    .select({ id: users.id, role: users.role, groups: users.groups, status: users.status, email: userIdentities.email })
    .from(users)
    .innerJoin(userIdentities, and(eq(userIdentities.userId, users.id), eq(userIdentities.provider, "google")))
    .where(and(eq(users.orgId, config.orgId), eq(users.id, hintedUserId)))
    .limit(1);
  if (!known || known.status !== "active") return {};
  if (await needsPersonalCalendar(db, known.id)) return { calendar: "personal", loginHint: known.email };
  // Režim organizátora: Kalendář propojuje jen účet organizátora. Osobní účet správce se při přihlášení
  // o Kalendář neptá, propojení jde přes Integrace (Google tam rovnou nabídne účet organizátora).
  const organizer = googleCalendarConfig()?.organizerEmail;
  if (organizer && known.email.toLowerCase() !== organizer) return {};
  return (await needsCalendarConnection(db, canPlan(known))) ? { calendar: "ask", loginHint: known.email } : {};
}

// Začátek přihlášení Google identitou. Jen v nakonfigurovaném testovacím režimu.
// `?kalendar=ne` přihlásí bez žádosti o Kalendář.
// Ostrá Wiki pustí na Google jen prohlížeč s důvěryhodným zařízením, s platnou pozvánkou v cookie, nebo `?spravce=1`
// pro adresy ze zaváděcího seznamu správců. Přímé volání bez zařízení skončí na neutrální stránce vstupu.
export async function GET(request: NextRequest) {
  const cfg = googleLoginConfig();
  if (!cfg) return new Response(null, { status: 404 });
  const db = await getDb();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await withinRateLimit(db, `google-login:${hashKey(ip)}`, 20, 600))) return new Response(null, { status: 429 });

  const params = request.nextUrl.searchParams;
  let scope: LoginScope | undefined;
  let loginHint: string | undefined;
  let hintedUserId = decodeHint(request.cookies.get(HINT_COOKIE)?.value);
  if (inviteOnlyLogin()) {
    const device = await findDevice(db, request.cookies.get(DEVICE_COOKIE)?.value);
    const invite = device ? null : await checkInvite(db, request.cookies.get(INVITE_COOKIE)?.value);
    if (device) {
      scope = { kind: "device", deviceId: device.id, userId: device.userId };
      loginHint = device.email;
      hintedUserId = device.userId;
    } else if (invite) {
      // Pozvánka zatím platí dál. Spotřebuje ji až callback, když se přihlásí právě tento účet.
      // Adresu z pozvánky Google nedostane: nové zařízení nesmí prozradit ani předvyplnit, komu pozvánka patří.
      scope = { kind: "invite", userId: invite.userId };
      loginHint = typedLoginHint(params.get("email"));
      hintedUserId = null;
    } else if (params.get("spravce") === "1" && cfg.bootstrapAdmins?.size) {
      scope = { kind: "bootstrap" };
      loginHint = typedLoginHint(params.get("email"));
    } else {
      const back = NextResponse.redirect(new URL("/vstup", request.nextUrl), 303);
      back.headers.set("Cache-Control", "no-store");
      return back;
    }
  }
  // `?kalendar=osobni`: tlačítko „Propojit Kalendář“ u uživatele (i po odmítnutí nebo odvolání).
  const calendar: LoginOptions =
    params.get("kalendar") === "ne"
      ? { calendar: "skip" }
      : params.get("kalendar") === "osobni" && personalDelivery()
        ? { calendar: "personal" }
        : await calendarRequestFor(db, hintedUserId, scope);
  const { url, cookieValue } = beginLogin(cfg, undefined, { ...calendar, ...(loginHint ? { loginHint } : {}), ...(scope ? { scope } : {}) });
  const response = NextResponse.redirect(url);
  response.cookies.set(LOGIN_COOKIE, cookieValue, loginCookieOptions);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
