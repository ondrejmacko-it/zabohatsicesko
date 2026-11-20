/**
 * Zpětná vazba (brouček): typy, popisky a limity sdílené oknem v prohlížeči i serverem.
 *
 * Převzato a zjednodušeno z Novi AI Tutor (`src/feedback/model.ts`): místo sedmi kroků tři (typ, popis,
 * kontrola), bez kontaktu a anonymního ID. Kdo hlášení poslal, doplní server z ověřené session.
 */

export const FEEDBACK_TYPES = ["bug", "ui", "idea", "other"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  bug: "Chyba",
  ui: "Vzhled / ovládání",
  idea: "Nápad",
  other: "Ostatní",
};

export const FEEDBACK_TEXT_MAX = 2000;
export const FEEDBACK_EXPECTED_MAX = 1000;
export const FEEDBACK_MARKS_MAX = 10;
export const FEEDBACK_SCREENSHOT_MAX_BYTES = 500_000;
/** Pokusy o odeslání na účet za hodinu. Počítá se i nepovedený pokus, proto s rezervou pro opakování. */
export const FEEDBACK_REPORTS_PER_HOUR = 10;

export const FEEDBACK_SCREENSHOT_MIMES = ["image/webp", "image/jpeg"] as const;
export type FeedbackScreenshotMime = (typeof FEEDBACK_SCREENSHOT_MIMES)[number];

/** Popis obdélníku vyznačeného tažením. Popisy prvků viz `page-context.ts`, jen strukturální názvy. */
export const FEEDBACK_RECT_LABEL = "Označená oblast";

export type FeedbackBox = { x: number; y: number; width: number; height: number };

export type FeedbackMark = {
  kind: "element" | "rect";
  /** Strukturální popis bez obsahu stránky: „Tlačítko v okně“, „Karta v harmonogramu“, „Označená oblast“. */
  description: string;
  selector: string | null;
  box: FeedbackBox;
};

/** Technický kontext z prohlížeče. Verzi aplikace, prohlížeč, roli a Pohled doplní server. */
export type FeedbackContext = {
  path: string;
  viewport: { width: number; height: number };
  pixelRatio: number;
};

/** Co posílá prohlížeč. `submissionId` je náhodný klíč konceptu proti dvojímu odeslání. */
export type FeedbackDraft = {
  submissionId: string;
  type: FeedbackType;
  text: string;
  expected: string | null;
  marks: FeedbackMark[];
  screenshot: { mime: FeedbackScreenshotMime; width: number; height: number } | null;
  context: FeedbackContext;
};

export type FeedbackFailure = "invalid" | "unauthorized" | "rate_limited" | "duplicate" | "not_configured" | "failed";
export type FeedbackResult = { ok: true } | { ok: false; reason: FeedbackFailure };

export const FEEDBACK_ERROR_MESSAGE: Record<FeedbackFailure, string> = {
  invalid: "Hlášení se nepodařilo zpracovat. Zkontrolujte text a zkuste to znovu.",
  unauthorized: "Přihlášení vypršelo. Načtěte stránku a vstupte znovu, rozepsaný text zůstane v okně.",
  rate_limited: `Za poslední hodinu jste odeslali ${FEEDBACK_REPORTS_PER_HOUR} hlášení. Zkuste to prosím později.`,
  duplicate: "Toto hlášení už bylo odesláno.",
  not_configured: "Odesílání zpětné vazby není na tomto serveru nastavené. Nic se neodeslalo.",
  failed: "Hlášení se nepodařilo odeslat. Zůstalo v okně, zkuste to za chvíli znovu.",
};

/**
 * Části Wiki, kde se snímek obrazovky nenabízí vůbec: Správa systému (účty, e-maily, pozvánky) a Integrace
 * (stav propojení a technické údaje). Bezpečné zachycení tam nejde zaručit redakcí jednotlivých prvků.
 */
const SCREENSHOT_BLOCKED_PATHS = ["/sprava", "/vzdelavani/integrace"];

export function screenshotAllowed(path: string): boolean {
  return !SCREENSHOT_BLOCKED_PATHS.some((blocked) => path === blocked || path.startsWith(`${blocked}/`));
}
