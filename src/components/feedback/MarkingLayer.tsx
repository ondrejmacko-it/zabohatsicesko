"use client";

import { useEffect, useRef, useState } from "react";
import { FEEDBACK_MARKS_MAX, type FeedbackBox, type FeedbackMark } from "@/lib/feedback";
import { boxOf, cssSelector, describeElement } from "./page-context";

type Props = {
  marks: FeedbackMark[];
  onChange: (marks: FeedbackMark[]) => void;
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

/**
 * Označení místa na stránce: klik vybere prvek, tah myší nakreslí obdélník. Vrstva leží nad celou stránkou,
 * takže klik nic nespustí. Esc nebo „Hotovo“ vrátí do okna.
 */
export function MarkingLayer({ marks, onChange, onDone }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<FeedbackBox | null>(null);
  const [drawing, setDrawing] = useState<FeedbackBox | null>(null);
  const full = marks.length >= FEEDBACK_MARKS_MAX;

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

  const add = (mark: FeedbackMark) => {
    if (!full) onChange([...marks, mark]);
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
            add({ kind: "rect", description: "vyznačená oblast", selector: null, box });
            return;
          }
          const element = elementAt(layer.current, event.clientX, event.clientY);
          if (element) add({ kind: "element", description: describeElement(element).slice(0, 300), selector: cssSelector(element), box: boxOf(element) });
        }}
      />
      {hover && !drawing && !full && <div className="mark-box mark-hover" style={{ left: hover.x, top: hover.y, width: hover.width, height: hover.height }} />}
      {drawing && <div className="mark-box mark-drawing" style={{ left: drawing.x, top: drawing.y, width: drawing.width, height: drawing.height }} />}
      {marks.map((mark, index) => (
        <div key={index} className="mark-box mark-done" style={{ left: mark.box.x, top: mark.box.y, width: mark.box.width, height: mark.box.height }}>
          <span className="mark-number">{index + 1}</span>
        </div>
      ))}
      <div className="mark-toolbar" role="region" aria-label="Označení místa">
        <p className="mark-hint" aria-live="polite">
          {full ? `Označeno ${FEEDBACK_MARKS_MAX} míst, víc už nejde.` : "Klikněte na prvek, nebo tažením vyznačte oblast. Esc vrátí do okna."}
        </p>
        {marks.length > 0 && (
          <ol className="mark-list">
            {marks.map((mark, index) => (
              <li key={index}>
                <span>
                  {index + 1}. {mark.description}
                </span>
                <button type="button" className="btn btn-small" onClick={() => onChange(marks.filter((_, i) => i !== index))} aria-label={`Odebrat označení ${index + 1}`}>
                  Odebrat
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="row">
          {marks.length > 0 && (
            <button type="button" className="btn btn-small" onClick={() => onChange([])}>
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
