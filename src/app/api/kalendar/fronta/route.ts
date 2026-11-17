import { NextResponse, type NextRequest } from "next/server";
import { workerRequestAuthorized } from "@/server/calendar/worker-auth";
import { runCalendarWorker } from "@/server/calendar/worker";
import type { WorkerSource } from "@/server/db/schema";

// Zpracování fronty Kalendáře pro plánovače. GET volá denní cron Vercelu (posílá `CRON_SECRET`),
// POST plánovač v GitHub Actions (`CALENDAR_WORKER_TOKEN`). Obojí v hlavičce `Authorization: Bearer`.
// Odpověď nese jen počty, nikdy názvy akcí ani adresy.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (status: number, body?: object) => {
  const response = body ? NextResponse.json(body, { status }) : new NextResponse(null, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

async function handle(request: NextRequest, source: WorkerSource) {
  if (!workerRequestAuthorized(request.headers.get("authorization"))) return reply(401);
  const result = await runCalendarWorker(source);
  return reply(result.status === "failed" ? 503 : 200, result);
}

export const GET = (request: NextRequest) => handle(request, "vercel-cron");
export const POST = (request: NextRequest) => handle(request, "github");
