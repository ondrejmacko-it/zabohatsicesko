import type { EventSnapshot, Group, Role } from "@/lib/types";
import type { EventRow } from "@/server/domain/snapshot";
import { snapshotOf } from "@/server/domain/snapshot";

// Jediné místo s pravidly přístupu. Volá se na serveru u seznamu, detailu, stavu, uploadu,
// stažení, opakování i publikace. UI z nich jen odvozuje, co zobrazit.

export type Viewer = { id: string; role: Role; groups: string[] };

/** Plánuje a zveřejňuje. Správce ZBC má stejná práva jako organizátor a navíc spravuje uživatele. */
export const isOrganizer = (viewer: Viewer) => viewer.role === "organizer" || viewer.role === "admin";

export const isAdmin = (viewer: Viewer) => viewer.role === "admin";

/**
 * Správu uživatelů (pozvání, schválení, role, skupiny, odebrání) má správce i organizátor.
 * Roli správce ale smí přidělit, odebrat nebo správci měnit účet jen jiný správce.
 */
export const canManageUsers = (viewer: Viewer) => isOrganizer(viewer);

export function canManageAccount(viewer: Viewer, target: { id: string; role: Role }, nextRole?: Role): boolean {
  if (!canManageUsers(viewer) || target.id === viewer.id) return false;
  if (isAdmin(viewer)) return true;
  return target.role !== "admin" && nextRole !== "admin";
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

/** Vedoucí nebo pověřený kontrolor zveřejněné akce. Organizátor tuto roli automaticky nemá. */
export function isEventHandler(viewer: Viewer, snapshot: EventSnapshot): boolean {
  return snapshot.leadId === viewer.id || snapshot.reviewerId === viewer.id;
}

/** Nahrávka, pracovní přepis a návrh zápisu: jen vedoucí a pověřený kontrolor. */
export function canHandleRecording(viewer: Viewer, row: EventRow): boolean {
  return row.published !== null && isEventHandler(viewer, row.published);
}

/** Zveřejněný zápis: publikum akce a její vedoucí či kontrolor. Platí i pro organizátora. */
export function canReadPublishedMinutes(viewer: Viewer, row: EventRow): boolean {
  const snapshot = row.published;
  return snapshot !== null && (viewer.groups.includes(snapshot.audience) || isEventHandler(viewer, snapshot));
}

export function canSeeAudience(viewer: Viewer, audience: string): boolean {
  return isOrganizer(viewer) || viewer.groups.includes(audience as Group);
}
