import type { EventSnapshot, Group, Role } from "@/lib/types";
import { eventVisibility, type EventVisibility } from "@/server/config";
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
 * Co smí uživatel z akce vidět. Správce vidí pracovní verzi, ostatní jen zveřejněný snímek. Výchozí režim
 * (`audience`) ho ukáže publiku akce a jejímu vedoucímu či kontrolorovi, režim `all-published` každému
 * přihlášenému (`eventVisibility`). Jinak null. Viditelnost akce nedává přístup k nahrávce, pracovnímu
 * ani zveřejněnému zápisu: ty mají vlastní pravidla níže.
 */
export function visibleEvent(viewer: Viewer, row: EventRow, mode: EventVisibility = eventVisibility()): EventSnapshot | null {
  if (isOrganizer(viewer)) return snapshotOf(row);
  return publishedEventVisibleToMember(viewer, row, mode);
}

/** Zveřejněný snímek pro kolegu bez práva plánovat. Návrh (akce bez zveřejněné verze) nikdy. */
export function publishedEventVisibleToMember(viewer: Viewer, row: EventRow, mode: EventVisibility): EventSnapshot | null {
  const snapshot = row.published;
  if (!snapshot) return null;
  if (mode === "all-published") return snapshot;
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

/**
 * Schválení (= zveřejnění) konkrétní verze zápisu: jen vedoucí zveřejněné akce. Kontrolor a správce návrh
 * upravují, schválit ho nemohou. Akce bez vedoucího nemá kdo schválit, UI vyzve k doplnění vedoucího.
 */
export function canApproveMinutes(viewer: Viewer, row: EventRow): boolean {
  return row.published !== null && row.published.leadId !== null && row.published.leadId === viewer.id;
}

/** Zveřejněný zápis: publikum akce, její vedoucí či kontrolor a správce. */
export function canReadPublishedMinutes(viewer: Viewer, row: EventRow): boolean {
  const snapshot = row.published;
  return snapshot !== null && (canPlan(viewer) || viewer.groups.includes(snapshot.audience) || isEventHandler(viewer, snapshot));
}

export function canSeeAudience(viewer: Viewer, audience: string): boolean {
  return isOrganizer(viewer) || viewer.groups.includes(audience as Group);
}

/**
 * Téma v seznamu Témat (F10). Stejné pravidlo jako u akcí: v režimu `all-published` vidí každý přihlášený všechna
 * nearchivovaná témata (filtr „Všechna“), jinak jen témata svých skupin. Jména zájemců dál vidí jen správce
 * a navrhnout téma jde jen pro vlastní skupinu (`canSeeAudience`).
 */
export function canSeeTopic(viewer: Viewer, audience: string, mode: EventVisibility = eventVisibility()): boolean {
  return mode === "all-published" || canSeeAudience(viewer, audience);
}

/**
 * Důvod a poznámka omluvy jsou soukromé (u nemoci jde o údaj související se zdravím). Zatím je smí číst
 * jen sám omluvený. Správce ani pracovní role „vedoucí týmu“ je automaticky nevidí: oprávněného manažera
 * doplní PR2 podle schváleného mapování (O03).
 */
export function canReadExcuseDetails(viewer: Viewer, subjectUserId: string): boolean {
  return viewer.id === subjectUserId;
}
