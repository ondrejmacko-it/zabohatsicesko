import { and, count, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import { logError } from "@/server/audit";
import { calendarMode, config, googleCalendarConfig, organizerDelivery, personalDelivery } from "@/server/config";
import { getDb, type Db } from "@/server/db/client";
import { calendarLinks, calendarSyncState, calendarWorkerRuns, events, type WorkerSource } from "@/server/db/schema";
import { connectionStatus } from "./google-auth";
import { syncDuePersonalCalendars } from "./personal";
import { CalendarError } from "./provider";
import { syncResponses, type ResponsesSyncResult } from "./rsvp";
import { calendarProvider, errorKind, syncPublished, type ErrorKind } from "./sync";

// Zpracování fronty Kalendáře mimo požadavek uživatele: odešle čekající pozvánky a změny (outbox
// v `calendar_links`) a načte odpovědi pozvaných. Spouští ho plánovač (GitHub Actions, cron Vercelu),
// návštěva Wiki a zveřejnění. Souběh hlídají zámky u každé vazby a u čtení odpovědí, opakované
// spuštění je bezpečné.

export type WorkerResult = {
  status: "off" | "not_connected" | "done" | "failed";
  pending: number;
  attention: number;
  responses: ResponsesSyncResult | "failed" | null;
};

/** Plánovače, jejichž výpadek se hlásí. Návštěva a zveřejnění samy pravidelný běh nezaručí. */
const SCHEDULED: WorkerSource[] = ["github", "vercel-cron"];
/** Návštěva spustí zpracování nejvýš jednou za 5 minut (napříč zdroji). */
const VISIT_INTERVAL_MIN = 5;
/** Bez úspěšného běhu plánovače déle než 30 minut je pravidelný běh v Správě hlášený jako výpadek. */
export const SCHEDULER_STALE_MS = 30 * 60 * 1000;
/** Přechodná chyba fronty se správci hlásí až po hodině, chyba přístupu nebo nastavení hned. */
const TRANSIENT_ALERT_MS = 60 * 60 * 1000;

const runWhere = (source: WorkerSource) => and(eq(calendarWorkerRuns.orgId, config.orgId), eq(calendarWorkerRuns.source, source));

async function queueCounts(db: Db) {
  const rows = await db
    .select({ status: calendarLinks.syncStatus, n: count() })
    .from(calendarLinks)
    .innerJoin(events, eq(events.id, calendarLinks.eventId))
    .where(eq(events.orgId, config.orgId))
    .groupBy(calendarLinks.syncStatus);
  const of = (status: string) => rows.find((r) => r.status === status)?.n ?? 0;
  return { pending: of("pending"), attention: of("attention") };
}

/**
 * Jeden běh zpracování. Do `calendar_worker_runs` zapíše začátek, úspěch nebo kód chyby, nikdy obsah.
 * V režimu osobních kalendářů dožene jen osobní kalendáře, které to potřebují (opakování po chybě,
 * změny účasti a skupin). Pozvánky ani odpovědi starého režimu se nečtou ani neposílají.
 */
export async function runCalendarWorker(source: WorkerSource): Promise<WorkerResult> {
  if (personalDelivery()) {
    try {
      const n = await syncDuePersonalCalendars(await getDb());
      return { status: "done", pending: n, attention: 0, responses: null };
    } catch {
      logError("calendar.worker", `${source}_personal_failed`);
      return { status: "failed", pending: 0, attention: 0, responses: null };
    }
  }
  if (!organizerDelivery()) return { status: "off", pending: 0, attention: 0, responses: null };
  const db = await getDb();
  await db
    .insert(calendarWorkerRuns)
    .values({ orgId: config.orgId, source, lastStartedAt: sql`now()` })
    .onConflictDoUpdate({ target: [calendarWorkerRuns.orgId, calendarWorkerRuns.source], set: { lastStartedAt: sql`now()` } });

  let status: WorkerResult["status"] = "done";
  let responses: WorkerResult["responses"] = null;
  let errorCode: string | null = null;
  try {
    const connected = calendarMode() === "simulation" || (googleCalendarConfig() !== null && (await connectionStatus(db)) !== null);
    if (!connected) {
      status = "not_connected";
      errorCode = "not_connected";
    } else {
      await syncPublished();
      try {
        responses = await syncResponses(db, calendarProvider(db));
      } catch (error) {
        if (!(error instanceof CalendarError)) throw error;
        responses = "failed";
        errorCode = `responses_${error.code}`;
      }
    }
  } catch (error) {
    status = "failed";
    errorCode = error instanceof CalendarError ? error.code : "worker_failed";
    logError("calendar.worker", `${source}_${errorCode}`);
  }
  // Úspěch = běh doběhl. Výpadek Googlu u odpovědí ho nezneplatní, správce ho uvidí jako chybu odpovědí.
  await db
    .update(calendarWorkerRuns)
    .set({ ...(status === "failed" ? {} : { lastSuccessAt: sql`now()` }), lastErrorCode: errorCode })
    .where(runWhere(source));
  return { status, ...(await queueCounts(db)), responses };
}

/**
 * Zpracování při návštěvě Wiki, nejvýš jednou za 5 minut. Nárok si běh bere atomicky v databázi,
 * dvě souběžné návštěvy tedy nespustí dva běhy.
 */
export async function runWorkerIfDue(source: Extract<WorkerSource, "visit" | "publish"> = "visit"): Promise<void> {
  if (!organizerDelivery()) return;
  try {
    const db = await getDb();
    const [recent] = await db
      .select({ n: count() })
      .from(calendarWorkerRuns)
      .where(
        and(
          eq(calendarWorkerRuns.orgId, config.orgId),
          gt(calendarWorkerRuns.lastStartedAt, sql`now() - make_interval(mins => ${VISIT_INTERVAL_MIN})`),
        ),
      );
    if ((recent?.n ?? 0) > 0) return;
    const [claimed] = await db
      .insert(calendarWorkerRuns)
      .values({ orgId: config.orgId, source, lastStartedAt: sql`now()` })
      .onConflictDoUpdate({
        target: [calendarWorkerRuns.orgId, calendarWorkerRuns.source],
        set: { lastStartedAt: sql`now()` },
        setWhere: lt(calendarWorkerRuns.lastStartedAt, sql`now() - make_interval(mins => ${VISIT_INTERVAL_MIN})`),
      })
      .returning({ source: calendarWorkerRuns.source });
    if (!claimed) return;
    await runCalendarWorker(source);
  } catch {
    logError("calendar.worker", `${source}_failed`);
  }
}

// ——— Stav pro Správu ———

export type WorkerAlert =
  | { kind: "scheduler_never" }
  | { kind: "scheduler_stale"; lastSuccessAt: string }
  | { kind: "queue"; errorKind: ErrorKind; count: number; since: string }
  | { kind: "responses"; errorCode: string; since: string };

export type WorkerHealth = {
  runs: Array<{ source: WorkerSource; lastStartedAt: string | null; lastSuccessAt: string | null; lastErrorCode: string | null }>;
  responsesSyncedAt: string | null;
  alerts: WorkerAlert[];
};

const iso = (value: Date | null) => (value ? value.toISOString() : null);

/**
 * Stav zpracování pro Správu. Výpadek plánovače se hlásí jen v režimu Googlu, simulace pravidelný běh nepotřebuje.
 * Chyby fronty podle druhu: přístup a nastavení hned, přechodné po hodině.
 */
export async function workerHealth(db: Db): Promise<WorkerHealth | null> {
  if (!organizerDelivery()) return null;
  const runs = await db.select().from(calendarWorkerRuns).where(eq(calendarWorkerRuns.orgId, config.orgId));
  const alerts: WorkerAlert[] = [];
  if (calendarMode() !== "simulation") {
    const scheduled = runs.filter((r) => SCHEDULED.includes(r.source) && r.lastSuccessAt);
    const last = scheduled.map((r) => r.lastSuccessAt!).sort((a, b) => b.getTime() - a.getTime())[0];
    if (!last) alerts.push({ kind: "scheduler_never" });
    else if (Date.now() - last.getTime() > SCHEDULER_STALE_MS) alerts.push({ kind: "scheduler_stale", lastSuccessAt: last.toISOString() });
  }

  const failing = await db
    .select({ errorCode: calendarLinks.errorCode, failingSince: calendarLinks.failingSince })
    .from(calendarLinks)
    .innerJoin(events, eq(events.id, calendarLinks.eventId))
    .where(and(eq(events.orgId, config.orgId), eq(calendarLinks.syncStatus, "attention"), isNotNull(calendarLinks.failingSince)));
  const byKind = new Map<ErrorKind, { count: number; since: Date }>();
  for (const row of failing) {
    const kind = errorKind(row.errorCode);
    // Ruční změny a spárování řeší stávající úkoly správce, tady by se zdvojily.
    if (kind === "data") continue;
    if (kind === "transient" && Date.now() - row.failingSince!.getTime() < TRANSIENT_ALERT_MS) continue;
    const entry = byKind.get(kind);
    if (!entry) byKind.set(kind, { count: 1, since: row.failingSince! });
    else {
      entry.count += 1;
      if (row.failingSince! < entry.since) entry.since = row.failingSince!;
    }
  }
  for (const [kind, entry] of byKind) alerts.push({ kind: "queue", errorKind: kind, count: entry.count, since: entry.since.toISOString() });

  const [state] = await db.select().from(calendarSyncState).where(eq(calendarSyncState.orgId, config.orgId)).limit(1);
  if (state?.errorCode && state.failingSince && Date.now() - state.failingSince.getTime() >= TRANSIENT_ALERT_MS) {
    alerts.push({ kind: "responses", errorCode: state.errorCode, since: state.failingSince.toISOString() });
  }
  return {
    runs: runs.map((r) => ({ source: r.source, lastStartedAt: iso(r.lastStartedAt), lastSuccessAt: iso(r.lastSuccessAt), lastErrorCode: r.lastErrorCode })),
    responsesSyncedAt: iso(state?.syncedAt ?? null),
    alerts,
  };
}
