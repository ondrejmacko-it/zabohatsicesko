import { z } from "zod";
import { clearRateLimit, hashKey, logError, withinRateLimit } from "@/server/audit";
import type { Executor } from "@/server/db/client";
import {
  FEEDBACK_EXPECTED_MAX,
  FEEDBACK_MARKS_MAX,
  FEEDBACK_REPORTS_PER_HOUR,
  FEEDBACK_SCREENSHOT_MAX_BYTES,
  FEEDBACK_SCREENSHOT_MIMES,
  FEEDBACK_TEXT_MAX,
  FEEDBACK_TYPES,
  screenshotAllowed,
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
          .strict(),
      )
      .max(FEEDBACK_MARKS_MAX),
    screenshot: z
      .object({
        mime: z.enum(FEEDBACK_SCREENSHOT_MIMES),
        width: z.number().int().min(1).max(8000),
        height: z.number().int().min(1).max(8000),
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
  .refine((draft) => draft.type === "bug" || draft.expected === null)
  // Na stránkách bez snímku server snímek nepřijme, ani kdyby ho prohlížeč poslal.
  .refine((draft) => draft.screenshot === null || screenshotAllowed(draft.context.path));

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

export type FeedbackSubmission = { draftJson: unknown; screenshot: Blob | null; facts: FeedbackServerFacts };

export type FeedbackDeps = {
  db: Executor;
  webhook: { url: string; secret: string } | null;
  fetchImpl: typeof fetch;
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
    logError("feedback.webhook", "request_failed", error);
  }
  // Nepovedené doručení klíč konceptu uvolní, aby šlo totéž hlášení hned zkusit znovu.
  await clearRateLimit(deps.db, onceKey);
  return { ok: false, reason: "failed" };
}
