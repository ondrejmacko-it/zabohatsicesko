import { DomainError } from "@/server/services/errors";

// Textový zdroj zápisu: vložený přepis či poznámky nebo nahraný soubor. Vše je nedůvěryhodný vstup,
// proto pevná přípona, velikost a striktní UTF-8. Obsah se nikdy neloguje.

/** Limit textu i souboru. Odpovídá zhruba hodině přepisu, server action ho přijme (limit těla 4,2 MB). */
export const TEXT_SOURCE_MAX_BYTES = 1024 * 1024;
export const TEXT_FILE_EXTENSIONS = [".txt", ".md", ".vtt", ".srt"] as const;

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
};

/** Jednotné konce řádků, bez řídicích znaků (kromě tabulátoru a nového řádku), bez nadbytečných prázdných řádků. */
export function normalizeText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SECTION_LABELS = /^(shrnuti|souhrn|summary|uvod|hlavni body|body|klicove body|poznamky|rozhodnuti|dohody|dalsi kroky|ukoly|kroky|key points|notes|decisions|next steps|action items|todo)$/;
const SPEAKER_LINE = /^\s*([\p{Lu}][\p{L} .'’-]{0,40}?)\s*:\s+\S/u;

/**
 * F14: jedno pole pro přepis i poznámky. Druh se jen odhadne pro štítek „Zdroj“: aspoň dva řádky ve tvaru
 * „Mluvčí: řeč“ (mimo nadpisy oddílů zápisu) = přepis, jinak poznámky. Na návrh zápisu to vliv nemá.
 */
export function pastedTextKind(text: string): "transcript" | "notes" {
  const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  let speakers = 0;
  for (const line of text.split("\n")) {
    const label = SPEAKER_LINE.exec(line)?.[1];
    if (label && !SECTION_LABELS.test(fold(label))) speakers++;
  }
  return speakers >= 2 ? "transcript" : "notes";
}

/** Vložený text: stejné limity jako soubor. */
export function readPastedText(text: string): string {
  if (new TextEncoder().encode(text).length > TEXT_SOURCE_MAX_BYTES) throw new DomainError("text_too_large");
  const normalized = normalizeText(text);
  if (!normalized) throw new DomainError("text_empty");
  return normalized;
}

const TIMING = /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->/;

/**
 * Titulky WebVTT a SRT bez hlavičky, čísel a časových značek titulků. Zůstane jen řeč. Značka mluvčího
 * `<v Jméno>` se převede na „Jméno: “, ostatní značky se zahodí. Navazující stejné řádky se sloučí.
 */
export function stripSubtitleTimings(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let skipBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      skipBlock = false;
      continue;
    }
    if (skipBlock) continue;
    if (i === 0 && /^WEBVTT\b/.test(line.replace(/^\uFEFF/, ""))) {
      skipBlock = true;
      continue;
    }
    if (/^(NOTE|STYLE|REGION)\b/.test(line)) {
      skipBlock = true;
      continue;
    }
    if (TIMING.test(line)) continue;
    // Identifikátor titulku (u SRT pořadové číslo) je řádek těsně před časovou značkou.
    if (TIMING.test(lines[i + 1] ?? "")) continue;
    const speech = line
      .replace(/<v(?:\.[^\s>]*)?\s+([^>]+)>/g, "$1: ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (speech && out[out.length - 1] !== speech) out.push(speech);
  }
  return out.join("\n");
}

/**
 * Obsah nahraného textového souboru: kontrola přípony, velikosti a platného UTF-8. Soubor s nulovými
 * bajty se bere jako binární, i když náhodou projde dekodérem.
 */
export function readTextFile(name: string, bytes: Uint8Array): string {
  const extension = extensionOf(name);
  if (!(TEXT_FILE_EXTENSIONS as readonly string[]).includes(extension)) throw new DomainError("text_file_type");
  if (bytes.length > TEXT_SOURCE_MAX_BYTES) throw new DomainError("text_too_large");
  if (bytes.length === 0) throw new DomainError("text_empty");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new DomainError("text_encoding");
  }
  if (text.includes("\u0000")) throw new DomainError("text_encoding");
  const plain = extension === ".vtt" || extension === ".srt" ? stripSubtitleTimings(text) : text;
  const normalized = normalizeText(plain);
  if (!normalized) throw new DomainError("text_empty");
  return normalized;
}
