/** Parametry adresy, které jen filtrují nebo přepínají zobrazení. Ostatní (`akce`, `den`, `kopie`, `tema`…) otevírají okno. */
const VIEW_PARAMS = new Set(["mesic", "pohled", "ucast", "typ", "stav", "filtr", "skupina", "q", "hledat"]);

/** Stránky jen pro správce. V náhledu účastníka by ukázaly jen „nemáš přístup“. */
const ORGANIZER_ONLY = ["/sprava", "/vzdelavani/integrace"];

/**
 * Kam po přepnutí náhledu. Otevřené okno se zavře (jeho obsah zobrazený nemusí vidět), detail akce vede na Plán
 * a stránka jen pro správce na Domů. Ochrana adres a serverových akcí zůstává na serveru, tohle jen šetří slepou stránku.
 */
export function previewLanding(path: string, viewerOrganizes: boolean): string {
  const url = new URL(path, "http://wiki.invalid");
  const onPath = (prefix: string) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);
  if (!viewerOrganizes && ORGANIZER_ONLY.some(onPath)) return "/";
  if (onPath("/vzdelavani/akce")) return "/vzdelavani/harmonogram";
  const kept = new URLSearchParams();
  for (const [key, value] of url.searchParams) if (VIEW_PARAMS.has(key)) kept.append(key, value);
  const query = kept.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}
