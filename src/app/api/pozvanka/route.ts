import { NextResponse, type NextRequest } from "next/server";
import { audit, hashKey, withinRateLimit } from "@/server/audit";
import { INVITE_COOKIE, checkInvite, inviteCookieOptions, inviteOnlyLogin } from "@/server/auth/devices";
import { getDb } from "@/server/db/client";

// Otevření zvacího odkazu ostré Wiki. Stránka `/vstup` přečte token z fragmentu adresy a pošle ho sem.
// Server jen ověří platnost a uloží token do krátké HttpOnly cookie. Pozvánku spotřebuje až úspěšné
// přihlášení Googlem pozvaným účtem (callback), takže kdo odkaz otevře první, ho nespálí.
// Odpověď neříká, proč odkaz neplatí (prošlý, použitý, zneplatněný, neexistující): vždy stejně.
export const dynamic = "force-dynamic";

const LIMIT = { attempts: 10, windowSec: 15 * 60 };

const reply = (status: number, body?: object) => {
  const response = body ? NextResponse.json(body, { status }) : new NextResponse(null, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export async function POST(request: NextRequest) {
  if (!inviteOnlyLogin()) return reply(404);
  // Jen ze stránky téže Wiki. JSON tělo navíc cizí stránka bez preflightu neodešle.
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply(403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415);
  const db = await getDb();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await withinRateLimit(db, `invite:${hashKey(ip)}`, LIMIT.attempts, LIMIT.windowSec))) return reply(429, { error: "limit" });
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const invite = await checkInvite(db, token);
  if (!invite) {
    // Bez tokenu a bez adresy, jen že pokus neprošel. Četnost hlídá limit výše.
    await audit(db, null, "invite.rejected", "invite", "-");
    return reply(400, { error: "invalid" });
  }
  const response = reply(204);
  response.cookies.set(INVITE_COOKIE, token, inviteCookieOptions);
  return response;
}
