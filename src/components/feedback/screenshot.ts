import { FEEDBACK_SCREENSHOT_MAX_BYTES, type FeedbackMark, type FeedbackScreenshotMime } from "@/lib/feedback";

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

const MAX_WIDTH = 1600;

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

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

/** WebP, kde ho prohlížeč umí zakódovat (Safari ne a vrátí PNG), jinak JPEG. Kvalita klesá, dokud se nevejde do limitu. */
async function encode(canvas: HTMLCanvasElement): Promise<{ blob: Blob; mime: FeedbackScreenshotMime } | null> {
  for (const mime of ["image/webp", "image/jpeg"] as const) {
    for (const quality of [0.8, 0.6, 0.4]) {
      const blob = await toBlob(canvas, mime, quality);
      if (!blob || blob.type !== mime) break;
      if (blob.size <= FEEDBACK_SCREENSHOT_MAX_BYTES) return { blob, mime };
    }
  }
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

/** Snímek nebo `null`, když se nepovede (hlášení se pak pošle bez něj). */
export async function captureScreenshot(marks: readonly FeedbackMark[]): Promise<CapturedScreenshot | null> {
  try {
    const { domToCanvas } = await import("modern-screenshot");
    // Celý <html>, ne <body>: u <body> knihovna v kopii přidá výchozí okraj prohlížeče a snímek se posune.
    const root = document.documentElement;
    const rootRect = root.getBoundingClientRect();
    const full = await domToCanvas(root, { scale: 1, backgroundColor: "#e8e4df", filter: (node) => !excluded(node), onCloneEachNode: scrubClone });

    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = Math.min(1, MAX_WIDTH / width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#e8e4df";
    ctx.fillRect(0, 0, width, height);
    // Výřez viditelné části: počátek okna leží v plném snímku na (-rootRect.left, -rootRect.top).
    const ratio = full.width / Math.max(1, rootRect.width);
    ctx.drawImage(full, -rootRect.left * ratio, -rootRect.top * ratio, width * ratio, height * ratio, 0, 0, width, height);

    ctx.fillStyle = "#4a4642";
    for (const element of document.querySelectorAll(REDACT_SELECTOR)) {
      if (excluded(element) || element.closest("[data-feedback-ui], dialog")) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < height) ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
    }

    // Označená místa, aby čtenář hlášení viděl, co je „1“, „2“…
    ctx.strokeStyle = "#9d6219";
    ctx.lineWidth = 3;
    ctx.font = "bold 14px system-ui, sans-serif";
    marks.forEach((mark, index) => {
      ctx.strokeRect(mark.box.x, mark.box.y, mark.box.width, mark.box.height);
      ctx.fillStyle = "#9d6219";
      ctx.fillRect(mark.box.x, mark.box.y - 20, 22, 20);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(index + 1), mark.box.x + 6, mark.box.y - 5);
    });

    const encoded = await encode(canvas);
    if (!encoded) return null;
    return { ...encoded, dataUrl: await readDataUrl(encoded.blob), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}
