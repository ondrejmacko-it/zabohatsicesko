import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, gte, inArray, lt, ne, or, sql } from "drizzle-orm";
import { EXTRAORDINARY_TYPES } from "@/lib/labels";
import { addDays, fromPragueLocal, isoWeekday, monthRange, toDateKey } from "@/lib/time";
import type { EventType, Group, PlanStatus, SyncStatus } from "@/lib/types";
import { audit } from "@/server/audit";
import { targetCalendarId } from "@/server/calendar/target";
import { config, now } from "@/server/config";
import { getDb, type Executor } from "@/server/db/client";
import {
  calendarLinks,
  eventRevisions,
  events,
  generationExclusions,
  templateSlots,
  users,
} from "@/server/db/schema";
import { planMonth } from "@/server/domain/generation";
import { snapshotOf, type EventRow } from "@/server/domain/snapshot";
import { suggestTopics } from "@/server/domain/topics";
import { isOrganizer, visibleEvent, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";
import { listTopics } from "@/server/services/topics";

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
  /** Jen pro organizátora. „unlinked“ = zveřejněná akce zatím bez vazby na pozvánku. */
  syncStatus: SyncStatus | "unlinked" | null;
  /** Jen pro organizátora: zveřejněný termín, pokud ho rozpracovaný návrh přesouvá jinam. */
  movedFrom: { startsAt: string; endsAt: string; allDay: boolean } | null;
};

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
): EventCard | null {
  const view = visibleEvent(viewer, row);
  if (!view) return null;
  const weekday = isoWeekday(toDateKey(new Date(view.startsAt)));
  const organizer = isOrganizer(viewer);
  const isPublic = row.published !== null;
  let syncStatus: EventCard["syncStatus"] = null;
  if (organizer && isPublic && view.type !== "holiday") syncStatus = link?.syncStatus ?? "unlinked";
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
  };
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
  const [names, slotDays] = await Promise.all([userNames(db), templateWeekdays(db)]);
  // Rozsah a pořadí se řídí verzí, kterou uživatel opravdu vidí (organizátor pracovní, ostatní zveřejněnou).
  return rows
    .map((row) => toCard(viewer, row, linkByEvent.get(row.id), names, slotDays))
    .filter((card): card is EventCard => card !== null && new Date(card.startsAt) < to && new Date(card.endsAt) >= from)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}

/** Akce pro detail: řádek z databáze a karta podle oprávnění uživatele, nebo null. */
export async function getEventCard(viewer: Viewer, id: string): Promise<{ row: EventRow; card: EventCard } | null> {
  const db = await getDb();
  const row = await loadEventRow(db, id);
  if (!row) return null;
  const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, id)).limit(1);
  const [names, slotDays] = await Promise.all([userNames(db), templateWeekdays(db)]);
  const card = toCard(viewer, row, link, names, slotDays);
  return card ? { row, card } : null;
}

export async function listMonth(viewer: Viewer, monthKey: string): Promise<EventCard[]> {
  const { start, end } = monthRange(monthKey);
  // Týdny v mřížce přesahují do sousedních měsíců, proto načteme o týden víc na obě strany.
  return listEvents(viewer, new Date(start.getTime() - 7 * 86_400_000), new Date(end.getTime() + 7 * 86_400_000));
}

/** Nejbližší zveřejněná akce pro uživatele (bez svátků a zrušených). */
export async function nextEventFor(viewer: Viewer): Promise<EventCard | null> {
  const from = now();
  const cards = await listEvents(viewer, from, new Date(from.getTime() + 120 * 86_400_000));
  return (
    cards.find(
      (c) => c.planStatus === "published" && c.type !== "holiday" && new Date(c.startsAt) >= from,
    ) ?? null
  );
}

export async function loadEventRow(db: Executor, id: string): Promise<EventRow | null> {
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.orgId, config.orgId)))
    .limit(1);
  return row ?? null;
}

// ——— Zápisy organizátora ———

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
 * Zveřejnění uloží snímek, revizi a požadavek na synchronizaci v jedné transakci.
 * Svátek se nesynchronizuje. Novou pozvánku vytvoří jen akce založená ve Wiki,
 * importovaná akce bez vazby čeká na spárování s existující pozvánkou.
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

/** Optimistická kontrola souběhu: změna projde jen nad revizí, kterou organizátor viděl. */
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
    if (current.status === "cancelled") throw new DomainError("cancelled");
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

/** Zrušení je okamžitě zveřejněná změna: ve Wiki zůstane se stavem Zrušeno, pozvaní dostanou zprávu. */
export async function cancelEvent(viewer: Viewer, id: string, expectedRevision: number, reason: string): Promise<void> {
  requireOrganizer(viewer);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const current = await loadEventRow(tx, id);
    if (!current) throw new DomainError("not_found");
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
 * Doplní chybějící sloty měsíce podle šablony. Budoucím termínům firemního vzdělávání předvyplní
 * doporučené téma podle zájmu a historie. Vše vzniká jako návrh, který organizátor upraví a zveřejní.
 */
export async function generateMonth(viewer: Viewer, monthKey: string): Promise<{ created: number; withTopic: number }> {
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
    const taken = new Set([...existing, ...excluded].map((r) => r.key as string));
    const plannedSlots = planMonth(config.orgId, monthKey, slots, taken);
    const reference = now();
    const upcoming = plannedSlots.filter((s) => !s.holiday && fromPragueLocal(s.dateKey, s.startTime) > reference);
    const suggestions = suggestTopics(upcoming, ranked, planned);
    let created = 0;
    let withTopic = 0;
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
      await tx.insert(eventRevisions).values({ eventId: row.id, revision: 1, action: "generate", snapshot: snapshotOf(row), actorId: viewer.id });
      if (holiday) await publishInTx(tx, row, viewer.id, "generate");
    }
    if (created) await audit(tx, viewer.id, "plan.generate", "month", monthKey);
    return { created, withTopic };
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
