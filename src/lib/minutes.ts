import type { MinutesContent } from "./types";

/**
 * Zápis už má nějaký obsah. Ruční zápis vzniká jako prázdná šablona: dokud ji nikdo nevyplní, je
 * rozpracovaný, ne „čeká na schválení“ (uložení vyžaduje neprázdné Shrnutí).
 */
export function minutesStarted(content: MinutesContent): boolean {
  return content.summary.trim() !== "" || [...content.keyPoints, ...content.decisions, ...content.nextSteps].some((item) => item.trim() !== "");
}

/**
 * Název sekce zápisu a odkazů na ni: „Nahrávka a zápis“ jen když akce nahrávku má nebo zápis z ní vznikl,
 * jinak „Zápis“ (C-02, Z-12). Bez údajů o nahrávce (čtenář, karta) vždy „Zápis“.
 */
export function minutesSectionLabel(panel: { recording?: unknown; minutes?: { source?: string } | null }): "Nahrávka a zápis" | "Zápis" {
  return panel.recording || panel.minutes?.source === "recording" ? "Nahrávka a zápis" : "Zápis";
}
