import { calendarMode, isLiveWiki } from "@/server/config";
import { createHash } from "node:crypto";
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
  minutes,
  recordingBlobs,
  recordings,
  transcriptionJobs,
  userIdentities,
  users,
} from "@/server/db/schema";
import { calendarSummary, snapshotOf } from "@/server/domain/snapshot";
import { generationKey } from "@/server/domain/generation";

export const DEMO_CALENDAR_ID = "zbc-demo-test-calendar";
export const demoEmail = (userId: string) => `${userId}@example.invalid`;

/** Pravidelný týden ze seedu. Sdílí ho ukázka i ostrá Wiki. */
async function insertWeeklyTemplate(tx: Executor): Promise<void> {
  await tx.insert(templateSlots).values(
    seed.weeklyTemplate.map((slot) => ({
      orgId: seed.organization,
      isoWeekday: slot.isoWeekday,
      startTime: slot.start,
      endTime: slot.end,
      types: slot.types,
      active: true,
    })),
  );
}

/**
 * Základ ostré Wiki (`WIKI_MODE=production`) nad prázdnou databází: jen pravidelný týden. Skupiny jsou
 * pevně v kódu (`GROUPS`), takže je zakládat netřeba. Žádné fiktivní osoby, akce ani témata.
 * Prvního správce založí přihlášení Googlem s adresou z `BOOTSTRAP_ADMIN_EMAILS`.
 */
export async function seedProductionBase(tx: Executor): Promise<void> {
  await insertWeeklyTemplate(tx);
}

/** Nahraje fiktivní data z demo/seed.json. Volá se jen nad prázdnou databází. */
export async function seedDatabase(tx: Executor): Promise<void> {
  // Druhá pojistka vedle `prepareDatabase`: ostrá Wiki fiktivní data nikdy nedostane.
  if (isLiveWiki()) throw new Error("Fiktivní seed je v ostré Wiki (WIKI_MODE=production) zakázaný.");
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

  await insertWeeklyTemplate(tx);

  await tx.insert(topics).values(
    seed.topics.map((t) => ({ id: t.id, orgId, name: t.name, audience: t.audience, priorityRank: "priorityRank" in t ? t.priorityRank : null })),
  );
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

  await insertPublishedMinutes(tx, orgId);
}

/** Krátké ticho ve formátu WAV (8 kHz, 8 bit, mono): ukázkový zápis má nahrávku, kterou jde stáhnout. */
function silentWav(seconds: number): Buffer {
  const rate = 8000;
  const samples = rate * seconds;
  const wav = Buffer.alloc(44 + samples, 0x80);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples, 40);
  return wav;
}

/**
 * Zveřejněné zápisy ukázky: hotový průchod nahrávka → přepis → zápis, aby čtenář hned viděl, jak zápis
 * vypadá. Zápis k ukázkové nahrávce (`recordingFixture`) se dál vytváří až nahráním.
 */
async function insertPublishedMinutes(tx: Executor, orgId: string): Promise<void> {
  for (const m of seed.publishedMinutes) {
    const data = silentWav(1);
    const id = `demo-${m.eventId}`;
    const publishedAt = new Date(m.publishedAt);
    await tx.insert(recordingBlobs).values({ storageKey: id, data });
    await tx.insert(recordings).values({
      id,
      orgId,
      eventId: m.eventId,
      storageKey: id,
      originalName: "ukazkovy-zaznam.wav",
      mimeType: "audio/wav",
      sizeBytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
      durationSec: 1,
      uploadedBy: m.uploadedBy,
      createdAt: publishedAt,
    });
    await tx.insert(transcriptionJobs).values({ id, orgId, eventId: m.eventId, recordingId: id, status: "done", attempts: 1, createdAt: publishedAt, updatedAt: publishedAt });
    await tx.insert(minutes).values({
      id,
      orgId,
      eventId: m.eventId,
      recordingId: id,
      jobId: id,
      transcript: m.transcript,
      content: m.content,
      detectedTemplate: "course",
      templateMismatch: false,
      status: "published",
      version: 1,
      updatedBy: m.uploadedBy,
      publishedBy: m.uploadedBy,
      publishedAt,
      source: "recording",
      approvedVersion: 1,
      approvedBy: m.uploadedBy,
      approvedAt: publishedAt,
      createdAt: publishedAt,
    });
  }
}

const TABLES = [
  "rate_limits", "audit_log", "minutes", "transcription_jobs", "recording_blobs", "recordings",
  "sim_calendar_notifications", "sim_calendar_events", "integration_settings", "calendar_links",
  "calendar_responses", "calendar_sync_state", "calendar_worker_runs",
  "generation_exclusions", "event_revisions", "events", "topic_interests", "topics", "template_slots", "users",
];

/** Smaže všechna data dema a nahraje seed znovu. Jedna transakce, buď vše, nebo nic. */
export async function resetDatabase(tx: Executor): Promise<void> {
  // Pojistka pro všechny cesty (tlačítko, `npm run db:reset`): ostrá Wiki se nikdy nepřepíše seedem.
  if (isLiveWiki()) throw new Error("Obnova ukázkových dat je v ostré Wiki (WIKI_MODE=production) zakázaná.");
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
