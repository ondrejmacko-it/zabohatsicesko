import { createHash } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, ne, sql } from "drizzle-orm";
import type { EventSnapshot } from "@/lib/types";
import { audit } from "@/server/audit";
import { attendeeSource, config, googleCalendarConfig, now, participationEnabled, personalDelivery } from "@/server/config";
import type { Executor } from "@/server/db/client";
import { calendarLinks, events } from "@/server/db/schema";
import { participationState } from "@/server/domain/participation";
import { participationInputs } from "./attendees";

// Aktivace individuální účasti (`PARTICIPATION=on`) nad existujícími pozvánkami (zadání I).
// Po zapnutí se hosté akce počítají podle účasti, už vydané pozvánky se ale samy nepřepočítají: změní se až
// při další úpravě akce nebo účasti. Inventura předem spočítá, kolik hostů se přidá a odebere a z jakého
// důvodu (jen počty, nikdy adresy ani důvody omluv). Řízená synchronizace pak vrátí dotčené akce do fronty
// po dávkách, jen se schváleným otiskem a jen se zapnutou účastí. Google se tu nevolá, Wiki vychází
// z hostů, které sama spravuje (`managed_attendees`). Ručně přidaní hosté a RSVP se nemění.

export type ActivationInventory = {
  /** Proč se nic nepřepočítá: osobní kalendáře nebo pevný seznam testovacích příjemců. */
  notApplicable: "personal" | "allowlist" | null;
  /** Budoucí zveřejněné akce s pozvánkou, které aktivace může změnit. */
  eventsChecked: number;
  /** Akce, kde se hosté po aktivaci změní. */
  eventsAffected: number;
  /** Starší vazby bez seznamu spravovaných hostů: Wiki u nich nikoho neodebere, jen doplní chybějící. */
  legacyLinks: number;
  add: { required: number; voluntaryEnrolled: number };
  remove: { excused: number; notEnrolled: number; notRecipient: number };
  /** Otisk počtů a dotčených akcí. Synchronizace ho vyžaduje, změna dat ho zneplatní. */
  fingerprint: string;
};

type Affected = { eventId: string; add: number; remove: number };
type Scan = { inventory: ActivationInventory; affected: Affected[]; synced: Set<string> };

async function scan(db: Executor): Promise<Scan> {
  const empty = { eventsChecked: 0, eventsAffected: 0, legacyLinks: 0, add: { required: 0, voluntaryEnrolled: 0 }, remove: { excused: 0, notEnrolled: 0, notRecipient: 0 } };
  const notApplicable = personalDelivery() ? "personal" : googleCalendarConfig() && attendeeSource() === "allowlist" ? "allowlist" : null;
  if (notApplicable) return { inventory: { notApplicable, ...empty, fingerprint: fingerprintOf(empty, []) }, affected: [], synced: new Set() };

  const rows = await db
    .select({ id: events.id, published: events.published, managed: calendarLinks.managedAttendees, syncStatus: calendarLinks.syncStatus })
    .from(events)
    .innerJoin(calendarLinks, eq(calendarLinks.eventId, events.id))
    .where(
      and(
        eq(events.orgId, config.orgId),
        isNotNull(events.published),
        ne(events.type, "holiday"),
        ne(events.status, "cancelled"),
        gt(sql`(${events.published}->>'startsAt')::timestamptz`, sql`${now().toISOString()}::timestamptz`),
      ),
    )
    .orderBy(events.id);
  const counts = structuredClone(empty);
  const affected: Affected[] = [];
  // Stav fronty není v otisku: mezi dávkami se mění, i když inventura zůstává stejná.
  const synced = new Set<string>();
  for (const row of rows) {
    const snapshot = row.published as EventSnapshot;
    if (snapshot.status === "cancelled") continue;
    counts.eventsChecked++;
    if (row.managed === null) counts.legacyLinks++;
    const managed = new Set((row.managed ?? []).map((e) => e.toLowerCase()));
    const { recipients, records } = await participationInputs(db, row.id);
    const known = new Set<string>();
    let add = 0;
    let remove = 0;
    for (const r of recipients) {
      known.add(r.email);
      const state = participationState({ status: "active", groups: r.groups }, snapshot, records.get(r.id) ?? null);
      const wanted = state === "required" || state === "voluntary_enrolled";
      if (wanted && !managed.has(r.email)) {
        add++;
        if (state === "required") counts.add.required++;
        else counts.add.voluntaryEnrolled++;
      } else if (!wanted && managed.has(r.email)) {
        remove++;
        if (state === "excused") counts.remove.excused++;
        else counts.remove.notEnrolled++;
      }
    }
    for (const email of managed) {
      if (known.has(email)) continue;
      remove++;
      counts.remove.notRecipient++;
    }
    if (add || remove) affected.push({ eventId: row.id, add, remove });
    if (row.syncStatus === "synced") synced.add(row.id);
  }
  counts.eventsAffected = affected.length;
  return { inventory: { notApplicable: null, ...counts, fingerprint: fingerprintOf(counts, affected) }, affected, synced };
}

function fingerprintOf(counts: object, affected: Affected[]): string {
  return createHash("sha256").update(JSON.stringify({ counts, affected })).digest("hex").slice(0, 12);
}

/** Jen čte. Vhodné spustit před zapnutím `PARTICIPATION` i po něm (výsledek je stejný, dokud se data nezmění). */
export async function activationInventory(db: Executor): Promise<ActivationInventory> {
  return (await scan(db)).inventory;
}

export type ActivationSyncResult =
  | { mode: "dry-run"; inventory: ActivationInventory }
  | { mode: "queued"; queued: number; remaining: number; inProgress: number };

/**
 * Vrátí do fronty synchronizace dotčené akce, nejvýš `batch` najednou. Bez otisku jen dry-run. Odmítne se
 * bez zapnuté účasti (jinak by fronta pozvánky spočítala postaru) a při otisku jiném, než má aktuální
 * inventura. `remaining` = dotčené akce čekající na další dávku, `inProgress` = ve frontě nebo k ručnímu řešení.
 */
export async function queueActivationSync(db: Executor, options: { approvedFingerprint?: string; batch?: number } = {}): Promise<ActivationSyncResult> {
  const { inventory, affected, synced } = await scan(db);
  if (!options.approvedFingerprint) return { mode: "dry-run", inventory };
  if (!participationEnabled()) throw new Error("Synchronizace po aktivaci vyžaduje zapnutou účast (PARTICIPATION=on a migrace).");
  if (options.approvedFingerprint !== inventory.fingerprint) throw new Error("Otisk neodpovídá aktuální inventuře. Spusť novou inventuru a nech ji schválit.");
  const batch = Math.max(1, Math.min(options.batch ?? 20, 200));
  // Akce už ve frontě (pending) nebo k ručnímu řešení (attention) se znovu nezařazují.
  const waiting = affected.filter((a) => synced.has(a.eventId));
  const ids = waiting.slice(0, batch).map((a) => a.eventId);
  const queued = ids.length
    ? (
        await db
          .update(calendarLinks)
          .set({ syncStatus: "pending", attempts: 0, errorCode: null, updatedAt: new Date() })
          .where(and(eq(calendarLinks.syncStatus, "synced"), inArray(calendarLinks.eventId, ids)))
          .returning({ id: calendarLinks.eventId })
      ).length
    : 0;
  await audit(db, null, "calendar.activation_sync", "org", `${inventory.fingerprint}:${queued}/${affected.length}`);
  return { mode: "queued", queued, remaining: waiting.length - queued, inProgress: affected.length - waiting.length };
}
