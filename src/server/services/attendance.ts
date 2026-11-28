import { and, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { eventTitle } from "@/lib/labels";
import type { OwnCalendar } from "@/lib/calendar-note";
import type { ExcuseReason, Group, ParticipationState } from "@/lib/types";
import { ownCalendarState } from "@/server/calendar/attendees";
import { config, participationEnabled } from "@/server/config";
import { getDb } from "@/server/db/client";
import { eventParticipation, events, users } from "@/server/db/schema";
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
};

/** Přehled podle akcí v období [from, to): zveřejněné akce bez svátků, počty jen za lidi v rozsahu. */
export async function attendanceByEvent(scope: AttendanceScope, from: Date, to: Date): Promise<EventAttendance[]> {
  const db = await getDb();
  const rows = await db
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
    .orderBy(events.startsAt, events.id);
  if (rows.length === 0) return [];
  const people = (await db
    .select({ id: users.id, status: users.status, groups: users.groups })
    .from(users)
    .where(eq(users.orgId, config.orgId))).filter((p) => scope.kind === "all" || scope.ids.has(p.id));
  const records = new Map<string, ParticipationRecord>();
  const recordRows = await db
    .select({ eventId: eventParticipation.eventId, userId: eventParticipation.userId, kind: eventParticipation.kind, excuseReason: eventParticipation.excuseReason })
    .from(eventParticipation)
    .where(and(eq(eventParticipation.orgId, config.orgId), inArray(eventParticipation.eventId, rows.map((r) => r.id))));
  for (const r of recordRows) records.set(`${r.eventId}|${r.userId}`, { kind: r.kind, excuseReason: r.excuseReason });

  return rows.map(({ id, published }) => {
    const snapshot = published!;
    const counts: AttendanceCounts = { required: 0, excused: 0, enrolled: 0, withdrawn: 0, expected: 0 };
    for (const person of people) {
      const state = participationState(person, snapshot, records.get(`${id}|${person.id}`) ?? null);
      if (state === "required") counts.required++;
      else if (state === "excused") counts.excused++;
      else if (state === "voluntary_enrolled") counts.enrolled++;
      else if (state === "withdrawn") counts.withdrawn++;
    }
    counts.expected = counts.required + counts.enrolled;
    return {
      id,
      title: eventTitle(snapshot.label, snapshot.topicTitle),
      startsAt: snapshot.startsAt,
      audience: snapshot.audience,
      cancelled: snapshot.status === "cancelled",
      counts,
    };
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

export type EventAttendanceDetail = Omit<EventAttendance, "counts"> & { counts: AttendanceCounts; people: AttendancePerson[] };

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

  const counts: AttendanceCounts = { required: 0, excused: 0, enrolled: 0, withdrawn: 0, expected: 0 };
  const result: AttendancePerson[] = [];
  for (const person of people) {
    const record = records.get(person.id) ?? null;
    const state = participationState(person, snapshot, record);
    if (state === null || state === "optional") continue;
    if (state === "required") counts.required++;
    else if (state === "excused") counts.excused++;
    else if (state === "voluntary_enrolled") counts.enrolled++;
    else if (state === "withdrawn") counts.withdrawn++;
    const excuse =
      state === "excused" && record?.excuseReason && canReadExcuseDetails(viewer, person.id, managed)
        ? { reason: record.excuseReason, note: record.excuseNote }
        : null;
    result.push({ id: person.id, name: person.name, state, excuse, calendar: await ownCalendarState(db, eventId, person.id) });
  }
  counts.expected = counts.required + counts.enrolled;
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
