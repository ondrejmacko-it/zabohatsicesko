import { createHash } from "node:crypto";
import { and, count, eq, gt, isNotNull, ne, sql } from "drizzle-orm";
import type { EventSnapshot } from "@/lib/types";
import { audit } from "@/server/audit";
import { config, now, personalDelivery } from "@/server/config";
import type { Db, Executor } from "@/server/db/client";
import { calendarLinks, events, personalCalendarEntries, personalCalendars } from "@/server/db/schema";
import { audienceAttendees } from "./attendees";
import type { FetchLike } from "./google-auth";
import { removePersonalCalendar } from "./personal";

// Přechod z osobních kalendářů na organizátora (PR B). Inventura jen čte a vrací počty, nikdy adresy.
// Úklid kalendářů „Vzdělávání ZBC“ v účtech uživatelů je nevratný, proto běží jen s otiskem inventury,
// kterou uživatel schválil, a až po přepnutí na organizátora (jinak by je osobní režim založil znovu).

export type MigrationInventory = {
  /** Budoucí zveřejněné nezrušené akce, které organizátor zapíše do svého kalendáře. */
  futureEvents: number;
  /** Pozvánky celkem (akce × pozvaní). Každá znamená jeden e-mail Googlu příjemci. */
  invitations: number;
  /** Různí příjemci pozvánek. */
  recipients: number;
  /** Akce bez pozvaných (skupina bez aktivních účtů). */
  eventsWithoutGuests: number;
  personalCalendars: { total: number; active: number; withCalendar: number };
  personalEntries: number;
  links: { total: number; withExternalEvent: number };
  /** Otisk počtů a dotčených uživatelů. Úklid ho vyžaduje, změna dat ho zneplatní. */
  fingerprint: string;
};

export async function migrationInventory(db: Executor): Promise<MigrationInventory> {
  const upcoming = await db
    .select({ id: events.id, published: events.published })
    .from(events)
    .where(
      and(
        eq(events.orgId, config.orgId),
        isNotNull(events.published),
        ne(events.type, "holiday"),
        ne(events.status, "cancelled"),
        gt(sql`(${events.published}->>'startsAt')::timestamptz`, sql`${now().toISOString()}::timestamptz`),
      ),
    );
  const guestsByAudience = new Map<string, string[]>();
  let invitations = 0;
  let eventsWithoutGuests = 0;
  const recipients = new Set<string>();
  for (const { published } of upcoming) {
    const snapshot = published as EventSnapshot;
    if (snapshot.status === "cancelled") continue;
    let guests = guestsByAudience.get(snapshot.audience);
    if (!guests) {
      guests = (await audienceAttendees(db, snapshot.audience, "audience")).map((a) => a.email.toLowerCase());
      guestsByAudience.set(snapshot.audience, guests);
    }
    invitations += guests.length;
    if (!guests.length) eventsWithoutGuests++;
    for (const g of guests) recipients.add(g);
  }

  const calendars = await db
    .select({ userId: personalCalendars.userId, status: personalCalendars.status, calendarId: personalCalendars.calendarId })
    .from(personalCalendars)
    .where(eq(personalCalendars.orgId, config.orgId));
  const [entries] = await db.select({ n: count() }).from(personalCalendarEntries);
  const [links] = await db
    .select({ total: count(), withExternal: count(calendarLinks.externalEventId) })
    .from(calendarLinks)
    .innerJoin(events, eq(events.id, calendarLinks.eventId))
    .where(eq(events.orgId, config.orgId));

  const counts = {
    futureEvents: upcoming.length,
    invitations,
    recipients: recipients.size,
    eventsWithoutGuests,
    personalCalendars: {
      total: calendars.length,
      active: calendars.filter((c) => c.status === "active").length,
      withCalendar: calendars.filter((c) => c.calendarId).length,
    },
    personalEntries: entries?.n ?? 0,
    links: { total: links?.total ?? 0, withExternalEvent: links?.withExternal ?? 0 },
  };
  const users = calendars.map((c) => c.userId).sort();
  const fingerprint = createHash("sha256").update(JSON.stringify({ counts, users })).digest("hex").slice(0, 12);
  return { ...counts, fingerprint };
}

export type RetireResult =
  | { mode: "dry-run"; inventory: MigrationInventory; wouldRemove: number }
  | { mode: "done"; removed: number };

/**
 * Smaže kalendáře „Vzdělávání ZBC“, které Wiki založila v účtech uživatelů, zneplatní jejich tokeny a smaže
 * řádky `personal_calendars`. Bez `approvedFingerprint` jen vypíše plán (dry-run) a nic nevolá.
 */
export async function retireWikiCalendars(
  db: Db,
  options: { approvedFingerprint?: string; fetchImpl?: FetchLike } = {},
): Promise<RetireResult> {
  const inventory = await migrationInventory(db);
  if (!options.approvedFingerprint) return { mode: "dry-run", inventory, wouldRemove: inventory.personalCalendars.total };
  if (personalDelivery()) throw new Error("Úklid odmítnut: běží osobní režim (CALENDAR_DELIVERY=personal). Nejdřív přepnout na organizátora.");
  if (options.approvedFingerprint !== inventory.fingerprint) {
    throw new Error("Úklid odmítnut: otisk nesouhlasí se současnou inventurou. Spusťte inventuru znovu a nechte ji schválit.");
  }
  const rows = await db.select({ userId: personalCalendars.userId }).from(personalCalendars).where(eq(personalCalendars.orgId, config.orgId));
  for (const { userId } of rows) await removePersonalCalendar(db, userId, { fetchImpl: options.fetchImpl });
  await audit(db, null, "calendar.migration.retired", "org", config.orgId);
  return { mode: "done", removed: rows.length };
}
