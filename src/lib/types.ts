// Sdílené typy mezi serverem a UI. Bez závislostí, bezpečné pro klientský bundle.

export const ROLES = ["admin", "organizer", "member"] as const;
export type Role = (typeof ROLES)[number];
/** Stav účtu ve Wiki. Čekající žádost ani zablokovaný účet dovnitř nepustí. */
export type UserStatus = "active" | "pending" | "disabled";
/** Původ účtu: fiktivní role ukázky, pozvánka správce, nebo žádost po prvním přihlášení. */
export type UserOrigin = "demo" | "invite" | "request";
export type PlanStatus = "draft" | "published" | "cancelled";
export type SyncStatus = "pending" | "synced" | "attention";

export const EVENT_TYPES = [
  "action",
  "training-fp",
  "portfolio",
  "training-rm",
  "education-fp",
  "education-rm",
  "team",
  "workshop",
  "two-day",
  "holiday",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const GROUPS = ["vsichni", "fp", "rm", "tym-a"] as const;
export type Group = (typeof GROUPS)[number];

/** Zveřejněný stav akce. Účastníci a Kalendář vidí jen tento snímek, ne rozpracované změny. */
export type EventSnapshot = {
  type: EventType;
  label: string;
  topicTitle: string | null;
  topicId: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  audience: Group;
  leadId: string | null;
  reviewerId: string | null;
  status: "published" | "cancelled";
  cancelReason: string | null;
};

export type MinutesContent = {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  nextSteps: string[];
};

export type SimAttendee = {
  email: string;
  name: string;
  responseStatus: "needsAction" | "accepted" | "declined" | "tentative";
};

/** Stav zpracování nahrávky, jak ho vidí uživatel. */
export type RecordingState = "awaiting" | "processing" | "review" | "available" | "failed";
