import { eventTitle } from "@/lib/labels";
import type { MinutesContent } from "@/lib/types";
import { assertNoTraining, type AiDataUse } from "@/server/integrations/ai-data-use";

/**
 * Integrační hranice: z textu (přepis, poznámky, obsah souboru) vznikne návrh zápisu ve šabloně
 * Shrnutí / Hlavní body / Rozhodnutí / Další kroky. Návrh je vždy jen podklad, upravuje ho a schvaluje člověk.
 *
 * Dnes existuje jediná lokální implementace bez sítě. Budoucí služba (schválený model shrnutí v testovacím
 * režimu, stejně jako `TranscriptionProvider` u přepisu) implementuje totéž rozhraní a vybere se v
 * `minutesDrafter()` podle konfigurace serveru. Její výstup je nedůvěryhodný: volající ho vždy validuje
 * přes `minutesSchema`, text se posílá jen se souhlasem organizace a do logu se nikdy nezapisuje.
 * F15: služba dostane text až po `redactClientData` (bez jmen a kontaktů klientů) a musí mít `dataUse` se
 * zákazem trénování, jinak ji `minutesDrafter()` nevybere.
 */
export interface MinutesDrafter {
  readonly dataUse: AiDataUse;
  draft(text: string, context: { label: string; topicTitle: string | null }): Promise<MinutesContent>;
}

type Section = keyof MinutesContent;

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Nadpisy sekcí, jak je lidé píší v poznámkách (česky i anglicky, s # nebo dvojtečkou). */
const HEADINGS: Array<[Section, RegExp]> = [
  ["summary", /^(shrnuti|souhrn|summary|uvod)$/],
  ["keyPoints", /^(hlavni body|body|klicove body|poznamky|key points|notes|discussion)$/],
  ["decisions", /^(rozhodnuti|dohody|dohodnuto|decisions|agreed)$/],
  ["nextSteps", /^(dalsi kroky|ukoly|kroky|next steps|action items|todo|to do)$/],
];

const DECISION = /(rozhodl|rozhodnut|dohodl|dohodnut|shodl|schvalil|schvalen|agreed|decided)/;
const NEXT_STEP = /(doplni|posle|rozesle|pripravi|zajisti|overi|domluvi|do patku|do pondeli|do konce|termin|ukol|will |by friday|todo|action)/;

const MAX_ITEMS = 20;
const MAX_LINE = 500;
const MAX_SUMMARY = 300;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Nadpis sekce na samostatném řádku („## Rozhodnutí“, „Další kroky:“) nebo s textem za dvojtečkou („Shrnutí: …“). */
function headingOf(line: string): { section: Section; rest: string } | null {
  const match = /^(?:#{1,6}\s*)?([^:：]{1,30}?)\s*(?:[:：]\s*(.*))?$/u.exec(line);
  if (!match) return null;
  const bare = fold(match[1]!.trim());
  const section = HEADINGS.find(([, pattern]) => pattern.test(bare))?.[0];
  return section ? { section, rest: (match[2] ?? "").trim() } : null;
}

const stripBullet = (line: string) => line.replace(/^\s*(?:[-*•–]|\d{1,2}[.)]|\[[ xX]?\])\s+/, "").trim();

/** Odstavec bez odrážek rozdělí na věty, aby šly zařadit jednotlivě. */
const sentences = (line: string) =>
  line
    .split(/(?<=[.!?])\s+(?=[\p{Lu}\d])/u)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Lokální rozdělení textu do šablony. Deterministické a bez sítě: nadpisy sekcí mají přednost, zbytek
 * se zařadí podle klíčových slov (rozhodnutí, úkoly), ostatní jsou hlavní body. Nic se nedomýšlí.
 */
export function draftFromText(text: string, context: { label: string; topicTitle: string | null }): MinutesContent {
  const sections: Record<Section, string[]> = { summary: [], keyPoints: [], decisions: [], nextSteps: [] };
  const loose: string[] = [];
  let current: Section | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const heading = headingOf(line);
    if (heading) {
      current = heading.section;
      if (heading.rest) sections[current].push(stripBullet(heading.rest) || heading.rest);
      continue;
    }
    const item = stripBullet(line);
    if (!item) continue;
    if (current) sections[current].push(item);
    else loose.push(...(item === line ? sentences(item) : [item]));
  }

  let summary = sections.summary.join(" ");
  if (!summary && loose.length) summary = loose.shift()!;
  for (const item of loose) {
    const folded = fold(item);
    if (DECISION.test(folded)) sections.decisions.push(item);
    else if (NEXT_STEP.test(folded)) sections.nextSteps.push(item);
    else sections.keyPoints.push(item);
  }
  if (!summary) summary = sections.keyPoints[0] ?? sections.decisions[0] ?? sections.nextSteps[0] ?? "";
  if (!summary) summary = eventTitle(context.label, context.topicTitle);

  const list = (items: string[]) => items.slice(0, MAX_ITEMS).map((item) => clip(item, MAX_LINE));
  return {
    summary: clip(summary, MAX_SUMMARY),
    keyPoints: list(sections.keyPoints),
    decisions: list(sections.decisions),
    nextSteps: list(sections.nextSteps),
  };
}

export class LocalTemplateDrafter implements MinutesDrafter {
  // Lokální šablona: text neopustí server.
  readonly dataUse: AiDataUse = { training: "never", retention: "none" };
  async draft(text: string, context: { label: string; topicTitle: string | null }): Promise<MinutesContent> {
    return draftFromText(text, context);
  }
}

export function minutesDrafter(): MinutesDrafter {
  return assertNoTraining("návrh zápisu", new LocalTemplateDrafter());
}
