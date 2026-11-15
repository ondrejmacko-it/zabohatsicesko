import { NextResponse, type NextRequest } from "next/server";
import { checkAccessCode, encodeGate, GATE_COOKIE, gateCookieOptions } from "@/server/auth/gate";
import { config, isLiveWiki } from "@/server/config";
import { getDb } from "@/server/db/client";

// Zvací odkaz ukázky `/vstup?pozvanka=<kód>` sem přesměruje stránka vstupu. Kód se ověří stejně jako
// ruční zadání (limit pokusů), uloží se cookie brány a uživatel se vrátí na `/vstup` už bez kódu v adrese.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Adresa podle požadavku, ne podle APP_URL: preview každé větve má vlastní host.
  const back = (result?: string) => {
    const url = new URL("/vstup", request.nextUrl);
    if (result) url.searchParams.set("odkaz", result);
    const response = NextResponse.redirect(url, 303);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  // Ostrá Wiki pozvánky ukázky nezná (a kód ukázky mít nemusí), lokálně brána není.
  if (isLiveWiki()) return back();
  const expected = config.accessCode;
  if (expected === null) return back();
  const code = (request.nextUrl.searchParams.get("kod") ?? "").slice(0, 200);
  if (!code) return back("neplatny");
  const result = await checkAccessCode(await getDb(), code, expected);
  if (result === "limited") return back("limit");
  if (result === "wrong") return back("neplatny");
  const response = back();
  response.cookies.set(GATE_COOKIE, encodeGate(expected), gateCookieOptions);
  return response;
}
