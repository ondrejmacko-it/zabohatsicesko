import type { OwnParticipationView } from "@/server/domain/participation";
import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { EXTRAORDINARY_TYPES } from "@/lib/labels";
import { addDays, fromPragueLocal, isoWeekday, monthOf, monthRange, toDateKey, toTimeKey } from "@/lib/time";
import type { EventSnapshot, EventType, Group, PlanStatus, SyncStatus } from "@/lib/types";
import { audit } from "@/server/audit";
import { targetCalendarId } from "@/server/calendar/target";
import { config, now, personalDelivery } from "@/server/config";
import { getDb, type Executor } from "@/server/db/client";
import {
  calendarLinks,
  eventRevisions,
  events,
  generationExclusions,
  minutes,
  templateSlots,
  topics,
  users,
} from "@/server/db/schema";
import { planMonth, slotConflict, type Occupant } from "@/server/domain/generation";
import { snapshotOf, type EventRow } from "@/server/domain/snapshot";
import { suggestTopics, suggestionPending, topicFitsAudience, TOPIC_ACCEPT, TOPIC_REJECT } from "@/server/domain/topics";
import { canHandleRecording, canReadPublishedMinutes, isEventHandler, isOrganizer, visibleEvent, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";
import { listTopics, topicIdByName } from "@/server/services/topics";

export type EventCard = {
  id: string;
  type: EventType;
  label: string;
  topicTitle: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  audience: Group;
  leadName: string | null;
  planStatus: PlanStatus;
  unpublishedChanges: boolean;
  extraordinary: boolean;
  past: boolean;
  /**
   * Jen pro správce. „unlinked“ = zveřejněná akce zatím bez vazby na pozvánku. „personal“ = osobní režim:
   * pozvánka organizátora se nevede a karta o doručení do osobních kalendářů nic netvrdí (evidence je v detailu).
   */
  syncStatus: SyncStatus | "unlinked" | "personal" | null;
  /** Jen pro správce: zveřejněný termín, pokud ho rozpracovaný návrh přesouvá jinam. */
  movedFrom: { startsAt: string; endsAt: string; allDay: boolean } | null;
  /**
   * Jen pro správce u návrhu změny zveřejněné akce: zveřejněná verze (originál), kterou dál vidí kolegové
   * i Kalendář, a co návrh mění. Karta návrh kreslí „nad“ originálem.
   */
  original: EventOriginal | null;
  /** Jen pro správce: verze akce, kterou přesun tažením posílá serveru jako kontrolu souběhu. */
  revision: number | null;
  /** Divák smí obsluhovat nahrávku a zápis (vedoucí, kontrolor, správce; `canHandleRecording`). */
  handler: boolean;
  /**
   * Divák zveřejněnou akci vede nebo kontroluje (`isEventHandler`). Na rozdíl od `handler` nezahrnuje
   * právo správce obsluhovat všechny akce, proto podle něj počítá filtr Moje a Úvod.
   */
  leadsOrReviews: boolean;
  /** Akce má zveřejněný zápis a divák ho smí číst (`canReadPublishedMinutes`). */
  minutesPublished: boolean;
  /** Vlastní účast (štítek, akce). Jen se zapnutou účastí, doplňuje `withOwnParticipation`. */
  participation?: OwnParticipationView | null;
};

export type EventOriginal = {
  label: string;
  topicTitle: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  audience: Group;
  leadName: string | null;
  /** Co návrh mění, česky pro kartu: termín, téma, vedoucí, publikum, typ, kontrolor. */
  changes: string[];
};

/** Rozdíl pracovní verze proti zveřejněné, v pořadí, jak ho správce čte na kartě. */
export function changedParts(view: Pick<EventSnapshot, "type" | "label" | "topicTitle" | "startsAt" | "endsAt" | "allDay" | "audience" | "leadId" | "reviewerId">, last: EventSnapshot): string[] {
  const parts: string[] = [];
  if (view.startsAt !== last.startsAt || view.endsAt !== last.endsAt || view.allDay !== last.allDay) parts.push("termín");
  if ((view.topicTitle ?? null) !== (last.topicTitle ?? null)) parts.push("téma");
  if ((view.leadId ?? null) !== (last.leadId ?? null)) parts.push("vedoucí");
  if (view.audience !== last.audience) parts.push("publikum");
  if (view.type !== last.type || view.label !== last.label) parts.push("typ");
  if ((view.reviewerId ?? null) !== (last.reviewerId ?? null)) parts.push("kontrolor");
  return parts;
}

async function userNames(db: Executor): Promise<Map<string, string>> {
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.orgId, config.orgId));
  return new Map(rows.map((u) => [u.id, u.name]));
}

async function templateWeekdays(db: Executor): Promise<Set<number>> {
  const rows = await db
    .select({ isoWeekday: templateSlots.isoWeekday })
    .from(templateSlots)
    .where(and(eq(templateSlots.orgId, config.orgId), eq(templateSlots.active, true)));
  return new Set(rows.map((r) => r.isoWeekday));
}

function toCard(
  viewer: Viewer,
  row: EventRow,
  link: { syncStatus: SyncStatus } | undefined,
  names: Map<string, string>,
  slotDays: Set<number>,
  withMinutes: ReadonlySet<string>,
): EventCard | null {
  const view = visibleEvent(viewer, row);
  if (!view) return null;
  const weekday = isoWeekday(toDateKey(new Date(view.startsAt)));
  const organizer = isOrganizer(viewer);
  const isPublic = row.published !== null;
  let syncStatus: EventCard["syncStatus"] = null;
  // Osobní režim: vazba ani její chybění nic nedokazují (`markLinksDelivered` ji jen označí za zpracovanou).
  if (organizer && isPublic && view.type !== "holiday") syncStatus = personalDelivery() ? "personal" : (link?.syncStatus ?? "unlinked");
  const last = row.published;
  const moved = organizer && last !== null && row.status !== "cancelled" && (last.startsAt !== view.startsAt || last.endsAt !== view.endsAt);

  return {
    id: row.id,
    type: view.type,
    label: view.label,
    topicTitle: view.topicTitle,
    startsAt: view.startsAt,
    endsAt: view.endsAt,
    allDay: view.allDay,
    audience: view.audience,
    leadName: view.leadId ? (names.get(view.leadId) ?? null) : null,
    planStatus: organizer ? row.status : (row.published?.status ?? "draft"),
    unpublishedChanges: organizer && isPublic && row.revision !== row.publishedRevision,
    extraordinary: view.type !== "holiday" && (EXTRAORDINARY_TYPES.has(view.type) || !slotDays.has(weekday)),
    past: new Date(view.endsAt) <= now(),
    syncStatus,
    movedFrom: moved ? { startsAt: last.startsAt, endsAt: last.endsAt, allDay: last.allDay } : null,
    original:
      organizer && last !== null && row.status !== "cancelled" && row.revision !== row.publishedRevision
        ? {
            label: last.label,
            topicTitle: last.topicTitle,
            startsAt: last.startsAt,
            endsAt: last.endsAt,
            allDay: last.allDay,
            audience: last.audience,
            leadName: last.leadId ? (names.get(last.leadId) ?? null) : null,
            changes: changedParts(view, last),
          }
        : null,
    revision: organizer ? row.revision : null,
    handler: canHandleRecording(viewer, row),
    leadsOrReviews: row.published !== null && isEventHandler(viewer, row.published),
    minutesPublished: withMinutes.has(row.id) && canReadPublishedMinutes(viewer, row),
  };
}

/**
 * Akce se zveřejněným zápisem: jedním dotazem pro celý seznam, jen u proběhlých zveřejněných akcí
 * (jinde zápis být nemůže). Bez takových akcí se nedotazuje vůbec.
 */
async function publishedMinutesOf(db: Executor, rows: EventRow[]): Promise<Set<string>> {
  const ids = rows.filter((row) => row.published !== null && row.startsAt <= now()).map((row) => row.id);
  if (!ids.length) return new Set();
  const found = await db
    .selectDistinct({ eventId: minutes.eventId })
    .from(minutes)
    .where(and(inArray(minutes.eventId, ids), eq(minutes.status, "published")));
  return new Set(found.map((m) => m.eventId));
}

/** Akce, které uživatel smí vidět, v daném rozsahu. Filtrování práv probíhá tady, ne v UI. */
export async function listEvents(viewer: Viewer, from: Date, to: Date): Promise<EventCard[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.orgId, config.orgId),
        // Návrh přesunu nesmí účastníkům schovat původní termín: hledá se i podle zveřejněné verze.
        or(
          and(lt(events.startsAt, to), gte(events.endsAt, from)),
          and(
            sql`(${events.published}->>'startsAt')::timestamptz < ${to.toISOString()}::timestamptz`,
            sql`(${events.published}->>'endsAt')::timestamptz >= ${from.toISOString()}::timestamptz`,
          ),
        ),
      ),
    )
    .orderBy(asc(events.startsAt), asc(events.id));
  const links = rows.length
    ? await db.select().from(calendarLinks).where(inArray(calendarLinks.eventId, rows.map((r) => r.id)))
    : [];
  const linkByEvent = new Map(links.map((l) => [l.eventId, l]));
  const [names, slotDays, withMinutes] = await Promise.all([userNames(db), templateWeekdays(db), publishedMinutesOf(db, rows)]);
  // Rozsah a pořadí se řídí verzí, kterou uživatel opravdu vidí (správce pracovní, ostatní zveřejněnou).
  return rows
    .map((row) => toCard(viewer, row, linkByEvent.get(row.id), names, slotDays, withMinutes))
    .filter((card): card is EventCard => card !== null && new Date(card.startsAt) < to && new Date(card.endsAt) >= from)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}

/** Akce pro detail: řádek z databáze a karta podle oprávnění uživatele, nebo null. */
export async function getEventCard(viewer: Viewer, id: string): Promise<{ row: EventRow; card: EventCard } | null> {
  const db = await getDb();
  const row = await loadEventRow(db, id);
  if (!row) return null;
  const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, id)).limit(1);
  const [names, slotDays, withMinutes] = await Promise.all([userNames(db), templateWeekdays(db), publishedMinutesOf(db, [row])]);
  const card = toCard(viewer, row, link, names, slotDays, withMinutes);
  return card ? { row, card } : null;
}

export async function listMonth(viewer: Viewer, monthKey: string): Promise<EventCard[]> {
  const { start, end } = monthRange(monthKey);
  // Týdny v mřížce přesahují do sousedních měsíců, proto načteme o týden víc na obě strany.
  return listEvents(viewer, new Date(start.getTime() - 7 * 86_400_000), new Date(end.getTime() + 7 * 86_400_000));
}

/** Nejbližší zveřejněné akce, které uživatel uvidí, od nejbližší (bez svátků a zrušených). Viditelnost určuje `listEvents`. */
export async function nextEventsFor(viewer: Viewer, limit: number): Promise<EventCard[]> {
  const from = now();
  const cards = await listEvents(viewer, from, new Date(from.getTime() + 120 * 86_400_000));
  return cards.filter((c) => c.planStatus === "published" && c.type !== "holiday" && new Date(c.startsAt) >= from).slice(0, limit);
}

export async function nextEventFor(viewer: Viewer): Promise<EventCard | null> {
  return (await nextEventsFor(viewer, 1))[0] ?? null;
}

export async function loadEventRow(db: Executor, id: string): Promise<EventRow | null> {
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.orgId, config.orgId)))
    .limit(1);
  return row ?? null;
}

// ——— Zápisy správce ———

export type EventInput = {
  type: EventType;
  label: string;
  date: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  topicTitle: string | null;
  topicId: string | null;
  audience: Group;
  leadId: string | null;
  reviewerId: string | null;
};

function requireOrganizer(viewer: Viewer) {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
}

/** Převede vstup formuláře na časy. Svátek je celodenní, vícedenní akce má vlastní den konce. */
export function resolveTimes(input: EventInput): { startsAt: Date; endsAt: Date; allDay: boolean } {
  if (input.type === "holiday") {
    const last = input.endDate ?? input.date;
    return {
      startsAt: fromPragueLocal(input.date, "00:00"),
      endsAt: fromPragueLocal(addDays(last, 1), "00:00"),
      allDay: true,
    };
  }
  const startsAt = fromPragueLocal(input.date, input.startTime);
  const endsAt = fromPragueLocal(input.endDate ?? input.date, input.endTime);
  if (endsAt <= startsAt) throw new DomainError("invalid_time");
  return { startsAt, endsAt, allDay: false };
}

async function assertUsers(db: Executor, ids: Array<string | null>) {
  const wanted = ids.filter((id): id is string => id !== null);
  if (!wanted.length) return;
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, config.orgId), inArray(users.id, wanted)));
  if (found.length !== new Set(wanted).size) throw new DomainError("invalid_input");
}

export type SaveMode = "draft" | "publish";

/**
 * Státní svátek vzniká jen při doplnění měsíce ze šablony a je pevný: ruční založení, úprava, přesun,
 * zrušení ani změna typu na svátek nebo ze svátku neprojde, ani přímým voláním serverové akce.
 */
function assertNotHoliday(...types: Array<string | null | undefined>) {
  if (types.includes("holiday")) throw new DomainError("holiday_locked");
}

/**
 * Zveřejnění uloží snímek, revizi a požadavek na synchronizaci v jedné transakci.
 * Svátek se nesynchronizuje. Vazbu tu dostane akce založená ve Wiki. Importované akci bez vazby
 * ji dozaloží `linkPublishedWithoutInvite` (nejdřív ověří, že ve stejném čase neleží cizí pozvánka).
 */
async function publishInTx(tx: Executor, row: EventRow, actorId: string, action: string) {
  const snapshot = snapshotOf(row);
  await tx
    .update(events)
    .set({ published: snapshot, publishedRevision: row.revision })
    .where(eq(events.id, row.id));
  await tx
    .insert(eventRevisions)
    .values({ eventId: row.id, revision: row.revision, action, snapshot, actorId })
    .onConflictDoUpdate({
      target: [eventRevisions.eventId, eventRevisions.revision],
      set: { action, snapshot },
    });
  if (row.type === "holiday") return;
  const [link] = await tx.select().from(calendarLinks).where(eq(calendarLinks.eventId, row.id)).limit(1);
  if (link) {
    await tx
      .update(calendarLinks)
      .set({ syncStatus: "pending", errorCode: null, attempts: 0, updatedAt: new Date() })
      .where(eq(calendarLinks.eventId, row.id));
  } else if (row.calendarIntent === "create") {
    await tx.insert(calendarLinks).values({
      eventId: row.id,
      calendarId: targetCalendarId(),
      syncStatus: "pending",
      syncedRevision: 0,
      attempts: 0,
    });
  }
}

export async function createEvent(viewer: Viewer, input: EventInput, mode: SaveMode): Promise<string> {
  requireOrganizer(viewer);
  assertNotHoliday(input.type);
  const db = await getDb();
  const { startsAt, endsAt, allDay } = resolveTimes(input);
  const id = `ev-${randomUUID()}`;
  await db.transaction(async (tx) => {
    await assertUsers(tx, [input.leadId, input.reviewerId]);
    const [row] = await tx
      .insert(events)
      .values({
        id,
        orgId: config.orgId,
        origin: "manual",
        calendarIntent: input.type === "holiday" ? "none" : "create",
        type: input.type,
        label: input.label,
        topicTitle: input.topicTitle,
        topicId: input.topicId,
        startsAt,
        endsAt,
        allDay,
        audience: input.audience,
        leadId: input.leadId,
        reviewerId: input.reviewerId,
        status: mode === "publish" ? "published" : "draft",
        revision: 1,
        updatedBy: viewer.id,
      })
      .returning();
    if (!row) throw new DomainError("conflict");
    await tx.insert(eventRevisions).values({ eventId: id, revision: 1, action: "create", snapshot: snapshotOf(row), actorId: viewer.id });
    if (mode === "publish") await publishInTx(tx, row, viewer.id, "publish");
    await audit(tx, viewer.id, mode === "publish" ? "event.create_publish" : "event.create", "event", id);
  });
  return id;
}

/** Optimistická kontrola souběhu: změna projde jen nad revizí, kterou správce viděl. */
export async function updateEvent(
  viewer: Viewer,
  id: string,
  expectedRevision: number,
  input: EventInput,
  mode: SaveMode,
): Promise<void> {
  requireOrganizer(viewer);
  const db = await getDb();
  const { startsAt, endsAt, allDay } = resolveTimes(input);
  await db.transaction(async (tx) => {
    await assertUsers(tx, [input.leadId, input.reviewerId]);
    const current = await loadEventRow(tx, id);
    if (!current) throw new DomainError("not_found");
    assertNotHoliday(current.type, input.type);
    if (current.status === "cancelled") throw new DomainError("cancelled");
    // Proběhlé akci termín měnit nejde (okno akce ho zamyká). Ostatní údaje opravit lze.
    const termChanged = current.startsAt.getTime() !== startsAt.getTime() || current.endsAt.getTime() !== endsAt.getTime() || current.allDay !== allDay;
    if (current.endsAt <= now() && termChanged) throw new DomainError("invalid_state");
    const [row] = await tx
      .update(events)
      .set({
        type: input.type,
        label: input.label,
        topicTitle: input.topicTitle,
        topicId: input.topicId ?? (input.topicTitle === current.topicTitle ? current.topicId : null),
        startsAt,
        endsAt,
        allDay,
        audience: input.audience,
        leadId: input.leadId,
        reviewerId: input.reviewerId,
        status: mode === "publish" ? "published" : current.status,
        revision: sql`${events.revision} + 1`,
        updatedBy: viewer.id,
        updatedAt: new Date(),
      })
      .where(and(eq(events.id, id), eq(events.revision, expectedRevision)))
      .returning();
    if (!row) throw new DomainError("conflict");
    await tx.insert(eventRevisions).values({ eventId: id, revision: row.revision, action: "save", snapshot: snapshotOf(row), actorId: viewer.id });
    if (mode === "publish") await publishInTx(tx, row, viewer.id, "publish");
    await audit(tx, viewer.id, mode === "publish" ? "event.publish" : "event.save", "event", id);
  });
}

export type MovePlan = { input: EventInput; mode: SaveMode; from: string; label: string };

/** Vstup `updateEvent` z pracovní verze akce: stejné místní časy a počet dní, začátek v den `date`. */
function inputOfRow(row: EventRow, date: string): EventInput {
  const from = toDateKey(row.startsAt);
  const lastDay = toDateKey(row.allDay ? new Date(row.endsAt.getTime() - 1) : row.endsAt);
  const span = Math.round((Date.parse(lastDay) - Date.parse(from)) / 86_400_000);
  return {
    type: row.type as EventType,
    label: row.label,
    date,
    endDate: span > 0 ? addDays(date, span) : null,
    startTime: row.allDay ? "00:00" : toTimeKey(row.startsAt),
    endTime: row.allDay ? "23:59" : toTimeKey(row.endsAt),
    topicTitle: row.topicTitle,
    topicId: row.topicId,
    audience: row.audience as Group,
    leadId: row.leadId,
    reviewerId: row.reviewerId,
  };
}

/**
 * Naplánovat téma do návrhu: uloží téma do budoucího nezveřejněného návrhu bez tématu, nic se nezveřejní
 * ani neodešle. Zveřejněnou akci takto měnit nejde, ta se upravuje v okně akce s kontrolou dopadu.
 * Téma musí být nearchivované a hodit se skupinou. Zápis a souběh (revize) hlídá `updateEvent`.
 */
export async function assignTopicToDraft(viewer: Viewer, topicId: string, eventId: string, expectedRevision: number): Promise<{ dateKey: string; topicName: string }> {
  requireOrganizer(viewer);
  const db = await getDb();
  const row = await loadEventRow(db, eventId);
  if (!row) throw new DomainError("not_found");
  assertNotHoliday(row.type);
  if (row.status !== "draft" || row.startsAt <= now()) throw new DomainError("invalid_state");
  if (row.revision !== expectedRevision || row.topicTitle) throw new DomainError("conflict");
  const [topic] = await db
    .select({ id: topics.id, name: topics.name, audience: topics.audience })
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.orgId, config.orgId), isNull(topics.archivedAt)))
    .limit(1);
  if (!topic) throw new DomainError("not_found");
  if (!topicFitsAudience(topic.audience, row.audience)) throw new DomainError("invalid_state");
  const dateKey = toDateKey(row.startsAt);
  await updateEvent(viewer, eventId, expectedRevision, { ...inputOfRow(row, dateKey), topicTitle: topic.name, topicId: topic.id }, "draft");
  return { dateKey, topicName: topic.name };
}

/**
 * Přesun akce na jiný den (tažení v Plánu nebo „Přesunout na jiný den“ v detailu). Stejné místní časy
 * a stejný počet dní, ostatní údaje beze změny. Platí pravidla ruční změny data v Připravit měsíc: cílový
 * den je v budoucnu a ve stejném měsíci. Proběhlou ani zrušenou akci přesunout nejde.
 * Zveřejněná akce bez rozpracovaného návrhu se rovnou zveřejní (pozvaní dostanou změnu stávající cestou),
 * jinak se přesun uloží jako návrh. Zápis i souběh hlídá `updateEvent`.
 */
export async function planMove(viewer: Viewer, id: string, date: string): Promise<MovePlan> {
  requireOrganizer(viewer);
  const row = await loadEventRow(await getDb(), id);
  if (!row) throw new DomainError("not_found");
  assertNotHoliday(row.type);
  if (row.status === "cancelled") throw new DomainError("cancelled");
  if (row.startsAt <= now()) throw new DomainError("invalid_state");
  const from = toDateKey(row.startsAt);
  if (date === from) throw new DomainError("invalid_input");
  if (monthOf(date) !== monthOf(from)) throw new DomainError("outside_month");
  const input = inputOfRow(row, date);
  if (resolveTimes(input).startsAt <= now()) throw new DomainError("outside_month");
  const mode: SaveMode = row.status === "published" && row.revision === row.publishedRevision ? "publish" : "draft";
  return { input, mode, from, label: row.label };
}

/** Zrušení je okamžitě zveřejněná změna: ve Wiki zůstane se stavem Zrušeno, pozvaní dostanou zprávu. */
export async function cancelEvent(viewer: Viewer, id: string, expectedRevision: number, reason: string): Promise<void> {
  requireOrganizer(viewer);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const current = await loadEventRow(tx, id);
    if (!current) throw new DomainError("not_found");
    assertNotHoliday(current.type);
    if (!current.published || current.status === "cancelled") throw new DomainError("invalid_state");
    // Zrušení vychází z poslední zveřejněné verze. Rozpracovaný návrh změny se zahodí,
    // aby se nezveřejněné téma, termín ani publikum nedostaly do Wiki a Kalendáře.
    const last = current.published;
    const [row] = await tx
      .update(events)
      .set({
        type: last.type,
        label: last.label,
        topicTitle: last.topicTitle,
        topicId: last.topicId,
        startsAt: new Date(last.startsAt),
        endsAt: new Date(last.endsAt),
        allDay: last.allDay,
        audience: last.audience,
        leadId: last.leadId,
        reviewerId: last.reviewerId,
        status: "cancelled",
        cancelReason: reason,
        revision: sql`${events.revision} + 1`,
        updatedBy: viewer.id,
        updatedAt: new Date(),
      })
      .where(and(eq(events.id, id), eq(events.revision, expectedRevision)))
      .returning();
    if (!row) throw new DomainError("conflict");
    await publishInTx(tx, row, viewer.id, "cancel");
    await audit(tx, viewer.id, "event.cancel", "event", id);
  });
}

/**
 * Zahodí rozpracovaný návrh změny a vrátí pracovní verzi na poslední zveřejněnou. Zveřejněná verze
 * se nemění, proto se Kalendář nesynchronizuje a pozvaní nic nedostanou.
 */
export async function discardDraftChanges(viewer: Viewer, id: string, expectedRevision: number): Promise<void> {
  requireOrganizer(viewer);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const current = await loadEventRow(tx, id);
    if (!current) throw new DomainError("not_found");
    const last = current.published;
    if (!last || current.status === "cancelled" || current.revision === current.publishedRevision) throw new DomainError("invalid_state");
    const [row] = await tx
      .update(events)
      .set({
        type: last.type,
        label: last.label,
        topicTitle: last.topicTitle,
        topicId: last.topicId,
        startsAt: new Date(last.startsAt),
        endsAt: new Date(last.endsAt),
        allDay: last.allDay,
        audience: last.audience,
        leadId: last.leadId,
        reviewerId: last.reviewerId,
        revision: sql`${events.revision} + 1`,
        publishedRevision: sql`${events.revision} + 1`,
        updatedBy: viewer.id,
        updatedAt: new Date(),
      })
      .where(and(eq(events.id, id), eq(events.revision, expectedRevision)))
      .returning();
    if (!row) throw new DomainError("conflict");
    await tx.insert(eventRevisions).values({ eventId: id, revision: row.revision, action: "discard", snapshot: snapshotOf(row), actorId: viewer.id });
    await audit(tx, viewer.id, "event.discard_changes", "event", id);
  });
}

/** Smazat lze jen nezveřejněný návrh. Vygenerovaný slot se zapíše jako výjimka, aby se nevrátil. */
export async function deleteDraft(viewer: Viewer, id: string, expectedRevision: number): Promise<void> {
  requireOrganizer(viewer);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(events)
      .where(
        and(
          eq(events.id, id),
          eq(events.orgId, config.orgId),
          eq(events.revision, expectedRevision),
          sql`${events.publishedRevision} IS NULL`,
        ),
      )
      .returning();
    if (!row) throw new DomainError("conflict");
    if (row.generationKey) {
      await tx
        .insert(generationExclusions)
        .values({ orgId: config.orgId, generationKey: row.generationKey })
        .onConflictDoNothing();
    }
    await audit(tx, viewer.id, "event.delete_draft", "event", id);
  });
}

// ——— Hromadné zveřejnění návrhů měsíce ———

/**
 * Hromadné smazání vybraných návrhů v jedné transakci. Smaže jen nikdy nezveřejněný návrh (ne svátek)
 * ve verzi, kterou správce viděl. Ostatní (mezitím změněné, zveřejněné, cizí ID) přeskočí a nezmění.
 */
export async function deleteDrafts(viewer: Viewer, items: Array<{ id: string; revision: number }>): Promise<{ deleted: string[]; skipped: number }> {
  requireOrganizer(viewer);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const deleted: string[] = [];
    for (const item of items) {
      const [row] = await tx
        .delete(events)
        .where(
          and(
            eq(events.id, item.id),
            eq(events.orgId, config.orgId),
            eq(events.revision, item.revision),
            ne(events.type, "holiday"),
            sql`${events.publishedRevision} IS NULL`,
          ),
        )
        .returning();
      if (!row) continue;
      if (row.generationKey) {
        await tx.insert(generationExclusions).values({ orgId: config.orgId, generationKey: row.generationKey }).onConflictDoNothing();
      }
      await audit(tx, viewer.id, "event.delete_draft", "event", row.id);
      deleted.push(row.id);
    }
    return { deleted, skipped: items.length - deleted.length };
  });
}

export type MonthDraft = {
  id: string;
  revision: number;
  type: EventType;
  label: string;
  startsAt: string;
  endsAt: string;
  audience: Group;
  topicTitle: string | null;
  leadId: string | null;
  /** Návrh na místě z týdenní šablony (základ měsíce). Ostatní návrhy přidal někdo ručně navíc. */
  fromTemplate: boolean;
  /** Souběh s jinou akcí v měsíci: „group“ = stejná skupina ve stejný čas, „shared“ = stejní lidé ve stejný den nebo čas. */
  clash: "group" | "shared" | null;
  /**
   * Téma předvyplnilo generování a správce o něm zatím nerozhodl: krátké vysvětlení doporučení
   * (např. „4 zájemci · zatím neproběhlo“). Po přijetí, změně nebo odmítnutí null.
   */
  suggestion: string | null;
};

/** Návrhy, u kterých téma z generování ještě čeká na rozhodnutí správce (podle historie revizí). */
async function pendingSuggestions(db: Executor, rows: ReadonlyArray<Pick<EventRow, "id" | "topicId">>): Promise<Set<string>> {
  const candidates = rows.filter((row) => row.topicId);
  if (!candidates.length) return new Set();
  const history = await db
    .select({ eventId: eventRevisions.eventId, action: eventRevisions.action, topicId: sql<string | null>`${eventRevisions.snapshot}->>'topicId'` })
    .from(eventRevisions)
    .where(inArray(eventRevisions.eventId, candidates.map((row) => row.id)));
  return new Set(
    candidates
      .filter((row) => suggestionPending(row.topicId, history.filter((h) => h.eventId === row.id)))
      .map((row) => row.id),
  );
}

/** Podmínka hromadného zveřejnění: budoucí, nikdy nezveřejněný návrh akce v daném měsíci. */
function monthDraftFilter(monthKey: string) {
  const { start, end } = monthRange(monthKey);
  return and(
    eq(events.orgId, config.orgId),
    eq(events.status, "draft"),
    isNull(events.publishedRevision),
    ne(events.type, "holiday"),
    gte(events.startsAt, start),
    lt(events.startsAt, end),
    gt(events.startsAt, now()),
  );
}

/**
 * Návrhy měsíce, které jdou zveřejnit najednou. Návrhy změn už zveřejněných akcí sem nepatří:
 * mění platnou pozvánku, proto je správce zveřejňuje jednotlivě s přehledem dopadu. Vrací jen jejich počet.
 */
export async function listMonthDrafts(
  viewer: Viewer,
  monthKey: string,
): Promise<{
  drafts: MonthDraft[];
  changeDrafts: number;
  /** Smazané budoucí termíny rozvrhu, které jde vrátit. */
  deletedSlots: number;
  /** Tytéž termíny jednotlivě (obnova po jednom). */
  deleted: DeletedSlot[];
}> {
  requireOrganizer(viewer);
  const db = await getDb();
  const { start, end } = monthRange(monthKey);
  const rows = await db.select().from(events).where(monthDraftFilter(monthKey)).orderBy(asc(events.startsAt), asc(events.id));
  // Stejné pravidlo jako při doplňování termínů: správce vidí souběh i u návrhů, které už v plánu jsou.
  const others = await db
    .select({ id: events.id, startsAt: events.startsAt, endsAt: events.endsAt, audience: events.audience, type: events.type })
    .from(events)
    .where(and(eq(events.orgId, config.orgId), ne(events.status, "cancelled"), eq(events.allDay, false), lt(events.startsAt, end), gt(events.endsAt, start)));
  const clashOf = (row: EventRow): MonthDraft["clash"] => {
    if (row.type === "holiday" || row.allDay) return null;
    const occupants: Occupant[] = others.filter((o) => o.id !== row.id).map((o) => ({ ...o, dateKey: toDateKey(o.startsAt) }));
    const verdict = slotConflict(
      { start: row.startsAt, end: row.endsAt, audience: row.audience, type: row.type, dateKey: toDateKey(row.startsAt) },
      occupants,
    );
    return verdict === "skip" ? "group" : verdict === "warn" ? "shared" : null;
  };
  // Počet smazaných termínů, které jde vrátit, jede ve stejném dotazu (rozpočet dotazů Plánu).
  const [changes] = await db
    .select({
      count: sql<number>`count(*)::int`,
      deletedSlots: sql<number>`(SELECT count(*)::int FROM ${generationExclusions} WHERE ${restorableExclusion(monthKey)})`,
    })
    .from(events)
    .where(
      and(
        eq(events.orgId, config.orgId),
        ne(events.status, "cancelled"),
        gte(events.startsAt, start),
        lt(events.startsAt, end),
        sql`${events.publishedRevision} IS NOT NULL AND ${events.revision} <> ${events.publishedRevision}`,
      ),
    );
  const pending = await pendingSuggestions(db, rows);
  const reasons = pending.size ? new Map((await listTopics(viewer)).map((t) => [t.id, t.reason])) : new Map<string, string>();
  return {
    drafts: rows.map((row) => ({
      id: row.id,
      revision: row.revision,
      type: row.type as EventType,
      label: row.label,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      audience: row.audience as Group,
      topicTitle: row.topicTitle,
      leadId: row.leadId,
      fromTemplate: row.generationKey !== null,
      clash: clashOf(row),
      suggestion: pending.has(row.id) ? (reasons.get(row.topicId as string) ?? "doporučeno podle zájmu kolegů") : null,
    })),
    changeDrafts: changes?.count ?? 0,
    deletedSlots: changes?.deletedSlots ?? 0,
    // Seznam jen když je co vracet: běžný Plán tak nemá dotaz navíc (rozpočet dotazů).
    deleted: changes?.deletedSlots ? await deletedSlotList(db, monthKey) : [],
  };
}

/** Úprava návrhu v okně Připravit měsíc. Datum (místní, bez času) a publikum jsou volitelné. */
export type DraftPublish = {
  id: string;
  revision: number;
  topicTitle: string | null;
  leadId: string | null;
  date?: string;
  audience?: Group;
  /** Rozhodnutí o doporučeném tématu. Platí jen, dokud doporučení čeká a správce téma v poli nezměnil. */
  topicDecision?: "accept" | "reject";
};

/** Hromadné zveřejnění obsahuje neúplné termíny, jejichž počet správce nepotvrdil. */
export class IncompleteNotConfirmed extends Error {
  constructor(readonly count: number) {
    super("incomplete_not_confirmed");
  }
}

/**
 * Nový začátek a konec návrhu po ručně změněném datu: stejné místní časy a stejný počet dní. Termín musí
 * zůstat v budoucnu a v měsíci, který správce připravuje.
 */
function movedTimes(current: EventRow, date: string | undefined, monthKey: string): { startsAt: Date; endsAt: Date } | null {
  const from = toDateKey(current.startsAt);
  if (!date || date === from) return null;
  if (monthOf(date) !== monthKey) throw new DomainError("outside_month");
  const span = Math.round((Date.parse(toDateKey(current.endsAt)) - Date.parse(from)) / 86_400_000);
  const startsAt = fromPragueLocal(date, toTimeKey(current.startsAt));
  const endsAt = fromPragueLocal(addDays(date, span), toTimeKey(current.endsAt));
  if (startsAt <= now()) throw new DomainError("outside_month");
  return { startsAt, endsAt };
}

/**
 * Uloží úpravy vybraných návrhů měsíce v jedné transakci (téma, vedoucí, datum, publikum) a s `publish`
 * je rovnou zveřejní. Projde jen budoucí, nikdy nezveřejněný návrh z daného měsíce ve verzi, kterou správce
 * viděl. Cokoli jiného (návrh změny, zrušená akce, mezitím upravený návrh) se přeskočí a nezmění. Uložení
 * bez zveřejnění nic neodesílá.
 */
export async function publishDrafts(
  viewer: Viewer,
  monthKey: string,
  items: DraftPublish[],
  confirmedIncomplete = 0,
  { publish = true }: { publish?: boolean } = {},
): Promise<{ published: string[]; skipped: number }> {
  requireOrganizer(viewer);
  const db = await getDb();
  return db.transaction(async (tx) => {
    await assertUsers(tx, items.map((item) => item.leadId));
    // Neúplné termíny (bez tématu nebo vedoucího) smí odejít jen se společným potvrzením právě tohoto
    // počtu (audit A04). Kontrola je tady, aby ji nešlo obejít přímým voláním serverové akce.
    const ids = items.map((item) => item.id);
    const types = new Map(
      (await tx.select({ id: events.id, type: events.type }).from(events).where(and(monthDraftFilter(monthKey), inArray(events.id, ids)))).map(
        (r) => [r.id, r.type],
      ),
    );
    const incomplete = items.filter((item) => types.has(item.id) && types.get(item.id) !== "holiday" && (!item.topicTitle || !item.leadId)).length;
    if (publish && incomplete > 0 && incomplete !== confirmedIncomplete) throw new IncompleteNotConfirmed(incomplete);
    const published: string[] = [];
    let skipped = 0;
    for (let item of items) {
      const [current] = await tx.select().from(events).where(and(monthDraftFilter(monthKey), eq(events.id, item.id))).limit(1);
      if (!current || current.revision !== item.revision) {
        skipped++;
        continue;
      }
      // Rozhodnutí o doporučení platí jen pro téma, které správce viděl jako doporučené.
      const decision =
        item.topicDecision && item.topicTitle === current.topicTitle && (await pendingSuggestions(tx, [current])).has(current.id)
          ? item.topicDecision
          : null;
      if (decision === "reject") item = { ...item, topicTitle: null };
      const moved = movedTimes(current, item.date, monthKey);
      const audience = item.audience ?? (current.audience as Group);
      const edited =
        decision !== null || moved !== null || audience !== current.audience || item.topicTitle !== current.topicTitle || item.leadId !== current.leadId;
      // Uložení bez zveřejnění nezakládá novou verzi, když se nic nezměnilo.
      if (!publish && !edited) continue;
      const topicId = item.topicTitle === current.topicTitle ? current.topicId : await topicIdByName(tx, item.topicTitle);
      const [row] = await tx
        .update(events)
        .set({
          topicTitle: item.topicTitle,
          topicId,
          leadId: item.leadId,
          audience,
          ...(moved ?? {}),
          ...(publish ? { status: "published" as const } : {}),
          revision: sql`${events.revision} + 1`,
          updatedBy: viewer.id,
          updatedAt: new Date(),
        })
        .where(and(eq(events.id, item.id), eq(events.revision, item.revision)))
        .returning();
      if (!row) {
        skipped++;
        continue;
      }
      const action = decision === "accept" ? TOPIC_ACCEPT : decision === "reject" ? TOPIC_REJECT : "save";
      await tx.insert(eventRevisions).values({ eventId: row.id, revision: row.revision, action, snapshot: snapshotOf(row), actorId: viewer.id });
      if (decision) await audit(tx, viewer.id, decision === "accept" ? "event.topic_accept" : "event.topic_reject", "event", row.id);
      if (publish) {
        await publishInTx(tx, row, viewer.id, "publish");
        await audit(tx, viewer.id, "event.publish", "event", row.id);
      } else {
        await audit(tx, viewer.id, "event.save", "event", row.id);
      }
      published.push(row.id);
    }
    if (published.length && publish) await audit(tx, viewer.id, "plan.publish_month", "month", monthKey);
    return { published, skipped };
  });
}

/** Témata, která už mají budoucí nezrušený termín, včetně rozpracovaných návrhů. */
async function plannedTopicIds(db: Executor): Promise<Set<string>> {
  const rows = await db
    .select({ topicId: events.topicId })
    .from(events)
    .where(
      and(
        eq(events.orgId, config.orgId),
        sql`${events.topicId} IS NOT NULL`,
        ne(events.status, "cancelled"),
        gt(events.endsAt, now()),
      ),
    );
  return new Set(rows.map((r) => r.topicId as string));
}

/**
 * Výsledek doplnění měsíce. Budoucím termínům firemního vzdělávání doplnění předvyplní doporučené téma
 * podle zájmu a historie. Vše vzniká jako návrh, který správce upraví a zveřejní.
 */
export type GenerateResult = {
  created: number;
  withTopic: number;
  /** Termíny, které už pokrývá akce pro stejnou skupinu ve stejný čas. */
  skipped: number;
  /** Data nových návrhů, které se kryjí s jinou akcí pro stejné lidi. Správce rozhodne. */
  review: string[];
  /** Z nově vzniklých návrhů ty, které vrátily dřív smazaný termín Pravidelného týdne. */
  restored: number;
  /** Smazané termíny měsíce, které po doplnění dál chybí (vrátí je jen Obnovit smazané návrhy). */
  deletedLeft: number;
};

/**
 * Smazaný termín Pravidelného týdne v měsíci, který jde vrátit (podmínka nad `generation_exclusions`): má výjimku
 * po smazání návrhu, žádná akce s jeho klíčem neexistuje (přesunutý, upravený i zrušený termín si klíč drží, takže
 * sem nepatří), ještě nenastal a jeho den je v rozvrhu pořád aktivní. Proběhlé smazané termíny zůstávají smazané,
 * návrh v minulosti by nešel zveřejnit. Klíč je `<org>:slot-<den>:<YYYY-MM-DD>` (viz `generationKey`).
 */
function restorableExclusion(monthKey: string) {
  const key = generationExclusions.generationKey;
  return sql`${generationExclusions.orgId} = ${config.orgId}
    AND left(right(${key}, 10), 7) = ${monthKey}
    AND right(${key}, 10) >= ${toDateKey(now())}
    AND NOT EXISTS (SELECT 1 FROM ${events} WHERE ${events.generationKey} = ${key})
    AND EXISTS (
      SELECT 1 FROM ${templateSlots}
      WHERE ${templateSlots.orgId} = ${generationExclusions.orgId} AND ${templateSlots.active}
        AND cardinality(${templateSlots.types}) > 0
        AND ${key} LIKE '%:slot-' || ${templateSlots.isoWeekday} || ':%'
    )`;
}

/** Smazaný termín, který jde vrátit, pro seznam v okně Připravit měsíc. */
export type DeletedSlot = { key: string; dateKey: string; label: string; startTime: string; endTime: string };

/** Seznam smazaných termínů měsíce podle aktuálního rozvrhu (jen když nějaké jsou, dva dotazy navíc). */
async function deletedSlotList(db: Executor, monthKey: string): Promise<DeletedSlot[]> {
  const keys = new Set(await deletedSlotKeys(db, monthKey));
  if (!keys.size) return [];
  const slots = await db.select().from(templateSlots).where(eq(templateSlots.orgId, config.orgId));
  return planMonth(config.orgId, monthKey, slots, new Set())
    .filter((slot) => keys.has(slot.generationKey) && !slot.holiday)
    .map((slot) => ({ key: slot.generationKey, dateKey: slot.dateKey, label: slot.label, startTime: slot.startTime, endTime: slot.endTime }));
}

async function deletedSlotKeys(db: Executor, monthKey: string): Promise<string[]> {
  const rows = await db.select({ key: generationExclusions.generationKey }).from(generationExclusions).where(restorableExclusion(monthKey));
  return rows.map((r) => r.key);
}

/**
 * Doplní chybějící sloty měsíce podle šablony. Smazané termíny (výjimky) běžné doplnění nevrací. Vrátí je
 * `restoreDeleted` (tlačítko Obnovit smazané návrhy), nebo samo doplnění, když v měsíci nezůstala žádná
 * pracovní akce (všechny návrhy smazané). Výjimka zmizí jen u termínu, který opravdu znovu vznikl.
 */
export async function generateMonth(
  viewer: Viewer,
  monthKey: string,
  options: { restoreDeleted?: boolean; /** Obnoví jen tento jeden smazaný termín, nic dalšího nedoplní. */ restoreKey?: string } = {},
): Promise<GenerateResult> {
  requireOrganizer(viewer);
  const db = await getDb();
  const ranked = await listTopics(viewer);
  const planned = await plannedTopicIds(db);
  return db.transaction(async (tx) => {
    const slots = await tx.select().from(templateSlots).where(eq(templateSlots.orgId, config.orgId));
    const existing = await tx
      .select({ key: events.generationKey })
      .from(events)
      .where(and(eq(events.orgId, config.orgId), sql`${events.generationKey} IS NOT NULL`));
    const excluded = await tx
      .select({ key: generationExclusions.generationKey })
      .from(generationExclusions)
      .where(eq(generationExclusions.orgId, config.orgId));
    // Úplně vymazaný měsíc lze znovu připravit i bez tlačítka obnovy. Výjimky jinak chrání úmyslně smazané
    // jednotlivé sloty před návratem. Svátek ani zrušená akce se nepočítá jako pracovní akce měsíce.
    const { start, end } = monthRange(monthKey);
    const active = await tx.select({ id: events.id }).from(events).where(and(
      eq(events.orgId, config.orgId),
      ne(events.type, "holiday"),
      ne(events.status, "cancelled"),
      lt(events.startsAt, end),
      gt(events.endsAt, start),
    )).limit(1);
    const deleted = await deletedSlotKeys(tx, monthKey);
    const restoring = new Set(
      options.restoreKey !== undefined
        ? deleted.filter((key) => key === options.restoreKey)
        : options.restoreDeleted || active.length === 0 ? deleted : [],
    );
    const taken = new Set([...existing, ...excluded.filter((r) => !restoring.has(r.key))].map((r) => r.key as string));
    // Akce, které v měsíci už jsou, rozhodnou o každém termínu: přeskočit, doplnit, nebo doplnit s varováním.
    const occupants: Occupant[] = (
      await tx
        .select({ startsAt: events.startsAt, endsAt: events.endsAt, audience: events.audience, type: events.type })
        .from(events)
        .where(
          and(
            eq(events.orgId, config.orgId),
            ne(events.status, "cancelled"),
            eq(events.allDay, false),
            lt(events.startsAt, end),
            gt(events.endsAt, start),
          ),
        )
    ).map((o) => ({ ...o, dateKey: toDateKey(o.startsAt) }));
    let skipped = 0;
    const review: string[] = [];
    // Proběhlé dny nedostanou návrh (rozhodnutí vlastníka O2): zveřejnit by nešel. Svátek je záznam, ne návrh.
    const today = toDateKey(now());
    const plannedSlots = planMonth(config.orgId, monthKey, slots, taken).filter((slot) => {
      if (options.restoreKey !== undefined && !restoring.has(slot.generationKey)) return false;
      if (slot.holiday) return true;
      if (slot.dateKey < today) return false;
      const verdict = slotConflict(
        { start: fromPragueLocal(slot.dateKey, slot.startTime), end: fromPragueLocal(slot.dateKey, slot.endTime), audience: slot.audience, type: slot.type, dateKey: slot.dateKey },
        occupants,
      );
      if (verdict === "skip") skipped += 1;
      if (verdict === "warn") review.push(slot.generationKey);
      return verdict !== "skip";
    });
    const reference = now();
    const upcoming = plannedSlots.filter((s) => !s.holiday && fromPragueLocal(s.dateKey, s.startTime) > reference);
    const suggestions = suggestTopics(upcoming, ranked, planned);
    let created = 0;
    let withTopic = 0;
    const reviewDays: string[] = [];
    const restored: string[] = [];
    for (const slot of plannedSlots) {
      const holiday = slot.holiday;
      const topic = suggestions.get(slot.generationKey);
      const startsAt = fromPragueLocal(slot.dateKey, holiday ? "00:00" : slot.startTime);
      const endsAt = holiday ? fromPragueLocal(addDays(slot.dateKey, 1), "00:00") : fromPragueLocal(slot.dateKey, slot.endTime);
      const [row] = await tx
        .insert(events)
        .values({
          id: `ev-${randomUUID()}`,
          orgId: config.orgId,
          generationKey: slot.generationKey,
          origin: "template",
          calendarIntent: holiday ? "none" : "create",
          type: slot.type,
          label: slot.label,
          topicTitle: topic?.name ?? null,
          topicId: topic?.id ?? null,
          startsAt,
          endsAt,
          allDay: holiday,
          audience: slot.audience,
          status: holiday ? "published" : "draft",
          revision: 1,
          updatedBy: viewer.id,
        })
        .onConflictDoNothing({ target: events.generationKey })
        .returning();
      if (!row) continue;
      created += 1;
      if (topic) withTopic += 1;
      if (review.includes(slot.generationKey)) reviewDays.push(slot.dateKey);
      if (restoring.has(slot.generationKey)) restored.push(slot.generationKey);
      await tx.insert(eventRevisions).values({ eventId: row.id, revision: 1, action: "generate", snapshot: snapshotOf(row), actorId: viewer.id });
      if (holiday) await publishInTx(tx, row, viewer.id, "generate");
    }
    // Termín, který se nevrátil (kolize se stejnou skupinou, slot už není v rozvrhu), zůstává smazaný.
    if (restored.length) {
      await tx.delete(generationExclusions).where(and(
        eq(generationExclusions.orgId, config.orgId),
        inArray(generationExclusions.generationKey, restored),
      ));
      await audit(tx, viewer.id, "plan.restore_deleted", "month", monthKey);
    }
    if (created) await audit(tx, viewer.id, "plan.generate", "month", monthKey);
    return { created, withTopic, skipped, review: reviewDays, restored: restored.length, deletedLeft: deleted.length - restored.length };
  });
}

export type TemplateSlotInput = { isoWeekday: number; startTime: string; endTime: string; types: EventType[]; active: boolean };

export async function updateTemplate(viewer: Viewer, slots: TemplateSlotInput[]): Promise<void> {
  requireOrganizer(viewer);
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const slot of slots) {
      if (slot.endTime <= slot.startTime) throw new DomainError("invalid_time");
      const [updated] = await tx
        .update(templateSlots)
        .set({ startTime: slot.startTime, endTime: slot.endTime, types: slot.types, active: slot.active })
        .where(and(eq(templateSlots.orgId, config.orgId), eq(templateSlots.isoWeekday, slot.isoWeekday)))
        .returning();
      if (!updated) throw new DomainError("invalid_input");
    }
    await audit(tx, viewer.id, "template.update", "template", config.orgId);
  });
}

export async function loadTemplate() {
  const db = await getDb();
  return db
    .select()
    .from(templateSlots)
    .where(eq(templateSlots.orgId, config.orgId))
    .orderBy(asc(templateSlots.isoWeekday));
}

export async function listPeople(viewer: Viewer) {
  requireOrganizer(viewer);
  const db = await getDb();
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.orgId, config.orgId))
    .orderBy(asc(users.name));
}
