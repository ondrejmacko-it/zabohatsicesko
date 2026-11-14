import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { hashKey, withinRateLimit } from "@/server/audit";
import { DEVICE_COOKIE, deviceCookieOptions, encodeDevice, openAccessLink } from "@/server/auth/access-links";
import { getDb } from "@/server/db/client";

// Osobní odkaz z pozvánky. Platný odkaz dá prohlížeči cookie zařízení a ukáže přihlášení. Neplatný, použitý
// i prošlý odkaz skončí na stejné neutrální stránce, takže se z odpovědi nedá poznat, zda odkaz kdy existoval.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const db = await getDb();
  const response = NextResponse.redirect(new URL("/vstup", request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await withinRateLimit(db, `pozvanka:${hashKey(ip)}`, 30, 600))) return response;
  const opened = await openAccessLink(db, (await params).token);
  if (opened) {
    const exp = Math.floor(opened.expiresAt.getTime() / 1000);
    response.cookies.set(DEVICE_COOKIE, encodeDevice(opened.userId, opened.linkId, exp), {
      ...deviceCookieOptions,
      maxAge: Math.max(60, exp - Math.floor(Date.now() / 1000)),
    });
  }
  return response;
}
