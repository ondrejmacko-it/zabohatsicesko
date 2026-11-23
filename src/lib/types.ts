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
/** Z čeho zápis vznikl. `recording` = stávající tok nahrávka → přepis, ostatní bez nahrávky. */
export const MINUTES_SOURCES = ["recording", "transcript", "notes", "file", "manual"] as const;
export type MinutesSource = (typeof MINUTES_SOURCES)[number];

export type RecordingState = "awaiting" | "processing" | "review" | "available" | "failed";

// ——— Pracovní role a individuální účast (PR1: jen doménový základ, UI a Kalendář je zatím nepoužívají) ———

/**
 * Pracovní zařazení člověka. Nesouvisí s technickou rolí (`Role`): pracovní role nikdy nedává právo
 * plánovat ani spravovat a správce není automaticky „vedoucí týmu“. Ukládá se do `users.groups` vedle
 * stávajících skupin. `vedouci-tymu` je připravená kvalifikace bez vlastního publika akcí (O02): v UI
 * ani v datech se zatím nepřiděluje.
 */
export const WORK_ROLES = ["fp", "rm", "vedouci-tymu"] as const;
export type WorkRole = (typeof WORK_ROLES)[number];

/**
 * Účast člověka na zveřejněné akci, jak ji vede Wiki. Není to stav doručení do Kalendáře ani odpověď
 * v Googlu (RSVP `needsAction | accepted | declined | tentative`), ty se vedou zvlášť.
 * – `required`: povinná, vyplývá z pracovních rolí a publika akce,
 * – `optional`: akce je vidět, člověk se zatím dobrovolně nepřihlásil,
 * – `voluntary_enrolled`: výslovná dobrovolná přihláška,
 * – `excused`: omluva z povinné akce, platí hned bez schvalování,
 * – `cancelled`: akce je zrušená, žádná aktivní účast.
 */
export type ParticipationState = "required" | "optional" | "voluntary_enrolled" | "excused" | "withdrawn" | "cancelled";

/** Výslovný záznam člověka u akce. Povinnost se neukládá, odvozuje se. */
export type ParticipationKind = "voluntary_enrolled" | "excused" | "withdrawn";

/** Důvod omluvy. Záměrně jen kategorie: „Nemoc“ není žádost o diagnózu. */
export const EXCUSE_REASONS = ["illness", "vacation", "other"] as const;
export type ExcuseReason = (typeof EXCUSE_REASONS)[number];

/** Nejdelší soukromá poznámka k omluvě (znaky). */
export const EXCUSE_NOTE_MAX = 280;
