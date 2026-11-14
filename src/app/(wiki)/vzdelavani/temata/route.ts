import { NextResponse, type NextRequest } from "next/server";
import { RETURN_COOKIE, returnCookieOptions, topicInterestPath } from "@/server/auth/return-path";
import { getCurrentUser } from "@/server/auth/session";

// Odkaz z pozvánky i starší odkazy na témata. Témata jsou na jedné stránce se zápisy, `?tema=<id>` tam kartu
// zvýrazní. Samotné otevření odkazu zájem nezapisuje, ten potvrdí až tlačítko po přihlášení.
export async function GET(request: NextRequest) {
  const target = topicInterestPath(request.nextUrl.searchParams.get("tema"));
  const go = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  if (await getCurrentUser()) return go(target);
  // Nepřihlášený: brána si cíl zapamatuje a po přihlášení na něj vrátí.
  const response = go("/vstup");
  response.cookies.set(RETURN_COOKIE, target, returnCookieOptions);
  return response;
}
