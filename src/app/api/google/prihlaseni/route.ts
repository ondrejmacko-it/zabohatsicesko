import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { hashKey, withinRateLimit } from "@/server/audit";
import { DEVICE_COOKIE, trustedDevice } from "@/server/auth/access-links";
import { beginLogin, type LoginOptions } from "@/server/auth/google-login";
import { needsCalendarConnection } from "@/server/calendar/google-auth";
import { config, gateMode, googleLoginConfig } from "@/server/config";
import { getDb, type Executor } from "@/server/db/client";
import { userIdentities, users } from "@/server/db/schema";
import { canPlan } from "@/server/policy";
import { HINT_COOKIE, LOGIN_COOKIE, decodeHint, loginCookieOptions } from "./cookie";

/**
 * Účet, který se z tohoto prohlížeče naposledy přihlásil, je aktivní správce a Wiki nemá propojený
 * Kalendář: Google dostane žádost o přihlášení i o Kalendář najednou. Jinak běžné přihlášení.
 */
async function calendarRequestFor(db: Executor, hintedUserId: string | null): Promise<LoginOptions> {
  if (!hintedUserId) return {};
  const [known] = await db
    .select({ id: users.id, role: users.role, groups: users.groups, status: users.status, email: userIdentities.email })
    .from(users)
    .innerJoin(userIdentities, and(eq(userIdentities.userId, users.id), eq(userIdentities.provider, "google")))
    .where(and(eq(users.orgId, config.orgId), eq(users.id, hintedUserId)))
    .limit(1);
  if (!known || known.status !== "active") return {};
  return (await needsCalendarConnection(db, canPlan(known))) ? { calendar: "ask", loginHint: known.email } : {};
}

// Začátek přihlášení Google identitou. Jen v nakonfigurovaném testovacím režimu.
// `?jiny=1` nabídne výběr účtu bez ohledu na minulé přihlášení, `?kalendar=ne` přihlásí bez žádosti o Kalendář.
export async function GET(request: NextRequest) {
  const cfg = googleLoginConfig();
  if (!cfg) return new Response(null, { status: 404 });
  const db = await getDb();
  // Vstup na pozvánku: bez osobního odkazu v tomto prohlížeči přihlášení vůbec nezačne.
  if (gateMode() === "invite" && !(await trustedDevice(db, request.cookies.get(DEVICE_COOKIE)?.value))) {
    return new Response(null, { status: 404 });
  }
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await withinRateLimit(db, `google-login:${hashKey(ip)}`, 20, 600))) return new Response(null, { status: 429 });

  const params = request.nextUrl.searchParams;
  const options: LoginOptions =
    params.get("kalendar") === "ne"
      ? { calendar: "skip" }
      : params.get("jiny") === "1"
        ? {}
        : await calendarRequestFor(db, decodeHint(request.cookies.get(HINT_COOKIE)?.value));
  const { url, cookieValue } = beginLogin(cfg, undefined, options);
  const response = NextResponse.redirect(url);
  response.cookies.set(LOGIN_COOKIE, cookieValue, loginCookieOptions);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
