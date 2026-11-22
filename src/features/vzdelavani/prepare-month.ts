import type { Group } from "@/lib/types";

/**
 * Pravidla okna Připravit měsíc nad rozepsaným formulářem: co návrhu chybí, souhrnný přehled stavu a
 * hromadné doplnění vedoucího. Čisté funkce bez Reactu, ať jdou ověřit testem.
 */

/** Stav jednoho řádku tak, jak ho správce právě vidí ve formuláři. */
export type DraftRowState = {
  id: string;
  /** Svátek téma ani vedoucího nepotřebuje. */
  holiday: boolean;
  topic: boolean;
  lead: boolean;
  clash: boolean;
  picked: boolean;
};

export type OverviewKey = "ready" | "missingLead" | "missingTopic" | "clash" | "picked";

/** Počet řádků v kategorii a první z nich v pořadí, jak jsou v okně (cíl přechodu). */
export type OverviewItem = { key: OverviewKey; count: number; firstId: string | null };

/** Co návrhu chybí ke zveřejnění, v pořadí pro text „Chybí téma a vedoucí“. */
export function draftGaps(row: Pick<DraftRowState, "holiday" | "topic" | "lead">): string[] {
  if (row.holiday) return [];
  return [!row.topic && "téma", !row.lead && "vedoucí"].filter((gap): gap is string => Boolean(gap));
}

const matches: Record<OverviewKey, (row: DraftRowState) => boolean> = {
  // Připravený návrh má vše vyplněné a nic se s ním nekryje.
  ready: (row) => draftGaps(row).length === 0 && !row.clash,
  missingLead: (row) => !row.holiday && !row.lead,
  missingTopic: (row) => !row.holiday && !row.topic,
  clash: (row) => row.clash,
  picked: (row) => row.picked,
};

const ORDER: OverviewKey[] = ["ready", "missingLead", "missingTopic", "clash", "picked"];

/** Přehled stavu návrhů pro horní lištu okna. Řádky musí být v pořadí, v jakém jsou v okně. */
export function prepareOverview(rows: DraftRowState[]): OverviewItem[] {
  return ORDER.map((key) => {
    const hits = rows.filter(matches[key]);
    return { key, count: hits.length, firstId: hits[0]?.id ?? null };
  });
}

/**
 * Řádky, do kterých hromadné doplnění vedoucího zapíše: jen prázdné pole vedoucího, nikdy ne vyplněné.
 * Svátek vedoucího nepotřebuje, a tak se přeskočí.
 */
export function rowsMissingLead(rows: Array<Pick<DraftRowState, "id" | "holiday" | "lead">>): string[] {
  return rows.filter((row) => !row.holiday && !row.lead).map((row) => row.id);
}

/**
 * Hromadné doplnění vedoucího nad hodnotami polí (id řádku → vybraný vedoucí, prázdný řetězec = bez
 * vedoucího). Vrátí nové hodnoty a seznam změněných řádků. Vyplněná pole zůstávají beze změny.
 */
export function fillEmptyLeads(
  leads: Record<string, string>,
  leadId: string,
  holidays: ReadonlySet<string> = new Set(),
): { leads: Record<string, string>; filled: string[] } {
  if (!leadId) return { leads, filled: [] };
  const filled = rowsMissingLead(Object.entries(leads).map(([id, value]) => ({ id, holiday: holidays.has(id), lead: Boolean(value) })));
  return { leads: { ...leads, ...Object.fromEntries(filled.map((id) => [id, leadId])) }, filled };
}

/** Volby „Pro koho“ pro nové plánování: všichni, nebo jedna pracovní role (F01). */
export const PLANNED_AUDIENCES = ["vsichni", "fp", "rm"] as const satisfies readonly Group[];

/**
 * Nabídka „Pro koho“ u řádku návrhu. Starší skupina (např. `tym-a`) zůstane jen u návrhu, který ji už má,
 * aby se při uložení potichu nezměnila. Nový výběr ji nenabízí.
 */
export function audienceOptions(current: Group): Group[] {
  const planned: readonly Group[] = PLANNED_AUDIENCES;
  return planned.includes(current) ? [...planned] : [...planned, current];
}
