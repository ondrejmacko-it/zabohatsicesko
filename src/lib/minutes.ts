import type { MinutesContent } from "./types";

/**
 * Zápis už má nějaký obsah. Ruční zápis vzniká jako prázdná šablona: dokud ji nikdo nevyplní, je
 * rozpracovaný, ne „čeká na schválení“ (uložení vyžaduje neprázdné Shrnutí).
 */
export function minutesStarted(content: MinutesContent): boolean {
  return content.summary.trim() !== "" || [...content.keyPoints, ...content.decisions, ...content.nextSteps].some((item) => item.trim() !== "");
}
