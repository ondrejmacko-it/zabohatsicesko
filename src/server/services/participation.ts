import { and, eq, inArray, sql } from "drizzle-orm";
import { audit } from "@/server/audit";
import { config, now } from "@/server/config";
import { getDb, type Executor } from "@/server/db/client";
import { eventParticipation, events, users } from "@/server/db/schema";
import {
  effectiveParticipation,
  participationTransition,
  type Participation,
  type ParticipationChange,
  type ParticipationRecord,
} from "@/server/domain/participation";
import type { Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";

// Serverová vrstva individuální účasti. PR1: jen pro testy a PR2, žádná stránka, akce formuláře ani API ji
// zatím nevolá. Tabulka `event_participation` vzniká migrací 0016 (approval), na vzdálené DB zatím není.
// Pravidla: člověk mění jen SVOU účast (id ze skutečné session, nikdy z náhledu), stav účtu a role se čtou
// z databáze, rozhoduje poslední zveřejněný snímek. Důvod ani poznámka omluvy nejdou do auditu ani logu.

async function loadRecord(db: Executor, eventId: string, userId: string): Promise<ParticipationRecord | null> {
  const [row] = await db
    .select({ kind: eventParticipation.kind, excuseReason: eventParticipation.excuseReason })
    .from(eventParticipation)
    .where(and(eq(eventParticipation.orgId, config.orgId), eq(eventParticipation.eventId, eventId), eq(eventParticipation.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Změna vlastní účasti. Akce se zamkne (FOR UPDATE), takže souběžné změny téhož člověka ani souběžné
 * zveřejnění akce nedají dva různé výsledky; primární klíč (org, akce, člověk) drží jediný záznam.
 * Vrací novou účast. Kalendář se zatím nepřepočítává (PR2).
 */
export async function changeOwnParticipation(viewer: Viewer, eventId: string, change: ParticipationChange): Promise<Participation> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [event] = await tx
      .select({ published: events.published })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.orgId, config.orgId)))
      .for("update")
      .limit(1);
    const [person] = await tx
      .select({ status: users.status, groups: users.groups })
      .from(users)
      .where(and(eq(users.id, viewer.id), eq(users.orgId, config.orgId)))
      .limit(1);
    if (!person || person.status !== "active") throw new DomainError("forbidden");
    if (!event?.published) throw new DomainError("not_found");

    const record = await loadRecord(tx, eventId, viewer.id);
    const at = now();
    const result = participationTransition(effectiveParticipation(person, event.published, record, at), record, change);
    if (!result.ok) throw new DomainError("invalid_state");

    const { write } = result;
    const key = and(eq(eventParticipation.orgId, config.orgId), eq(eventParticipation.eventId, eventId), eq(eventParticipation.userId, viewer.id));
    if (write.op === "delete") {
      await tx.delete(eventParticipation).where(key);
    } else if (write.op === "upsert") {
      const values = {
        kind: write.kind,
        excuseReason: write.kind === "excused" ? write.excuse.reason : null,
        excuseNote: write.kind === "excused" ? write.excuse.note : null,
        actorId: viewer.id,
        updatedAt: at,
      };
      await tx
        .insert(eventParticipation)
        .values({ orgId: config.orgId, eventId, userId: viewer.id, ...values })
        .onConflictDoUpdate({
          target: [eventParticipation.orgId, eventParticipation.eventId, eventParticipation.userId],
          set: { ...values, revision: sql`${eventParticipation.revision} + 1` },
        });
    }
    if (write.op !== "none") await audit(tx, viewer.id, `participation.${change.kind}`, "event", eventId);

    const next = effectiveParticipation(person, event.published, await loadRecord(tx, eventId, viewer.id), at);
    if (!next) throw new DomainError("not_found");
    return next;
  });
}

/**
 * Vlastní výslovné záznamy k vybraným akcím (bez poznámky). Cizí záznamy tato funkce nikdy nevrací.
 * Pro kartu „Povinné pro tebe / Můžeš se přihlásit“ v PR2.
 */
export async function ownParticipationRecords(db: Executor, viewer: Viewer, eventIds: readonly string[]): Promise<Map<string, ParticipationRecord>> {
  if (!eventIds.length) return new Map();
  const rows = await db
    .select({ eventId: eventParticipation.eventId, kind: eventParticipation.kind, excuseReason: eventParticipation.excuseReason })
    .from(eventParticipation)
    .where(and(eq(eventParticipation.orgId, config.orgId), eq(eventParticipation.userId, viewer.id), inArray(eventParticipation.eventId, [...eventIds])));
  return new Map(rows.map((r) => [r.eventId, { kind: r.kind, excuseReason: r.excuseReason }]));
}
