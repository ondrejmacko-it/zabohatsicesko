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
  if (card.unpublishedChanges) return { label: "Zveřejněno · máš návrh změny", tone: "ochre" };
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
 * Chybějící údaje, které karta neukazuje jako řádek „— doplnit“ (typicky téma u Action time). Jen ty dostanou
 * ikonu výstrahy, aby karta nehlásila tentýž problém dvakrát (A-04).
 */
export function hiddenMissingDetails(card: EventCard, managing: boolean): string[] {
  const shown = new Set<string>(cardDetails(card, managing).filter((d) => d.missing).map((d) => (d.label === "Kdo" ? "vedoucí" : "téma")));
  return missingDetails(card, managing).filter((m) => !shown.has(m));
}

export type CardDetail = { label: "Kdo" | "Téma"; value: string; missing: boolean };

const sameText = (a: string, b: string) => a.trim().toLocaleLowerCase("cs") === b.trim().toLocaleLowerCase("cs");

/**
 * Kolonky Kdo a Téma na kartě harmonogramu. Svátek a zrušená akce je nemají. Nevyplněné pole správce
 * vidí jako „— doplnit“, účastník jako „Bude upřesněno“; u proběhlé akce účastník prázdné pole nevidí.
 * Téma shodné s názvem akce se neopakuje. Action time je pracovní blok bez tématu: Téma ukáže, jen když je vyplněné.
 */
export function cardDetails(card: EventCard, managing: boolean): CardDetail[] {
  if (card.type === "holiday" || card.planStatus === "cancelled") return [];
  const placeholder = managing ? "— doplnit" : card.past ? null : "Bude upřesněno";
  const field = (label: CardDetail["label"], value: string | null, optional = false): CardDetail | null =>
    value ? { label, value, missing: false } : placeholder && !optional ? { label, value: placeholder, missing: true } : null;
  const topic = card.topicTitle?.trim() || null;
  return [
    field("Kdo", card.leadName?.trim() || null),
    topic && sameText(topic, card.label) ? null : field("Téma", topic, card.type === "action"),
  ].filter((d): d is CardDetail => d !== null);
}

/**
 * Krátká rada správci k danému stavu. Účastník a vedoucí mají své úkoly v Přehledu,
 * proto pro ně (syncStatus je null a návrhy nevidí) vrací null.
 */
export function statusAdvice(card: EventCard): string | null {
  if (card.planStatus === "cancelled" || card.type === "holiday") return null;
  // Chybějící téma a vedoucího ukazují samotná pole („Doplň téma“), rada je neopakuje.
  if (card.planStatus === "draft") return "Kolegové návrh zatím nevidí.";
  if (card.syncStatus === "attention") return "Kalendář neodpovídá Wiki, je potřeba oprava.";
  // Rozpracovaný návrh změny má v detailu vlastní upozornění s tlačítky.
  if (card.unpublishedChanges) return null;
  if (card.syncStatus === "pending") return "Změna se posílá do Kalendáře.";
  // Osobní režim: pozvánka organizátora se nevede a doručení kolegům karta netvrdí (evidence je v detailu).
  if (card.syncStatus === "personal") return null;
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
 * Stav měsíce převedený na úkoly správce v bloku „Čeká na tebe“. Každý úkol vede na harmonogram
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
export type PlanFilter = { types?: EventType[]; states?: PlanState[] };

/**
 * Filtr harmonogramu podle typů akce a stavů. V jedné kategorii stačí shoda s kteroukoli vybranou hodnotou (NEBO),
 * mezi kategoriemi musí platit obě (A). Jen zužuje to, co uživatel už smí vidět.
 */
export function filterCards(cards: EventCard[], monthKey: string, filter: PlanFilter): EventCard[] {
  const types = filter.types ?? [];
  const states = filter.states ?? [];
  if (!types.length && !states.length) return cards;
  const gapIds = states.includes("doplnit") ? new Set(planGaps(cards, monthKey).map((g) => g.card.id)) : null;
  const matchesState = (card: EventCard) =>
    (states.includes("navrhy") && card.type !== "holiday" && awaitsPublishing(card)) || Boolean(gapIds?.has(card.id));
  return cards.filter((card) => (!types.length || types.includes(card.type)) && (!states.length || matchesState(card)));
}

/** Hodnoty filtru z adresy: opakovaný parametr (`typ=a&typ=b`) i čárkami oddělený seznam; jen povolené, bez duplicit. */
export function filterValues<T extends string>(raw: string | string[] | undefined, allowed: readonly T[]): T[] {
  const parts = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((v) => v.split(","));
  return allowed.filter((value) => parts.includes(value));
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

/** Akci jde přesunout jen budoucí, nezrušenou a ne svátek. Server totéž ověří znovu (`planMove`). */
export const isMovable = (card: EventCard) => card.revision !== null && card.type !== "holiday" && card.planStatus !== "cancelled" && !card.past;

export type CardActionKind = "edit" | "move" | "duplicate" | "publish" | "details" | "minutes" | "recording" | "cancel" | "delete";
export type CardAction = { kind: CardActionKind; label: string; danger?: boolean };

/**
 * Kdo se dívá: `managing` = správce ve svém pohledu (ne náhled očima skupiny nebo kolegy), `movable` = přesun
 * je v tomto zobrazení dostupný (od dneška dál), `now` = okamžik pro rozlišení budoucího návrhu.
 */
export type CardActionContext = { managing: boolean; preview: boolean; movable: boolean; now: Date };

/**
 * Rychlé akce v menu ⋯ karty harmonogramu podle stavu akce a role. Pořadí: hlavní akce, úpravy, méně časté
 * a jako poslední nebezpečná akce. Menu je jen zkratka, každou akci server ověří znovu. Ne-správce dostane menu,
 * jen když nabízí aspoň dvě položky, jinak stačí klik na kartu. Svátek menu nemá.
 */
export function cardActions(card: EventCard, ctx: CardActionContext): CardAction[] {
  if (card.type === "holiday") return [];
  const manage = ctx.managing && !ctx.preview;
  const actions: CardAction[] = [];
  const add = (kind: CardActionKind, label: string, danger = false) => actions.push(danger ? { kind, label, danger } : { kind, label });
  const cancelled = card.planStatus === "cancelled";
  const draft = card.planStatus === "draft";
  if (manage && !cancelled && (draft || !card.past)) {
    add("edit", "Upravit akci");
    if (ctx.movable && isMovable(card)) add("move", "Přesunout termín…");
    add("duplicate", "Duplikovat akci");
    if (draft && new Date(card.startsAt) > ctx.now) add("publish", "Zveřejnit návrh…");
    if (!draft) add("details", "Otevřít podrobnosti");
    add(draft ? "delete" : "cancel", draft ? "Smazat návrh…" : "Zrušit akci…", true);
    return actions;
  }
  if (draft) return [];
  add("details", "Otevřít podrobnosti");
  if (!cancelled && card.past) {
    if (card.minutesPublished) add("minutes", "Zobrazit zápis");
    // Zápis (a případnou nahrávku) obsluhuje vedoucí, kontrolor a správce, nikdy v náhledu očima jiného.
    if (card.handler && !ctx.preview) add("recording", card.minutesPublished ? "Upravit zápis" : "Doplnit zápis");
  }
  if (manage) add("duplicate", "Duplikovat jako novou");
  return manage || actions.length >= 2 ? actions : [];
}
