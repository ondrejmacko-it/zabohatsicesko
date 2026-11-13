import type { EventSnapshot, Group, Role } from "@/lib/types";
import type { EventRow } from "@/server/domain/snapshot";
import { snapshotOf } from "@/server/domain/snapshot";

// Jediné místo s pravidly přístupu. Volá se na serveru u seznamu, detailu, stavu, uploadu,
// stažení, opakování i publikace. UI z nich jen odvozuje, co zobrazit.

export type Viewer = { id: string; role: Role; groups: string[] };

/**
 * Správce: plánuje, zveřejňuje, spravuje účty a vidí vše. V databázi zůstávají dvě hodnoty role
 * (`admin` a starší `organizer`), pravidla je berou stejně. Nové účty dostávají `admin`.
 */
export const canPlan = (viewer: Pick<Viewer, "role">) => viewer.role === "organizer" || viewer.role === "admin";

/** Starší název téhož pravidla, ponechaný pro stávající volání. */
export const isOrganizer = canPlan;
export const isAdmin = canPlan;

export const canManageUsers = (viewer: Viewer) => canPlan(viewer);

/** Správce smí měnit každý účet kromě vlastního, aby si omylem neodebral přístup. */
export function canManageAccount(viewer: Viewer, target: { id: string; role: Role }, nextRole?: Role): boolean {
  void nextRole;
  return canManageUsers(viewer) && target.id !== viewer.id;
}

/**
 * Co smí uživatel z akce vidět. Organizátor vidí pracovní verzi, ostatní jen zveřejněný snímek
 * akce pro svou skupinu (nebo akce, kterou vedou či kontrolují). Jinak null.
 */
export function visibleEvent(viewer: Viewer, row: EventRow): EventSnapshot | null {
  if (isOrganizer(viewer)) return snapshotOf(row);
  const snapshot = row.published;
  if (!snapshot) return null;
  if (viewer.groups.includes(snapshot.audience)) return snapshot;
  if (isEventHandler(viewer, snapshot)) return snapshot;
  return null;
}

/** Vedoucí nebo pověřený kontrolor zveřejněné akce. */
export function isEventHandler(viewer: Viewer, snapshot: EventSnapshot): boolean {
  return snapshot.leadId === viewer.id || snapshot.reviewerId === viewer.id;
}

/** Nahrávka, pracovní přepis, návrh zápisu a jeho zveřejnění či stažení: vedoucí, kontrolor a správce. */
export function canHandleRecording(viewer: Viewer, row: EventRow): boolean {
  return row.published !== null && (canPlan(viewer) || isEventHandler(viewer, row.published));
}

/** Zveřejněný zápis: publikum akce, její vedoucí či kontrolor a správce. */
export function canReadPublishedMinutes(viewer: Viewer, row: EventRow): boolean {
  const snapshot = row.published;
  return snapshot !== null && (canPlan(viewer) || viewer.groups.includes(snapshot.audience) || isEventHandler(viewer, snapshot));
}

export function canSeeAudience(viewer: Viewer, audience: string): boolean {
  return isOrganizer(viewer) || viewer.groups.includes(audience as Group);
}
