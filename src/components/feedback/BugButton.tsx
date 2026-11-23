"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BUG_SIZE,
  BUG_SIZE_TOUCH,
  BUG_TAB_WIDTH,
  moveBugDock,
  parseBugDock,
  placeBug,
  serializeBugDock,
  snapBugDock,
  type BugDock,
  type BugPlacement,
  type SafeInsets,
  type ScreenBox,
} from "@/lib/bug-dock";
import { Icon } from "../Icon";

export const BUG_STORAGE_KEY = "zbc-broucek";
/** Telefon nebo dotyková obrazovka: větší brouček blíž okraji a přesun podržením (jako v Novi). */
const TOUCH_QUERY = "(max-width: 900px), (pointer: coarse)";
/** Hlavní ovládání, které brouček nesmí zakrýt. */
const OBSTACLES = "[data-bug-avoid], .select-bar, .move-panel, .flash, .btn-primary, .sidebar, .quick-actions";
/** Myš: tah delší než pár pixelů je přesun. */
const DRAG_THRESHOLD = 4;
/** Prst: přesun až po podržení, aby se brouček nehýbal při rolování stránky. Posun před tím je švihnutí. */
const LONG_PRESS_MS = 400;
const SWIPE_THRESHOLD = 10;

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

const subscribeNever = () => () => {};
function subscribeTouch(onChange: () => void) {
  const query = window.matchMedia(TOUCH_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Výřez displeje a domovská lišta (`env(safe-area-inset-*)`) změřené pomocným prvkem. */
function measureInsets(): SafeInsets {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = { top: parseFloat(style.paddingTop) || 0, right: parseFloat(style.paddingRight) || 0, bottom: parseFloat(style.paddingBottom) || 0, left: parseFloat(style.paddingLeft) || 0 };
  probe.remove();
  return insets;
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
 * Plovoucí tlačítko zpětné vazby na všech šířkách. Myší se přesune tažením, prstem podržením a tažením, po puštění
 * se přichytí k bližšímu okraji. Šipky ho posunou z klávesnice. Poloha se měří jen při rolování, změně velikosti
 * okna a změně stránky (rAF), ne v intervalu.
 */
export function BugButton({ dock, onDockChange, onOpen, busy }: Props) {
  // Až v prohlížeči (ne při vykreslení na serveru) a s aktuální shodou dotazu na dotyk a šířku.
  const ready = useSyncExternalStore(subscribeNever, () => true, () => false);
  const touch = useSyncExternalStore(subscribeTouch, () => window.matchMedia(TOUCH_QUERY).matches, () => false);
  const [covered, setCovered] = useState(false);
  const [placement, setPlacement] = useState<BugPlacement | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  /** `armed`: myš, nebo prst po podržení. Jen tehdy pohyb brouček přesouvá. */
  const drag = useRef<{ x: number; y: number; moved: boolean; armed: boolean; timer: number } | null>(null);
  /** Klik, který přijde hned po tažení, okno neotevře. */
  const justDragged = useRef(false);
  const frame = useRef(0);
  const tucked = dock.mode === "tucked";

  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setCovered(coveredByUi());
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const size = touch ? BUG_SIZE_TOUCH : BUG_SIZE;
      setPlacement(placeBug(dock, tucked ? BUG_TAB_WIDTH : size, viewport, measureObstacles(), { touch, insets: measureInsets() }));
    });
  }, [dock, tucked, touch]);

  useLayoutEffect(() => {
    if (!ready || dock.mode === "hidden") return;
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
  }, [ready, dock.mode, measure]);

  useEffect(() => () => window.clearTimeout(drag.current?.timer), []);

  if (!ready || dock.mode === "hidden" || busy || covered || !placement) return null;

  const size = touch ? BUG_SIZE_TOUCH : BUG_SIZE;
  const peek = tucked || placement.peek;
  const style = dragPoint ? { left: dragPoint.x - size / 2, top: dragPoint.y - size / 2 } : { left: placement.left, top: placement.top };
  const endDrag = () => {
    window.clearTimeout(drag.current?.timer);
    drag.current = null;
    setDragPoint(null);
  };

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
    <div className={`bug-dock bug-dock-${dock.side}${touch ? " bug-dock-touch" : ""}`} style={style} data-feedback-ui="" data-dragging={dragPoint ? "" : undefined}>
      <button
        type="button"
        className="bug-button"
        data-testid="broucek"
        aria-label="Nahlásit chybu nebo nápad"
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        title={touch ? "Zpětná vazba (podržením přesuneš)" : "Zpětná vazba (šipkami přesuneš)"}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const point = { x: event.clientX, y: event.clientY };
          const finger = event.pointerType !== "mouse";
          const state = { ...point, moved: false, armed: !finger, timer: 0 };
          if (finger) {
            state.timer = window.setTimeout(() => {
              if (drag.current !== state || state.moved) return;
              state.armed = true;
              state.moved = true;
              navigator.vibrate?.(15);
              setDragPoint(point);
            }, LONG_PRESS_MS);
          }
          drag.current = state;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state) return;
          const distance = Math.hypot(event.clientX - state.x, event.clientY - state.y);
          if (!state.armed) {
            // Švihnutí prstem před podržením brouček nepřesune ani neotevře.
            if (distance > SWIPE_THRESHOLD) {
              window.clearTimeout(state.timer);
              state.moved = true;
            }
            return;
          }
          if (!state.moved && distance < DRAG_THRESHOLD) return;
          state.moved = true;
          setDragPoint({ x: event.clientX, y: event.clientY });
        }}
        onPointerUp={(event) => {
          const state = drag.current;
          endDrag();
          justDragged.current = Boolean(state?.moved);
          if (state?.moved && state.armed) onDockChange({ ...dock, ...snapBugDock({ x: event.clientX, y: event.clientY }, { width: window.innerWidth, height: window.innerHeight }) });
        }}
        onPointerCancel={endDrag}
        // Podržení prstem nesmí otevřít systémovou nabídku (Android) ani výběr textu (iOS).
        onContextMenu={(event) => event.preventDefault()}
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
        <Icon name="bug" size={touch ? 24 : 22} />
      </button>
      <button type="button" className="bug-tuck" aria-label="Schovat tlačítko zpětné vazby k okraji" title="Schovat k okraji" onClick={() => onDockChange({ ...dock, mode: "tucked" })}>
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}
