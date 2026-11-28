import { and, desc, eq, gte, inArray, isNotNull, like, lt, or, sql } from "drizzle-orm";
import { eventTitle } from "@/lib/labels";
import { calendarStatus, type OwnCalendar } from "@/lib/calendar-note";
import type { ExcuseReason, Group, ParticipationState } from "@/lib/types";
import { calendarStates } from "@/server/calendar/attendees";
import { config, participationEnabled } from "@/server/config";
import { getDb } from "@/server/db/client";
import { auditLog, eventParticipation, events, users } from "@/server/db/schema";
import { participationState, type ParticipationRecord } from "@/server/domain/participation";
import { canManageUsers, canReadExcuseDetails, type Viewer } from "@/server/policy";
import { managedEmployeeIds } from "@/server/services/excuse-managers";

// Záložka Účast (bod 6 zadání vlastníka). Stav účasti počítá výhradně doména (`participationState`), tady se
// jen sčítá. Oprávnění: správce celá firma, výslovně určený nadřízený jen svoji lidé, jinak nic. Náhled
// „Zobrazit jako“ záložku nikdy neukáže, aby se přes něj nedalo dostat k cizí účasti.

export type AttendanceScope = { kind: "all" } | { kind: "managed"; ids: ReadonlySet<string> };

/** Koho smí přihlášený v přehledu účasti vidět. Null = záložka se nezobrazí a služby vrací `forbidden`. */
export async function attendanceScope(viewer: Viewer, preview: boolean): Promise<AttendanceScope | null> {
  if (preview || !participationEnabled()) return null;
  if (canManageUsers(viewer)) return { kind: "all" };
  const ids = await managedEmployeeIds(await getDb(), viewer.id);
  return ids.size > 0 ? { kind: "managed", ids } : null;
}

/** Očekávaná účast podle Wiki, ne potvrzená docházka. `expected` = povinní bez omluvy + dobrovolně přihlášení. */
export type AttendanceCounts = { required: number; excused: number; enrolled: number; withdrawn: number; expected: number };

export type EventAttendance = {
  id: string;
  title: string;
  startsAt: string;
  audience: Group;
  cancelled: boolean;
  counts: AttendanceCounts;
  /** Kolika lidem v rozsahu akce v Kalendáři chybí, přebývá, zápis selhal nebo nemají propojený kalendář. */
  calendarProblems: number;
};

type PeriodData = {
  rows: { id: string; published: NonNullable<(typeof events.$inferSelect)["published"]> }[];
  people: { id: string; name: string; status: (typeof users.$inferSelect)["status"]; groups: string[] }[];
  records: Map<string, ParticipationRecord>;
};

/** Zveřejněné akce bez svátků v období [from, to), lidé v rozsahu a jejich záznamy účasti. */
async function loadPeriod(scope: AttendanceScope, from: Date, to: Date): Promise<PeriodData> {
  const db = await getDb();
  const rows = (await db
    .select({ id: events.id, published: events.published })
    .from(events)
    .where(
      and(
        eq(events.orgId, config.orgId),
        isNotNull(events.published),
        sql`${events.published}->>'type' <> 'holiday'`,
        gte(events.startsAt, from),
        lt(events.startsAt, to),
      ),
    )
    .orderBy(events.startsAt, events.id)) as PeriodData["rows"];
  const people = (await db
    .select({ id: users.id, name: users.name, status: users.status, groups: users.groups })
    .from(users)
    .where(eq(users.orgId, config.orgId))
    .orderBy(users.name, users.id)).filter((p) => scope.kind === "all" || scope.ids.has(p.id));
  const records = new Map<string, ParticipationRecord>();
  if (rows.length === 0) return { rows, people, records };
  const recordRows = await db
    .select({ eventId: eventParticipation.eventId, userId: eventParticipation.userId, kind: eventParticipation.kind, excuseReason: eventParticipation.excuseReason })
    .from(eventParticipation)
    .where(and(eq(eventParticipation.orgId, config.orgId), inArray(eventParticipation.eventId, rows.map((r) => r.id))));
  for (const r of recordRows) records.set(`${r.eventId}|${r.userId}`, { kind: r.kind, excuseReason: r.excuseReason });
  return { rows, people, records };
}

const emptyCounts = (): AttendanceCounts => ({ required: 0, excused: 0, enrolled: 0, withdrawn: 0, expected: 0 });

/** Přičte stav do počtů. Vrací false, když se akce člověka netýká (dobrovolná bez přihlášky, bez účasti). */
function addState(counts: AttendanceCounts, state: ParticipationState | null): boolean {
  if (state === null || state === "optional") return false;
  if (state === "required") counts.required++;
  else if (state === "excused") counts.excused++;
  else if (state === "voluntary_enrolled") counts.enrolled++;
  else if (state === "withdrawn") counts.withdrawn++;
  counts.expected = counts.required + counts.enrolled;
  return true;
}

/** Přehled podle akcí v období [from, to): zveřejněné akce bez svátků, počty jen za lidi v rozsahu. */
export async function attendanceByEvent(scope: AttendanceScope, from: Date, to: Date): Promise<EventAttendance[]> {
  const { rows, people, records } = await loadPeriod(scope, from, to);
  const calendars = await calendarStates(await getDb(), rows.map((r) => r.id), people.map((p) => p.id));
  return rows.map(({ id, published: snapshot }) => {
    const counts = emptyCounts();
    let calendarProblems = 0;
    for (const person of people) {
      const state = participationState(person, snapshot, records.get(`${id}|${person.id}`) ?? null);
      if (!addState(counts, state) || state === null) continue;
      if (snapshot.status !== "cancelled" && calendarStatus(state, calendars.get(`${id}|${person.id}`) ?? null)?.problem) calendarProblems++;
    }
    return {
      id,
      title: eventTitle(snapshot.label, snapshot.topicTitle),
      startsAt: snapshot.startsAt,
      audience: snapshot.audience,
      cancelled: snapshot.status === "cancelled",
      counts,
      calendarProblems,
    };
  });
}

export type PersonAttendance = { id: string; name: string; active: boolean; groups: string[]; counts: AttendanceCounts };

/** Přehled podle lidí v období [from, to): u každého člověka v rozsahu počty akcí podle stavu. Zrušené akce se nepočítají. */
export async function attendanceByPerson(scope: AttendanceScope, from: Date, to: Date): Promise<PersonAttendance[]> {
  const { rows, people, records } = await loadPeriod(scope, from, to);
  return people.map((person) => {
    const counts = emptyCounts();
    for (const { id, published } of rows) addState(counts, participationState(person, published, records.get(`${id}|${person.id}`) ?? null));
    return { id: person.id, name: person.name, active: person.status === "active", groups: person.groups, counts };
  });
}

export type AttendanceHistoryItem = { at: string; action: string; eventId: string | null; eventTitle: string | null };

/**
 * Historie člověka jen z auditu (nic se nedomýšlí): vlastní změny účasti (`participation.*`, aktér = člověk)
 * a změny jeho přístupu a nadřízených (`user.*`, `excuse_managers.*`). Null = člověk není v rozsahu.
 */
export async function attendanceHistory(scope: AttendanceScope, userId: string, limit = 100): Promise<AttendanceHistoryItem[] | null> {
  if (scope.kind === "managed" && !scope.ids.has(userId)) return null;
  const db = await getDb();
  const [person] = await db.select({ id: users.id }).from(users).where(and(eq(users.orgId, config.orgId), eq(users.id, userId))).limit(1);
  if (!person) return null;
  const rows = await db
    .select({ at: auditLog.createdAt, action: auditLog.action, entityType: auditLog.entityType, entityId: auditLog.entityId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, config.orgId),
        or(
          and(eq(auditLog.actorId, userId), eq(auditLog.entityType, "event"), like(auditLog.action, "participation.%")),
          and(eq(auditLog.entityType, "user"), eq(auditLog.entityId, userId), or(like(auditLog.action, "user.%"), eq(auditLog.action, "excuse_managers.changed"))),
        ),
      ),
    )
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit);
  const eventIds = [...new Set(rows.filter((r) => r.entityType === "event").map((r) => r.entityId))];
  const titles = new Map<string, string>();
  if (eventIds.length) {
    const found = await db
      .select({ id: events.id, published: events.published })
      .from(events)
      .where(and(eq(events.orgId, config.orgId), inArray(events.id, eventIds)));
    for (const e of found) {
      const snap = e.published;
      if (snap) titles.set(e.id, eventTitle(snap.label, snap.topicTitle));
    }
  }
  return rows.map((r) => {
    const eventId = r.entityType === "event" ? r.entityId : null;
    return { at: r.at.toISOString(), action: r.action, eventId, eventTitle: eventId ? (titles.get(eventId) ?? null) : null };
  });
}

export type AttendancePerson = {
  id: string;
  name: string;
  state: ParticipationState;
  /** Důvod a poznámka omluvy jen pro omluveného a výslovně určeného nadřízeného (`canReadExcuseDetails`). */
  excuse: { reason: ExcuseReason; note: string | null } | null;
  /** Stav akce v Kalendáři člověka, null = Wiki ho nezná (viz `ownCalendarState`). */
  calendar: OwnCalendar | null;
};

export type EventAttendanceDetail = Omit<EventAttendance, "counts" | "calendarProblems"> & { counts: AttendanceCounts; people: AttendancePerson[] };

/** Detail jedné akce: lidé v rozsahu, kterých se akce týká, s jejich stavem. Null = akce neexistuje nebo nejde o zveřejněnou akci. */
export async function attendanceDetail(viewer: Viewer, scope: AttendanceScope, eventId: string): Promise<EventAttendanceDetail | null> {
  const db = await getDb();
  const [row] = await db
    .select({ published: events.published })
    .from(events)
    .where(and(eq(events.orgId, config.orgId), eq(events.id, eventId)))
    .limit(1);
  const snapshot = row?.published;
  if (!snapshot || snapshot.type === "holiday") return null;
  const people = (await db
    .select({ id: users.id, name: users.name, status: users.status, groups: users.groups })
    .from(users)
    .where(eq(users.orgId, config.orgId))
    .orderBy(users.name, users.id)).filter((p) => scope.kind === "all" || scope.ids.has(p.id));
  const recordRows = await db
    .select({ userId: eventParticipation.userId, kind: eventParticipation.kind, excuseReason: eventParticipation.excuseReason, excuseNote: eventParticipation.excuseNote })
    .from(eventParticipation)
    .where(and(eq(eventParticipation.orgId, config.orgId), eq(eventParticipation.eventId, eventId)));
  const records = new Map(recordRows.map((r) => [r.userId, r]));
  // Důvody omluv smí i správce číst jen u lidí, u kterých je výslovně určeným nadřízeným.
  const managed = scope.kind === "managed" ? scope.ids : await managedEmployeeIds(db, viewer.id);
  const calendars = await calendarStates(db, [eventId], people.map((p) => p.id));

  const counts = emptyCounts();
  const result: AttendancePerson[] = [];
  for (const person of people) {
    const record = records.get(person.id) ?? null;
    const state = participationState(person, snapshot, record);
    if (!addState(counts, state) || state === null) continue;
    const excuse =
      state === "excused" && record?.excuseReason && canReadExcuseDetails(viewer, person.id, managed)
        ? { reason: record.excuseReason, note: record.excuseNote }
        : null;
    result.push({ id: person.id, name: person.name, state, excuse, calendar: calendars.get(`${eventId}|${person.id}`) ?? null });
  }
  return {
    id: eventId,
    title: eventTitle(snapshot.label, snapshot.topicTitle),
    startsAt: snapshot.startsAt,
    audience: snapshot.audience,
    cancelled: snapshot.status === "cancelled",
    counts,
    people: result,
  };
}
