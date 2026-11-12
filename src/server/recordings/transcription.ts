import { z } from "zod";
import type { MinutesContent } from "@/lib/types";
import { getDb } from "@/server/db/client";
import { readSwitch, simulatedLatency } from "@/server/settings";

export type Transcript = {
  text: string;
  /** Časové značky jen tehdy, když je poskytovatel opravdu vrátí. Nikdy se nedopočítávají. */
  segments: Array<{ startSec: number; endSec: number; text: string }>;
};

export class TranscriptionError extends Error {
  constructor(readonly code: "unsupported_fixture" | "transcription_unavailable" | "invalid_output") {
    super(code);
    this.name = "TranscriptionError";
  }
}

/**
 * Poskytovatel přepisu a shrnutí. Skutečný adaptér (schválená služba v testovacím režimu)
 * implementuje stejné rozhraní. Výstup modelu je nedůvěryhodný a vždy prochází minutesSchema.
 */
export interface TranscriptionProvider {
  transcribe(audio: Uint8Array, sha256: string): Promise<Transcript>;
  summarize(transcript: Transcript, context: { label: string; topicTitle: string | null }): Promise<unknown>;
}

const line = z.string().trim().min(1).max(500);
export const minutesSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    keyPoints: z.array(line).max(20),
    decisions: z.array(line).max(20),
    nextSteps: z.array(line).max(20),
  })
  .strict();

export function validateMinutes(output: unknown): MinutesContent {
  const parsed = minutesSchema.safeParse(output);
  if (!parsed.success) throw new TranscriptionError("invalid_output");
  return parsed.data;
}

// Deterministická ukázka: zná jen přiloženou syntetickou nahrávku (otisk SHA-256).
// Obsah odpovídá demo/PREPIS_FIXTURE.md. Další termín nebyl domluven, žádné datum se nedomýšlí.
export const FIXTURE_SHA256 = "914e0645e5a3d030eb4df53c183f36d904e429fe388f45bb4a7adbc48556f06f";

const FIXTURE_TRANSCRIPT =
  "Today in our internal training, we discussed preparing for a first meeting. " +
  "We agreed to check the materials and prepare three open questions before the meeting. " +
  "Clara will add the checklist to the team wiki by Friday. The next session has not been scheduled yet.";

const FIXTURE_MINUTES: MinutesContent = {
  summary: "Interní trénink k přípravě na úvodní schůzku.",
  keyPoints: [
    "Před úvodní schůzkou zkontrolovat podklady.",
    "Připravit tři otevřené otázky.",
    "Další termín zatím nebyl domluven.",
  ],
  decisions: ["Před schůzkou zkontrolujeme podklady a připravíme tři otevřené otázky."],
  nextSteps: ["Klára doplní kontrolní seznam do týmové Wiki, termín do pátku."],
};

export class FixtureTranscription implements TranscriptionProvider {
  private async gate(): Promise<void> {
    await simulatedLatency();
    if (await readSwitch(await getDb(), "transcription.outage")) throw new TranscriptionError("transcription_unavailable");
  }

  async transcribe(_audio: Uint8Array, sha256: string): Promise<Transcript> {
    await this.gate();
    if (sha256 !== FIXTURE_SHA256) throw new TranscriptionError("unsupported_fixture");
    return { text: FIXTURE_TRANSCRIPT, segments: [] };
  }

  async summarize(transcript: Transcript): Promise<unknown> {
    await this.gate();
    if (transcript.text !== FIXTURE_TRANSCRIPT) throw new TranscriptionError("unsupported_fixture");
    return structuredClone(FIXTURE_MINUTES);
  }
}

export function transcriptionProvider(): TranscriptionProvider {
  return new FixtureTranscription();
}

/**
 * Doporučení šablony zápisu podle přepisu. Jen signalizuje, nikdy nemění akci, publikum ani přístup.
 */
export function detectTemplate(text: string): "training" | "course" | "meeting" | "unknown" {
  const t = text.toLowerCase();
  const has = (words: string) => new RegExp(`(?<!\\p{L})(${words})(?!\\p{L})`, "u").test(t);
  if (has("training|trénink|rozbor|role-?play")) return "training";
  if (has("course|školení|seminar|seminář|workshop|lecture")) return "course";
  if (has("meeting|schůzka|porada|standup")) return "meeting";
  return "unknown";
}

export function expectedTemplate(eventType: string): "training" | "course" | "meeting" {
  if (["training-fp", "training-rm", "portfolio"].includes(eventType)) return "training";
  if (["education-fp", "education-rm", "two-day", "workshop"].includes(eventType)) return "course";
  return "meeting";
}
