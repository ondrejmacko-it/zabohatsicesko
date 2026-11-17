import { monthOf, toDateKey } from "@/lib/time";
import type { EventType } from "@/lib/types";
import type { EventCard } from "@/server/services/events";

export type Tone = "neutral" | "ochre" | "ok" | "danger" | "outline" | "draft";
export type CardTone = "regular" | "extra" | "muted" | "draft";

/** Jeden nejdůležitější stav akce pro mřížku a seznam. Text vždy doplňuje barvu. */
export function primaryStatus(card: EventCard): { label: string; tone: Tone } | null {
  if (card.planStatus === "cancelled") return { label: "Zrušeno", tone: "danger" };
  if (card.type === "holiday") return { label: "Svátek", tone: "neutral" };
  if (card.planStatus === "draft") return { label: "Návrh", tone: "draft" };
  if (card.syncStatus === "attention") return { label: "Kalendář čeká na opravu", tone: "danger" };
  if (card.unpublishedChanges) return { label: "Zveřejněno · máte návrh změny", tone: "ochre" };
  if (card.syncStatus === "pending") return { label: "Kalendář se synchronizuje", tone: "ochre" };
  if (card.extraordinary) return { label: "Mimořádná akce", tone: "neutral" };
  return null;
}

/**
 * Životní stav akce pro detail: vždy právě jeden štítek, aby byl stav vidět i bez barvy.
 * Zrušení má přednost před vším (i před svátkem a proběhnutím), návrh před proběhnutím.
 */
export function lifecycleStatus(card: EventCard): { label: string; tone: Tone } {
  if (card.planStatus === "cancelled") return { label: "Zrušeno", tone: "danger" };
  if (card.type === "holiday") return { label: "Svátek", tone: "neutral" };
  if (card.planStatus === "draft") return { label: "Návrh", tone: "draft" };
  if (card.past) return { label: "Proběhlo", tone: "neutral" };
  return { label: "Zveřejněno", tone: "ok" };
}

/**
 * Štítky v hlavičce detailu: životní stav a nejvýš jeden doplněk, který něco znamená (rozpracovaná změna,
 * chyba Kalendáře, mimořádnost). Zrušená akce a svátek doplněk nemají. Běžící synchronizace štítek nemá.
 */
export function detailBadges(card: EventCard): Array<{ label: string; tone: Tone }> {
  const badges = [lifecycleStatus(card)];
  if (card.planStatus === "cancelled" || card.type === "holiday") return badges;
  if (card.syncStatus === "attention") badges.push({ label: "Kalendář k opravě", tone: "danger" });
  else if (card.unpublishedChanges) badges.push({ label: "Návrh změny", tone: "ochre" });
  else if (card.extraordinary) badges.push({ label: "Mimořádná", tone: "neutral" });
  return badges;
}

/**
 * Jediný štítek karty v Plánu: stav, který něco znamená. Synchronizace, která běží sama, štítek nemá.
 * Chybějící údaje ukazuje zvlášť decentní indikátor (`missingDetails`), ne další štítky.
 */
export function cardStatus(card: EventCard): { label: string; tone: Tone } | null {
  if (card.planStatus === "cancelled") return { label: "Zrušeno", tone: "danger" };
  if (card.type === "holiday") return null;
  if (card.planStatus === "draft") return { label: "Návrh", tone: "draft" };
  if (card.syncStatus === "attention") return { label: "Kalendář k opravě", tone: "danger" };
  if (card.unpublishedChanges) return { label: "Návrh změny", tone: "ochre" };
  if (card.extraordinary) return { label: "Mimořádná", tone: "neutral" };
  return null;
}

/** Co akci chybí (jen správce): „téma“, „vedoucí“. Svátek a zrušená akce nic nepotřebují. */
export function missingDetails(card: EventCard, managing: boolean): string[] {
  if (!managing || card.type === "holiday" || card.planStatus === "cancelled") return [];
  return [!card.topicTitle && "téma", !card.leadName && "vedoucí"].filter((m): m is string => Boolean(m));
}

/**
 * Krátká rada správci k danému stavu. Účastník a vedoucí mají své úkoly v Přehledu,
 * proto pro ně (syncStatus je null a návrhy nevidí) vrací null.
 */
export function statusAdvice(card: EventCard): string | null {
  if (card.planStatus === "cancelled" || card.type === "holiday") return null;
  // Chybějící téma a vedoucího ukazují samotná pole („Doplňte téma“), rada je neopakuje.
  if (card.planStatus === "draft") return "Kolegové návrh zatím nevidí.";
  if (card.syncStatus === "attention") return "Kalendář neodpovídá Wiki, je potřeba oprava.";
  // Rozpracovaný návrh změny má v detailu vlastní upozornění s tlačítky.
  if (card.unpublishedChanges) return null;
  if (card.syncStatus === "pending") return "Změna se posílá do Kalendáře.";
  // U proběhlé akce už chybějící pozvánka nic neřeší, správce by jen zbytečně hledal opravu.
  if (card.syncStatus === "unlinked" && !card.past) return "Akce zatím nemá pozvánku v Kalendáři.";
  return null;
}

export function cardTone(card: EventCard): CardTone {
  if (card.planStatus === "cancelled" || card.type === "holiday") return "muted";
  if (card.planStatus === "draft") return "draft";
  if (card.extraordinary) return "extra";
  return "regular";
}

export const badgeClass = (tone: Tone) =>
  ({ neutral: "badge", ochre: "badge badge-ochre", ok: "badge badge-ok", danger: "badge badge-danger", outline: "badge badge-outline", draft: "badge badge-draft" })[tone];

const inPlan = (card: EventCard, monthKey: string) =>
  card.type !== "holiday" && card.planStatus !== "cancelled" && monthOf(toDateKey(new Date(card.startsAt))) === monthKey;

/** Čeká na zveřejnění: nový návrh, nebo rozpracovaná změna zveřejněné akce. */
export const awaitsPublishing = (card: EventCard) =>
  card.planStatus === "draft" || (card.planStatus === "published" && card.unpublishedChanges);

export type MonthSummary = { planned: number; toPublish: number; toComplete: number };

/** Stav měsíce pro správce: kolik je v plánu, co čeká na zveřejnění a co na doplnění. */
export function monthSummary(cards: EventCard[], monthKey: string): MonthSummary {
  const mine = cards.filter((c) => inPlan(c, monthKey));
  return {
    planned: mine.length,
    toPublish: mine.filter(awaitsPublishing).length,
    toComplete: planGaps(cards, monthKey).length,
  };
}

/** „1 termín“, „3 termíny“, „9 termínů“. */
const plural = (count: number, one: string, few: string, many: string) => `${count} ${count === 1 ? one : count >= 2 && count <= 4 ? few : many}`;

export type MonthTask = { state: PlanState; title: string; detail: string; action: string };

/**
 * Stav měsíce převedený na úkoly správce v bloku „Čeká na vás“. Každý úkol vede na harmonogram
 * zúžený na příslušné termíny (stejný filtr jako výběr Stav).
 */
export function monthTasks(summary: MonthSummary, monthName: string): MonthTask[] {
  const tasks: MonthTask[] = [];
  if (summary.toComplete > 0) {
    tasks.push({
      state: "doplnit",
      title: `${monthName}: ${plural(summary.toComplete, "termín", "termíny", "termínů")} k doplnění`,
      detail: "Chybí téma, vedoucí nebo oprava v Kalendáři.",
      action: "Zobrazit termíny",
    });
  }
  if (summary.toPublish > 0) {
    tasks.push({
      state: "navrhy",
      title: `${monthName}: ${plural(summary.toPublish, "návrh čeká", "návrhy čekají", "návrhů čeká")} na zveřejnění`,
      detail: "Kolegové je uvidí až po zveřejnění.",
      action: "Zobrazit návrhy",
    });
  }
  return tasks;
}

export const PLAN_STATES = ["navrhy", "doplnit"] as const;
export type PlanState = (typeof PLAN_STATES)[number];
export type PlanFilter = { type?: EventType; state?: PlanState };

/** Filtr harmonogramu podle typu akce a stavu. Jen zužuje to, co uživatel už smí vidět. */
export function filterCards(cards: EventCard[], monthKey: string, filter: PlanFilter): EventCard[] {
  if (!filter.type && !filter.state) return cards;
  const gapIds = filter.state === "doplnit" ? new Set(planGaps(cards, monthKey).map((g) => g.card.id)) : null;
  return cards.filter(
    (card) =>
      (!filter.type || card.type === filter.type) &&
      (filter.state !== "navrhy" || (card.type !== "holiday" && awaitsPublishing(card))) &&
      (!gapIds || gapIds.has(card.id)),
  );
}

export type PlanGap = { card: EventCard; reasons: string[] };

/**
 * Termíny vybraného měsíce, které správce ještě musí dotáhnout: bez tématu, bez vedoucího
 * nebo s problémem synchronizace. Svátky a zrušené akce se nepočítají.
 */
export function planGaps(cards: EventCard[], monthKey: string): PlanGap[] {
  return cards
    .filter((c) => inPlan(c, monthKey))
    .map((card) => ({
      card,
      reasons: [
        !card.topicTitle && "chybí téma",
        !card.leadName && "chybí vedoucí",
        card.syncStatus === "attention" && "Kalendář čeká na opravu",
      ].filter((r): r is string => Boolean(r)),
    }))
    .filter((gap) => gap.reasons.length > 0);
}

/** Návrh, který jde v Plánu hromadně označit: nikdy nezveřejněná akce (ne svátek). Návrh změny má vlastní potvrzení. */
export const isPickable = (card: EventCard) => card.planStatus === "draft" && card.type !== "holiday" && card.revision !== null;
