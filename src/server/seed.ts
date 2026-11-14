import { calendarMode } from "@/server/config";
import { ne, sql } from "drizzle-orm";
import seed from "../../demo/seed.json";
import { isoWeekday, toDateKey } from "@/lib/time";
import type { Role } from "@/lib/types";
import type { Executor } from "@/server/db/client";
import {
  calendarLinks,
  eventRevisions,
  events,
  simCalendarEvents,
  templateSlots,
  topicInterests,
  topics,
  integrationCredentials,
  userIdentities,
  users,
} from "@/server/db/schema";
import { calendarSummary, snapshotOf } from "@/server/domain/snapshot";
import { generationKey } from "@/server/domain/generation";

export const DEMO_CALENDAR_ID = "zbc-demo-test-calendar";
export const demoEmail = (userId: string) => `${userId}@example.invalid`;

/** Nahraje fiktivní data z demo/seed.json. Volá se jen nad prázdnou databází. */
export async function seedDatabase(tx: Executor): Promise<void> {
  const orgId = seed.organization;
  const nameOf = (id: string) => seed.users.find((u) => u.id === id)?.name ?? id;

  await tx.insert(users).values(
    seed.users.map((u) => ({
      id: u.id,
      orgId,
      name: u.name,
      email: demoEmail(u.id),
      role: u.role as Role,
      groups: u.groups,
    })),
  );

  await tx.insert(templateSlots).values(
    seed.weeklyTemplate.map((slot) => ({
      orgId,
      isoWeekday: slot.isoWeekday,
      startTime: slot.start,
      endTime: slot.end,
      types: slot.types,
      active: true,
    })),
  );

  await tx.insert(topics).values(seed.topics.map((t) => ({ id: t.id, orgId, name: t.name, audience: t.audience })));
  const interests = seed.topics.flatMap((t) => t.interestedUserIds.map((userId) => ({ topicId: t.id, userId })));
  if (interests.length) await tx.insert(topicInterests).values(interests);

  const slotDays = new Set(seed.weeklyTemplate.map((slot) => slot.isoWeekday));
  const topicByName = new Map(seed.topics.map((t) => [t.name.toLowerCase(), t.id]));

  for (const e of seed.events) {
    const startsAt = new Date(e.startsAt);
    const dateKey = toDateKey(startsAt);
    const row = {
      id: e.id,
      orgId,
      // Importovaná akce ve slotu šablony obsadí slot, aby ho přegenerování nezdvojilo.
      generationKey: slotDays.has(isoWeekday(dateKey)) ? generationKey(orgId, isoWeekday(dateKey), dateKey) : null,
      origin: "import" as const,
      calendarIntent: e.type === "holiday" ? ("none" as const) : ("pair" as const),
      type: e.type,
      label: e.label,
      topicTitle: e.topic,
      topicId: e.topic ? (topicByName.get(e.topic.toLowerCase()) ?? null) : null,
      startsAt,
      endsAt: new Date(e.endsAt),
      allDay: e.allDay,
      audience: e.audience,
      leadId: e.leadId,
      reviewerId: null,
      status: e.status as "draft" | "published" | "cancelled",
      cancelReason: null,
      revision: 1,
    };
    const snapshot = snapshotOf(row);
    const isPublic = row.status !== "draft";
    await tx.insert(events).values({
      ...row,
      publishedRevision: isPublic ? 1 : null,
      published: isPublic ? snapshot : null,
    });
    await tx.insert(eventRevisions).values({ eventId: e.id, revision: 1, action: "import", snapshot });

    // Ukázkové pozvánky patří simulaci. V testovacím režimu Googlu začínají akce bez vazby a správce je spáruje.
    if (calendarMode() === "simulation" && "calendarFixture" in e && e.calendarFixture) {
      const fixture = e.calendarFixture;
      const summary = calendarSummary(snapshot);
      await tx.insert(simCalendarEvents).values({
        id: fixture.id,
        calendarId: DEMO_CALENDAR_ID,
        summary,
        description: "",
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        status: "confirmed",
        attendees: fixture.attendees.map((a) => ({
          email: demoEmail(a.userId),
          name: nameOf(a.userId),
          responseStatus: a.response as "accepted",
        })),
        meetingUrl: fixture.meetingUrl,
        sequence: 0,
      });
      await tx.insert(calendarLinks).values({
        eventId: e.id,
        calendarId: DEMO_CALENDAR_ID,
        externalEventId: fixture.id,
        syncedRevision: 1,
        syncedFields: {
          summary,
          startsAt: snapshot.startsAt,
          endsAt: snapshot.endsAt,
          cancelled: false,
        },
        syncStatus: "synced",
        attempts: 0,
      });
    }
  }
}

const TABLES = [
  "rate_limits", "audit_log", "minutes", "transcription_jobs", "recording_blobs", "recordings",
  "sim_calendar_notifications", "sim_calendar_events", "integration_settings", "calendar_links",
  "generation_exclusions", "event_revisions", "events", "topic_interests", "topics", "template_slots", "users",
];

/** Smaže všechna data dema a nahraje seed znovu. Jedna transakce, buď vše, nebo nic. */
export async function resetDatabase(tx: Executor): Promise<void> {
  // Skutečné účty (pozvánky a žádosti), vazby na Google ani připojení Kalendáře nejsou ukázková data.
  // Všechno odkazuje na uživatele, takže je TRUNCATE … CASCADE smaže. Bez obnovení by obnova
  // odhlásila lidi, zahodila jim přidělené role a odpojila Kalendář. Jejich zájmy o témata se obnoví do seedu.
  const realUsers = await tx.select().from(users).where(ne(users.origin, "demo"));
  const identities = await tx.select().from(userIdentities);
  const credentials = await tx.select().from(integrationCredentials);
  await tx.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`));
  await seedDatabase(tx);
  if (realUsers.length) await tx.insert(users).values(realUsers);
  const known = new Set([...seed.users.map((u) => u.id), ...realUsers.map((u) => u.id)]);
  const kept = identities.filter((identity) => known.has(identity.userId));
  if (kept.length) await tx.insert(userIdentities).values(kept);
  if (credentials.length) {
    await tx
      .insert(integrationCredentials)
      .values(credentials.map((c) => ({ ...c, connectedBy: c.connectedBy && known.has(c.connectedBy) ? c.connectedBy : null })));
  }
}
