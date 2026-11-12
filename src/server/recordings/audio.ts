import { DomainError } from "@/server/services/errors";

// Ověření nahrávky podle obsahu, ne podle přípony nebo MIME z prohlížeče. Formát musí sedět
// s příponou a struktura souboru se musí dát projít až k délce záznamu.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_DURATION_SEC = 15 * 60;

export type AudioFormat = "wav" | "mp3" | "m4a";
export type AudioInfo = { format: AudioFormat; mimeType: string; durationSec: number };

const MIME: Record<AudioFormat, string> = { wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4" };

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

function inspectWav(b: Uint8Array): number {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 44 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WAVE") throw new DomainError("file_type");
  let byteRate = 0;
  let offset = 12;
  while (offset + 8 <= b.length) {
    const id = ascii(b, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      if (size < 16 || body + 16 > b.length) break;
      const format = view.getUint16(body, true);
      const channels = view.getUint16(body + 2, true);
      const sampleRate = view.getUint32(body + 4, true);
      byteRate = view.getUint32(body + 8, true);
      const blockAlign = view.getUint16(body + 12, true);
      const valid = [1, 3, 0xfffe].includes(format) && channels > 0 && sampleRate >= 8000 && sampleRate <= 192_000 && blockAlign > 0;
      if (!valid || byteRate !== sampleRate * blockAlign) throw new DomainError("file_corrupt");
    } else if (id === "data") {
      if (!byteRate || body + size > b.length || size === 0) throw new DomainError("file_corrupt");
      return size / byteRate;
    }
    offset = body + size + (size % 2);
  }
  throw new DomainError("file_corrupt");
}

// MPEG Layer III: bitrate (kbit/s) podle verze, vzorkovací frekvence podle verze.
const MP3_BITRATES = {
  v1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  v2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const MP3_SAMPLE_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function inspectMp3(b: Uint8Array): number {
  let offset = 0;
  if (ascii(b, 0, 3) === "ID3") {
    if (b.length < 10) throw new DomainError("file_corrupt");
    const tagSize = ((b[6]! & 0x7f) << 21) | ((b[7]! & 0x7f) << 14) | ((b[8]! & 0x7f) << 7) | (b[9]! & 0x7f);
    offset = 10 + tagSize;
  }
  if (b[offset] !== 0xff || (b[offset + 1]! & 0xe0) !== 0xe0) throw new DomainError("file_type");
  let frames = 0;
  let seconds = 0;
  // Projde hlavičky rámců až na konec souboru. Neplatný rámec uprostřed = poškozený soubor.
  while (offset + 4 <= b.length) {
    const h1 = b[offset + 1]!;
    const h2 = b[offset + 2]!;
    const version = (h1 >> 3) & 0x3;
    const layer = (h1 >> 1) & 0x3;
    const bitrateIndex = h2 >> 4;
    const rateIndex = (h2 >> 2) & 0x3;
    const sampleRate = MP3_SAMPLE_RATES[version]?.[rateIndex];
    const bitrate = (version === 3 ? MP3_BITRATES.v1 : MP3_BITRATES.v2)[bitrateIndex];
    if (b[offset] !== 0xff || (h1 & 0xe0) !== 0xe0 || layer !== 1 || !sampleRate || !bitrate) {
      if (frames > 0 && b.length - offset <= 256) break; // koncový ID3v1/APE tag
      throw new DomainError("file_corrupt");
    }
    const samplesPerFrame = version === 3 ? 1152 : 576;
    const length = Math.floor(((samplesPerFrame / 8) * bitrate * 1000) / sampleRate) + ((h2 >> 1) & 1);
    if (length < 4) throw new DomainError("file_corrupt");
    seconds += samplesPerFrame / sampleRate;
    frames += 1;
    offset += length;
  }
  if (frames < 2) throw new DomainError("file_corrupt");
  return seconds;
}

function inspectM4a(b: Uint8Array): number {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 16 || ascii(b, 4, 4) !== "ftyp") throw new DomainError("file_type");
  const brand = ascii(b, 8, 4);
  if (!["M4A ", "M4B ", "mp42", "isom", "mp41"].includes(brand)) throw new DomainError("file_type");

  const boxes = (start: number, end: number) => {
    const found = new Map<string, { body: number; end: number }>();
    for (let at = start; at + 8 <= end; ) {
      let size = view.getUint32(at); // MP4 boxy jsou big-endian
      let header = 8;
      if (size === 1 && at + 16 <= end) {
        size = Number(view.getBigUint64(at + 8));
        header = 16;
      } else if (size === 0) {
        size = end - at;
      }
      if (size < header || at + size > end) throw new DomainError("file_corrupt");
      found.set(ascii(b, at + 4, 4), { body: at + header, end: at + size });
      at += size;
    }
    return found;
  };

  const top = boxes(0, b.length);
  const moov = top.get("moov");
  if (!moov || !top.has("mdat")) throw new DomainError("file_corrupt");
  const mvhd = boxes(moov.body, moov.end).get("mvhd");
  if (!mvhd) throw new DomainError("file_corrupt");
  const version = b[mvhd.body];
  const timescale = view.getUint32(mvhd.body + (version === 1 ? 20 : 12));
  const duration = version === 1 ? Number(view.getBigUint64(mvhd.body + 24)) : view.getUint32(mvhd.body + 16);
  if (!timescale || !duration) throw new DomainError("file_corrupt");
  return duration / timescale;
}

const INSPECTORS: Record<AudioFormat, (b: Uint8Array) => number> = { wav: inspectWav, mp3: inspectMp3, m4a: inspectM4a };

export function formatFromName(name: string): AudioFormat | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext === "wav" || ext === "mp3" || ext === "m4a" ? ext : null;
}

export function inspectAudio(bytes: Uint8Array, fileName: string): AudioInfo {
  if (bytes.length > MAX_UPLOAD_BYTES) throw new DomainError("file_too_large");
  const format = formatFromName(fileName);
  if (!format || bytes.length === 0) throw new DomainError("file_type");
  let durationSec: number;
  try {
    durationSec = INSPECTORS[format](bytes);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("file_corrupt");
  }
  if (!Number.isFinite(durationSec) || durationSec < 1) throw new DomainError("file_corrupt");
  if (durationSec > MAX_DURATION_SEC) throw new DomainError("file_too_long");
  return { format, mimeType: MIME[format], durationSec: Math.round(durationSec) };
}

/** Název jen pro zobrazení. Úložiště používá generovaný klíč, nikdy jméno od uživatele. */
export function displayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "nahravka";
  const clean = base.replace(/[\u0000-\u001f\u007f<>"]/g, "").trim();
  return (clean || "nahravka").slice(0, 100);
}
