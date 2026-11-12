import { formatDayMonth } from "@/lib/time";

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
