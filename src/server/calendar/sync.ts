import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { addDays, fromPragueLocal, toDateKey } from "@/lib/time";
import type { EventSnapshot, SimAttendee } from "@/lib/types";
import { audit, logError } from "@/server/audit";
import { calendarMode, config, googleCalendarConfig } from "@/server/config";
import { getDb, type Db } from "@/server/db/client";
import { calendarLinks, events, users, type ManagedFields } from "@/server/db/schema";
import { calendarSummary } from "@/server/domain/snapshot";
import { loadEventRow } from "@/server/services/events";
import { DomainError } from "@/server/services/errors";
import { isOrganizer, type Viewer } from "@/server/policy";
import { GoogleCalendar } from "./google";
import { storedAccessToken } from "./google-auth";
import { CalendarError, type CalendarProvider, type ExternalEvent, type ManagedEventData } from "./provider";
import { SimulatedCalendar } from "./simulated";
import { targetCalendarId } from "./target";

const MAX_ATTEMPTS = 3;
const LEASE_SEC = 60;
/** V simulaci smí pozvánka jít jen na fiktivní adresy. Ověřuje se na serveru před zápisem. */
const SIMULATION_ATTENDEE_DOMAIN = "@example.invalid";

/** Poskytovatel, který při každém volání ohlásí chybějící konfiguraci. Nikdy nespadne zpět do simulace. */
const unconfigured = new Proxy({} as CalendarProvider, {
  get: () => async () => {
    throw new CalendarError("calendar_not_configured", false);
  },
});

export function calendarProvider(db: Db): CalendarProvider {
  if (calendarMode() === "simulation") return new SimulatedCalendar(db);
  const cfg = googleCalendarConfig();
  if (!cfg) return unconfigured;
  return new GoogleCalendar({
    tokens: storedAccessToken(db, cfg),
    allowedCalendarIds: cfg.allowedCalendarIds,
    allowedAttendees: cfg.allowedAttendees,
  });
}

function desiredData(eventId: string, snapshot: EventSnapshot): ManagedEventData {
  return {
    summary: calendarSummary(snapshot),
    // Do pozvánky jde jen odkaz. Wiki u něj znovu ověří přístup, citlivý obsah v Kalendáři není.
    description: `Podrobnosti a zápis ve firemní Wiki: ${config.appUrl}/vzdelavani/akce/${eventId}`,
    startsAt: new Date(snapshot.startsAt),
    endsAt: new Date(snapshot.endsAt),
    cancelled: snapshot.status === "cancelled",
  };
}

const managed = (data: ManagedEventData | ExternalEvent): ManagedFields => ({
  summary: data.summary,
  startsAt: data.startsAt.toISOString(),
  endsAt: data.endsAt.toISOString(),
  cancelled: data.cancelled,
});

const sameManaged = (a: ManagedFields, b: ManagedFields) =>
  a.summary === b.summary && a.startsAt === b.startsAt && a.endsAt === b.endsAt && a.cancelled === b.cancelled;

/**
 * Komu půjde nová pozvánka. V simulaci aktivním fiktivním rolím z publika akce (skutečné účty
 * z pozvánek simulace nikdy neosloví). V testovacím režimu Googlu jen povoleným testovacím příjemcům.
 */
async function inviteAttendees(db: Db, audience: string): Promise<SimAttendee[]> {
  const cfg = googleCalendarConfig();
  if (cfg) return cfg.allowedAttendees.map((email) => ({ email, name: email, responseStatus: "needsAction" as const }));
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.orgId, config.orgId), eq(users.origin, "demo"), eq(users.status, "active")));
  const attendees = rows
    .filter((u) => u.groups.includes(audience))
    .map((u) => ({ email: u.email, name: u.name, responseStatus: "needsAction" as const }));
  if (attendees.some((a) => !a.email.endsWith(SIMULATION_ATTENDEE_DOMAIN))) throw new CalendarError("attendee_not_allowed", false);
  return attendees;
}

/** Zámek na úrovni akce: souběžné synchronizace téže akce se serializují. */
async function acquireLease(db: Db, eventId: string) {
  const [link] = await db
    .update(calendarLinks)
    .set({ leaseUntil: sql`now() + make_interval(secs => ${LEASE_SEC})` })
    .where(
      and(
        eq(calendarLinks.eventId, eventId),
        or(isNull(calendarLinks.leaseUntil), lt(calendarLinks.leaseUntil, sql`now()`)),
      ),
    )
    .returning();
  return link ?? null;
}

const releaseLease = (db: Db, eventId: string) =>
  db.update(calendarLinks).set({ leaseUntil: null }).where(eq(calendarLinks.eventId, eventId));

async function markAttention(db: Db, eventId: string, errorCode: string, attempts: number, conflict: ManagedFields | null = null) {
  await db
    .update(calendarLinks)
    .set({ syncStatus: "attention", errorCode, attempts, conflict, updatedAt: new Date() })
    .where(eq(calendarLinks.eventId, eventId));
}

/**
 * Propíše zveřejněnou revizi akce do Kalendáře. Posílá vždy nejnovější zveřejněný snímek,
 * takže starší revize nikdy nepřepíše novější. Opakované volání je bezpečné.
 * @param force přepsat ruční změnu provedenou mimo Wiki (rozhodnutí organizátora)
 */
export async function syncEvent(eventId: string, options: { force?: boolean } = {}): Promise<void> {
  const db = await getDb();
  const link = await acquireLease(db, eventId);
  if (!link) return;
  const provider = calendarProvider(db);
  let attempts = link.attempts;
  try {
    for (;;) {
      const row = await loadEventRow(db, eventId);
      const snapshot = row?.published;
      const revision = row?.publishedRevision ?? 0;
      const [current] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, eventId)).limit(1);
      if (!row || !snapshot || !current) return;
      if (current.syncedRevision >= revision && current.syncStatus === "synced") return;

      const desired = desiredData(eventId, snapshot);
      let external: ExternalEvent;
      try {
        external = await pushToCalendar(db, provider, current, desired, snapshot, options.force === true);
      } catch (error) {
        if (error instanceof ConflictDetected) {
          await markAttention(db, eventId, "external_change", attempts, error.external);
          return;
        }
        if (!(error instanceof CalendarError)) throw error;
        attempts += 1;
        logError("calendar.sync", error.code);
        if (!error.transient || attempts >= MAX_ATTEMPTS) {
          await markAttention(db, eventId, error.code, attempts);
          return;
        }
        await db.update(calendarLinks).set({ attempts, errorCode: error.code }).where(eq(calendarLinks.eventId, eventId));
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempts));
        continue;
      }

      // Monotónní zápis: revize se posune jen dopředu.
      await db
        .update(calendarLinks)
        .set({
          externalEventId: external.id,
          syncedRevision: revision,
          syncedFields: managed(external),
          syncStatus: "synced",
          errorCode: null,
          conflict: null,
          attempts: 0,
          updatedAt: new Date(),
        })
        .where(and(eq(calendarLinks.eventId, eventId), lt(calendarLinks.syncedRevision, revision + 1)));
      await audit(db, null, "calendar.synced", "event", eventId);

      // Pokud mezitím organizátor zveřejnil novější revizi, rovnou ji odešleme.
      const [latest] = await db.select({ rev: events.publishedRevision }).from(events).where(eq(events.id, eventId));
      if ((latest?.rev ?? 0) <= revision) return;
      await db.update(calendarLinks).set({ syncStatus: "pending" }).where(eq(calendarLinks.eventId, eventId));
      attempts = 0;
    }
  } finally {
    await releaseLease(db, eventId);
  }
}

class ConflictDetected extends Error {
  constructor(readonly external: ManagedFields) {
    super("external_change");
  }
}

async function pushToCalendar(
  db: Db,
  provider: CalendarProvider,
  link: typeof calendarLinks.$inferSelect,
  desired: ManagedEventData,
  snapshot: EventSnapshot,
  force: boolean,
): Promise<ExternalEvent> {
  if (!link.externalEventId) {
    // Nejasný výsledek předchozího pokusu: nejdřív ověřit, zda událost už nevznikla.
    const key = `${config.orgId}:${link.eventId}`;
    const existing = await provider.findByKey(link.calendarId, key);
    if (existing) return sameManaged(managed(existing), managed(desired)) ? existing : provider.patch(link.calendarId, existing.id, desired);
    return provider.create(link.calendarId, key, desired, await inviteAttendees(db, snapshot.audience));
  }
  const external = await provider.get(link.calendarId, link.externalEventId);
  if (!external) throw new CalendarError("calendar_missing", false);
  if (!force && link.syncedFields && !sameManaged(managed(external), link.syncedFields)) {
    throw new ConflictDetected(managed(external));
  }
  if (sameManaged(managed(external), managed(desired)) && external.description === desired.description) return external;
  return provider.patch(link.calendarId, link.externalEventId, desired);
}

// ——— Akce organizátora nad vazbou ———

function requireOrganizer(viewer: Viewer) {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
}

/** Ruční opakování po chybě. Vynulování pokusů je auditované. */
export async function requestRetry(viewer: Viewer, eventId: string): Promise<void> {
  requireOrganizer(viewer);
  const db = await getDb();
  const [link] = await db
    .update(calendarLinks)
    .set({ syncStatus: "pending", attempts: 0, errorCode: null, updatedAt: new Date() })
    .where(eq(calendarLinks.eventId, eventId))
    .returning();
  if (!link) throw new DomainError("not_found");
  await audit(db, viewer.id, "calendar.retry", "event", eventId);
}

/**
 * Po novém připojení účtu vrátí do fronty akce, které zastavilo odvolání přístupu.
 * Ostatní chyby (například ruční změnu v Kalendáři) dál řeší organizátor sám.
 * @returns ID akcí, které má volající znovu synchronizovat
 */
export async function resumeAfterReconnect(db: Db): Promise<string[]> {
  const resumed = await db
    .update(calendarLinks)
    .set({ syncStatus: "pending", attempts: 0, errorCode: null, updatedAt: new Date() })
    .where(and(eq(calendarLinks.syncStatus, "attention"), eq(calendarLinks.errorCode, "calendar_revoked")))
    .returning({ eventId: calendarLinks.eventId });
  return resumed.map((r) => r.eventId);
}

/** Organizátor výslovně rozhodl založit novou pozvánku pro zveřejněnou akci bez vazby. */
export async function requestNewInvite(viewer: Viewer, eventId: string): Promise<void> {
  requireOrganizer(viewer);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const row = await loadEventRow(tx, eventId);
    if (!row?.published || row.type === "holiday") throw new DomainError("invalid_state");
    await tx.update(events).set({ calendarIntent: "create" }).where(eq(events.id, eventId));
    await tx
      .insert(calendarLinks)
      .values({ eventId, calendarId: targetCalendarId(), syncStatus: "pending", syncedRevision: 0, attempts: 0 })
      .onConflictDoNothing();
    await audit(tx, viewer.id, "calendar.create_intent", "event", eventId);
  });
}

/** Spáruje akci s existující pozvánkou. Hosté a RSVP pozvánky zůstanou, Wiki převezme jen spravovaná pole. */
export async function pairWithExisting(viewer: Viewer, eventId: string, externalEventId: string): Promise<void> {
  requireOrganizer(viewer);
  // Spárovat lze jen nespárovanou pozvánku ze stejného dne, kterou organizátor viděl v nabídce.
  const external = (await pairingCandidates(viewer, eventId)).find((c) => c.id === externalEventId);
  if (!external) throw new DomainError("invalid_state");
  const db = await getDb();
  await db.transaction(async (tx) => {
    const row = await loadEventRow(tx, eventId);
    if (!row?.published) throw new DomainError("invalid_state");
    await tx.insert(calendarLinks).values({
      eventId,
      calendarId: targetCalendarId(),
      externalEventId: external.id,
      // U opakované události se vazba drží konkrétního výskytu, ostatní termíny série zůstanou.
      recurringEventId: external.recurringEventId ?? null,
      originalStartTime: external.originalStartTime ?? null,
      syncedFields: managed(external),
      syncStatus: "pending",
      syncedRevision: 0,
      attempts: 0,
    });
    await audit(tx, viewer.id, "calendar.pair", "event", eventId);
  });
}

/** Nespárované události z testovacího kalendáře ve stejném dni jako akce. */
export async function pairingCandidates(viewer: Viewer, eventId: string): Promise<ExternalEvent[]> {
  requireOrganizer(viewer);
  const db = await getDb();
  const row = await loadEventRow(db, eventId);
  if (!row?.published) return [];
  const day = toDateKey(row.startsAt);
  const candidates = await calendarProvider(db).listBetween(
    targetCalendarId(),
    fromPragueLocal(day, "00:00"),
    fromPragueLocal(addDays(day, 1), "00:00"),
  );
  const linked = await db.select({ id: calendarLinks.externalEventId }).from(calendarLinks);
  const taken = new Set(linked.map((l) => l.id));
  return candidates.filter((c) => !taken.has(c.id));
}
