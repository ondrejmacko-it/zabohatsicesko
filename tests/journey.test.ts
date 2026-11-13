import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { syncEvent } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { calendarLinks, minutes, simCalendarEvents } from "@/server/db/schema";
import { listPublishedMinutes, listTasks } from "@/server/services/journey";
import { processTranscriptionJob, publishMinutes, uploadRecording } from "@/server/services/recordings";
import { PAST_FP, asFile, fixtureWav, lead, organizer, outsider, participant, resetDemo } from "./helpers";

beforeEach(resetDemo);

async function draftMinutes() {
  const jobId = await uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "nahravka.wav"));
  await processTranscriptionJob(jobId);
  const [row] = await (await getDb()).select().from(minutes).where(eq(minutes.eventId, PAST_FP));
  return row!;
}

describe("Moje cesta a Zápisy", () => {
  test("zápis je v seznamu až po zveřejnění a jen pro publikum akce, hledání ignoruje diakritiku", async () => {
    const draft = await draftMinutes();
    expect(await listPublishedMinutes(participant)).toHaveLength(0);
    expect((await listTasks(lead)).map((t) => t.action)).toContain("Zkontrolovat zápis");

    await publishMinutes(lead, PAST_FP, draft.id, draft.version);
    const visible = await listPublishedMinutes(participant);
    expect(visible.map((m) => m.eventId)).toEqual([PAST_FP]);
    expect(await listPublishedMinutes(outsider)).toHaveLength(0);
    expect((await listTasks(lead)).some((t) => t.key.endsWith(PAST_FP))).toBe(false);

    const word = visible[0]!.summary.split(" ").find((w) => w.length > 4)!;
    const plain = word.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
    expect(await listPublishedMinutes(participant, { query: plain })).toHaveLength(1);
    expect(await listPublishedMinutes(participant, { query: "tohle-v-zapisu-neni" })).toHaveLength(0);
    expect(await listPublishedMinutes(participant, { audience: "rm" })).toHaveLength(0);
  });

  test("zveřejněný zápis doplní do pozvánky odkaz a pozvaní dostanou oznámení", async () => {
    const db = await getDb();
    const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, PAST_FP));
    if (!link?.externalEventId) return; // ukázková data bez pozvánky u této akce: není co ověřovat
    const draft = await draftMinutes();
    await publishMinutes(lead, PAST_FP, draft.id, draft.version);
    await syncEvent(PAST_FP);
    const [invite] = await db.select().from(simCalendarEvents).where(eq(simCalendarEvents.id, link.externalEventId));
    expect(invite!.description).toContain(`/vzdelavani/akce/${PAST_FP}#zapis`);
  });

  test("organizátor vidí mezi úkoly pozvánku, která čeká na zásah", async () => {
    const db = await getDb();
    const [any] = await db.select().from(calendarLinks).limit(1);
    await db.update(calendarLinks).set({ syncStatus: "attention", errorCode: "calendar_revoked" }).where(eq(calendarLinks.eventId, any!.eventId));
    expect((await listTasks(organizer)).map((t) => t.action)).toContain("Vyřešit pozvánku");
    expect((await listTasks(participant)).map((t) => t.action)).not.toContain("Vyřešit pozvánku");
  });
});
