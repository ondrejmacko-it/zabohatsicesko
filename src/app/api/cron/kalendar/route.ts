import { syncPublished } from "@/server/calendar/sync";
import { isCronRequest } from "@/server/cron";
import { logError } from "@/server/audit";

// Pravidelné doručení pozvánek nezávisle na tom, jestli někdo otevřel Plán. Volá Vercel Cron
// (viz vercel.json) s tajemstvím CRON_SECRET. Dělá totéž co otevření Plánu správcem: dozaloží
// chybějící vazby a odešle frontu. Opakované volání je bezpečné, souběh hlídá zámek u každé vazby.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Stejná odpověď pro chybějící i špatné tajemství, aby cesta neprozradila, zda je cron nastavený.
  if (!isCronRequest(request.headers.get("authorization"))) return new Response(null, { status: 401 });
  try {
    await syncPublished();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("cron", "calendar_sync", error);
    return Response.json({ ok: false }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
