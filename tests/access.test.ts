import { canHandleRecording } from "@/server/policy";
import { beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/server/db/client";
import { getEventDetail } from "@/server/services/detail";
import { DomainError } from "@/server/services/errors";
import { listMonth } from "@/server/services/events";
import { processTranscriptionJob, publishMinutes, readRecording, recordingPanel, uploadRecording } from "@/server/services/recordings";
import { loadEventRow } from "@/server/services/events";
import { PAST_FP, asFile, fixtureWav, lead, organizer, outsider, participant, resetDemo } from "./helpers";

const code = (promise: Promise<unknown>) => promise.then(() => "ok", (e: unknown) => (e instanceof DomainError ? e.code : String(e)));

beforeEach(resetDemo);

describe("přístup k akcím", () => {
  test("kolega vidí jen zveřejněné akce své skupiny", async () => {
    const ids = (await listMonth(participant, "2026-11")).map((c) => c.id);
    expect(ids).toContain(PAST_FP);
    expect(ids).not.toContain("tr-rm-1112"); // publikum RM
    expect(ids).not.toContain("ev-11-13"); // návrh
    const all = (await listMonth(organizer, "2026-11")).map((c) => c.id);
    expect(all).toContain("ev-11-13");
  });

  test("kolega mimo publikum nezíská detail ani přímým ID", async () => {
    expect(await getEventDetail(outsider, PAST_FP)).toBeNull();
    expect(await getEventDetail(participant, "neexistuje")).toBeNull();
    expect(await getEventDetail(participant, PAST_FP)).not.toBeNull();
  });
});

describe("přístup k nahrávce a zápisu", () => {
  test("účastník a kolega mimo publikum nahrát nesmí", async () => {
    expect(await code(uploadRecording(participant, PAST_FP, asFile(fixtureWav(), "a.wav")))).toBe("forbidden");
    expect(await code(uploadRecording(outsider, PAST_FP, asFile(fixtureWav(), "a.wav")))).toBe("not_found");
  });

  test("správce smí u cizí akce nahrát záznam a číst pracovní zápis (obě hodnoty role)", async () => {
    const row = (await loadEventRow(await getDb(), PAST_FP))!;
    expect(row.published?.leadId).not.toBe(organizer.id);
    for (const role of ["organizer", "admin"] as const) expect(canHandleRecording({ ...organizer, role }, row)).toBe(true);
    expect(canHandleRecording(participant, row)).toBe(false);
    const jobId = await uploadRecording(organizer, PAST_FP, asFile(fixtureWav(), "spravce.wav"));
    expect(jobId).toBeTruthy();
    expect((await readRecording(organizer, PAST_FP)).data.byteLength).toBeGreaterThan(0);
  });

  test("audio a pracovní zápis vidí jen vedoucí, zveřejněný zápis publikum", async () => {
    const jobId = await uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "trenink.wav"));
    await processTranscriptionJob(jobId);

    expect((await readRecording(lead, PAST_FP)).data.byteLength).toBeGreaterThan(0);
    expect(await code(readRecording(participant, PAST_FP))).toBe("forbidden");
    expect(await code(readRecording(outsider, PAST_FP))).toBe("not_found");

    const row = (await loadEventRow(await getDb(), PAST_FP))!;
    const draftView = await recordingPanel(participant, row);
    expect(draftView).toEqual({ access: "reader", state: "processing", minutes: null, publishedAt: null });
    expect((await recordingPanel(outsider, row)).access).toBe("none");

    const handler = await recordingPanel(lead, row);
    if (handler.access !== "handler" || !handler.minutes) throw new Error("chybí návrh zápisu");
    await publishMinutes(lead, PAST_FP, handler.minutes.id, handler.minutes.version);

    const published = await recordingPanel(participant, row);
    expect(published.access === "reader" && published.minutes?.summary).toBeTruthy();
    expect(JSON.stringify(published)).not.toContain("Today in our internal training"); // bez přepisu
    expect((await recordingPanel(outsider, row)).access).toBe("none");
  });
});
