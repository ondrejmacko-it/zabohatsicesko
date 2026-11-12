import { readFileSync } from "node:fs";
import { ne } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import type { Viewer } from "@/server/policy";
import { resetDatabase } from "@/server/seed";

export const organizer: Viewer = { id: "demo-organizator", role: "organizer", groups: ["vsichni", "fp", "rm", "tym-a"] };
export const lead: Viewer = { id: "demo-vedouci", role: "member", groups: ["vsichni", "fp", "rm", "tym-a"] };
export const participant: Viewer = { id: "demo-ucastnik", role: "member", groups: ["vsichni", "fp"] };
export const outsider: Viewer = { id: "demo-mimo-skupinu", role: "member", groups: ["vsichni", "rm"] };

export const admin: Viewer = { id: "demo-spravce", role: "admin", groups: ["vsichni", "fp", "rm", "tym-a"] };

/** Výchozí stav pro test. Skutečné účty obnova dat záměrně drží, test je proto maže zvlášť. */
export async function resetDemo() {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(users).where(ne(users.origin, "demo"));
    await resetDatabase(tx);
  });
  return db;
}

export const fixtureWav = () => new Uint8Array(readFileSync("public/demo/testovaci-nahravka.wav"));

/** Platný krátký PCM WAV (ticho), který ale není testovací nahrávkou. */
export function silentWav(seconds = 2, sampleRate = 8000): Uint8Array {
  const dataSize = seconds * sampleRate * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const ascii = (at: number, text: string) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataSize, true);
  return new Uint8Array(buffer);
}

export const asFile = (bytes: Uint8Array, name: string) => new File([bytes as BlobPart], name);

export const PUBLISHED_RM = "tr-rm-1112";
export const PAST_FP = "tr-fp-1111";
