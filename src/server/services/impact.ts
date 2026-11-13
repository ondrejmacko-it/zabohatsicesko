import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDate, formatEventTime, toDateKey } from "@/lib/time";
import type { EventSnapshot, Group } from "@/lib/types";
import { audienceAttendees, planGuests } from "@/server/calendar/attendees";
import { CalendarError } from "@/server/calendar/provider";
import { calendarProvider } from "@/server/calendar/sync";
import { attendeeSource, calendarMode, now } from "@/server/config";
import { getDb } from "@/server/db/client";
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
};

type Next = { summary: string; startsAt: Date; endsAt: Date; allDay: boolean; audience: Group };

function nextOf(input: EventInput): Next {
  const times = resolveTimes(input);
  return { summary: calendarSummary(input), ...times, audience: input.audience };
}

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
  add("Publikum", GROUP_LABELS[published.audience], GROUP_LABELS[next.audience]);
  return rows;
}

function tokenOf(row: EventRow, next: Next): string {
  const payload = [row.id, row.publishedRevision, next.summary, next.startsAt.toISOString(), next.endsAt.toISOString(), next.audience];
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
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

  const impact: ChangeImpact = { token: tokenOf(row, next), changes: changesOf(published, input, next), guests: { add: [], remove: [], manual: [] }, notes: [] };
  const audienceChanged = published.audience !== next.audience;
  if (audienceChanged) {
    impact.notes.push(
      `Ve Wiki akci i její zápis nově uvidí skupina ${GROUP_LABELS[next.audience]}. Skupina ${GROUP_LABELS[published.audience]} ji vidět přestane.`,
    );
  }
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
  if (calendarMode() === "simulation") impact.notes.push("Kalendář běží v simulaci: hosté jsou fiktivní role a žádná skutečná zpráva neodejde.");
  if (next.startsAt <= now()) {
    impact.notes.push("Akce už proběhla nebo právě běží, hosty v pozvánce Wiki nemění.");
    return impact;
  }
  let desired;
  try {
    desired = await audienceAttendees(db, next.audience);
  } catch {
    impact.notes.push("Seznam hostů pro nové publikum se nepodařilo sestavit. Synchronizace se zastaví a ukáže důvod.");
    return impact;
  }
  if (!link?.externalEventId) {
    impact.guests.add = desired.map((a) => a.name);
    impact.notes.push(
      link
        ? "Pozvánka v Kalendáři zatím nevznikla. Vytvoří se rovnou pro nové publikum."
        : "Akce nemá vazbu na pozvánku v Kalendáři. Změna se projeví jen ve Wiki, dokud pozvánku nezaložíte nebo nespárujete.",
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
      "Aktuální hosty se z Kalendáře nepodařilo načíst, dopad na hosty proto není ověřený. Wiki přidá chybějící lidi z nového publika, odebere jen hosty, které sama přidala, a ručně přidané nechá.",
    );
  }
  return impact;
}

/** Serverová kontrola před zveřejněním: významná změna zveřejněné akce musí mít potvrzený právě tento dopad. */
export async function assertImpactConfirmed(eventId: string, input: EventInput, token: string | null): Promise<void> {
  const row = await loadEventRow(await getDb(), eventId);
  if (!row?.published || row.published.status === "cancelled") return;
  const next = nextOf(input);
  if (isSignificant(row.published, next) && token !== tokenOf(row, next)) throw new ImpactNotConfirmed();
}

export class ImpactNotConfirmed extends Error {}

export type CancelImpact = { audience: string; guests: string[]; notes: string[] };

/** Koho se zrušení dotkne: skupina, která akci vidí ve Wiki, a hosté pozvánky, kterým Kalendář pošle storno. */
export async function cancelImpact(viewer: Viewer, eventId: string): Promise<CancelImpact> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  const row = await loadEventRow(db, eventId);
  if (!row) throw new DomainError("not_found");
  const published = row.published;
  if (!published || published.status === "cancelled") throw new DomainError("invalid_state");

  const impact: CancelImpact = { audience: GROUP_LABELS[published.audience], guests: [], notes: [] };
  if (row.revision !== row.publishedRevision) {
    impact.notes.push("Rozpracovaný návrh změny se zahodí. Zruší se zveřejněná verze akce.");
  }
  const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, eventId)).limit(1);
  if (!link?.externalEventId) {
    impact.notes.push("Akce nemá pozvánku v Kalendáři, nikomu proto nepřijde zpráva. Zrušení se projeví jen ve Wiki.");
    return impact;
  }
  if (new Date(published.endsAt) <= now()) impact.notes.push("Akce už proběhla. Zrušení se přesto zapíše do Wiki i do Kalendáře.");
  if (calendarMode() === "simulation") impact.notes.push("Kalendář běží v simulaci: hosté jsou fiktivní role a žádná skutečná zpráva neodejde.");
  try {
    const external = await calendarProvider(db).get(link.calendarId, link.externalEventId);
    if (!external) throw new CalendarError("calendar_missing", false);
    impact.guests = external.attendees.map((a) => a.name || a.email);
    if (!impact.guests.length) impact.notes.push("Pozvánka nemá žádné hosty, zpráva o zrušení nikomu nepřijde.");
  } catch (error) {
    if (!(error instanceof CalendarError)) throw error;
    impact.notes.push("Hosty se z Kalendáře nepodařilo načíst. Zprávu o zrušení dostanou všichni, kdo jsou v pozvánce.");
  }
  return impact;
}
