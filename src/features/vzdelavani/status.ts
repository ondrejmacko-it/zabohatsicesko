import { monthOf, toDateKey } from "@/lib/time";
import type { EventCard } from "@/server/services/events";

export type Tone = "neutral" | "ochre" | "ok" | "danger" | "outline";
export type CardTone = "regular" | "extra" | "muted" | "draft";

/** Jeden nejdůležitější stav akce pro mřížku a seznam. Text vždy doplňuje barvu. */
export function primaryStatus(card: EventCard): { label: string; tone: Tone } | null {
  if (card.planStatus === "cancelled") return { label: "Zrušeno", tone: "danger" };
  if (card.type === "holiday") return { label: "Svátek", tone: "neutral" };
  if (card.planStatus === "draft") return { label: "Návrh", tone: "outline" };
  if (card.syncStatus === "attention") return { label: "Kalendář: pozornost", tone: "danger" };
  if (card.unpublishedChanges) return { label: "Neveřejné změny", tone: "ochre" };
  if (card.syncStatus === "pending") return { label: "Kalendář: čeká", tone: "ochre" };
  if (card.extraordinary) return { label: "Mimořádná akce", tone: "neutral" };
  return null;
}

export function cardTone(card: EventCard): CardTone {
  if (card.planStatus === "cancelled" || card.type === "holiday") return "muted";
  if (card.planStatus === "draft") return "draft";
  if (card.extraordinary) return "extra";
  return "regular";
}

export const badgeClass = (tone: Tone) =>
  ({ neutral: "badge", ochre: "badge badge-ochre", ok: "badge badge-ok", danger: "badge badge-danger", outline: "badge badge-outline" })[tone];

export type PlanGap = { card: EventCard; reasons: string[] };

/**
 * Termíny vybraného měsíce, které organizátor ještě musí dotáhnout: bez tématu, bez vedoucího
 * nebo s problémem synchronizace. Svátky a zrušené akce se nepočítají.
 */
export function planGaps(cards: EventCard[], monthKey: string): PlanGap[] {
  return cards
    .filter((c) => c.type !== "holiday" && c.planStatus !== "cancelled" && monthOf(toDateKey(new Date(c.startsAt))) === monthKey)
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
