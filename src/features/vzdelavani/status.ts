import { monthOf, toDateKey } from "@/lib/time";
import type { EventCard } from "@/server/services/events";

export type Tone = "neutral" | "ochre" | "ok" | "danger" | "outline";
export type CardTone = "regular" | "extra" | "muted" | "draft";

/** Jeden nejdůležitější stav akce pro mřížku a seznam. Text vždy doplňuje barvu. */
export function primaryStatus(card: EventCard): { label: string; tone: Tone } | null {
  if (card.planStatus === "cancelled") return { label: "Zrušeno", tone: "danger" };
  if (card.type === "holiday") return { label: "Svátek", tone: "neutral" };
  if (card.planStatus === "draft") return { label: "Návrh", tone: "outline" };
  if (card.syncStatus === "attention") return { label: "Kalendář čeká na opravu", tone: "danger" };
  if (card.unpublishedChanges) return { label: "Zveřejněno · máte návrh změny", tone: "ochre" };
  if (card.syncStatus === "pending") return { label: "Kalendář se synchronizuje", tone: "ochre" };
  if (card.extraordinary) return { label: "Mimořádná akce", tone: "neutral" };
  return null;
}

/**
 * Co má organizátor u daného stavu udělat. Účastník a vedoucí mají své úkoly v Přehledu,
 * proto pro ně (syncStatus je null a návrhy nevidí) vrací null.
 */
export function statusAdvice(card: EventCard): string | null {
  if (card.planStatus === "cancelled" || card.type === "holiday") return null;
  if (card.planStatus === "draft") {
    const missing = [!card.topicTitle && "téma", !card.leadName && "vedoucího"].filter(Boolean).join(" a ");
    return missing
      ? `Návrh vidíte jen vy. Doplňte ${missing} a zveřejněte ho přes Upravit.`
      : "Návrh vidíte jen vy. Kolegové ho uvidí a dostanou pozvánku, až ho přes Upravit zveřejníte.";
  }
  if (card.syncStatus === "attention") return "Pozvánka v Kalendáři neodpovídá Wiki. Důvod a tlačítko pro nový pokus jsou níže v části Google Kalendář.";
  // Rozpracovaný návrh změny má v detailu vlastní upozornění s tlačítky.
  if (card.unpublishedChanges) return null;
  if (card.syncStatus === "pending") return "Změna se právě posílá do Kalendáře. Není potřeba nic dělat, stránka se obnoví sama.";
  if (card.syncStatus === "unlinked") return "Akce je zveřejněná ve Wiki, ale nemá pozvánku. Založte ji nebo spárujte níže v části Google Kalendář.";
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

export type MonthStep = { title: string; done: boolean; text: string };

/** Průvodce měsícem pro organizátora: termíny ze šablony, doplnění témat a vedoucích, zveřejnění. */
export function monthSteps(cards: EventCard[], monthKey: string): MonthStep[] {
  const mine = cards.filter((c) => c.type !== "holiday" && c.planStatus !== "cancelled" && monthOf(toDateKey(new Date(c.startsAt))) === monthKey);
  const incomplete = mine.filter((c) => !c.topicTitle || !c.leadName).length;
  const drafts = mine.filter((c) => c.planStatus === "draft").length;
  const changes = mine.filter((c) => c.planStatus !== "draft" && c.unpublishedChanges).length;
  const waiting = [drafts && `${drafts}× návrh`, changes && `${changes}× návrh změny`].filter(Boolean).join(", ");
  return [
    {
      title: "Termíny",
      done: mine.length > 0,
      text: mine.length ? `V plánu: ${mine.length}` : "Měsíc je prázdný. Doplňte ho ze šablony v Nástrojích organizátora, nebo přidejte akci.",
    },
    {
      title: "Témata a vedoucí",
      done: mine.length > 0 && incomplete === 0,
      text: !mine.length ? "Až budou termíny." : incomplete ? `Zbývá doplnit: ${incomplete}. Seznam je níže v K doplnění.` : "Vše doplněno.",
    },
    {
      title: "Zveřejnění",
      done: mine.length > 0 && !waiting,
      text: !mine.length ? "Až budou termíny." : waiting ? `Čeká: ${waiting}. Zveřejňuje se v detailu akce přes Upravit.` : "Vše zveřejněno.",
    },
  ];
}

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
