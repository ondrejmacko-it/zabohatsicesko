import { FEEDBACK_SCREENSHOT_MAX_BYTES, FEEDBACK_SCREENSHOT_MAX_SIDE, type FeedbackScreenshotMime } from "@/lib/feedback";
import type { ClientMark } from "./MarkingLayer";

/**
 * Snímek viditelné části stránky pro hlášení (knihovna `modern-screenshot`, vykreslení v prohlížeči, nic se
 * neposílá jinam). Ochrana obsahu má dvě vrstvy: v kopii stránky se vymažou hodnoty polí a po vykreslení se
 * pole a citlivé části (zápisy, přepisy, nahrávky, účet) neprůhledně přetřou. Okno zpětné vazby, brouček
 * a vrstva označování se do snímku nedostanou vůbec.
 */

export type CapturedScreenshot = {
  blob: Blob;
  /** Náhled v okně. data: URL, protože CSP `img-src` nepovoluje blob:. */
  dataUrl: string;
  mime: FeedbackScreenshotMime;
  width: number;
  height: number;
};

/** Citlivý obsah mimo pole: zápisy, přepisy, nahrávky a účet. `data-feedback-redact` může doplnit kterákoli komponenta. */
const SENSITIVE_SELECTOR = ["[data-feedback-redact]", "[class*='minutes']", ".transcript", "[class*='recording']", ".account", ".signed-in"].join(", ");

/** Co se ve snímku po vykreslení přetře. */
export const REDACT_SELECTOR = [
  "input:not([type='hidden']):not([type='checkbox']):not([type='radio'])",
  "textarea",
  "select",
  "[contenteditable='true']",
  SENSITIVE_SELECTOR,
].join(", ");

/** Nejvyšší hustota snímku. Víc než dvojnásobek čtenáři hlášení nepomůže a jen zvětší soubor. */
const MAX_PIXEL_RATIO = 2;
/**
 * Mez plného vykreslení stránky před výřezem. Safari odmítne canvas nad 16 777 216 px plochy a každý prohlížeč
 * nad 16 384 px na stranu. Dlouhá stránka (harmonogram, Témata) se proto vykreslí v menším měřítku, nespadne.
 */
const MAX_RENDER_AREA = 16_000_000;
const MAX_RENDER_SIDE = 16_000;
/** Kolikrát se snímek zmenší o čtvrtinu, když se ani v nejnižší kvalitě nevejde do limitu. */
const MAX_SHRINKS = 3;

function excluded(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  // <noscript> by se v kopii vykreslil jako surový text.
  return node.hasAttribute("data-feedback-ui") || ["DIALOG", "NOSCRIPT", "SCRIPT", "TEMPLATE"].includes(node.tagName);
}

/**
 * Kopie stránky před vykreslením: citlivé části se skryjí a hodnoty polí vymažou. Nezávisí na poloze, takže platí
 * i tam, kde se kopie vykreslí jinak než živá stránka (lepkavé menu). Přetření po vykreslení je druhá pojistka.
 */
function scrubClone(node: Node) {
  if (node instanceof HTMLElement && node.matches(SENSITIVE_SELECTOR)) {
    node.style.setProperty("visibility", "hidden", "important");
    return;
  }
  if (node instanceof HTMLElement) keepSingleLine(node);
  if (node instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit"].includes(node.type)) {
    node.setAttribute("value", "");
    node.value = "";
    node.removeAttribute("placeholder");
  } else if (node instanceof HTMLTextAreaElement) {
    node.textContent = "";
    node.value = "";
  } else if (node instanceof HTMLSelectElement) {
    for (const option of node.options) option.textContent = "";
  }
}

type ClonedBox = Pick<CSSStyleDeclaration, "height" | "lineHeight" | "fontSize" | "boxSizing" | "paddingTop" | "paddingBottom" | "borderTopWidth" | "borderBottomWidth">;

/** Výška jednoho řádku textu podle stylu kopie; `normal` odhadem 1,3× velikost písma. */
export function clonedTextIsSingleLine(style: ClonedBox): boolean {
  const px = (value: string) => Number.parseFloat(value) || 0;
  const height = px(style.height);
  const line = px(style.lineHeight) || px(style.fontSize) * 1.3;
  if (height <= 0 || line <= 0) return false;
  const inner = style.boxSizing === "border-box" ? height - px(style.paddingTop) - px(style.paddingBottom) - px(style.borderTopWidth) - px(style.borderBottomWidth) : height;
  return inner < line * 1.5;
}

/**
 * modern-screenshot zapíše do kopie pevnou šířku a výšku každého prvku podle živé stránky. Text, který se na stránce
 * vešel bez rezervy (pilulky, položky menu), se v kopii zalomí nebo usekne, jakmile v ní písmo vyjde nepatrně širší
 * (telefon vykresluje kopii v jiném měřítku než stránku). Jednořádkový text proto v kopii nezalamujeme; šířky
 * zůstávají, takže rozložení i polohy značek a přetření se nemění.
 */
function keepSingleLine(element: HTMLElement) {
  const hasText = [...element.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim());
  if (hasText && clonedTextIsSingleLine(element.style)) element.style.setProperty("white-space", "nowrap");
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

/** WebP, kde ho prohlížeč umí zakódovat (Safari ne a vrátí PNG), jinak JPEG. Kvalita klesá, dokud se nevejde do limitu. */
async function encodeOnce(canvas: HTMLCanvasElement): Promise<{ blob: Blob; mime: FeedbackScreenshotMime } | null> {
  for (const mime of ["image/webp", "image/jpeg"] as const) {
    for (const quality of [0.8, 0.6, 0.4]) {
      const blob = await toBlob(canvas, mime, quality);
      if (!blob || blob.type !== mime) break;
      if (blob.size <= FEEDBACK_SCREENSHOT_MAX_BYTES) return { blob, mime };
    }
  }
  return null;
}

function release(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

/** Nevejde-li se snímek ani v nejnižší kvalitě, zmenší se o čtvrtinu, nejvýš třikrát. */
async function encode(canvas: HTMLCanvasElement): Promise<{ blob: Blob; mime: FeedbackScreenshotMime; width: number; height: number } | null> {
  let current = canvas;
  for (let shrink = 0; shrink <= MAX_SHRINKS; shrink += 1) {
    const encoded = await encodeOnce(current);
    if (encoded) {
      const result = { ...encoded, width: current.width, height: current.height };
      if (current !== canvas) release(current);
      return result;
    }
    const smaller = document.createElement("canvas");
    smaller.width = Math.max(1, Math.round(current.width * 0.75));
    smaller.height = Math.max(1, Math.round(current.height * 0.75));
    smaller.getContext("2d")?.drawImage(current, 0, 0, smaller.width, smaller.height);
    if (current !== canvas) release(current);
    current = smaller;
  }
  if (current !== canvas) release(current);
  return null;
}

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Snímek viditelné části okna nebo `null`, když se nepovede (hlášení se pak pošle bez něj).
 * Hustota podle zařízení (nejvýš 2×, delší strana nejvýš 2000 px), značky se dokreslí na místo, kde prvky
 * leží teď: posun stránky od označení se odečte.
 */
export async function captureScreenshot(marks: readonly ClientMark[]): Promise<CapturedScreenshot | null> {
  let full: HTMLCanvasElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  try {
    const { domToCanvas } = await import("modern-screenshot");
    // Celý <html>, ne <body>: u <body> knihovna v kopii přidá výchozí okraj prohlížeče a snímek se posune.
    const root = document.documentElement;
    const rootRect = root.getBoundingClientRect();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const outScale = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1, FEEDBACK_SCREENSHOT_MAX_SIDE / Math.max(width, height));
    const docWidth = Math.max(1, rootRect.width);
    const docHeight = Math.max(1, root.scrollHeight, rootRect.height);
    const renderScale = Math.min(outScale, Math.sqrt(MAX_RENDER_AREA / (docWidth * docHeight)), MAX_RENDER_SIDE / Math.max(docWidth, docHeight));
    full = await domToCanvas(root, { scale: renderScale, backgroundColor: "#e8e4df", filter: (node) => !excluded(node), onCloneEachNode: scrubClone });

    // Zvětšovat nad měřítko vykreslení nemá smysl, přidalo by to jen bajty.
    const scale = Math.min(outScale, renderScale);
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#e8e4df";
    ctx.fillRect(0, 0, width, height);
    // Výřez viditelné části: počátek okna leží v plném snímku na (-rootRect.left, -rootRect.top).
    const ratio = full.width / docWidth;
    ctx.drawImage(full, -rootRect.left * ratio, -rootRect.top * ratio, width * ratio, height * ratio, 0, 0, width, height);
    release(full);
    full = null;

    ctx.fillStyle = "#4a4642";
    for (const element of document.querySelectorAll(REDACT_SELECTOR)) {
      if (excluded(element) || element.closest("[data-feedback-ui], dialog")) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < height) ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
    }

    // Označená místa, aby čtenář hlášení viděl, co je „1“, „2“… Číslo nad rámečkem, u horního okraje uvnitř.
    ctx.strokeStyle = "#9d6219";
    ctx.lineWidth = 3;
    ctx.font = "bold 14px system-ui, sans-serif";
    marks.forEach((mark, index) => {
      const x = mark.box.x + (mark.scroll.x - window.scrollX);
      const y = mark.box.y + (mark.scroll.y - window.scrollY);
      ctx.strokeRect(x, y, mark.box.width, mark.box.height);
      const labelY = y < 22 ? y : y - 20;
      ctx.fillStyle = "#9d6219";
      ctx.fillRect(x, labelY, 22, 20);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(index + 1), x + 6, labelY + 15);
    });

    const encoded = await encode(canvas);
    if (!encoded) return null;
    return { ...encoded, dataUrl: await readDataUrl(encoded.blob) };
  } catch {
    return null;
  } finally {
    if (full) release(full);
    if (canvas) release(canvas);
  }
}
