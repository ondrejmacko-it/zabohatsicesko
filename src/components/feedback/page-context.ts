import type { FeedbackBox, FeedbackContext } from "@/lib/feedback";

/**
 * Popis místa na stránce pro hlášení. Čte jen strukturu (roli, popisek, nadpis sekce), nikdy hodnoty polí:
 * u pole formuláře se použije jeho popisek, ne to, co do něj kdo napsal.
 */

const FIELD = "input, textarea, select, [contenteditable='true']";
const MAX_LABEL = 60;

const clip = (text: string, max = MAX_LABEL) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

const KIND: Record<string, string> = {
  a: "odkaz",
  button: "tlačítko",
  input: "pole",
  textarea: "pole",
  select: "výběr",
  img: "obrázek",
  table: "tabulka",
  li: "položka seznamu",
  h1: "nadpis",
  h2: "nadpis",
  h3: "nadpis",
  dialog: "okno",
};

function fieldLabel(field: Element): string {
  const labelled = field.getAttribute("aria-label");
  if (labelled) return labelled;
  const id = field.getAttribute("id");
  const label = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || field.closest("label");
  // Text popisku bez hodnot vnořených polí.
  if (label) return [...label.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE || !(node as Element).matches?.(FIELD)).map((node) => node.textContent ?? "").join(" ");
  return field.getAttribute("name") ?? "";
}

/** Krátké pojmenování prvku: druh + popisek. U polí jen popisek, nikdy hodnota. */
function elementName(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const kind = KIND[tag] ?? (element.getAttribute("role") === "button" ? "tlačítko" : "prvek");
  const text = element.matches(FIELD) ? fieldLabel(element) : element.getAttribute("aria-label") ?? (element.closest(FIELD) ? "" : element.textContent ?? "");
  const label = clip(text);
  return label ? `${kind} „${label}“` : kind;
}

/** Nejbližší nadpis sekce nebo okna, ve které prvek leží. */
function sectionName(element: Element): string | null {
  let node: Element | null = element;
  while (node && node !== document.body) {
    const heading = node.matches("section, dialog, main, article, aside, form") ? node.querySelector("h1, h2, h3") : null;
    if (heading && heading !== element) return clip(heading.textContent ?? "", 50) || null;
    node = node.parentElement;
  }
  return null;
}

export function describeElement(element: Element): string {
  const section = sectionName(element);
  return section ? `${elementName(element)} v sekci „${section}“` : elementName(element);
}

/** Krátký selektor pro vývojáře: id, `data-testid` nebo cesta přes třídy. Hodnoty atributů polí se nepoužijí. */
export function cssSelector(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.body && parts.length < 5) {
    const testId = node.getAttribute("data-testid");
    if (node.id && /^[\w-]+$/.test(node.id)) {
      parts.unshift(`#${node.id}`);
      break;
    }
    if (testId && /^[\w-]+$/.test(testId)) {
      parts.unshift(`[data-testid="${testId}"]`);
      break;
    }
    const classes = [...node.classList].filter((name) => /^[a-z][\w-]*$/.test(name)).slice(0, 2);
    parts.unshift(node.tagName.toLowerCase() + classes.map((name) => `.${name}`).join(""));
    node = node.parentElement;
  }
  return parts.join(" > ").slice(0, 500);
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
