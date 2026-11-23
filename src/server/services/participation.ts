import { and, eq, inArray, sql } from "drizzle-orm";
import { audit } from "@/server/audit";
import { config, now, participationEnabled } from "@/server/config";
import { getDb, type Executor } from "@/server/db/client";
import { calendarLinks, eventParticipation, events, users } from "@/server/db/schema";
import {
  effectiveParticipation,
  ownParticipationView,
  participationTransition,
  type OwnParticipationView,
  type Participation,
  type ParticipationChange,
  type ParticipationRecord,
} from "@/server/domain/participation";
import { canReadExcuseDetails, type Viewer } from "@/server/policy";
import type { EventCard } from "@/server/services/events";
import type { PlanPreview } from "@/server/services/preview";
import type { ExcuseReason } from "@/lib/types";
import type { OwnCalendar } from "@/lib/calendar-note";
import { ownCalendarState } from "@/server/calendar/attendees";
import { DomainError } from "@/server/services/errors";

// Serverová vrstva individuální účasti. Stránky a akce formuláře ji volají jen se zapnutým přepínačem
// `PARTICIPATION=on` (`participationEnabled`). Tabulka `event_participation` vzniká migrací 0016 (approval),
// na vzdálené DB zatím není, proto ji bez přepínače žádná běžná cesta nečte.
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
 * Vrací novou účast. Se zapnutou účastí vrátí pozvánku akce do fronty Kalendáře (hosté podle
 * `desiredGuestIds`); omluva ve Wiki platí hned, i když Kalendář ještě čeká nebo selže.
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
    if (write.op !== "none") {
      await audit(tx, viewer.id, `participation.${change.kind}`, "event", eventId);
      if (participationEnabled()) {
        await tx
          .update(calendarLinks)
          .set({ syncStatus: "pending", attempts: 0, errorCode: null, updatedAt: new Date() })
          .where(and(eq(calendarLinks.eventId, eventId), eq(calendarLinks.syncStatus, "synced")));
      }
    }

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

/** Účet a role člověka z databáze. Náhled ani session je nepřepisují. */
async function loadPerson(db: Executor, userId: string) {
  const [person] = await db
    .select({ status: users.status, groups: users.groups })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, config.orgId)))
    .limit(1);
  return person ?? null;
}

/**
 * Doplní ke kartám vlastní účast (štítek, dovolené akce). Bez zapnuté účasti vrací karty beze změny a
 * nedotazuje se. V náhledu („Zobrazit jako“) se počítá jen z rolí náhledu, bez záznamů: cizí přihlášky
 * ani omluvy se tak správci neukážou a akce se nenabízejí (identita akcí je vždy skutečná session).
 */
export async function withOwnParticipation(session: Viewer, preview: PlanPreview | null, cards: EventCard[]): Promise<EventCard[]> {
  // Náhled může bezpečně zobrazit povinnost podle role i při vypnuté možnosti měnit účast.
  if ((!participationEnabled() && !preview) || !cards.length) return cards;
  const db = await getDb();
  const ids = [...new Set(cards.map((c) => c.id))];
  const rows = await db
    .select({ id: events.id, published: events.published })
    .from(events)
    .where(and(eq(events.orgId, config.orgId), inArray(events.id, ids)));
  const published = new Map(rows.map((r) => [r.id, r.published]));
  const person = preview ? { status: "active" as const, groups: preview.viewer.groups } : await loadPerson(db, session.id);
  // Náhled skupiny je hypotetický. Náhled konkrétního kolegy smí správci zobrazit
  // stav přihlášení/omluvení, nikdy však důvod ani poznámku a nikdy akce ke změně.
  const records = participationEnabled() && preview?.personName
    ? await ownParticipationRecords(db, preview.viewer, ids)
    : participationEnabled() && !preview
      ? await ownParticipationRecords(db, session, ids)
      : new Map<string, ParticipationRecord>();
  const at = now();
  return cards.map((card) => {
    const snapshot = published.get(card.id) ?? null;
    const participation = person ? effectiveParticipation(person, snapshot, records.get(card.id) ?? null, at) : null;
    return { ...card, participation: ownParticipationView(participation, { readOnly: Boolean(preview) }) };
  });
}

export type OwnParticipationDetail = OwnParticipationView & {
  /** Jen vlastní omluva, jen pro omluveného samotného (O03). */
  excuse: { reason: ExcuseReason; note: string | null } | null;
  /** Vlastní pozvánka v Kalendáři (F04). Null = Wiki stav nezná, nebo jde o náhled. */
  calendar: OwnCalendar | null;
};

/** Vlastní účast pro detail akce včetně vlastního důvodu omluvy. Null = přepínač vypnutý nebo účast nevzniká. */
export async function ownParticipationDetail(session: Viewer, preview: PlanPreview | null, eventId: string): Promise<OwnParticipationDetail | null> {
  if (!participationEnabled() && !preview) return null;
  const db = await getDb();
  const [row] = await db
    .select({ published: events.published })
    .from(events)
    .where(and(eq(events.orgId, config.orgId), eq(events.id, eventId)))
    .limit(1);
  if (!row) return null;
  if (preview) {
    const record = participationEnabled() && preview.personName
      ? await loadRecord(db, eventId, preview.viewer.id)
      : null;
    const view = ownParticipationView(effectiveParticipation(
      { status: "active", groups: preview.viewer.groups }, row.published, record, now(),
    ), { readOnly: true });
    return view && { ...view, excuse: null, calendar: null };
  }
  const person = await loadPerson(db, session.id);
  if (!person) return null;
  const [record] = await db
    .select({ kind: eventParticipation.kind, excuseReason: eventParticipation.excuseReason, excuseNote: eventParticipation.excuseNote, userId: eventParticipation.userId })
    .from(eventParticipation)
    .where(and(eq(eventParticipation.orgId, config.orgId), eq(eventParticipation.eventId, eventId), eq(eventParticipation.userId, session.id)))
    .limit(1);
  const view = ownParticipationView(effectiveParticipation(person, row.published, record ?? null, now()), { readOnly: false });
  if (!view) return null;
  const excuse =
    view.state === "excused" && record?.excuseReason && canReadExcuseDetails(session, record.userId)
      ? { reason: record.excuseReason, note: record.excuseNote }
      : null;
  return { ...view, excuse, calendar: await ownCalendarState(db, eventId, session.id) };
}
