"use client";

import { useEffect, useRef, useState } from "react";
import { FEEDBACK_MARKS_MAX, FEEDBACK_RECT_LABEL, type FeedbackBox, type FeedbackMark } from "@/lib/feedback";
import { boxOf, cssSelector, describeElement } from "./page-context";

/** Označení v okně. `scroll` je posun stránky v okamžiku označení, aby šlo značku do snímku dokreslit na správné místo. Neodesílá se. */
export type ClientMark = FeedbackMark & { scroll: { x: number; y: number } };

export function toFeedbackMark({ kind, description, selector, box }: ClientMark): FeedbackMark {
  return { kind, description, selector, box };
}

type Props = {
  marks: ClientMark[];
  onChange: (marks: ClientMark[]) => void;
  /** Návrat do okna. Označení zůstanou. */
  onDone: () => void;
};

const MIN_RECT = 8;

/** Prvek pod kurzorem bez vrstvy označování (ta zachytává kliky, aby se na stránce nic nespustilo). */
function elementAt(layer: HTMLElement, x: number, y: number): Element | null {
  layer.style.pointerEvents = "none";
  const element = document.elementFromPoint(x, y);
  layer.style.pointerEvents = "";
  return element && element !== document.body && element !== document.documentElement && !element.closest("[data-feedback-ui]") ? element : null;
}

const normalize = (a: { x: number; y: number }, b: { x: number; y: number }): FeedbackBox => ({
  x: Math.round(Math.min(a.x, b.x)),
  y: Math.round(Math.min(a.y, b.y)),
  width: Math.round(Math.abs(a.x - b.x)),
  height: Math.round(Math.abs(a.y - b.y)),
});

/** Stejný prvek na stejném místě. Obdélníky se nikdy neslučují, každý tah je záměr. */
export function sameMark(a: ClientMark, b: ClientMark): boolean {
  if (a.kind !== "element" || b.kind !== "element" || a.selector !== b.selector) return false;
  return a.box.x + a.scroll.x === b.box.x + b.scroll.x && a.box.y + a.scroll.y === b.box.y + b.scroll.y && a.box.width === b.box.width && a.box.height === b.box.height;
}

const elementMark = (element: Element): ClientMark => ({
  kind: "element",
  description: describeElement(element),
  selector: cssSelector(element),
  box: boxOf(element),
  scroll: { x: window.scrollX, y: window.scrollY },
});

/**
 * Označení místa na stránce: klik nebo klepnutí vybere prvek, tah myší či prstem nakreslí obdélník. Vrstva leží
 * nad celou stránkou, takže klik nic nespustí (ani tažení karty v harmonogramu). Esc nebo „Hotovo“ vrátí do okna.
 * U posledního prvku jde výběr zvětšit na nadřazený prvek a zase zmenšit.
 */
export function MarkingLayer({ marks, onChange, onDone }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  /** Poslední označený prvek a cesta, kterou se k němu došlo přes „Větší“ (pro „Menší“). Jen v paměti. */
  const [picked, setPicked] = useState<{ index: number; path: Element[] } | null>(null);
  const [hover, setHover] = useState<FeedbackBox | null>(null);
  const [drawing, setDrawing] = useState<FeedbackBox | null>(null);
  const [toolbarTop, setToolbarTop] = useState(false);
  const full = marks.length >= FEEDBACK_MARKS_MAX;
  const last = picked && picked.index === marks.length - 1 ? picked : null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDone();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.documentElement.style.overflow;
    // Stránka se pod vrstvou nerolí, jinak by označení neodpovídala snímku.
    document.documentElement.style.overflow = "hidden";
    layer.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = overflow;
    };
  }, [onDone]);

  const add = (mark: ClientMark, element?: Element) => {
    if (full) return;
    // Druhé klepnutí na už označený prvek (třeba když se první zdálo nezaregistrované) nepřidá stejnou značku znovu.
    if (marks.some((other) => sameMark(other, mark))) return;
    setPicked(element ? { index: marks.length, path: [element] } : null);
    onChange([...marks, mark]);
  };

  /** „Větší“ vybere nadřazený prvek, „Menší“ se vrátí o krok zpět. */
  const resize = (direction: "up" | "down") => {
    if (!last) return;
    const path = [...last.path];
    if (direction === "up") {
      const parent = path.at(-1)?.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) return;
      path.push(parent);
    } else if (path.length > 1) path.pop();
    else return;
    const target = path.at(-1);
    if (!target) return;
    setPicked({ index: last.index, path });
    onChange(marks.map((mark, index) => (index === last.index ? elementMark(target) : mark)));
  };

  return (
    <div className="mark-layer" data-feedback-ui="" data-testid="vrstva-oznaceni">
      <div
        ref={layer}
        className="mark-surface"
        tabIndex={-1}
        aria-label="Plocha pro označení místa"
        onPointerMove={(event) => {
          if (start.current) {
            setDrawing(normalize(start.current, { x: event.clientX, y: event.clientY }));
            return;
          }
          const element = layer.current && elementAt(layer.current, event.clientX, event.clientY);
          setHover(element ? boxOf(element) : null);
        }}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(event) => {
          if (event.button !== 0 || full) return;
          // Žádný výběr textu ani nativní tažení pod vrstvou.
          event.preventDefault();
          start.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          const from = start.current;
          start.current = null;
          setDrawing(null);
          if (!from || !layer.current) return;
          const box = normalize(from, { x: event.clientX, y: event.clientY });
          if (box.width >= MIN_RECT && box.height >= MIN_RECT) {
            add({ kind: "rect", description: FEEDBACK_RECT_LABEL, selector: null, box, scroll: { x: window.scrollX, y: window.scrollY } });
            return;
          }
          const element = elementAt(layer.current, event.clientX, event.clientY);
          if (element) add(elementMark(element), element);
        }}
      />
      {hover && !drawing && !full && <div className="mark-box mark-hover" style={{ left: hover.x, top: hover.y, width: hover.width, height: hover.height }} />}
      {drawing && <div className="mark-box mark-drawing" style={{ left: drawing.x, top: drawing.y, width: drawing.width, height: drawing.height }} />}
      {marks.map((mark, index) => (
        <div key={index} className="mark-box mark-done" style={{ left: mark.box.x, top: mark.box.y, width: mark.box.width, height: mark.box.height }}>
          <span className="mark-number">{index + 1}</span>
        </div>
      ))}
      <div className={toolbarTop ? "mark-toolbar mark-toolbar-top" : "mark-toolbar"} role="region" aria-label="Označení místa">
        <p className="mark-hint" aria-live="polite">
          {full ? `Označeno ${FEEDBACK_MARKS_MAX} míst, víc už nejde.` : "Klikni nebo klepni na prvek, tažením vyznačíš oblast."}
        </p>
        {marks.length > 0 && (
          <ol className="mark-list">
            {marks.map((mark, index) => (
              <li key={index}>
                <span>
                  {index + 1}. {mark.description}
                </span>
                <button type="button" className="btn btn-small" onClick={() => {
                    setPicked(null);
                    onChange(marks.filter((_, i) => i !== index));
                  }} aria-label={`Odebrat označení ${index + 1}`}>
                  Odebrat
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="row mark-actions">
          {last && (
            <>
              <button type="button" className="btn btn-small" onClick={() => resize("down")} disabled={last.path.length < 2}>
                Menší
              </button>
              <button type="button" className="btn btn-small" onClick={() => resize("up")}>
                Větší
              </button>
            </>
          )}
          <button type="button" className="btn btn-small mark-toolbar-flip" onClick={() => setToolbarTop((top) => !top)}>
            {toolbarTop ? "Panel dolů" : "Panel nahoru"}
          </button>
          {marks.length > 0 && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                setPicked(null);
                onChange([]);
              }}
            >
              Zrušit vše
            </button>
          )}
          <button type="button" className="btn btn-small btn-primary" onClick={onDone}>
            Hotovo
          </button>
        </div>
      </div>
    </div>
  );
}
