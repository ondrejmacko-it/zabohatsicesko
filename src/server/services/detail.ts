import { eq } from "drizzle-orm";
import { toDateKey, toTimeKey } from "@/lib/time";
import type { EventSnapshot, EventType, Group, SimAttendee } from "@/lib/types";
import { audienceAttendees } from "@/server/calendar/attendees";
import { CalendarError, type ExternalEvent } from "@/server/calendar/provider";
import { personalEventDelivery, type PersonalEventDelivery } from "@/server/calendar/personal";
import { listNotifications } from "@/server/calendar/simulated";
import { calendarProvider, looksLikeSameInvite, pairingCandidates } from "@/server/calendar/sync";
import { attendeeSource, calendarMode, config, now, personalDelivery, type AttendeeSource, type CalendarMode } from "@/server/config";
import { getDb } from "@/server/db/client";
import { calendarLinks, users, type ManagedFields } from "@/server/db/schema";
import { calendarSummary, snapshotOf, type EventRow } from "@/server/domain/snapshot";
import { isOrganizer, type Viewer } from "@/server/policy";
import { getEventCard, type EventCard } from "@/server/services/events";
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
  const invitees = await audienceAttendees(db, row.audience).catch(() => []);
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
