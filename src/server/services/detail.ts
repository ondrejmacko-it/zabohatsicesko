import { and, eq, isNull } from "drizzle-orm";
import { TYPE_LABELS } from "@/lib/labels";
import { addDays, isoWeekday, toDateKey, toTimeKey } from "@/lib/time";
import type { EventSnapshot, EventType, Group, SimAttendee } from "@/lib/types";
import { audienceAttendees, eventAttendees } from "@/server/calendar/attendees";
import { CalendarError, type ExternalEvent } from "@/server/calendar/provider";
import { personalEventDelivery, type PersonalEventDelivery } from "@/server/calendar/personal";
import { listNotifications } from "@/server/calendar/simulated";
import { calendarProvider, looksLikeSameInvite, pairingCandidates } from "@/server/calendar/sync";
import { attendeeSource, calendarMode, config, now, participationEnabled, personalDelivery, type AttendeeSource, type CalendarMode } from "@/server/config";
import { getDb } from "@/server/db/client";
import { calendarLinks, topics, users, type ManagedFields } from "@/server/db/schema";
import { calendarSummary, snapshotOf, type EventRow } from "@/server/domain/snapshot";
import { canPlan, isOrganizer, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";
import { getEventCard, loadEventRow, loadTemplate, type EventCard } from "@/server/services/events";
import { recordingPanel, type RecordingPanel } from "@/server/services/recordings";

/** Hodnoty formuláře akce ve tvaru, který potřebuje dialog. */
export type EventFormValues = {
  type: EventType;
  label: string;
  date: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  topicTitle: string;
  audience: Group;
  leadId: string;
  reviewerId: string;
};

export function formValuesOf(snapshot: EventSnapshot): EventFormValues {
  const start = new Date(snapshot.startsAt);
  const end = new Date(snapshot.endsAt);
  const lastDay = toDateKey(snapshot.allDay ? new Date(end.getTime() - 1) : end);
  const date = toDateKey(start);
  return {
    type: snapshot.type,
    label: snapshot.label,
    date,
    endDate: lastDay !== date ? lastDay : null,
    startTime: snapshot.allDay ? "08:00" : toTimeKey(start),
    endTime: snapshot.allDay ? "16:00" : toTimeKey(end),
    topicTitle: snapshot.topicTitle ?? "",
    audience: snapshot.audience,
    leadId: snapshot.leadId ?? "",
    reviewerId: snapshot.reviewerId ?? "",
  };
}

/**
 * Datum kopie: stejný den v týdnu o týden později než zdroj, pokud je to nejdřív zítra. Jinak nejbližší
 * stejný den v týdnu od zítřka (zdroj z minulosti se tak nikdy nenavrhne do minulosti ani na dnešek).
 */
export function suggestedCopyDate(sourceDate: string, todayKey: string): string {
  const tomorrow = addDays(todayKey, 1);
  const weekLater = addDays(sourceDate, 7);
  if (weekLater >= tomorrow) return weekLater;
  return addDays(tomorrow, (isoWeekday(sourceDate) - isoWeekday(tomorrow) + 7) % 7);
}

/**
 * Předvyplnění okna Přidat akci podle existující akce (Duplikovat). Jen správce. Kopíruje se pouze to, co je
 * ve formuláři: typ, název, téma, skupina, vedoucí, kontrolor a časy. Datum je jen návrh (`suggestedCopyDate`).
 * Identita, verze, vazby na Kalendář, pozvánky, nahrávky, zápisy, stav ani historie se nepřenáší: nová akce
 * vznikne běžným `createEvent` jako návrh. Neexistující akce a svátek vrací null.
 */
export async function duplicateFormValues(viewer: Viewer, id: string, todayKey: string): Promise<EventFormValues | null> {
  if (!canPlan(viewer)) throw new DomainError("forbidden");
  const row = await loadEventRow(await getDb(), id);
  if (!row || row.type === "holiday") return null;
  const source = formValuesOf(snapshotOf(row));
  const date = suggestedCopyDate(source.date, todayKey);
  const span = source.endDate ? Math.round((Date.parse(source.endDate) - Date.parse(source.date)) / 86_400_000) : 0;
  return {
    type: source.type,
    label: source.label,
    date,
    endDate: span > 0 ? addDays(date, span) : null,
    startTime: source.startTime,
    endTime: source.endTime,
    topicTitle: source.topicTitle,
    audience: source.audience,
    leadId: source.leadId,
    reviewerId: source.reviewerId,
  };
}

/** Typ nové akce k tématu: firemní vzdělávání skupiny, jinak jiná akce (typ a název doplní správce). */
export function topicEventType(audience: string): EventType {
  return audience === "fp" ? "education-fp" : audience === "rm" ? "education-rm" : "other";
}

/**
 * Předvyplnění okna Přidat akci z tématu (Naplánovat téma → Vytvořit novou akci, `?tema=`). Jen správce.
 * Téma, skupina a typ podle tématu, datum a čas nejbližšího dne šablony s tímto typem od zítřka (do dvou
 * týdnů), jinak zítřek s výchozím časem. Ukládá se běžně (návrh i zveřejnění s kontrolou), téma se
 * k akci přiřadí podle názvu jako vždy. Neznámé nebo archivované téma vrací null.
 */
export async function topicFormValues(viewer: Viewer, topicId: string, todayKey: string): Promise<EventFormValues | null> {
  if (!canPlan(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  const [topic] = await db
    .select({ name: topics.name, audience: topics.audience })
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.orgId, config.orgId), isNull(topics.archivedAt)))
    .limit(1);
  if (!topic) return null;
  const type = topicEventType(topic.audience);
  const slots = (await loadTemplate()).filter((slot) => slot.active && slot.types.includes(type));
  let date = addDays(todayKey, 1);
  let times = { startTime: "09:00", endTime: "11:00" };
  for (let offset = 1; offset <= 14 && slots.length > 0; offset += 1) {
    const day = addDays(todayKey, offset);
    const slot = slots.find((s) => s.isoWeekday === isoWeekday(day));
    if (!slot) continue;
    date = day;
    times = { startTime: slot.startTime, endTime: slot.endTime };
    break;
  }
  return {
    type,
    label: type === "other" ? "" : TYPE_LABELS[type],
    date,
    endDate: null,
    ...times,
    topicTitle: topic.name,
    audience: topic.audience as Group,
    leadId: "",
    reviewerId: "",
  };
}

export type SyncPanel = {
  mode: CalendarMode;
  /** Režim osobních kalendářů: akce se zapisuje kolegům do jejich kalendářů, pozvánky ani e-maily se neposílají. */
  personal: boolean;
  /** Vazba míří na jeden výskyt opakované události. */
  seriesInstance: boolean;
  /**
   * Stav pozvánky v kalendáři organizátora. „personal“ = osobní režim: pozvánka organizátora se nevede
   * a jeden souhrnný stav by nic nedokazoval, skutečnou evidenci nese `personalDelivery`.
   */
  status: "pending" | "synced" | "attention" | "unlinked" | "none" | "personal";
  errorCode: string | null;
  conflict: { external: ManagedFields; wiki: ManagedFields } | null;
  externalId: string | null;
  external: { summary: string; attendees: SimAttendee[]; meetingUrl: string | null; cancelled: boolean } | null;
  calendarUnavailable: boolean;
  /** Důvod, proč se nepodařilo načíst údaje z Kalendáře (odpojeno, chybí konfigurace, výpadek). */
  calendarErrorCode: string | null;
  notifications: Array<{ sequence: number; kind: string; recipients: number; at: string }>;
  candidates: Array<{ id: string; summary: string; startsAt: string; endsAt: string }>;
  inviteeCount: number;
  /** Odkud se berou hosté nové pozvánky: publikum akce, nebo pevný seznam testovacích příjemců. */
  attendeeSource: AttendeeSource;
  /**
   * Proč zveřejněná akce nemá pozvánku. Jeden zdroj pro všechny texty panelu (audit A08):
   * „lookalike“ podobná cizí pozvánka zastavila automatiku, „automatic“ pozvánku založí fronta,
   * „past“ proběhlá akce se už nezakládá, „unavailable“ Kalendář teď neodpovídá nebo není propojený.
   */
  unlinkedReason: "lookalike" | "automatic" | "past" | "unavailable" | "cancelled" | null;
  /** Jen osobní režim a zveřejněná akce: co o zápisu do osobních kalendářů skutečně víme. */
  personalDelivery: PersonalEventDelivery | null;
  /** Jen osobní režim: starší pozvánka v kalendáři organizátora z doby před osobními kalendáři (jen informace). */
  legacyInviteId: string | null;
};

/**
 * Osobní režim: diagnostika vychází jen z evidence osobních kalendářů. Kalendář organizátora se nevolá,
 * nepáruje se a nová pozvánka se nenabízí. Případná starší vazba se ukáže jen jako historická informace.
 */
async function personalSyncPanel(db: Awaited<ReturnType<typeof getDb>>, row: EventRow, legacyInviteId: string | null): Promise<SyncPanel> {
  return {
    mode: calendarMode(),
    personal: true,
    seriesInstance: false,
    status: row.published ? "personal" : "none",
    errorCode: null,
    conflict: null,
    externalId: null,
    external: null,
    calendarUnavailable: false,
    calendarErrorCode: null,
    notifications: [],
    candidates: [],
    inviteeCount: 0,
    attendeeSource: "audience",
    unlinkedReason: null,
    personalDelivery: row.published ? await personalEventDelivery(db, row.id, row.published) : null,
    legacyInviteId,
  };
}

async function syncPanel(viewer: Viewer, row: EventRow): Promise<SyncPanel | null> {
  if (!isOrganizer(viewer) || row.type === "holiday") return null;
  const db = await getDb();
  const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, row.id)).limit(1);
  if (personalDelivery()) return personalSyncPanel(db, row, link?.externalEventId ?? null);
  // Neplatná sestava hostů zastaví až synchronizaci, panel kvůli ní nespadne.
  // Zveřejněná akce: stejní hosté, jaké posílá synchronizace (se zapnutou účastí bez omluvených).
  const invitees = await (participationEnabled() && row.published ? eventAttendees(db, row.id, row.published) : audienceAttendees(db, row.audience)).catch(() => []);
  const mode = calendarMode();
  const panel: SyncPanel = {
    mode,
    personal: false,
    seriesInstance: Boolean(link?.recurringEventId),
    status: !row.published ? "none" : (link?.syncStatus ?? "unlinked"),
    errorCode: link?.errorCode ?? null,
    conflict: null,
    externalId: link?.externalEventId ?? null,
    external: null,
    calendarUnavailable: false,
    calendarErrorCode: null,
    notifications: [],
    candidates: [],
    attendeeSource: mode === "google-test" ? attendeeSource() : "audience",
    inviteeCount: invitees.length,
    unlinkedReason: null,
    personalDelivery: null,
    legacyInviteId: null,
  };
  let rawCandidates: ExternalEvent[] = [];
  try {
    if (link?.externalEventId) {
      const external = await calendarProvider(db).get(link.calendarId, link.externalEventId);
      if (external) {
        panel.external = { summary: external.summary, attendees: external.attendees, meetingUrl: external.meetingUrl, cancelled: external.cancelled };
        panel.inviteeCount = external.attendees.length;
      }
      // Záznam oznámení vede jen simulace. Google doručení nehlásí, žádost o oznámení je součástí zápisu.
      if (mode === "simulation") {
        panel.notifications = (await listNotifications(db, link.externalEventId)).map((n) => ({
          sequence: n.sequence,
          kind: n.kind,
          recipients: n.recipients,
          at: n.createdAt.toISOString(),
        }));
      }
    } else if (!link && row.published && row.published.status !== "cancelled") {
      rawCandidates = await pairingCandidates(viewer, row.id);
      panel.candidates = rawCandidates.map((c) => ({
        id: c.id,
        summary: c.summary,
        startsAt: c.startsAt.toISOString(),
        endsAt: c.endsAt.toISOString(),
      }));
    }
  } catch (error) {
    if (!(error instanceof CalendarError)) throw error;
    panel.calendarUnavailable = true;
    panel.calendarErrorCode = error.code;
  }
  if (panel.status === "unlinked" && row.published) {
    const published = row.published;
    const target = { startsAt: new Date(published.startsAt), endsAt: new Date(published.endsAt), summary: calendarSummary(published) };
    // Zrušená akce pozvánku nedostane, nabídka založení ani párování nedává smysl.
    panel.unlinkedReason = published.status === "cancelled"
      ? "cancelled"
      : panel.calendarUnavailable
      ? "unavailable"
      : target.startsAt <= now()
        ? "past"
        : rawCandidates.some((c) => !c.createdByWiki && looksLikeSameInvite(c, target))
          ? "lookalike"
          : "automatic";
  }
  if (link?.conflict && row.published) {
    const published = row.published;
    panel.conflict = {
      external: link.conflict,
      wiki: {
        summary: calendarSummary(published),
        startsAt: published.startsAt,
        endsAt: published.endsAt,
        cancelled: published.status === "cancelled",
      },
    };
  }
  return panel;
}

export type EventDetail = {
  card: EventCard;
  revision: number;
  /** Jen správce: pracovní hodnoty pro dialog a zveřejněné hodnoty pro posouzení dopadu změny. */
  form: EventFormValues | null;
  publishedForm: EventFormValues | null;
  leadName: string | null;
  reviewerName: string | null;
  cancelReason: string | null;
  canCancel: boolean;
  canDelete: boolean;
  /** Akce drží místo v rozpisu ze šablony. Správce ji může nahradit jiným typem akce. */
  fromTemplate: boolean;
  sync: SyncPanel | null;
  recording: RecordingPanel;
};

export async function getEventDetail(viewer: Viewer, id: string): Promise<EventDetail | null> {
  const found = await getEventCard(viewer, id);
  if (!found) return null;
  const { row, card } = found;
  const organizer = isOrganizer(viewer);
  const view = organizer ? snapshotOf(row) : row.published!;
  const db = await getDb();
  const people = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.orgId, config.orgId));
  const names = new Map(people.map((u) => [u.id, u.name]));
  const [sync, recording] = await Promise.all([syncPanel(viewer, row), recordingPanel(viewer, row)]);
  return {
    card,
    revision: row.revision,
    form: organizer ? formValuesOf(snapshotOf(row)) : null,
    publishedForm: organizer && row.published ? formValuesOf(row.published) : null,
    leadName: view.leadId ? (names.get(view.leadId) ?? null) : null,
    reviewerName: view.reviewerId ? (names.get(view.reviewerId) ?? null) : null,
    cancelReason: view.cancelReason,
    canCancel: organizer && row.published !== null && row.status !== "cancelled",
    canDelete: organizer && row.publishedRevision === null,
    fromTemplate: row.generationKey !== null && row.type !== "holiday",
    sync,
    recording,
  };
}
