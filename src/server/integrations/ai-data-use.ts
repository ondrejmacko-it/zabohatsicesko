/**
 * F15: podmínka pro každou službu, která dostane text přepisu nebo poznámek (přepis nahrávky, návrh zápisu).
 * `training: "never"` je v typu jediná povolená hodnota: adaptér služby, která by data použila k trénování, se
 * nepřeloží. Za běhu to ověří ještě `assertNoTraining`, než se služba vůbec vybere. Hodnotu adaptér smí nastavit
 * jen podle smlouvy se službou (zákaz trénování, žádné nebo jen dočasné uchování dat), ne podle výchozího nastavení.
 */
export type AiDataUse = {
  readonly training: "never";
  /** `none` = data neopustí server (lokální implementace), `processing-only` = služba je smaže po zpracování. */
  readonly retention: "none" | "processing-only";
};

export class AiDataUseError extends Error {
  constructor(service: string) {
    super(`Služba ${service} nemá potvrzený zákaz trénování na datech.`);
    this.name = "AiDataUseError";
  }
}

export function assertNoTraining<T extends { readonly dataUse: AiDataUse }>(service: string, provider: T): T {
  const use = provider.dataUse as { training?: unknown; retention?: unknown } | undefined;
  if (use?.training !== "never" || (use.retention !== "none" && use.retention !== "processing-only")) throw new AiDataUseError(service);
  return provider;
}
