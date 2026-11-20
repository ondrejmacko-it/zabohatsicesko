"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BUG_SIZE, BUG_TAB_WIDTH, moveBugDock, parseBugDock, placeBug, serializeBugDock, snapBugDock, type BugDock, type BugPlacement, type ScreenBox } from "@/lib/bug-dock";
import { Icon } from "../Icon";

export const BUG_STORAGE_KEY = "zbc-broucek";
/** Brouček jen na počítači s myší. Telefon a tablet mají položku v menu. */
const DESKTOP_QUERY = "(min-width: 900px) and (pointer: fine)";
/** Hlavní ovládání, které brouček nesmí zakrýt. */
const OBSTACLES = "[data-bug-avoid], .select-bar, .move-panel, .flash, .btn-primary, .sidebar";
const DRAG_THRESHOLD = 4;

export function readBugDock(): BugDock {
  try {
    return parseBugDock(window.localStorage.getItem(BUG_STORAGE_KEY));
  } catch {
    return parseBugDock(null);
  }
}

export function writeBugDock(dock: BugDock) {
  try {
    window.localStorage.setItem(BUG_STORAGE_KEY, serializeBugDock(dock));
  } catch {
    // Soukromé okno nebo zakázané úložiště: poloha platí jen do obnovení stránky.
  }
}

function measureObstacles(): ScreenBox[] {
  const boxes: ScreenBox[] = [];
  for (const element of document.querySelectorAll(OBSTACLES)) {
    if (element.closest("[data-feedback-ui]")) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) continue;
    boxes.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
  }
  return boxes;
}

/** Brouček se schová, když je otevřené okno nebo běží přesun akce. */
const coveredByUi = () => document.querySelector("dialog[open]") !== null || document.body.hasAttribute("data-moving");

type Props = {
  dock: BugDock;
  onDockChange: (dock: BugDock) => void;
  onOpen: () => void;
  /** Okno zpětné vazby nebo označování právě běží. */
  busy: boolean;
};

/**
 * Plovoucí tlačítko zpětné vazby. Tažením se přesune a po puštění přichytí k bližšímu okraji, šipky ho
 * posunou z klávesnice. Poloha se měří jen při rolování, změně velikosti okna a změně stránky (rAF), ne v intervalu.
 */
export function BugButton({ dock, onDockChange, onOpen, busy }: Props) {
  const [desktop, setDesktop] = useState(false);
  const [covered, setCovered] = useState(false);
  const [placement, setPlacement] = useState<BugPlacement | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  /** Klik, který přijde hned po tažení, okno neotevře. */
  const justDragged = useRef(false);
  const frame = useRef(0);
  const tucked = dock.mode === "tucked";

  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setCovered(coveredByUi());
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      setPlacement(placeBug(dock, tucked ? BUG_TAB_WIDTH : BUG_SIZE, viewport, measureObstacles()));
    });
  }, [dock, tucked]);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (!desktop || dock.mode === "hidden") return;
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "data-moving", "class", "hidden"] });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame.current);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, { capture: true });
    };
  }, [desktop, dock.mode, measure]);

  if (!desktop || dock.mode === "hidden" || busy || covered || !placement) return null;

  const peek = tucked || placement.peek;
  const style = dragPoint ? { left: dragPoint.x - BUG_SIZE / 2, top: dragPoint.y - BUG_SIZE / 2 } : { left: placement.left, top: placement.top };

  if (peek && !dragPoint) {
    return (
      <button
        type="button"
        className={`bug-tab bug-tab-${dock.side}`}
        style={style}
        data-feedback-ui=""
        data-testid="broucek-jazycek"
        aria-label="Zobrazit tlačítko zpětné vazby"
        title="Zpětná vazba"
        onClick={() => (tucked ? onDockChange({ ...dock, mode: "shown" }) : onOpen())}
      >
        <Icon name="bug" size={14} />
      </button>
    );
  }

  return (
    <div className={`bug-dock bug-dock-${dock.side}`} style={style} data-feedback-ui="" data-dragging={dragPoint ? "" : undefined}>
      <button
        type="button"
        className="bug-button"
        data-testid="broucek"
        aria-label="Nahlásit chybu nebo nápad"
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        title="Zpětná vazba (šipkami přesunete)"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          drag.current = { x: event.clientX, y: event.clientY, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state) return;
          if (!state.moved && Math.hypot(event.clientX - state.x, event.clientY - state.y) < DRAG_THRESHOLD) return;
          state.moved = true;
          setDragPoint({ x: event.clientX, y: event.clientY });
        }}
        onPointerUp={(event) => {
          const state = drag.current;
          drag.current = null;
          setDragPoint(null);
          justDragged.current = Boolean(state?.moved);
          if (state?.moved) onDockChange({ ...dock, ...snapBugDock({ x: event.clientX, y: event.clientY }, { width: window.innerWidth, height: window.innerHeight }) });
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragPoint(null);
        }}
        onClick={(event) => {
          // Klik po tažení nic neotevře. Klávesnice (Enter, mezerník) má detail 0 a otevře vždy.
          const dragged = justDragged.current && event.detail > 0;
          justDragged.current = false;
          if (!dragged) onOpen();
        }}
        onKeyDown={(event) => {
          const next = moveBugDock(dock, event.key);
          if (!next) return;
          event.preventDefault();
          onDockChange(next);
        }}
      >
        <Icon name="bug" size={22} />
      </button>
      <button type="button" className="bug-tuck" aria-label="Schovat tlačítko zpětné vazby k okraji" title="Schovat k okraji" onClick={() => onDockChange({ ...dock, mode: "tucked" })}>
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}
