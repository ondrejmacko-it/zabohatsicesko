import { and, eq, gte, isNotNull, lt } from "drizzle-orm";
import type { SimAttendee } from "@/lib/types";
import { CalendarError } from "@/server/calendar/provider";
import { calendarProvider } from "@/server/calendar/sync";
import { config } from "@/server/config";
import { getDb } from "@/server/db/client";
import { calendarLinks, events } from "@/server/db/schema";
import { canSeeResponses, type Viewer } from "@/server/policy";

// Odpovědi pozvaných (RSVP) z Kalendáře. Wiki je jen čte, nikdy je nemění. Vidí je správce a vedoucí
// akce. Výpadek Kalendáře není chyba stránky: odpovědi se prostě neukážou.

export type EventResponses = {
  total: number;
  /** Jména podle odpovědi. Bez adres, vedoucí akce je znát nepotřebuje. */
  accepted: string[];
  tentative: string[];
  declined: string[];
  waiting: string[];
};

const BUCKET = { accepted: "accepted", tentative: "tentative", declined: "declined", needsAction: "waiting" } as const;

export function groupResponses(attendees: readonly SimAttendee[]): EventResponses {
  const result: EventResponses = { total: attendees.length, accepted: [], tentative: [], declined: [], waiting: [] };
  for (const attendee of attendees) result[BUCKET[attendee.responseStatus] ?? "waiting"].push(attendee.name || attendee.email);
  for (const key of ["accepted", "tentative", "declined", "waiting"] as const) result[key].sort((a, b) => a.localeCompare(b, "cs"));
  return result;
}

/**
 * Odpovědi u zveřejněných nezrušených akcí v rozsahu, které uživatel smí vidět. Jeden dotaz do
 * Kalendáře za celý rozsah. Akce bez pozvánky, bez hostů nebo cizí akce ve výsledku chybí.
 */
export async function listResponses(viewer: Viewer, from: Date, to: Date): Promise<Record<string, EventResponses>> {
  const db = await getDb();
  const rows = await db
    .select({ event: events, calendarId: calendarLinks.calendarId, externalId: calendarLinks.externalEventId })
    .from(events)
    .innerJoin(calendarLinks, eq(calendarLinks.eventId, events.id))
    .where(and(eq(events.orgId, config.orgId), lt(events.startsAt, to), gte(events.endsAt, from), isNotNull(calendarLinks.externalEventId)));
  const allowed = rows.filter((r) => r.event.published?.status === "published" && canSeeResponses(viewer, r.event));
  if (!allowed.length) return {};
  const result: Record<string, EventResponses> = {};
  try {
    const provider = calendarProvider(db);
    for (const calendarId of new Set(allowed.map((r) => r.calendarId))) {
      const external = new Map((await provider.listBetween(calendarId, from, to)).map((e) => [e.id, e]));
      for (const row of allowed) {
        const found = row.calendarId === calendarId ? external.get(row.externalId!) : undefined;
        if (found && !found.cancelled && found.attendees.length) result[row.event.id] = groupResponses(found.attendees);
      }
    }
  } catch (error) {
    if (!(error instanceof CalendarError)) throw error;
    return {};
  }
  return result;
}

/** Odpovědi jedné akce pro okno akce a detail. Null, když je uživatel vidět nesmí nebo nejsou. */
export async function getEventResponses(viewer: Viewer, eventId: string): Promise<EventResponses | null> {
  const db = await getDb();
  const [row] = await db
    .select({ event: events, calendarId: calendarLinks.calendarId, externalId: calendarLinks.externalEventId })
    .from(events)
    .innerJoin(calendarLinks, eq(calendarLinks.eventId, events.id))
    .where(and(eq(events.orgId, config.orgId), eq(events.id, eventId), isNotNull(calendarLinks.externalEventId)))
    .limit(1);
  if (!row || row.event.published?.status !== "published" || !canSeeResponses(viewer, row.event)) return null;
  try {
    const external = await calendarProvider(db).get(row.calendarId, row.externalId!);
    return external && !external.cancelled && external.attendees.length ? groupResponses(external.attendees) : null;
  } catch (error) {
    if (!(error instanceof CalendarError)) throw error;
    return null;
  }
}
