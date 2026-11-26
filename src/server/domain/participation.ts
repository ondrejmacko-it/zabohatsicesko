import {
  EXCUSE_NOTE_MAX,
  EXCUSE_REASONS,
  GROUPS,
  WORK_ROLES,
  type EventSnapshot,
  type ExcuseReason,
  type Group,
  type ParticipationKind,
  type ParticipationState,
  type UserStatus,
  type WorkRole,
} from "@/lib/types";

// Čistá pravidla individuální účasti. Bez databáze a bez Kalendáře, aby šla otestovat celá matice rolí.
//
// Zdroj pravdy:
// 1. poslední ZVEŘEJNĚNÝ snímek akce (`events.published`), nikdy rozpracovaný návrh,
// 2. členství člověka (`users.groups`: pracovní role FP/RM a starší skupiny jako `tym-a`),
// 3. výslovný záznam člověka u akce (`event_participation`): dobrovolná přihláška nebo omluva.
// Povinná účast se neukládá. Žádný záznam = platí, co vyplývá z rolí a publika.
// Technická role (`admin | organizer | member`) do účasti nevstupuje vůbec.

/** Členství, které rozhoduje o povinnosti: pracovní role a starší skupiny publika. `vsichni` se neukládá, platí pro každého. */
export type Membership = Exclude<Group, "vsichni"> | WorkRole;

const KNOWN_MEMBERSHIPS: ReadonlySet<string> = new Set<string>([...GROUPS, ...WORK_ROLES].filter((g) => g !== "vsichni"));

/** Známá členství z uložených skupin, bez duplicit a bez `vsichni`. Neznámý text se ignoruje, nic se nehádá. */
export function membershipsOf(groups: readonly string[]): Membership[] {
  return [...new Set(groups)].filter((g): g is Membership => KNOWN_MEMBERSHIPS.has(g));
}

/** Pracovní role z uložených skupin v pořadí `WORK_ROLES`. Starší `tym-a` pracovní rolí není. */
export function workRolesOf(groups: readonly string[]): WorkRole[] {
  return WORK_ROLES.filter((role) => groups.includes(role));
}

/**
 * Je akce pro člověka povinná? „Všichni“ platí pro každého aktivního, i bez uloženého `vsichni`.
 * Jinak rozhoduje shoda publika s členstvím. Víc rolí = sjednocení, akce je povinná jen jednou.
 */
export function isRequiredForUser(groups: readonly string[], audience: Group): boolean {
  if (audience === "vsichni") return true;
  return membershipsOf(groups).includes(audience);
}

/** Člověk, o jehož účast jde. Stav účtu se čte z databáze, nikdy z náhledu. */
export type Participant = { status: UserStatus; groups: readonly string[] };

/** Výslovný záznam u akce. Poznámka k omluvě sem záměrně nepatří, pravidla ji nepotřebují. */
export type ParticipationRecord = { kind: ParticipationKind; excuseReason: ExcuseReason | null };

/**
 * Stav účasti bez ohledu na čas. Null = účast nevzniká: akce není zveřejněná, je to svátek, nebo účet
 * není aktivní. Omluva se uplatní jen u povinné akce; když povinnost zanikne (změna rolí nebo publika),
 * záznam zůstane, ale neplatí, a po návratu povinnosti začne platit znovu. Dobrovolná přihláška povinnost
 * nemění; u povinné akce je jen nadbytečná a po zániku povinnosti zase platí.
 */
export function participationState(
  person: Participant,
  snapshot: EventSnapshot | null,
  record: ParticipationRecord | null,
): ParticipationState | null {
  if (!snapshot || snapshot.type === "holiday" || person.status !== "active") return null;
  if (snapshot.status === "cancelled") return "cancelled";
  if (isRequiredForUser(person.groups, snapshot.audience)) return record?.kind === "excused" ? "excused" : "required";
  return record?.kind === "voluntary_enrolled" ? "voluntary_enrolled" : record?.kind === "withdrawn" ? "withdrawn" : "optional";
}

export type Participation = {
  state: ParticipationState;
  /** Povinnost podle rolí a publika (platí i u omluvy a u zrušené akce, která byla povinná). */
  required: boolean;
  /** Má dostat pozvánku: povinná bez omluvy nebo dobrovolně přihlášená. Neříká nic o odpovědi v Googlu. */
  calendarGuest: boolean;
  /** Účast jde měnit: akce ještě nezačala a není zrušená. */
  open: boolean;
};

/** Účast pro zobrazení a rozhodnutí o změně v čase `at`. */
export function effectiveParticipation(
  person: Participant,
  snapshot: EventSnapshot | null,
  record: ParticipationRecord | null,
  at: Date,
): Participation | null {
  const state = participationState(person, snapshot, record);
  if (!state || !snapshot) return null;
  return {
    state,
    required: state === "required" || state === "excused" || (state === "cancelled" && isRequiredForUser(person.groups, snapshot.audience)),
    calendarGuest: state === "required" || state === "voluntary_enrolled",
    open: state !== "cancelled" && new Date(snapshot.startsAt) > at,
  };
}

export const canVoluntarilyJoin = (p: Participation | null) => p !== null && p.open && (p.state === "optional" || p.state === "withdrawn");
export const canWithdraw = (p: Participation | null) => p !== null && p.open && p.state === "voluntary_enrolled";
export const canExcuse = (p: Participation | null) => p !== null && p.open && (p.state === "required" || p.state === "excused");
export const canRevokeExcuse = (p: Participation | null) => p !== null && p.open && p.state === "excused";

export type Excuse = { reason: ExcuseReason; note: string | null };

export type ParticipationChange =
  | { kind: "enroll" }
  | { kind: "withdraw" }
  | { kind: "excuse"; excuse: Excuse }
  | { kind: "revoke_excuse" };

/** Co se má se záznamem stát. `none` = stav už odpovídá (dvojklik, opakování), nic se nezapíše. */
export type RecordWrite =
  | { op: "upsert"; kind: "voluntary_enrolled" | "withdrawn" }
  | { op: "upsert"; kind: "excused"; excuse: Excuse }
  | { op: "delete" }
  | { op: "none" };

export type TransitionResult = { ok: true; write: RecordWrite } | { ok: false; reason: "not_participant" | "closed" | "not_allowed" };

/**
 * Přechod účasti. Opakování téže změny je bez účinku (idempotence), nedovolená změna vrací důvod.
 * Omluvu lze jen z povinné akce, přihlášku jen k nepovinné, odhlásit jen vlastní dobrovolnou účast.
 */
export function participationTransition(
  participation: Participation | null,
  record: ParticipationRecord | null,
  change: ParticipationChange,
): TransitionResult {
  if (!participation) return { ok: false, reason: "not_participant" };
  if (!participation.open) return { ok: false, reason: "closed" };
  const { state } = participation;
  switch (change.kind) {
    case "enroll":
      if (state === "voluntary_enrolled") return { ok: true, write: { op: "none" } };
      return state === "optional" || state === "withdrawn" ? { ok: true, write: { op: "upsert", kind: "voluntary_enrolled" } } : { ok: false, reason: "not_allowed" };
    case "withdraw":
      if (state === "voluntary_enrolled") return { ok: true, write: { op: "upsert", kind: "withdrawn" } };
      // Nepřihlášený: není co odhlásit (případnou starou omluvu odhlášení nemaže).
      return state === "optional" || state === "withdrawn" ? { ok: true, write: { op: "none" } } : { ok: false, reason: "not_allowed" };
    case "excuse":
      return state === "required" || state === "excused"
        ? { ok: true, write: { op: "upsert", kind: "excused", excuse: change.excuse } }
        : { ok: false, reason: "not_allowed" };
    case "revoke_excuse":
      if (state === "excused") return { ok: true, write: { op: "delete" } };
      // Povinná bez omluvy: už platí, nadbytečnou dobrovolnou přihlášku odvolání omluvy nemaže.
      if (state === "required") return { ok: true, write: { op: "none" } };
      // Neplatná (stará) omluva u nepovinné akce: smazat ji smí, přihlášku tím ale neruší.
      return state === "optional" && record?.kind === "excused" ? { ok: true, write: { op: "delete" } } : { ok: false, reason: "not_allowed" };
  }
}

/**
 * Omluva z formuláře: jen známá kategorie a volitelná poznámka bez řídicích znaků, oříznutá, do limitu.
 * Prázdná poznámka = žádná. Null = neplatný vstup.
 */
export function parseExcuse(input: { reason: unknown; note?: unknown }): Excuse | null {
  if (typeof input.reason !== "string" || !(EXCUSE_REASONS as readonly string[]).includes(input.reason)) return null;
  if (input.note !== undefined && input.note !== null && typeof input.note !== "string") return null;
  const note = (input.note ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
  if (note.length > EXCUSE_NOTE_MAX) return null;
  return { reason: input.reason as ExcuseReason, note: note || null };
}

/** Člověk pro výpočet pozvaných. */
export type GuestCandidate = Participant & { id: string };

/**
 * Komu má zveřejněná akce patřit v Kalendáři: povinní bez omluvených plus dobrovolně přihlášení, každý
 * jednou, seřazeno. Jen smlouva pro PR2: pozvánky dnes dál počítá `audienceAttendees` beze změny.
 * Odebrání omluveného z pozvaných NENÍ jeho odpověď `declined` v Googlu (viz docs/ucast-a-role.md).
 */
export function desiredGuestIds(
  people: readonly GuestCandidate[],
  snapshot: EventSnapshot | null,
  records: ReadonlyMap<string, ParticipationRecord>,
): string[] {
  const ids = new Set<string>();
  for (const person of people) {
    const state = participationState(person, snapshot, records.get(person.id) ?? null);
    if (state === "required" || state === "voluntary_enrolled") ids.add(person.id);
  }
  return [...ids].sort();
}

/** Akce, kterou smí člověk se svou účastí udělat. Stejné názvy jako `ParticipationChange.kind`. */
export type ParticipationAction = ParticipationChange["kind"];

export const PARTICIPATION_LABELS = {
  required: "Povinné pro tebe",
  optional: "Můžeš se přihlásit",
  voluntary_enrolled: "Přihlášeno",
  excused: "Omluven/a",
  withdrawn: "Odhlášeno",
} as const satisfies Partial<Record<ParticipationState, string>>;

/**
 * Vlastní účast pro kartu a detail: jen stav, štítek a dovolené akce. Bez důvodu a poznámky omluvy a bez
 * jakýchkoli údajů o ostatních. `actions` je prázdné u proběhlé či zrušené akce a bez zapnutých přihlášek.
 * V náhledu „Zobrazit jako“ jsou akce stejné jako u kolegy, UI je ale jen zamčeně ukáže.
 */
export type OwnParticipationView = {
  state: ParticipationState;
  /** Akce je (nebo před zrušením byla) pro člověka povinná. Zrušená povinná akce tak zůstává v Povinné a Moje. */
  required: boolean;
  label: string | null;
  actions: ParticipationAction[];
};

/** Štítek nepovinné akce, ke které se přihlásit nejde (přihlášky vypnuté, akce už začala): jen popisuje. */
export const OPTIONAL_READ_ONLY_LABEL = "Dobrovolné";

/**
 * `enrollment: false` = přihlášky ve Wiki nejsou zapnuté (`PARTICIPATION`). Nepovinná akce pak, stejně jako
 * proběhlá nepovinná akce, nesmí slibovat „Můžeš se přihlásit“ ani v měsíci, ani v detailu, ani v náhledu.
 */
export function ownParticipationView(
  participation: Participation | null,
  { readOnly, enrollment = true }: { readOnly: boolean; enrollment?: boolean },
): OwnParticipationView | null {
  if (!participation) return null;
  const { state } = participation;
  const label = state === "cancelled" ? null : state === "optional" && (!enrollment || !participation.open) ? OPTIONAL_READ_ONLY_LABEL : PARTICIPATION_LABELS[state];
  const actions: ParticipationAction[] = [];
  if (!readOnly) {
    if (canVoluntarilyJoin(participation)) actions.push("enroll");
    if (canWithdraw(participation)) actions.push("withdraw");
    if (canExcuse(participation) && state === "required") actions.push("excuse");
    if (canRevokeExcuse(participation)) actions.push("revoke_excuse");
  }
  return { state, required: participation.required, label, actions };
}

/**
 * Filtr „Moje“: povinné (i omluvené), dobrovolně přihlášené a akce, které člověk vede nebo kontroluje.
 * `leadsOrReviews` je vedení či kontrola konkrétní akce, ne obecné právo správce obsluhovat všechny akce.
 */
export function isMine(view: OwnParticipationView | null | undefined, leadsOrReviews: boolean): boolean {
  if (leadsOrReviews || view?.required) return true;
  return view?.state === "required" || view?.state === "excused" || view?.state === "voluntary_enrolled";
}

/** Strop změn vlastní účasti na člověka a hodinu (akce formuláře). Přihlášky a omluvy nikdo nemění častěji. */
export const PARTICIPATION_LIMIT = { count: 30, windowSec: 3600 };
