import { formatDayMonth } from "@/lib/time";
import type { EventType, Group } from "@/lib/types";
import { isRequiredForUser } from "@/server/domain/participation";

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
  /** ID akce nejbližšího budoucího zveřejněného konání (odkaz ze seznamu Témat). */
  nextPlannedId?: string | null;
  /** Nejbližší budoucí akce, která má téma jen v návrhu (dateKey). Plní se jen pro správce. */
  nextDraft?: string | null;
  nextDraftId?: string | null;
  /** Garantované téma: pořadí 1–3. Null nebo chybí = běžné téma. */
  priorityRank?: number | null;
  /** Ruční pořadí mezi ostatními tématy. Null nebo chybí = podle zájmu. */
  manualRank?: number | null;
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
        // Téma bez konání nic nepřidává: „zatím neproběhlo“ se opakovalo skoro všude (F12).
        topic.lastHeld ? `naposledy ${formatDayMonth(topic.lastHeld)}` : null,
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

/**
 * Pořadí seznamu Témat: podle počtu zájemců sestupně, při shodě abecedně a podle ID (stabilní).
 * Jen prezentace. Plánování a předvyplňování termínů dál používá `rankTopics`.
 */
export function sortByInterest<T extends Pick<TopicStat, "id" | "name" | "interestCount">>(topics: readonly T[]): T[] {
  return [...topics].sort((a, b) => b.interestCount - a.interestCount || collator.compare(a.name, b.name) || a.id.localeCompare(b.id));
}

/** Kolik témat z čela seznamu dostane štítek Nejžádanější. */
export const MOST_WANTED_COUNT = 3;

/** Nejžádanější témata: první tři podle zájmu, jen ta s aspoň jedním zájemcem. */
export function mostWantedIds(topics: readonly Pick<TopicStat, "id" | "name" | "interestCount">[]): Set<string> {
  return new Set(
    sortByInterest(topics)
      .filter((t) => t.interestCount > 0)
      .slice(0, MOST_WANTED_COUNT)
      .map((t) => t.id),
  );
}

/** Doporučit jde nenaplánované téma se zájmem aspoň jednoho člověka. Garantované téma i bez zájemců. */
export function isRecommendable(topic: { interestCount: number; nextPlanned?: string | null; priorityRank?: number | null }): boolean {
  return (topic.interestCount > 0 || isGuaranteed(topic)) && !topic.nextPlanned;
}

/** Téma se hodí k akci stejného publika, téma pro všechny ke každé akci. */
export function topicFitsAudience(topicAudience: string, eventAudience: string): boolean {
  return topicAudience === eventAudience || topicAudience === "vsichni";
}

// ——— Filtr Pro mou roli / Všechna (F10) ———

export type TopicFilter = "role" | "all";

/**
 * Téma pro mou roli: pro všechny, nebo pro některou z mých pracovních rolí či skupin. Víc rolí = témata všech
 * (stejné pravidlo jako povinnost akce, `isRequiredForUser`). Technická role (správce) se nepočítá.
 */
export function isTopicForRoles(audience: string, groups: readonly string[]): boolean {
  return isRequiredForUser(groups, audience as Group);
}

/** Filtr zachová pořadí vstupu, jen vynechá témata mimo role. */
export function filterTopics<T extends { audience: string }>(topics: readonly T[], groups: readonly string[], filter: TopicFilter): T[] {
  return filter === "all" ? [...topics] : topics.filter((t) => isTopicForRoles(t.audience, groups));
}

/**
 * Výchozí filtr: běžný kolega dřív viděl jen témata svých skupin, proto „Pro mou roli“. Správce plánuje pro
 * všechny a pořadí mění jen nad celým seznamem, proto „Všechna“.
 */
export function defaultTopicFilter(organizer: boolean): TopicFilter {
  return organizer ? "all" : "role";
}

/** Hodnota z adresy (`?filtr=role|vse`). Neznámá nebo chybějící = výchozí filtr. */
export function parseTopicFilter(value: string | string[] | undefined, organizer: boolean): TopicFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "role") return "role";
  if (raw === "vse") return "all";
  return defaultTopicFilter(organizer);
}

// ——— Garantovaná témata a ruční pořadí ———

type Ordered = Pick<TopicStat, "id" | "name" | "interestCount" | "priorityRank" | "manualRank">;

export const isGuaranteed = (topic: { priorityRank?: number | null }): boolean => topic.priorityRank != null;

/** Garantovaná témata podle pořadí (1..n, počet není omezený). */
export function guaranteedTopics<T extends Ordered>(topics: readonly T[]): T[] {
  return topics.filter(isGuaranteed).sort((a, b) => a.priorityRank! - b.priorityRank!);
}

/**
 * Ostatní témata: nejdřív ta s ručním pořadím (Posunout výš/níž), za nimi zbytek podle zájmu
 * (`sortByInterest`). Nové téma tak při ručním pořadí přibude na konec.
 */
export function otherTopics<T extends Ordered>(topics: readonly T[]): T[] {
  const rest = sortByInterest(topics.filter((t) => !isGuaranteed(t)));
  const ranked = rest.filter((t) => t.manualRank != null).sort((a, b) => a.manualRank! - b.manualRank!);
  return [...ranked, ...rest.filter((t) => t.manualRank == null)];
}

export const hasManualOrder = (topics: readonly Pick<TopicStat, "priorityRank" | "manualRank">[]): boolean =>
  topics.some((t) => !isGuaranteed(t) && t.manualRank != null);

/** Pořadí pro nově garantované téma: na konec garantovaných (pořadí jsou vždy sesypaná na 1..n). */
export function nextFreePriority(topics: readonly Pick<TopicStat, "priorityRank">[]): number {
  return topics.reduce((max, t) => Math.max(max, t.priorityRank ?? 0), 0) + 1;
}

export type TopicSection = "guaranteed" | "other";

/**
 * Přetažení tématu na cílovou pozici v garantovaných nebo ostatních. Vrátí nové pořadí obou seznamů,
 * nebo null, když se nic nemění (stejné místo, téma v žádném seznamu není). Ostatní témata si zachovají
 * vzájemné pořadí, index mimo rozsah se ořízne na začátek nebo konec cílového seznamu.
 */
export function placeInSections(
  order: { guaranteed: readonly string[]; others: readonly string[] },
  id: string,
  section: TopicSection,
  index: number,
): { guaranteed: string[]; others: string[] } | null {
  const from: TopicSection | null = order.guaranteed.includes(id) ? "guaranteed" : order.others.includes(id) ? "other" : null;
  if (!from) return null;
  const guaranteed = order.guaranteed.filter((t) => t !== id);
  const others = order.others.filter((t) => t !== id);
  const target = section === "guaranteed" ? guaranteed : others;
  const to = Math.min(target.length, Math.max(0, Math.trunc(index)));
  if (from === section && (section === "guaranteed" ? order.guaranteed : order.others).indexOf(id) === to) return null;
  target.splice(to, 0, id);
  return { guaranteed, others };
}

/**
 * Posun o jedno místo v daném pořadí: vrátí nové pořadí ID, nebo null, když téma už je na kraji
 * (nebo v pořadí není). Výměna se sousedem, ostatní zůstávají.
 */
export function moveInOrder(ids: readonly string[], id: string, target: "up" | "down" | number): string[] | null {
  const index = ids.indexOf(id);
  if (index < 0) return null;
  // Číslo = cílová pozice v seznamu (přetažení), mimo rozsah se ořízne na začátek nebo konec.
  const to = typeof target === "number" ? Math.min(ids.length - 1, Math.max(0, Math.trunc(target))) : target === "up" ? index - 1 : index + 1;
  if (to < 0 || to >= ids.length || to === index) return null;
  const next = [...ids];
  next.splice(index, 1);
  next.splice(to, 0, id);
  return next;
}

/**
 * Doporučená témata pro akci dané skupiny: jen vhodná a doporučitelná (`isRecommendable`), v pořadí
 * garantovaná podle priority → téma přímo pro skupinu (před tématem pro všechny) → pořadí vstupu
 * (u `rankTopics` zájem a historie). Formulář akce i doplnění měsíce používají stejné pořadí.
 */
export function recommendTopics<T extends { id: string; audience: string; interestCount: number; nextPlanned?: string | null; priorityRank?: number | null }>(
  topics: readonly T[],
  eventAudience: string,
): T[] {
  return topics
    .map((topic, index) => ({ topic, index }))
    .filter(({ topic }) => isRecommendable(topic) && topicFitsAudience(topic.audience, eventAudience))
    .sort(
      (a, b) =>
        // Garantované vždy před ostatními bez ohledu na číslo pořadí, mezi sebou podle pořadí.
        Number(!isGuaranteed(a.topic)) - Number(!isGuaranteed(b.topic)) ||
        (a.topic.priorityRank ?? 0) - (b.topic.priorityRank ?? 0) ||
        Number(a.topic.audience !== eventAudience) - Number(b.topic.audience !== eventAudience) ||
        a.index - b.index,
    )
    .map(({ topic }) => topic);
}

/** Budoucí akce, kterou lze pro téma zvážit v okně Naplánovat téma. */
export type PlanEvent = {
  id: string;
  revision: number;
  type: EventType;
  label: string;
  audience: string;
  status: "draft" | "published" | "cancelled";
  startsAt: Date;
  topicId: string | null;
  topicTitle: string | null;
};

export type PlanCandidate = PlanEvent & { draft: boolean; reason: string };

/** Kolik akcí okno Naplánovat téma nabídne. */
export const PLAN_CANDIDATES = 5;

/**
 * Kam téma naplánovat: budoucí nezrušené akce bez tématu, pro které se téma hodí skupinou. Přednost má
 * návrh (uloží se jen návrh, nic se neodešle) s typem řízeným tématem a se stejnou skupinou, pak dřívější
 * termín. Zveřejněná akce je až za návrhy, její změna jde pozvaným a zveřejňuje se s kontrolou dopadu.
 * `scheduled` = nejbližší budoucí akce, která téma už má (i návrh). Svátek se nenabízí nikdy.
 */
export function planCandidates(
  topic: { id: string; audience: string },
  upcoming: readonly PlanEvent[],
  limit = PLAN_CANDIDATES,
): { scheduled: PlanEvent | null; candidates: PlanCandidate[] } {
  const live = [...upcoming].filter((e) => e.status !== "cancelled" && e.type !== "holiday").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const scheduled = live.find((e) => e.topicId === topic.id) ?? null;
  const rank = (e: PlanEvent) => (e.status === "draft" ? 0 : 2) + (TOPIC_DRIVEN_TYPES.has(e.type) ? 0 : 1);
  const candidates = live
    .filter((e) => !e.topicTitle && topicFitsAudience(topic.audience, e.audience))
    .map((e, index) => ({ e, index }))
    .sort((a, b) => rank(a.e) - rank(b.e) || Number(a.e.audience !== topic.audience) - Number(b.e.audience !== topic.audience) || a.index - b.index)
    .slice(0, limit)
    .map(({ e }) => ({
      ...e,
      draft: e.status === "draft",
      // Krátce, jeden řádek: podrobnosti dopadu ukáže až potvrzení zveřejnění v okně akce.
      reason: [
        e.status === "draft" ? "návrh" : "zveřejněno, změnu potvrdíš",
        e.audience === topic.audience ? null : "téma je pro všechny",
      ]
        .filter(Boolean)
        .join(" · "),
    }));
  return { scheduled, candidates };
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
    // Stejné pořadí jako doporučení ve formuláři: garantovaná témata skupiny, pak témata skupiny, pak zájem.
    const topic = recommendTopics(ranked, slot.audience).find((t) => !used.has(t.id));
    if (!topic) continue;
    used.add(topic.id);
    result.set(slot.generationKey, topic);
  }
  return result;
}

/** Akce v historii revizí, kterými správce rozhodne o tématu doporučeném při generování. */
export const TOPIC_ACCEPT = "topic_accept";
export const TOPIC_REJECT = "topic_reject";

/**
 * Doporučení čeká na rozhodnutí správce, když téma předvyplnilo generování a od té doby se nezměnilo
 * ani nebylo přijato. Ruční změna tématu (i na prázdné) nebo odmítnutí doporučení ukončí natrvalo,
 * stejné téma zadané později znovu už je rozhodnutí správce. Historie stačí, nová struktura v DB není potřeba.
 */
export function suggestionPending(
  topicId: string | null,
  history: ReadonlyArray<{ action: string; topicId: string | null }>,
): boolean {
  if (!topicId) return false;
  const generated = history.find((h) => h.action === "generate");
  return generated?.topicId === topicId && history.every((h) => h.topicId === topicId && h.action !== TOPIC_ACCEPT);
}
