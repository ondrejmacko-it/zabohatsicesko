import { randomUUID } from "node:crypto";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { SimAttendee } from "@/lib/types";
import type { Executor } from "@/server/db/client";
import { simCalendarEvents, simCalendarNotifications } from "@/server/db/schema";
import { readSwitch, simulatedLatency } from "@/server/settings";
import { CalendarError, type CalendarProvider, type ExternalEvent, type GuestChange, type ManagedEventData } from "./provider";

type SimRow = typeof simCalendarEvents.$inferSelect;

const toExternal = (row: SimRow): ExternalEvent => ({
  id: row.id,
  summary: row.summary,
  description: row.description,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  cancelled: row.status === "cancelled",
  attendees: row.attendees,
  meetingUrl: row.meetingUrl,
});

/**
 * Simulace Google Kalendáře nad vlastními tabulkami. Chová se jako správcovská kopie události:
 * drží identitu, hosty s RSVP a odkaz na schůzku, číslo sekvence a záznam odeslaných oznámení.
 */
export class SimulatedCalendar implements CalendarProvider {
  constructor(private readonly db: Executor) {}

  private async gate(): Promise<void> {
    await simulatedLatency();
    if (await readSwitch(this.db, "calendar.revoked")) throw new CalendarError("calendar_revoked", false);
    if (await readSwitch(this.db, "calendar.outage")) throw new CalendarError("calendar_unavailable", true);
  }

  async get(calendarId: string, eventId: string): Promise<ExternalEvent | null> {
    await this.gate();
    const [row] = await this.db
      .select()
      .from(simCalendarEvents)
      .where(and(eq(simCalendarEvents.calendarId, calendarId), eq(simCalendarEvents.id, eventId)))
      .limit(1);
    return row ? toExternal(row) : null;
  }

  async findByKey(calendarId: string, key: string): Promise<ExternalEvent | null> {
    await this.gate();
    const [row] = await this.db
      .select()
      .from(simCalendarEvents)
      .where(and(eq(simCalendarEvents.calendarId, calendarId), eq(simCalendarEvents.idempotencyKey, key)))
      .limit(1);
    return row ? toExternal(row) : null;
  }

  async create(calendarId: string, key: string, data: ManagedEventData, attendees: SimAttendee[]): Promise<ExternalEvent> {
    await this.gate();
    const [row] = await this.db
      .insert(simCalendarEvents)
      .values({
        id: `sim_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
        calendarId,
        idempotencyKey: key,
        summary: data.summary,
        description: data.description,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: data.cancelled ? "cancelled" : "confirmed",
        attendees,
        sequence: 0,
      })
      // Stejný klíč vytvoření vrátí existující událost, druhá pozvánka nevznikne.
      .onConflictDoUpdate({ target: simCalendarEvents.idempotencyKey, set: { idempotencyKey: key } })
      .returning();
    if (!row) throw new CalendarError("calendar_unavailable", true);
    await this.notify(row, "created");
    return toExternal(row);
  }

  async patch(calendarId: string, eventId: string, data: ManagedEventData, guests?: GuestChange): Promise<ExternalEvent> {
    await this.gate();
    const where = and(eq(simCalendarEvents.calendarId, calendarId), eq(simCalendarEvents.id, eventId));
    let attendees: SimAttendee[] | undefined;
    if (guests && (guests.add.length || guests.remove.length)) {
      const [current] = await this.db.select({ attendees: simCalendarEvents.attendees }).from(simCalendarEvents).where(where).limit(1);
      if (!current) throw new CalendarError("calendar_missing", false);
      const removed = new Set(guests.remove);
      attendees = [...current.attendees.filter((a) => !removed.has(a.email.toLowerCase())), ...guests.add];
    }
    const [row] = await this.db
      .update(simCalendarEvents)
      .set({
        ...(attendees ? { attendees } : {}),
        summary: data.summary,
        description: data.description,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: data.cancelled ? "cancelled" : "confirmed",
        sequence: sql`${simCalendarEvents.sequence} + 1`,
        updatedAt: new Date(),
      })
      .where(where)
      .returning();
    if (!row) throw new CalendarError("calendar_missing", false);
    await this.notify(row, data.cancelled ? "cancelled" : "updated");
    return toExternal(row);
  }

  async listBetween(calendarId: string, from: Date, to: Date): Promise<ExternalEvent[]> {
    await this.gate();
    const rows = await this.db
      .select()
      .from(simCalendarEvents)
      .where(and(eq(simCalendarEvents.calendarId, calendarId), lt(simCalendarEvents.startsAt, to), gte(simCalendarEvents.endsAt, from)));
    return rows.map(toExternal);
  }

  /** Odpovídá sendUpdates=all. Jedna zpráva na sekvenci, opakování ji nezdvojí. */
  private async notify(row: SimRow, kind: "created" | "updated" | "cancelled"): Promise<void> {
    await this.db
      .insert(simCalendarNotifications)
      .values({ externalEventId: row.id, sequence: row.sequence, kind, recipients: row.attendees.length })
      .onConflictDoNothing();
  }
}

/** Jen pro předvedení: změní název přímo „v Google“, jako by to udělal člověk mimo Wiki. */
export async function simulateManualEdit(db: Executor, externalEventId: string): Promise<void> {
  await db
    .update(simCalendarEvents)
    .set({ summary: sql`${simCalendarEvents.summary} || ' (upraveno v Kalendáři)'`, updatedAt: new Date() })
    .where(eq(simCalendarEvents.id, externalEventId));
}

/** Kontrolní pohled ukázky: oznámení, která by Google poslal pozvaným. */
export async function listNotifications(db: Executor, externalEventId: string) {
  return db
    .select()
    .from(simCalendarNotifications)
    .where(eq(simCalendarNotifications.externalEventId, externalEventId))
    .orderBy(simCalendarNotifications.sequence);
}
