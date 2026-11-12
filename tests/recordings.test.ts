import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/server/db/client";
import { minutes, recordingBlobs, recordings, transcriptionJobs } from "@/server/db/schema";
import { inspectAudio } from "@/server/recordings/audio";
import { detectTemplate } from "@/server/recordings/transcription";
import { DomainError } from "@/server/services/errors";
import { loadEventRow } from "@/server/services/events";
import {
  processTranscriptionJob,
  recordingPanel,
  retryTranscription,
  updateMinutes,
  uploadRecording,
} from "@/server/services/recordings";
import { writeSwitch } from "@/server/settings";
import { PAST_FP, PUBLISHED_RM, asFile, fixtureWav, lead, resetDemo, silentWav } from "./helpers";

beforeEach(resetDemo);

const code = (fn: () => unknown) => {
  try {
    fn();
    return "ok";
  } catch (e) {
    return e instanceof DomainError ? e.code : String(e);
  }
};

describe("validace souboru", () => {
  test("pozná WAV podle obsahu a změří délku", () => {
    expect(inspectAudio(fixtureWav(), "trenink.WAV")).toEqual({ format: "wav", mimeType: "audio/wav", durationSec: 14 });
  });

  test("odmítne falešnou příponu, poškozený a příliš velký soubor", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]);
    expect(code(() => inspectAudio(png, "nahravka.wav"))).toBe("file_type");
    expect(code(() => inspectAudio(fixtureWav(), "nahravka.mp3"))).toBe("file_type");
    expect(code(() => inspectAudio(fixtureWav(), "nahravka.exe"))).toBe("file_type");
    expect(code(() => inspectAudio(fixtureWav().slice(0, 100), "nahravka.wav"))).toBe("file_corrupt");
    expect(code(() => inspectAudio(new Uint8Array(4 * 1024 * 1024 + 1), "nahravka.wav"))).toBe("file_too_large");
    const long = silentWav(1, 8000);
    new DataView(long.buffer).setUint32(28, 1, true); // byteRate neodpovídá formátu
    expect(code(() => inspectAudio(long, "nahravka.wav"))).toBe("file_corrupt");
  });

  test("projde hlavičky MP3 rámců a M4A boxy", () => {
    const frame = new Uint8Array(417);
    frame.set([0xff, 0xfb, 0x90, 0x00]); // MPEG-1 Layer III, 128 kbit/s, 44,1 kHz
    const mp3 = new Uint8Array(417 * 120);
    for (let i = 0; i < 120; i++) mp3.set(frame, i * 417);
    expect(inspectAudio(mp3, "a.mp3")).toMatchObject({ format: "mp3", durationSec: 3 });

    const box = (type: string, body: Uint8Array) => {
      const out = new Uint8Array(8 + body.length);
      new DataView(out.buffer).setUint32(0, out.length);
      out.set([...type].map((c) => c.charCodeAt(0)), 4);
      out.set(body, 8);
      return out;
    };
    const mvhdBody = new Uint8Array(100);
    new DataView(mvhdBody.buffer).setUint32(12, 1000);
    new DataView(mvhdBody.buffer).setUint32(16, 65_000);
    const ftyp = box("ftyp", new Uint8Array([..."M4A ".split("").map((c) => c.charCodeAt(0)), 0, 0, 0, 0]));
    const m4a = new Uint8Array([...ftyp, ...box("moov", box("mvhd", mvhdBody)), ...box("mdat", new Uint8Array(10))]);
    expect(inspectAudio(m4a, "a.m4a")).toMatchObject({ format: "m4a", durationSec: 65 });
    new DataView(m4a.buffer).setUint32(ftyp.length + 16 + 16, 20 * 60 * 1000); // 20 minut
    expect(code(() => inspectAudio(m4a, "a.m4a"))).toBe("file_too_long");
  });
});

describe("zpracování nahrávky", () => {
  test("testovací nahrávka projde až k návrhu zápisu bez vymyšlených údajů", async () => {
    const jobId = await uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "trenink.wav"));
    await processTranscriptionJob(jobId);
    await processTranscriptionJob(jobId); // opakované doručení úlohy

    const db = await getDb();
    const rows = await db.select().from(minutes).where(eq(minutes.eventId, PAST_FP));
    expect(rows).toHaveLength(1);
    const content = rows[0]!.content;
    expect(content.summary).toContain("úvodní schůzku");
    expect(content.nextSteps.join(" ")).toContain("Klára");
    expect(content.keyPoints.join(" ")).toContain("Další termín zatím nebyl domluven");
    expect(JSON.stringify(content)).not.toMatch(/\d{1,2}\.\s?\d{1,2}\./); // žádné domyšlené datum
    expect(rows[0]).toMatchObject({ status: "draft", detectedTemplate: "training", templateMismatch: false });
  });

  test("jiné audio v ukázkovém režimu skončí čitelnou chybou", async () => {
    const jobId = await uploadRecording(lead, PAST_FP, asFile(silentWav(), "jine.wav"));
    await processTranscriptionJob(jobId);
    const panel = await recordingPanel(lead, (await loadEventRow(await getDb(), PAST_FP))!);
    expect(panel).toMatchObject({ access: "handler", state: "failed", errorCode: "unsupported_fixture" });
  });

  test("výpadek přepisu jde zopakovat a výsledek se nezdvojí", async () => {
    const db = await getDb();
    await writeSwitch(db, "transcription.outage", true);
    const jobId = await uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "trenink.wav"));
    await processTranscriptionJob(jobId);
    expect((await db.select().from(transcriptionJobs))[0]).toMatchObject({ status: "failed", errorCode: "transcription_unavailable" });

    await writeSwitch(db, "transcription.outage", false);
    await processTranscriptionJob(await retryTranscription(lead, PAST_FP));
    expect(await db.select().from(minutes)).toHaveLength(1);
  });

  test("nahrazení audia: starší úloha nepřepíše novější výsledek a starý soubor zmizí", async () => {
    const db = await getDb();
    const oldJob = await uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "prvni.wav"));
    const newJob = await uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "druha.wav"));
    await processTranscriptionJob(oldJob);
    expect(await db.select().from(minutes)).toHaveLength(0);
    await processTranscriptionJob(newJob);
    const rows = await db.select().from(minutes);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.jobId).toBe(newJob);
    expect(await db.select().from(recordingBlobs)).toHaveLength(1);
    expect((await db.select().from(recordings)).filter((r) => r.supersededAt === null)).toHaveLength(1);
  });

  test("nahrávku nelze přidat k akci, která ještě neproběhla", async () => {
    await expect(uploadRecording(lead, PUBLISHED_RM, asFile(fixtureWav(), "a.wav"))).rejects.toMatchObject({ code: "not_past" });
  });

  test("souběžná úprava zápisu se starší verzí neprojde a výstup se validuje", async () => {
    await processTranscriptionJob(await uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "a.wav")));
    const [row] = await (await getDb()).select().from(minutes);
    const content = { summary: "Opraveno", keyPoints: ["Bod"], decisions: [], nextSteps: [] };
    await updateMinutes(lead, PAST_FP, row!.id, 1, content);
    await expect(updateMinutes(lead, PAST_FP, row!.id, 1, content)).rejects.toMatchObject({ code: "conflict" });
    await expect(updateMinutes(lead, PAST_FP, row!.id, 2, { ...content, summary: "" })).rejects.toThrow();
  });

  test("rozpoznání typu jen doporučuje šablonu", () => {
    expect(detectTemplate("V tréninku jsme dělali rozbor schůzky")).toBe("training");
    expect(detectTemplate("Dnešní školení o investicích")).toBe("course");
    expect(detectTemplate("Bez klíčových slov")).toBe("unknown");
  });
});
