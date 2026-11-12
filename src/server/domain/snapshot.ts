import type { EventSnapshot, EventType, Group } from "@/lib/types";
import type { events } from "@/server/db/schema";

export type EventRow = typeof events.$inferSelect;

/** Snímek pracovní verze akce, který se ukládá při zveřejnění a do historie revizí. */
export function snapshotOf(row: Pick<EventRow,
  "type" | "label" | "topicTitle" | "topicId" | "startsAt" | "endsAt" | "allDay" | "audience" | "leadId" | "reviewerId" | "status" | "cancelReason"
>): EventSnapshot {
  return {
    type: row.type as EventType,
    label: row.label,
    topicTitle: row.topicTitle,
    topicId: row.topicId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    allDay: row.allDay,
    audience: row.audience as Group,
    leadId: row.leadId,
    reviewerId: row.reviewerId,
    status: row.status === "cancelled" ? "cancelled" : "published",
    cancelReason: row.cancelReason,
  };
}

/** Bezpečný název pro pozvánku: jen typ a schválené téma, nic z interních poznámek. */
export function calendarSummary(snapshot: Pick<EventSnapshot, "label" | "topicTitle">): string {
  return snapshot.topicTitle ? `${snapshot.label}: ${snapshot.topicTitle}` : snapshot.label;
}
