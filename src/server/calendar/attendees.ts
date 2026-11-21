import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { EventSnapshot, SimAttendee } from "@/lib/types";
import { attendeeSource, config, googleCalendarConfig, now, participationEnabled, type AttendeeSource } from "@/server/config";
import type { Executor } from "@/server/db/client";
import { calendarLinks, eventParticipation, events, userIdentities, users } from "@/server/db/schema";
import { desiredGuestIds, type ParticipationRecord } from "@/server/domain/participation";
import { CalendarError } from "./provider";

// Hosté pozvánek. Wiki zve publikum akce a spravuje jen hosty, které sama přidala.
// Ručně přidaní hosté a odpovědi (RSVP) v Kalendáři zůstávají beze změny.

/** V simulaci smí pozvánka jít jen na fiktivní adresy. Ověřuje se na serveru před zápisem. */
const SIMULATION_ATTENDEE_DOMAIN = "@example.invalid";

export type Recipient = { id: string; email: string; name: string; groups: string[] };

/**
 * Účty, kterým mohou jít pozvánky podle skupin.
 * – simulace: aktivní fiktivní role (skutečné účty simulace nikdy neosloví),
 * – Google: aktivní účty se skutečnou adresou. Pozvaný nebo schválený účet má adresu ze Správy,
 *   fiktivní role jen tehdy, když je svázaná s účtem Google (zaváděcí seznam testovacích účtů).
 */
export async function listRecipients(db: Executor, google: boolean): Promise<Recipient[]> {
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, groups: users.groups, origin: users.origin, googleEmail: userIdentities.email })
    .from(users)
    .leftJoin(userIdentities, and(eq(userIdentities.userId, users.id), eq(userIdentities.provider, "google")))
    .where(and(eq(users.orgId, config.orgId), eq(users.status, "active")))
    .orderBy(asc(users.name));
  const recipients: Recipient[] = [];
  for (const row of rows) {
    const email = google ? (row.origin === "demo" ? row.googleEmail : row.email) : row.origin === "demo" ? row.email : null;
    if (email) recipients.push({ id: row.id, email: email.toLowerCase(), name: row.name, groups: row.groups });
  }
  return recipients;
}

/**
 * Koho má Wiki na akci zvát.
 * – simulace: aktivní fiktivní role z publika akce,
 * – Google, zdroj „allowlist“ (výchozí): jen povolení testovací příjemci,
 * – Google, zdroj „audience“: aktivní skutečné účty ve skupině publika, i pozvané před prvním přihlášením.
 */
export async function audienceAttendees(db: Executor, audience: string, source: AttendeeSource = attendeeSource()): Promise<SimAttendee[]> {
  const cfg = googleCalendarConfig();
  if (cfg && source === "allowlist") {
    return cfg.allowedAttendees.map((email) => ({ email, name: email, responseStatus: "needsAction" as const }));
  }
  const attendees = (await listRecipients(db, cfg !== null))
    .filter((u) => u.groups.includes(audience))
    .map((u) => ({ email: u.email, name: u.name, responseStatus: "needsAction" as const }));
  // Fiktivní adresy jsou nedoručitelné a do skutečných pozvánek nepatří. A naopak.
  if (cfg ? attendees.some(fictional) : !attendees.every(fictional)) throw new CalendarError("attendee_not_allowed", false);
  return attendees;
}

const fictional = (a: SimAttendee) => a.email.endsWith(SIMULATION_ATTENDEE_DOMAIN);

/**
 * Hosté zveřejněné akce podle individuální účasti (jen `PARTICIPATION=on`): povinní podle rolí bez
 * omluvených plus dobrovolně přihlášení (`desiredGuestIds`). Bez přepínače, u pevného seznamu testovacích
 * příjemců a bez snímku platí `audienceAttendees` beze změny. Omluvený se jen přestane zvát: Wiki za něj
 * v Googlu nenastavuje `declined` (O04, API to organizátorovi nezaručuje), jeho RSVP i ruční hosté zůstávají.
 */
export async function eventAttendees(db: Executor, eventId: string, snapshot: EventSnapshot, source: AttendeeSource = attendeeSource()): Promise<SimAttendee[]> {
  const cfg = googleCalendarConfig();
  if (!participationEnabled() || (cfg && source === "allowlist")) return audienceAttendees(db, snapshot.audience, source);
  const recipients = await listRecipients(db, cfg !== null);
  const rows = await db
    .select({ userId: eventParticipation.userId, kind: eventParticipation.kind, excuseReason: eventParticipation.excuseReason })
    .from(eventParticipation)
    .where(and(eq(eventParticipation.orgId, config.orgId), eq(eventParticipation.eventId, eventId)));
  // Do výpočtu jde jen druh záznamu. Důvod se tu nepoužívá a dál se nepředává.
  const records = new Map<string, ParticipationRecord>(rows.map((r) => [r.userId, { kind: r.kind, excuseReason: null }]));
  const wanted = new Set(desiredGuestIds(recipients.map((r) => ({ id: r.id, status: "active" as const, groups: r.groups })), snapshot, records));
  const attendees = recipients
    .filter((r) => wanted.has(r.id))
    .map((r) => ({ email: r.email, name: r.name, responseStatus: "needsAction" as const }));
  if (cfg ? attendees.some(fictional) : !attendees.every(fictional)) throw new CalendarError("attendee_not_allowed", false);
  return attendees;
}

export type GuestPlan = {
  add: SimAttendee[];
  /** Adresy k odebrání. Vždy jen ty, které dřív přidala Wiki. */
  remove: string[];
  /** Hosté, které po provedení plánu spravuje Wiki. */
  managed: string[];
};

/**
 * Porovná publikum s hosty v pozvánce. Přidá chybějící, odebere jen hosty spravované Wiki, kteří
 * už do publika nepatří. Host, kterého přidal člověk ručně, se nikdy nestane spravovaným.
 */
export function planGuests(desired: SimAttendee[], current: SimAttendee[], managed: readonly string[]): GuestPlan {
  const present = new Set(current.map((a) => a.email.toLowerCase()));
  const wanted = new Set(desired.map((a) => a.email.toLowerCase()));
  const add = desired.filter((a) => !present.has(a.email.toLowerCase()));
  const remove = managed.filter((email) => present.has(email) && !wanted.has(email));
  const kept = managed.filter((email) => present.has(email) && wanted.has(email));
  return { add, remove, managed: [...kept, ...add.map((a) => a.email.toLowerCase())] };
}

export const samePlan = (plan: GuestPlan) => plan.add.length === 0 && plan.remove.length === 0;

/**
 * Po změně skupin, role nebo stavu účtu vrátí do fronty budoucí zveřejněné akce dotčeného publika.
 * Proběhlé akce se nemění. Při pevném seznamu testovacích příjemců se hosté podle účtů neřídí.
 */
export async function requeueAttendeeSync(db: Executor, groups: readonly string[]): Promise<void> {
  if (!groups.length || (googleCalendarConfig() && attendeeSource() === "allowlist")) return;
  const affected = db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.orgId, config.orgId),
        gt(events.startsAt, now()),
        inArray(sql<string>`${events.published}->>'audience'`, [...groups]),
      ),
    );
  await db
    .update(calendarLinks)
    .set({ syncStatus: "pending", attempts: 0, errorCode: null, updatedAt: new Date() })
    .where(and(eq(calendarLinks.syncStatus, "synced"), inArray(calendarLinks.eventId, affected)));
}
