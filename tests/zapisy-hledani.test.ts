import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { events } from "@/server/db/schema";
import { listPublishedMinutes } from "@/server/services/journey";
import { processTranscriptionJob, publishMinutes, recordingPanel, uploadRecording } from "@/server/services/recordings";
import { PAST_FP, asFile, fixtureWav, lead, outsider, participant, resetDemo } from "./helpers";

beforeEach(async () => {
  const db = await resetDemo();
  await processTranscriptionJob(await uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "a.wav")));
  const panel = await recordingPanel(lead, (await db.select().from(events).where(eq(events.id, PAST_FP)))[0]!);
  if (panel.access !== "handler" || !panel.minutes) throw new Error("chybí návrh zápisu");
  await publishMinutes(lead, PAST_FP, panel.minutes.id, panel.minutes.version);
});

describe("hledání v zápisech a filtr podle tématu", () => {
  test("filtr tématu vrátí jen zápisy toho tématu, neznámé téma nevrátí nic", async () => {
    const [item] = await listPublishedMinutes(participant);
    expect(item).toMatchObject({ eventId: PAST_FP });
    expect(item!.topic).toBeTruthy();
    expect(await listPublishedMinutes(participant, { topic: item!.topic! })).toHaveLength(1);
    expect(await listPublishedMinutes(participant, { topic: "Téma, které neexistuje" })).toEqual([]);
  });

  test("hledání prochází celý text zápisu bez ohledu na diakritiku a ukáže nalezenou větu", async () => {
    const [item] = await listPublishedMinutes(participant);
    const word = item!.summary.split(/\s+/).find((w) => w.length > 5)!;
    const plain = word.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
    expect(await listPublishedMinutes(participant, { query: plain })).toHaveLength(1);
    expect(await listPublishedMinutes(participant, { query: "zzz-nic-takoveho" })).toEqual([]);
    for (const found of await listPublishedMinutes(participant, { query: plain })) expect(found.match).toBeNull();
  });

  test("kdo zápis nesmí číst, nenajde ho hledáním ani filtrem tématu", async () => {
    const [item] = await listPublishedMinutes(participant);
    expect(await listPublishedMinutes(outsider)).toEqual([]);
    expect(await listPublishedMinutes(outsider, { topic: item!.topic! })).toEqual([]);
    expect(await listPublishedMinutes(outsider, { query: item!.summary.slice(0, 12) })).toEqual([]);
  });
});
