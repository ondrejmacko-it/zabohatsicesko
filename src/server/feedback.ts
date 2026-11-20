import { z } from "zod";
import { clearRateLimit, hashKey, logError, withinRateLimit } from "@/server/audit";
import { shotGrantValid } from "@/server/feedback-grant";
import type { Executor } from "@/server/db/client";
import {
  FEEDBACK_EXPECTED_MAX,
  FEEDBACK_MARKS_MAX,
  FEEDBACK_REPORTS_PER_HOUR,
  FEEDBACK_SCREENSHOT_MAX_BYTES,
  FEEDBACK_SCREENSHOT_MAX_SIDE,
  FEEDBACK_SCREENSHOT_MIMES,
  FEEDBACK_TEXT_MAX,
  FEEDBACK_TYPES,
  feedbackMarkIsStructural,
  type FeedbackResult,
  type FeedbackScreenshotMime,
} from "@/lib/feedback";

/**
 * Serverová část zpětné vazby bez závislosti na Next.js: ověření konceptu z prohlížeče, kontrola snímku
 * podle bajtů, limity, ochrana proti dvojímu odeslání a předání do webhooku Make.com. Vychází z Novi AI Tutor
 * (`src/feedback/submit.ts`). Server action dodá přihlášeného uživatele, hlavičky a `fetch`, aby šlo vše
 * testovat. Text, snímek ani označení se nikdy nelogují.
 */

const COORD = z.number().finite().min(-10_000).max(100_000);
const SIZE = z.number().finite().min(0).max(100_000);

/** Nepovinný text: prázdný po oříznutí = `null`. */
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .transform((value) => (value?.trim() ? value.trim() : null));

const draftSchema = z
  .object({
    submissionId: z.uuid(),
    type: z.enum(FEEDBACK_TYPES),
    text: z
      .string()
      .max(FEEDBACK_TEXT_MAX)
      .transform((value) => value.trim())
      .pipe(z.string().min(1)),
    expected: optionalText(FEEDBACK_EXPECTED_MAX),
    marks: z
      .array(
        z
          .object({
            kind: z.enum(["element", "rect"]),
            description: z.string().max(300),
            selector: z.string().max(500).nullable(),
            box: z.object({ x: COORD, y: COORD, width: SIZE, height: SIZE }).strict(),
          })
          .strict()
          // Jen strukturální popis ze seznamu a selektor ze značek. Text stránky neprojde ani z upraveného prohlížeče.
          .refine(feedbackMarkIsStructural),
      )
      .max(FEEDBACK_MARKS_MAX),
    screenshot: z
      .object({
        mime: z.enum(FEEDBACK_SCREENSHOT_MIMES),
        width: z.number().int().min(1).max(FEEDBACK_SCREENSHOT_MAX_SIDE),
        height: z.number().int().min(1).max(FEEDBACK_SCREENSHOT_MAX_SIDE),
      })
      .strict()
      .nullable(),
    context: z
      .object({
        path: z.string().min(1).max(300).startsWith("/").refine((path) => !path.startsWith("//")),
        viewport: z.object({ width: SIZE, height: SIZE }).strict(),
        pixelRatio: z.number().finite().min(0.1).max(10),
      })
      .strict(),
  })
  .strict()
  // „Co by mělo fungovat jinak“ patří jen k chybě.
  .refine((draft) => draft.type === "bug" || draft.expected === null);

export type ValidDraft = z.infer<typeof draftSchema>;

/** Koncept z `FormData` (JSON text). Cokoli nečitelného je `null`. */
export function parseFeedbackDraft(raw: unknown): ValidDraft | null {
  if (typeof raw !== "string" || raw.length > 50_000) return null;
  try {
    const result = draftSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Typ obrázku podle magických bajtů, ne podle přípony nebo MIME od klienta. WebP = `RIFF….WEBP`, JPEG = `FF D8 FF`. */
export function detectScreenshotMime(bytes: Uint8Array): FeedbackScreenshotMime | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

const le16 = (bytes: Uint8Array, at: number) => bytes[at]! | (bytes[at + 1]! << 8);
const le24 = (bytes: Uint8Array, at: number) => le16(bytes, at) | (bytes[at + 2]! << 16);

/**
 * Skutečné rozměry obrázku z jeho hlavičky. Deklarované rozměry od klienta musí sedět, jinak hlášení neprojde.
 * WebP: `VP8 ` (ztrátový), `VP8L` (bezeztrátový) a `VP8X` (rozšířený). JPEG: první značka SOF (mimo DHT,
 * JPG a DAC, které mají podobný kód). Nečitelná hlavička je `null`.
 */
export function readScreenshotSize(bytes: Uint8Array, mime: FeedbackScreenshotMime): { width: number; height: number } | null {
  if (mime === "image/webp") {
    if (bytes.length < 30) return null;
    const chunk = String.fromCharCode(...bytes.subarray(12, 16));
    if (chunk === "VP8 ") {
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
      return { width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      if (bytes[20] !== 0x2f) return null;
      const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
    return null;
  }
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1]!;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    const length = (bytes[at + 2]! << 8) | bytes[at + 3]!;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: (bytes[at + 7]! << 8) | bytes[at + 8]!, height: (bytes[at + 5]! << 8) | bytes[at + 6]! };
    }
    if (marker === 0xd9 || marker === 0xda || length < 2) return null;
    at += 2 + length;
  }
  return null;
}

/** Kdo hlášení poslal: jen pseudonym účtu, role a způsob přihlášení. Jméno ani e-mail se neposílají. */
export type FeedbackReporter = { userId: string; role: string; signedInWith: string };

/** Fakta, která doplní server. Klient je poslat nemůže. */
export type FeedbackServerFacts = {
  id: string;
  createdAt: string;
  appVersion: string | null;
  userAgent: string | null;
  wikiMode: string;
  reporter: FeedbackReporter;
  /** Aktivní globální „Pohled“ správce. Jen popis pro čtenáře hlášení, nic neopravňuje. */
  preview: { key: string; label: string } | null;
};

/** Balíček `schemaVersion: 1` přesně podle `docs/zpetna-vazba.md`. */
export function buildFeedbackPayload(draft: ValidDraft, facts: FeedbackServerFacts, screenshotBase64: string | null) {
  return {
    schemaVersion: 1,
    source: "zbc-wiki",
    id: facts.id,
    createdAt: facts.createdAt,
    type: draft.type,
    text: draft.text,
    expected: draft.expected,
    marks: draft.marks,
    screenshot: draft.screenshot && screenshotBase64 ? { ...draft.screenshot, base64: screenshotBase64 } : null,
    context: {
      ...draft.context,
      appVersion: facts.appVersion,
      userAgent: facts.userAgent,
      wikiMode: facts.wikiMode,
      preview: facts.preview,
    },
    reporter: { ref: hashKey(`feedback:${facts.reporter.userId}`), role: facts.reporter.role, signedInWith: facts.reporter.signedInWith },
  };
}

export const FEEDBACK_TIMEOUT_MS = 10_000;
export const FEEDBACK_SECRET_HEADER = "x-zbc-feedback-secret";
/** Klíč konceptu platí den: opakované odeslání téhož hlášení během dne neprojde podruhé. */
const ONCE_WINDOW_SEC = 24 * 60 * 60;

/** `screenshotGrant` = povolení snímku z `ShotGrant`, posílá se jen se snímkem a do Make.com nejde. */
export type FeedbackSubmission = { draftJson: unknown; screenshot: Blob | null; screenshotGrant: unknown; facts: FeedbackServerFacts };

export type FeedbackDeps = {
  db: Executor;
  webhook: { url: string; secret: string } | null;
  fetchImpl: typeof fetch;
  /** Klíč podpisu povolení snímku (`config.sessionSecret`). */
  grantSecret: string;
  timeoutMs?: number;
};

/** Celé odeslání. Každý neúspěch vrací důvod pro poctivou hlášku v okně, rozepsaná data zůstávají u uživatele. */
export async function submitFeedbackCore(submission: FeedbackSubmission, deps: FeedbackDeps): Promise<FeedbackResult> {
  const draft = parseFeedbackDraft(submission.draftJson);
  if (!draft) return { ok: false, reason: "invalid" };

  // Snímek a jeho popis musí přijít spolu, jinak hlášení neodpovídá souhrnu, který uživatel schválil.
  if ((draft.screenshot === null) !== (submission.screenshot === null)) return { ok: false, reason: "invalid" };
  let screenshotBase64: string | null = null;
  if (draft.screenshot && submission.screenshot) {
    if (submission.screenshot.size > FEEDBACK_SCREENSHOT_MAX_BYTES) return { ok: false, reason: "invalid" };
    const bytes = new Uint8Array(await submission.screenshot.arrayBuffer());
    if (detectScreenshotMime(bytes) !== draft.screenshot.mime) return { ok: false, reason: "invalid" };
    // Rozměry z hlavičky obrázku musí sedět s popisem. Nesedí-li, obrázek není ten, který okno pořídilo.
    const size = readScreenshotSize(bytes, draft.screenshot.mime);
    if (!size || size.width !== draft.screenshot.width || size.height !== draft.screenshot.height) return { ok: false, reason: "invalid" };
    // Snímek jen s povolením, které server vydal na ověřené stránce tomuto uživateli.
    if (!shotGrantValid(deps.grantSecret, submission.screenshotGrant, submission.facts.reporter.userId)) return { ok: false, reason: "invalid" };
    screenshotBase64 = Buffer.from(bytes).toString("base64");
  }

  // Bez nastaveného webhooku se nic neodešle a uživatel se to dozví. Žádný předstíraný úspěch.
  if (!deps.webhook) return { ok: false, reason: "not_configured" };

  const userId = submission.facts.reporter.userId;
  if (!(await withinRateLimit(deps.db, `feedback:${userId}`, FEEDBACK_REPORTS_PER_HOUR, 60 * 60))) {
    return { ok: false, reason: "rate_limited" };
  }
  // Jeden koncept = jedno hlášení. Souběžné druhé odeslání (dvojklik, druhá záložka) neprojde.
  const onceKey = `feedback-once:${hashKey(`${userId}:${draft.submissionId}`)}`;
  if (!(await withinRateLimit(deps.db, onceKey, 1, ONCE_WINDOW_SEC))) return { ok: false, reason: "duplicate" };

  const payload = buildFeedbackPayload(draft, submission.facts, screenshotBase64);
  try {
    const response = await deps.fetchImpl(deps.webhook.url, {
      method: "POST",
      headers: { "content-type": "application/json", [FEEDBACK_SECRET_HEADER]: deps.webhook.secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(deps.timeoutMs ?? FEEDBACK_TIMEOUT_MS),
      cache: "no-store",
      redirect: "error",
    });
    if (response.ok) return { ok: true };
    logError("feedback.webhook", `http_${response.status}`);
  } catch (error) {
    // Vypršel čas: Make mohl hlášení přijmout, jen odpověď nedorazila. Klíč konceptu zůstane, opakování by
    // v Make vytvořilo duplicitu. Uživatel se dozví, že výsledek nejde ověřit, a text mu zůstane.
    if (error instanceof DOMException && error.name === "TimeoutError") {
      logError("feedback.webhook", "timeout");
      return { ok: false, reason: "uncertain" };
    }
    logError("feedback.webhook", "request_failed", error);
  }
  // Nepovedené doručení klíč konceptu uvolní, aby šlo totéž hlášení hned zkusit znovu.
  await clearRateLimit(deps.db, onceKey);
  return { ok: false, reason: "failed" };
}
