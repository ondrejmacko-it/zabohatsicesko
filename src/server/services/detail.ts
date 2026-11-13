import { eq } from "drizzle-orm";
import { toDateKey, toTimeKey } from "@/lib/time";
import type { EventSnapshot, EventType, Group, SimAttendee } from "@/lib/types";
import { audienceAttendees } from "@/server/calendar/attendees";
import { CalendarError } from "@/server/calendar/provider";
import { listNotifications } from "@/server/calendar/simulated";
import { calendarProvider, pairingCandidates } from "@/server/calendar/sync";
import { attendeeSource, calendarMode, config, type AttendeeSource, type CalendarMode } from "@/server/config";
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
  /** Vazba míří na jeden výskyt opakované události. */
  seriesInstance: boolean;
  status: "pending" | "synced" | "attention" | "unlinked" | "none";
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
};

async function syncPanel(viewer: Viewer, row: EventRow): Promise<SyncPanel | null> {
  if (!isOrganizer(viewer) || row.type === "holiday") return null;
  const db = await getDb();
  const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, row.id)).limit(1);
  // Neplatná sestava hostů zastaví až synchronizaci, panel kvůli ní nespadne.
  const invitees = await audienceAttendees(db, row.audience).catch(() => []);
  const mode = calendarMode();
  const panel: SyncPanel = {
    mode,
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
  };
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
    } else if (!link && row.published) {
      panel.candidates = (await pairingCandidates(viewer, row.id)).map((c) => ({
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
  /** Jen organizátor: pracovní hodnoty pro dialog a zveřejněné hodnoty pro posouzení dopadu změny. */
  form: EventFormValues | null;
  publishedForm: EventFormValues | null;
  leadName: string | null;
  reviewerName: string | null;
  cancelReason: string | null;
  canCancel: boolean;
  canDelete: boolean;
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
    sync,
    recording,
  };
}
