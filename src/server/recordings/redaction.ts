import type { MinutesContent } from "@/lib/types";

/**
 * F15: přepisy a poznámky mohou obsahovat jména a kontakty klientů. Než text dostane návrh zápisu (dnes lokální
 * šablona, později AI služba), nahradí se tu zástupným znakem. Pravidla jsou deterministická a záměrně opatrná:
 * - e-mail, telefon, rodné číslo a číslo účtu vždy,
 * - jméno za slovem, které označuje klienta („klientka Jana Nová“, „pan Novák“),
 * - celé jméno (křestní + příjmení), pokud křestní je běžné jméno a nejde o kolegu z Wiki.
 * Samotné křestní jméno („Petr pošle šablonu“) zůstává: v poznámkách jde většinou o kolegu a úkol by bez něj
 * ztratil smysl. Vedoucí návrh vždy čte a upravuje, pravidla jsou pojistka, ne záruka.
 */

export const REDACTED_NAME = "[jméno]";

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Běžná křestní jména bez diakritiky. Seznam stačí rozšířit, pravidlo se nemění.
const FIRST_NAMES = new Set(
  (
    "jan jana petr petra pavel pavla martin martina tomas tereza jiri jirina josef josefa eva marie anna lucie katerina " +
    "lenka alena hana jaroslav jaroslava milan milana michal michaela lukas david jakub ondrej vojtech adam filip karel " +
    "frantisek vaclav zdenek zdenka miroslav miroslava ladislav roman radek daniel daniela veronika barbora kristyna " +
    "monika zuzana ivana ivan jitka vera dana marketa simona klara nikola adela eliska natalie karolina jindrich " +
    "stanislav vladimir ales libor marek robert igor peter patrik dominik matej sarka iveta irena ludmila jaromir " +
    "vit vitezslav bohumil bohuslav emil oldrich antonin viktor kamila renata magdalena andrea olga helena " +
    "john mary james michael sarah anne paul peter thomas clara"
  ).split(/\s+/),
);

// České koncovky skloňovaných jmen (Janu, Petrovi, Janou, Petře…). Zkouší se od nejdelší.
const ENDINGS = ["ovi", "ou", "em", "ě", "e", "a", "y", "u", "i", "o"];

function isFirstName(word: string): boolean {
  const base = fold(word);
  if (FIRST_NAMES.has(base)) return true;
  return ENDINGS.some((ending) => base.length > ending.length + 2 && base.endsWith(fold(ending)) && FIRST_NAMES.has(base.slice(0, -ending.length)));
}

/** Kolegové z Wiki: shoda prvních čtyř písmen každého slova jména, aby prošly i skloňované tvary. */
function colleagueMatcher(names: string[]): (words: string[]) => boolean {
  const people = names.map((name) => fold(name).split(/\s+/).filter(Boolean).map((w) => w.slice(0, 4)));
  return (words) => {
    const stems = words.map((w) => fold(w).slice(0, 4));
    return people.some((person) => stems.every((stem) => person.includes(stem)));
  };
}

const WORD = String.raw`\p{Lu}[\p{Ll}'’-]+`;
// Slova, za kterými následuje jméno klienta. Velké písmeno jen na začátku, jméno musí začínat velkým.
const MARKER = String.raw`(?:[Kk]lient(?:ka|ky|ku|kou|ce|ovi|em|a|i|ů|y)?|[Pp]an(?:a|u|em|í)?|[Ss]lečn(?:a|y|ě|u|ou)|[Mm]anžel(?:ka|ky|ce|em|a|i)?|[Cc]lient|Mrs?\.?|Ms\.?)`;
const MARKED_NAME = new RegExp(String.raw`(?<!\p{L})(${MARKER})(\s+)(${WORD}(?:\s+${WORD})?)(?!\p{L})`, "gu");
// Druhé slovo jen v předstihu: „Shrnutí Jan Novák“ musí najít dvojici „Jan Novák“, ne pohltit „Shrnutí Jan“.
const FULL_NAME = new RegExp(String.raw`(?<!\p{L})(${WORD})(?=(\s+)(${WORD})(?!\p{L}))`, "gu");

const PATTERNS: Array<[RegExp, string]> = [
  [/[\p{L}\d._%+-]+@[\p{L}\d.-]+\.\p{L}{2,}/gu, "[e-mail]"],
  [/(?<!\d)\d{6}\/\d{3,4}(?!\d)/g, "[rodné číslo]"],
  [/(?<!\d)(?:\d{1,6}-)?\d{2,10}\/\d{4}(?!\d)/g, "[číslo účtu]"],
  [/(?<![\d+])(?:\+\d{3}[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}(?!\d)/g, "[telefon]"],
];

export type Redaction = { text: string; count: number };

/** Vynechá z textu jména a kontakty klientů. `colleagues` = jména lidí z Wiki, ta zůstávají. */
export function redactClientData(text: string, colleagues: string[] = []): Redaction {
  const isColleague = colleagueMatcher(colleagues);
  let count = 0;
  let result = text;
  for (const [pattern, token] of PATTERNS) {
    result = result.replace(pattern, () => {
      count++;
      return token;
    });
  }
  result = result.replace(MARKED_NAME, (match, marker: string, space: string, name: string) => {
    if (isColleague(name.split(/\s+/))) return match;
    count++;
    return `${marker}${space}${REDACTED_NAME}`;
  });
  let out = "";
  let cursor = 0;
  FULL_NAME.lastIndex = 0;
  for (let match = FULL_NAME.exec(result); match; match = FULL_NAME.exec(result)) {
    const [, first, space, last] = match as unknown as [string, string, string, string];
    if (!isFirstName(first) || isColleague([first, last])) continue;
    count++;
    out += result.slice(cursor, match.index) + REDACTED_NAME;
    cursor = match.index + first.length + space.length + last.length;
    FULL_NAME.lastIndex = cursor;
  }
  return { text: out + result.slice(cursor), count };
}

/** Totéž pro hotový návrh: pojistka pro výstup služby, který by jméno doplnil sám. */
export function redactMinutes(content: MinutesContent, colleagues: string[] = []): MinutesContent {
  const clean = (line: string) => redactClientData(line, colleagues).text;
  return {
    summary: clean(content.summary),
    keyPoints: content.keyPoints.map(clean),
    decisions: content.decisions.map(clean),
    nextSteps: content.nextSteps.map(clean),
  };
}
