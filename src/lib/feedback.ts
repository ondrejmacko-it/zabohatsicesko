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
/** Delší strana snímku v pixelech. Klient zmenšuje, server větší obrázek nepřijme. */
export const FEEDBACK_SCREENSHOT_MAX_SIDE = 2000;
/** Pokusy o odeslání na účet za hodinu. Počítá se i nepovedený pokus, proto s rezervou pro opakování. */
export const FEEDBACK_REPORTS_PER_HOUR = 10;

export const FEEDBACK_SCREENSHOT_MIMES = ["image/webp", "image/jpeg"] as const;
export type FeedbackScreenshotMime = (typeof FEEDBACK_SCREENSHOT_MIMES)[number];

/** Popis obdélníku vyznačeného tažením. Popisy prvků viz `page-context.ts`, jen strukturální názvy. */
export const FEEDBACK_RECT_LABEL = "Označená oblast";

/**
 * Jediné povolené druhy a místa v popisu označeného prvku. Popis vzniká v prohlížeči jako „druh“ nebo
 * „druh místo“ a server přijme jen tyto kombinace, takže do hlášení nemůže projít žádný text ze stránky,
 * ani kdyby ho upravený prohlížeč poslal.
 */
export const FEEDBACK_ELEMENT_KINDS = [
  "Karta v harmonogramu",
  "Karta akce",
  "Nadpis stránky",
  "Nadpis sekce",
  "Tlačítko",
  "Zaškrtávací pole",
  "Přepínač",
  "Výběr",
  "Textové pole",
  "Popisek pole",
  "Odkaz",
  "Obrázek",
  "Buňka tabulky",
  "Tabulka",
  "Položka seznamu",
  "Okno",
  "Položka nabídky",
  "Prvek stránky",
] as const;
export type FeedbackElementKind = (typeof FEEDBACK_ELEMENT_KINDS)[number];

export const FEEDBACK_ELEMENT_PLACES = ["v okně", "v nabídce", "v tabulce", "ve formuláři", "v menu", "v záhlaví"] as const;
export type FeedbackElementPlace = (typeof FEEDBACK_ELEMENT_PLACES)[number];

/** Selektor jen ze značek a pořadí: `main > section:nth-of-type(2) > button`, nejvýš 8 úrovní. */
const SELECTOR_PART = "[a-z][a-z0-9-]{0,30}(:nth-of-type\\([1-9][0-9]{0,3}\\))?";
export const FEEDBACK_SELECTOR_PATTERN = new RegExp(`^${SELECTOR_PART}( > ${SELECTOR_PART}){0,7}$`);

const ELEMENT_DESCRIPTIONS: ReadonlySet<string> = new Set(
  FEEDBACK_ELEMENT_KINDS.flatMap((kind) => [kind, ...FEEDBACK_ELEMENT_PLACES.map((place) => `${kind} ${place}`)]),
);

/** Platí pro značku jen strukturální popis a selektor? Obdélník nemá selektor a má pevný popis. */
export function feedbackMarkIsStructural(mark: Pick<FeedbackMark, "kind" | "description" | "selector">): boolean {
  if (mark.kind === "rect") return mark.description === FEEDBACK_RECT_LABEL && mark.selector === null;
  return ELEMENT_DESCRIPTIONS.has(mark.description) && (mark.selector === null || FEEDBACK_SELECTOR_PATTERN.test(mark.selector));
}

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

export type FeedbackFailure = "invalid" | "unauthorized" | "rate_limited" | "duplicate" | "not_configured" | "failed" | "uncertain";
export type FeedbackResult = { ok: true } | { ok: false; reason: FeedbackFailure };

export const FEEDBACK_ERROR_MESSAGE: Record<FeedbackFailure, string> = {
  invalid: "Hlášení se nepodařilo zpracovat. Zkontrolujte text a zkuste to znovu.",
  unauthorized: "Přihlášení vypršelo. Načtěte stránku a vstupte znovu, rozepsaný text zůstane v okně.",
  rate_limited: `Za poslední hodinu jste odeslali ${FEEDBACK_REPORTS_PER_HOUR} hlášení. Zkuste to prosím později.`,
  duplicate: "Toto hlášení už bylo odesláno.",
  not_configured: "Odesílání zpětné vazby není na tomto serveru nastavené. Nic se neodeslalo.",
  failed: "Hlášení se nepodařilo odeslat. Zůstalo v okně, zkuste to za chvíli znovu.",
  uncertain: "Odpověď se nepodařilo ověřit, hlášení nejspíš dorazilo. Znovu ho neposíláme, text zůstává v okně.",
};

/**
 * Stránky ověřené pro snímek obrazovky (pozitivní seznam). Jinde se snímek nenabízí a server ho nepřijme.
 * Úvod, Plán a Témata: akce, témata a úkoly fiktivní ukázky, pole formulářů a účet se ve snímku začerní.
 * Zápisy, detail akce, Správa, Integrace, Přehled ani Moje cesta tu nejsou (zápisy, účty, osobní postup).
 * Povolení vydává server (`ShotGrant`), klientská cesta o snímku nerozhoduje.
 */
export const FEEDBACK_SHOT_PAGES = ["/", "/vzdelavani/harmonogram", "/vzdelavani/temata"] as const;
export type FeedbackShotPage = (typeof FEEDBACK_SHOT_PAGES)[number];

/** Atribut značky s povolením snímku, kterou vkládá `ShotGrant`. */
export const FEEDBACK_SHOT_GRANT_ATTR = "data-feedback-shot-grant";
