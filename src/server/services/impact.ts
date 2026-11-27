import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDate, formatEventTime, toDateKey } from "@/lib/time";
import type { EventSnapshot, Group } from "@/lib/types";
import { eventAttendees, planGuests } from "@/server/calendar/attendees";
import { CalendarError } from "@/server/calendar/provider";
import { calendarProvider } from "@/server/calendar/sync";
import { attendeeSource, calendarMode, eventVisibility, now, participationEnabled } from "@/server/config";
import { getDb, type Db } from "@/server/db/client";
import { calendarLinks } from "@/server/db/schema";
import { calendarSummary, type EventRow } from "@/server/domain/snapshot";
import { isOrganizer, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";
import { loadEventRow, resolveTimes, type EventInput } from "@/server/services/events";

// Dopad změny zveřejněné akce na pozvané. Počítá se na serveru ze zveřejněné verze a z pozvánky,
// dialog ho jen zobrazí. Zveřejnění významné změny bez potvrzení právě tohoto dopadu server odmítne.

export type ChangeImpact = {
  /** Potvrzení platí jen pro tuto konkrétní změnu této zveřejněné verze. */
  token: string;
  changes: Array<{ field: string; from: string; to: string }>;
  guests: { add: string[]; remove: string[]; manual: string[] };
  notes: string[];
  /** Kolik lidí Wiki ke zveřejněné verzi dnes zve (stejný výpočet jako synchronizace). Null, když seznam nejde sestavit. */
  affected: number | null;
};

type Next = { summary: string; startsAt: Date; endsAt: Date; allDay: boolean; audience: Group };

function nextOf(input: EventInput): Next {
  const times = resolveTimes(input);
  return { summary: calendarSummary(input), ...times, audience: input.audience };
}

/**
 * Zveřejněná verze po změně, jen pro výpočet hostů. Hosté se tak počítají stejně jako při synchronizaci
 * (`eventAttendees`: povinní podle rolí bez omluvených plus dobrovolně přihlášení), ne jen podle skupiny.
 */
const nextSnapshot = (published: EventSnapshot, input: EventInput, next: Next): EventSnapshot => ({
  ...published,
  type: input.type,
  audience: next.audience,
  startsAt: next.startsAt.toISOString(),
  endsAt: next.endsAt.toISOString(),
  allDay: next.allDay,
});

const term = (startsAt: Date, endsAt: Date, allDay: boolean) =>
  `${formatDate(toDateKey(startsAt))} · ${formatEventTime(startsAt, endsAt, allDay)}`;

function changesOf(published: EventSnapshot, input: EventInput, next: Next): ChangeImpact["changes"] {
  const rows: ChangeImpact["changes"] = [];
  const add = (field: string, from: string, to: string) => from !== to && rows.push({ field, from, to });
  add("Název", published.label, input.label);
  add("Téma", published.topicTitle ?? "zatím nedoplněno", input.topicTitle ?? "zatím nedoplněno");
  const termChanged = published.startsAt !== next.startsAt.toISOString() || published.endsAt !== next.endsAt.toISOString();
  if (termChanged) {
    rows.push({
      field: "Termín",
      from: term(new Date(published.startsAt), new Date(published.endsAt), published.allDay),
      to: term(next.startsAt, next.endsAt, next.allDay),
    });
  }
  add("Pro koho", GROUP_LABELS[published.audience], GROUP_LABELS[next.audience]);
  return rows;
}

/**
 * Otisk skutečných příjemců publika. Do potvrzení se tak promítne i změna skupin účtu mezi zobrazením
 * dopadu a zveřejněním (audit A02). Adresy se jen hashují, nikam se neukládají ani nelogují.
 */
async function recipientsFingerprint(db: Db, eventId: string, snapshot: EventSnapshot): Promise<string> {
  try {
    const emails = (await eventAttendees(db, eventId, snapshot)).map((a) => a.email.toLowerCase()).sort();
    return createHash("sha256").update(emails.join("\n")).digest("hex");
  } catch {
    // Seznam nejde sestavit (třeba chybí testovací příjemci). Potvrzení pak platí pro tento stav.
    return "unavailable";
  }
}

async function tokenOf(db: Db, row: EventRow, input: EventInput, next: Next): Promise<string> {
  const recipients = row.published ? await recipientsFingerprint(db, row.id, nextSnapshot(row.published, input, next)) : "unpublished";
  const payload = [row.id, row.publishedRevision, next.summary, next.startsAt.toISOString(), next.endsAt.toISOString(), next.audience, recipients];
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Věta o změně publika podle toho, kdo akci ve Wiki vidí. Při `all-published` ji vidí všichni dál,
 * mění se jen povinnost (s účastí) nebo komu Wiki posílá pozvánku (bez ní).
 */
function audienceNote(from: Group, to: Group): string {
  if (eventVisibility() === "audience") {
    return `Ve Wiki akci i její zápis nově uvidí skupina ${GROUP_LABELS[to]}. Skupina ${GROUP_LABELS[from]} ji vidět přestane.`;
  }
  if (!participationEnabled()) return `Ve Wiki akci dál uvidí všichni. Pozvánku nově dostane skupina ${GROUP_LABELS[to]}.`;
  const required = to === "vsichni" ? "všechny" : `skupinu ${GROUP_LABELS[to]}`;
  return `Ve Wiki akci dál uvidí všichni. Nově je povinná pro ${required}${to === "vsichni" ? "" : ", pro ostatní dobrovolná"}. Omluvy a přihlášky se ve výpočtu pozvaných zohlední.`;
}

/** Významná změna: mění to, co vidí pozvaní (název, téma, termín) nebo kdo je pozvaný (publikum). */
function isSignificant(published: EventSnapshot, next: Next): boolean {
  return (
    calendarSummary(published) !== next.summary ||
    published.startsAt !== next.startsAt.toISOString() ||
    published.endsAt !== next.endsAt.toISOString() ||
    published.audience !== next.audience
  );
}

/** Dopad zveřejnění změny. Null, pokud akce není zveřejněná nebo změna pozvané nijak nezasáhne. */
export async function changeImpact(viewer: Viewer, eventId: string, input: EventInput): Promise<ChangeImpact | null> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  const row = await loadEventRow(db, eventId);
  if (!row) throw new DomainError("not_found");
  const published = row.published;
  const next = nextOf(input);
  if (!published || published.status === "cancelled" || !isSignificant(published, next)) return null;

  const impact: ChangeImpact = { token: await tokenOf(db, row, input, next), changes: changesOf(published, input, next), guests: { add: [], remove: [], manual: [] }, notes: [], affected: null };
  impact.affected = await eventAttendees(db, eventId, published).then((list) => list.length, () => null);
  if (published.audience !== next.audience) impact.notes.push(audienceNote(published.audience, next.audience));
  if (published.startsAt !== next.startsAt.toISOString() || published.endsAt !== next.endsAt.toISOString()) {
    impact.notes.push("Mění se termín, Google proto pozvané požádá o novou odpověď. U změny názvu nebo tématu odpovědi zůstávají.");
  }
  if (input.type === "holiday") return impact;

  const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, eventId)).limit(1);
  const fixedList = calendarMode() === "google-test" && attendeeSource() === "allowlist";
  if (fixedList) {
    impact.notes.push("Testovací režim Googlu zve jen pevný seznam testovacích příjemců. Změna publika proto hosty v pozvánce nezmění.");
    return impact;
  }
  if (calendarMode() === "simulation") impact.notes.push("V simulaci se e-mail neodešle.");
  if (next.startsAt <= now()) {
    impact.notes.push("Akce už proběhla nebo právě běží, hosty v pozvánce Wiki nemění.");
    return impact;
  }
  let desired;
  try {
    desired = await eventAttendees(db, eventId, nextSnapshot(published, input, next));
  } catch {
    impact.notes.push("Seznam hostů pro novou skupinu se nepodařilo sestavit. Synchronizace se zastaví a ukáže důvod.");
    return impact;
  }
  if (!link?.externalEventId) {
    impact.guests.add = desired.map((a) => a.name);
    impact.notes.push(
      link
        ? "Pozvánka v Kalendáři zatím nevznikla. Vytvoří se rovnou pro novou skupinu."
        : "Akce nemá vazbu na pozvánku v Kalendáři. Změna se projeví jen ve Wiki, dokud pozvánku nezaložíš nebo nespáruješ.",
    );
    if (!link) impact.guests.add = [];
    return impact;
  }
  try {
    const external = await calendarProvider(db).get(link.calendarId, link.externalEventId);
    if (!external) throw new CalendarError("calendar_missing", false);
    const managed = link.managedAttendees ?? [];
    const plan = planGuests(desired, external.attendees, managed);
    const nameOf = new Map([...external.attendees, ...desired].map((a) => [a.email.toLowerCase(), a.name || a.email]));
    impact.guests = {
      add: plan.add.map((a) => a.name || a.email),
      remove: plan.remove.map((email) => nameOf.get(email) ?? email),
      manual: external.attendees.filter((a) => !managed.includes(a.email.toLowerCase())).map((a) => a.name || a.email),
    };
  } catch (error) {
    if (!(error instanceof CalendarError)) throw error;
    impact.notes.push(
      "Aktuální hosty se z Kalendáře nepodařilo načíst, dopad na hosty proto není ověřený. Wiki přidá chybějící pozvané, odebere jen hosty, které sama přidala, a ručně přidané nechá.",
    );
  }
  return impact;
}

/** Serverová kontrola před zveřejněním: významná změna zveřejněné akce musí mít potvrzený právě tento dopad. */
export async function assertImpactConfirmed(eventId: string, input: EventInput, token: string | null): Promise<void> {
  const db = await getDb();
  const row = await loadEventRow(db, eventId);
  if (!row?.published || row.published.status === "cancelled") return;
  const next = nextOf(input);
  if (!isSignificant(row.published, next)) return;
  if (!token) throw new ImpactNotConfirmed(false);
  if (token !== (await tokenOf(db, row, input, next))) throw new ImpactNotConfirmed(true);
}

export class ImpactNotConfirmed extends Error {
  /** Potvrzení přišlo, ale dopad se od té doby změnil (jiná verze akce nebo jiní příjemci). */
  constructor(readonly stale: boolean) {
    super("impact_not_confirmed");
  }
}

export type CancelImpact = {
  audience: string;
  guests: string[];
  notes: string[];
  /** Akce má pozvánku v Kalendáři, zrušení tedy odešle storno. */
  hasInvite: boolean;
  /** Hosté pozvánky jsou ověření u Kalendáře (nebo pozvánka není). Jinak dopad na pozvané neznáme. */
  verified: boolean;
};

/** Koho se zrušení dotkne: skupina, která akci vidí ve Wiki, a hosté pozvánky, kterým Kalendář pošle storno. */
export async function cancelImpact(viewer: Viewer, eventId: string): Promise<CancelImpact> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  const row = await loadEventRow(db, eventId);
  if (!row) throw new DomainError("not_found");
  const published = row.published;
  if (!published || published.status === "cancelled") throw new DomainError("invalid_state");

  const impact: CancelImpact = { audience: GROUP_LABELS[published.audience], guests: [], notes: [], hasInvite: false, verified: true };
  if (row.revision !== row.publishedRevision) {
    impact.notes.push("Rozpracovaný návrh změny se zahodí. Zruší se zveřejněná verze akce.");
  }
  const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, eventId)).limit(1);
  if (!link?.externalEventId) {
    impact.notes.push("Akce nemá pozvánku v Kalendáři, nikomu proto nepřijde zpráva. Zrušení se projeví jen ve Wiki.");
    return impact;
  }
  impact.hasInvite = true;
  if (new Date(published.endsAt) <= now()) impact.notes.push("Akce už proběhla. Zrušení se přesto zapíše do Wiki i do Kalendáře.");
  if (calendarMode() === "simulation") impact.notes.push("V simulaci se e-mail neodešle.");
  try {
    const external = await calendarProvider(db).get(link.calendarId, link.externalEventId);
    if (!external) throw new CalendarError("calendar_missing", false);
    impact.guests = external.attendees.map((a) => a.name || a.email);
    if (!impact.guests.length) impact.notes.push("Pozvánka nemá žádné hosty, zpráva o zrušení nikomu nepřijde.");
  } catch (error) {
    if (!(error instanceof CalendarError)) throw error;
    impact.verified = false;
    impact.notes.push(
      "Hosty se z Kalendáře nepodařilo načíst, komu přijde zpráva o zrušení, teď nejde ověřit. Ve Wiki se akce zruší hned, do Kalendáře se storno propíše, až bude dostupný.",
    );
  }
  return impact;
}
