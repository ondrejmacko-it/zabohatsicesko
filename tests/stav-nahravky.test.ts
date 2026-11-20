import { beforeEach, describe, expect, it } from "vitest";
import { formatEventWhen } from "@/lib/time";
import { getDb } from "@/server/db/client";
import { processTranscriptionJob, recordingPanel, uploadRecording } from "@/server/services/recordings";
import { listMissingMinutes, listTasks, progressOf } from "@/server/services/journey";
import { loadEventRow } from "@/server/services/events";
import { PAST_FP, asFile, fixtureWav, lead, participant, resetDemo, silentWav } from "./helpers";

beforeEach(resetDemo);

// A03: Plán (úkoly), okno Zápisy k dokončení, detail i čtenář ukazují stejný stav nahrávky.
describe("stav nahrávky napříč obrazovkami", () => {
  it("rozlišuje selhání služby a nepodporovaný soubor", () => {
    expect(progressOf(null, "failed", "transcription_unavailable")).toBe("failed");
    expect(progressOf(null, "failed", "unsupported_fixture")).toBe("unsupported");
    expect(progressOf(null, "queued", null)).toBe("processing");
    expect(progressOf("draft", "done", null)).toBe("draft");
    expect(progressOf("draft", null, null, false)).toBe("started");
    expect(progressOf("published", "done", null)).toBe("published");
  });

  it("nepodporovaný soubor: úkol i výběr nabídnou jinou nahrávku, čtenář jen neutrální stav", async () => {
    const jobId = await uploadRecording(lead, PAST_FP, asFile(silentWav(), "jine.wav"));
    await processTranscriptionJob(jobId);

    const picker = await listMissingMinutes(lead);
    expect(picker.items.find((i) => i.eventId === PAST_FP)?.state).toBe("unsupported");
    const task = (await listTasks(lead)).find((t) => t.href.includes(PAST_FP));
    expect(task?.action).toBe("Vybrat jinou nahrávku");

    const row = (await loadEventRow(await getDb(), PAST_FP))!;
    expect(await recordingPanel(lead, row)).toMatchObject({ state: "failed", errorCode: "unsupported_fixture" });
    expect(await recordingPanel(participant, row)).toMatchObject({ access: "reader", minutes: null });
  });

  it("návrh zápisu je ve výběru i v úkolech vedoucího k dokončení", async () => {
    const jobId = await uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "trenink.wav"));
    await processTranscriptionJob(jobId);
    expect((await listMissingMinutes(lead)).items.find((i) => i.eventId === PAST_FP)?.state).toBe("draft");
    expect((await listTasks(lead)).find((t) => t.href.includes(PAST_FP))?.action).toBe("Dokončit zápis");
  });
});

// T03: detail i náhled formátují datum stejně a u vícedenní akce neopakují první datum.
describe("datum akce", () => {
  const at = (iso: string) => new Date(iso);
  it("jednodenní, vícedenní a celodenní", () => {
    expect(formatEventWhen(at("2026-11-12T09:00:00+01:00"), at("2026-11-12T11:00:00+01:00"), false)).toBe("čt 12. 11. 2026 · 09:00–11:00");
    expect(formatEventWhen(at("2026-11-12T09:00:00+01:00"), at("2026-11-13T16:00:00+01:00"), false)).toBe("čt 12. 11. 09:00 – pá 13. 11. 2026 16:00");
    expect(formatEventWhen(at("2026-12-21T00:00:00+01:00"), at("2026-12-24T00:00:00+01:00"), true)).toBe("po 21. 12. – st 23. 12. 2026");
    expect(formatEventWhen(at("2026-11-12T00:00:00+01:00"), at("2026-11-13T00:00:00+01:00"), true)).toBe("čt 12. 11. 2026 · celý den");
  });
});
