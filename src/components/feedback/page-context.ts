import type { FeedbackBox, FeedbackContext, FeedbackElementKind, FeedbackElementPlace } from "@/lib/feedback";

/**
 * Popis označeného místa pro hlášení. Používá jen strukturu stránky, nikdy její obsah: žádný text prvků,
 * nadpisů, popisků, `aria-label`, `title`, hodnot polí, id, tříd ani `data-*` atributů. V nich může být jméno
 * klienta, e-mail nebo text zápisu (i v dynamickém nadpisu či popisku tlačítka), a co je v nich, předem nevíme.
 * Popis tedy zní například „Tlačítko v okně“ nebo „Karta v harmonogramu“ a selektor je jen cesta značek.
 */

/** Druh prvku podle značky a role. Pořadí rozhoduje: první shoda vyhrává. */
const KINDS: readonly (readonly [selector: string, label: FeedbackElementKind])[] = [
  ["a[href^='/vzdelavani/akce/']", "Karta akce"],
  ["h1", "Nadpis stránky"],
  ["h2, h3, h4, h5, h6, legend", "Nadpis sekce"],
  ["button, [role='button'], input[type='button'], input[type='submit'], summary", "Tlačítko"],
  ["input[type='checkbox'], [role='checkbox']", "Zaškrtávací pole"],
  ["input[type='radio'], [role='radio']", "Přepínač"],
  ["select, [role='listbox'], [role='combobox']", "Výběr"],
  ["input, textarea, [contenteditable='true'], [role='textbox']", "Textové pole"],
  ["label", "Popisek pole"],
  ["a[href]", "Odkaz"],
  ["img, svg, picture", "Obrázek"],
  ["th, td", "Buňka tabulky"],
  ["table, thead, tbody, tr", "Tabulka"],
  ["li", "Položka seznamu"],
  ["dialog", "Okno"],
  ["[role='menuitem']", "Položka nabídky"],
];

/** Kde prvek leží, opět jen podle struktury. */
const PLACES: readonly (readonly [selector: string, label: FeedbackElementPlace])[] = [
  ["dialog, [role='dialog'], [role='alertdialog']", "v okně"],
  ["[role='menu']", "v nabídce"],
  ["table", "v tabulce"],
  ["form", "ve formuláři"],
  ["nav, .sidebar", "v menu"],
  ["header, .topbar", "v záhlaví"],
];

/** Harmonogram je tabulka týdnů. Karta akce v ní dostane přesnější název. */
const SCHEDULE = "table a[href^='/vzdelavani/akce/']";

function kindOf(element: Element): FeedbackElementKind {
  // Prvek uvnitř karty nebo tlačítka (ikona, text) se popíše jako celek, který uživatel vidí.
  const card = element.closest(SCHEDULE);
  if (card) return "Karta v harmonogramu";
  for (const [selector, label] of KINDS) if (element.closest(selector) === element) return label;
  const control = element.closest("button, a[href], label");
  if (control && control !== element) return kindOf(control);
  return "Prvek stránky";
}

function placeOf(element: Element): FeedbackElementPlace | null {
  for (const [selector, label] of PLACES) if (element.parentElement?.closest(selector)) return label;
  return null;
}

/** Bezpečný popis značky. Neobsahuje nic, co na stránce napsal nebo vyplnil člověk. */
export function describeElement(element: Element): string {
  const kind = kindOf(element);
  const place = kind === "Karta v harmonogramu" ? null : placeOf(element);
  return place ? `${kind} ${place}` : kind;
}

/**
 * Selektor pro vývojáře: jen názvy značek a pořadí mezi sourozenci (`main > section:nth-of-type(2) > button`).
 * Žádné id, třídy ani atributy, ty mohou nést identifikátory nebo obsah.
 */
export function cssSelector(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.body && node !== document.documentElement && parts.length < 8) {
    const tag = node.tagName.toLowerCase();
    if (!/^[a-z][a-z0-9-]{0,30}$/.test(tag)) break;
    const parent: Element | null = node.parentElement;
    const sameTag = parent ? [...parent.children].filter((child) => child.tagName === node!.tagName) : [];
    parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})` : tag);
    node = parent;
  }
  return parts.join(" > ");
}

export function boxOf(element: Element): FeedbackBox {
  const rect = element.getBoundingClientRect();
  return { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
}

/** Technický kontext. Jen cesta bez dotazu (`?…` může nést identifikátory), velikost okna a hustota pixelů. */
export function collectContext(): FeedbackContext {
  return {
    path: window.location.pathname.slice(0, 300) || "/",
    viewport: { width: window.innerWidth, height: window.innerHeight },
    pixelRatio: Math.round((window.devicePixelRatio || 1) * 100) / 100,
  };
}
