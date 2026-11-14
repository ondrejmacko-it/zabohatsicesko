import { formatDayMonth } from "@/lib/time";
import type { EventType } from "@/lib/types";

export type TopicStat = {
  id: string;
  name: string;
  audience: string;
  interestCount: number;
  interestedByViewer: boolean;
  /** Poslední proběhlé zveřejněné konání (dateKey), nebo null. */
  lastHeld: string | null;
  /** Nejbližší budoucí zveřejněné konání (dateKey), nebo null. */
  nextPlanned: string | null;
};

export type RankedTopic = TopicStat & { reason: string };

export function interestedLabel(count: number): string {
  if (count === 0) return "zatím bez zájemců";
  if (count === 1) return "1 zájemce";
  if (count < 5) return `${count} zájemci`;
  return `${count} zájemců`;
}

const collator = new Intl.Collator("cs");

/**
 * Vysvětlitelné doporučení: nejdřív témata, která nejsou naplánovaná, pak podle počtu zájemců,
 * pak déle neprobraná (neproběhlá jako první). Při shodě rozhoduje název a ID, pořadí je stabilní.
 */
export function rankTopics(stats: TopicStat[]): RankedTopic[] {
  return [...stats]
    .sort(
      (a, b) =>
        Number(a.nextPlanned !== null) - Number(b.nextPlanned !== null) ||
        b.interestCount - a.interestCount ||
        (a.lastHeld ?? "").localeCompare(b.lastHeld ?? "") ||
        collator.compare(a.name, b.name) ||
        a.id.localeCompare(b.id),
    )
    .map((topic) => ({
      ...topic,
      reason: [
        interestedLabel(topic.interestCount),
        topic.lastHeld ? `naposledy ${formatDayMonth(topic.lastHeld)}` : "zatím neproběhlo",
        topic.nextPlanned ? `naplánováno na ${formatDayMonth(topic.nextPlanned)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
}

/**
 * Typy, kterým generování měsíce předvyplní téma. Firemní vzdělávání vychází z témat od kolegů,
 * tréninkům a Action time určuje náplň vedoucí.
 */
export const TOPIC_DRIVEN_TYPES: ReadonlySet<EventType> = new Set<EventType>(["education-fp", "education-rm"]);

/** Téma se hodí k akci stejného publika, téma pro všechny ke každé akci. */
export function topicFitsAudience(topicAudience: string, eventAudience: string): boolean {
  return topicAudience === eventAudience || topicAudience === "vsichni";
}

/**
 * Návrh témat pro nové termíny ze šablony. Každému termínu (v pořadí, jak jdou za sebou) přiřadí
 * nejvýše doporučené téma jeho publika, o které má někdo zájem a které ještě není naplánované.
 * Jedno téma se v jednom běhu použije nejvýš jednou. Je to jen předvyplnění návrhu, rozhoduje správce.
 */
export function suggestTopics(
  slots: ReadonlyArray<{ generationKey: string; type: EventType; audience: string }>,
  ranked: ReadonlyArray<RankedTopic>,
  plannedTopicIds: ReadonlySet<string>,
): Map<string, RankedTopic> {
  const used = new Set(plannedTopicIds);
  const result = new Map<string, RankedTopic>();
  for (const slot of slots) {
    if (!TOPIC_DRIVEN_TYPES.has(slot.type)) continue;
    const topic = ranked.find(
      (t) => t.interestCount > 0 && t.nextPlanned === null && !used.has(t.id) && topicFitsAudience(t.audience, slot.audience),
    );
    if (!topic) continue;
    used.add(topic.id);
    result.set(slot.generationKey, topic);
  }
  return result;
}
