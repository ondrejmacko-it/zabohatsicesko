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

type LoginStartResult = { kind: "google"; url: string; cookieValue: string } | { kind: "gate"; url: URL } | { kind: "error"; status: number };

/**
 * Společný začátek přihlášení pro GET (odkazy bez e-mailu) i POST (ručně zadaná adresa).
 * `typedEmail` přichází jen z těla POST: adresa se nikdy neobjeví v URL Wiki, historii ani v přístupových lozích.
 */
async function prepareLogin(request: NextRequest, typedEmail: string | null): Promise<LoginStartResult> {
  const cfg = googleLoginConfig();
  if (!cfg) return { kind: "error", status: 404 };
  const db = await getDb();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await withinRateLimit(db, `google-login:${hashKey(ip)}`, 20, 600))) return { kind: "error", status: 429 };

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
      loginHint = typedLoginHint(typedEmail);
      hintedUserId = null;
    } else if (params.get("spravce") === "1" && cfg.bootstrapAdmins?.size) {
      scope = { kind: "bootstrap" };
      loginHint = typedLoginHint(typedEmail);
    } else {
      return { kind: "gate", url: new URL("/vstup", request.nextUrl) };
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
  return { kind: "google", url, cookieValue };
}

// Začátek přihlášení Google identitou. Jen v nakonfigurovaném testovacím režimu.
// `?kalendar=ne` přihlásí bez žádosti o Kalendář.
// Ostrá Wiki pustí na Google jen prohlížeč s důvěryhodným zařízením, s platnou pozvánkou v cookie, nebo `?spravce=1`
// pro adresy ze zaváděcího seznamu správců. Přímé volání bez zařízení skončí na neutrální stránce vstupu.
// GET nikdy nečte e-mail z URL: ručně zadaná adresa jde jen přes POST níže.
export async function GET(request: NextRequest) {
  const result = await prepareLogin(request, null);
  if (result.kind === "error") return new Response(null, { status: result.status });
  const response = NextResponse.redirect(result.url, result.kind === "gate" ? 303 : 307);
  if (result.kind === "google") response.cookies.set(LOGIN_COOKIE, result.cookieValue, loginCookieOptions);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

const MAX_BODY = 1024;

/**
 * Nové zařízení s ručně zadanou adresou. Prohlížeč pošle `fetch` POST s JSON tělem, server připraví stav
 * přihlášení (podepsaná HttpOnly cookie) a vrátí adresu Googlu, na kterou klient přejde přes `location`.
 * Odeslání formuláře by CSP `form-action 'self'` při přesměrování na Google zablokovala.
 * Jen JSON ze stejného původu: cizí stránka tento požadavek bez CORS preflightu poslat nemůže.
 */
export async function POST(request: NextRequest) {
  const noStore = { "Cache-Control": "no-store" };
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin || !request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });
  let email: string | null = null;
  try {
    const body: unknown = JSON.parse(raw);
    if (body && typeof body === "object" && typeof (body as { email?: unknown }).email === "string") email = (body as { email: string }).email;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });
  }
  const result = await prepareLogin(request, email);
  if (result.kind === "error") return NextResponse.json({ error: result.status === 429 ? "rate_limited" : "unavailable" }, { status: result.status, headers: noStore });
  if (result.kind === "gate") return NextResponse.json({ url: "/vstup" }, { headers: noStore });
  const response = NextResponse.json({ url: result.url }, { headers: noStore });
  response.cookies.set(LOGIN_COOKIE, result.cookieValue, loginCookieOptions);
  return response;
}
