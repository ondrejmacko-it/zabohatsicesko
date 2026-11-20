/**
 * Kde stojí brouček zpětné vazby a jak se vyhne hlavním ovládacím prvkům. Čistá logika bez DOM,
 * převzatá z Novi AI Tutor (`src/feedback/bug-dock.ts`) a upravená pro desktopovou Wiki.
 */

export const BUG_SIDES = ["left", "right"] as const;
export type BugSide = (typeof BUG_SIDES)[number];

/** `shown` celý brouček, `tucked` jen jazýček u okraje, `hidden` vůbec (vrací ho položka v levém menu). */
export const BUG_MODES = ["shown", "tucked", "hidden"] as const;
export type BugMode = (typeof BUG_MODES)[number];

export type BugDock = {
  side: BugSide;
  /** Svislá poloha středu broučka jako podíl výšky okna (0 nahoře, 1 dole). */
  y: number;
  mode: BugMode;
};

/** Vpravo dole. */
export const DEFAULT_BUG_DOCK: BugDock = { side: "right", y: 0.88, mode: "shown" };

export const BUG_SIZE = 44;
export const BUG_TAB_WIDTH = 18;
const EDGE_GAP = 16;
const AVOID_GAP = 8;
const MIN_TOP = 12;
/** Překážka vyšší než půlka okna (levé menu) se obchází do strany, ne nahoru. */
const TALL_OBSTACLE_RATIO = 0.5;
const Y_MIN = 0.05;
const Y_MAX = 0.95;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function serializeBugDock(dock: BugDock): string {
  return `${dock.side}.${Math.round(clamp(dock.y, Y_MIN, Y_MAX) * 1000)}.${dock.mode}`;
}

/** Cokoli nečitelného znamená výchozí polohu, ne chybu. */
export function parseBugDock(value: string | null | undefined): BugDock {
  const match = /^(left|right)\.(\d{1,4})\.(shown|tucked|hidden)$/.exec(value ?? "");
  if (!match) return DEFAULT_BUG_DOCK;
  return { side: match[1] as BugSide, y: clamp(Number(match[2]) / 1000, Y_MIN, Y_MAX), mode: match[3] as BugMode };
}

/** Po puštění se brouček přichytí k bližšímu bočnímu okraji ve výšce kurzoru. */
export function snapBugDock(point: { x: number; y: number }, viewport: { width: number; height: number }): Pick<BugDock, "side" | "y"> {
  return { side: point.x < viewport.width / 2 ? "left" : "right", y: clamp(point.y / viewport.height, Y_MIN, Y_MAX) };
}

/** Posun šipkami: nahoru a dolů po krocích, doleva a doprava přeskočí na druhý okraj. */
export function moveBugDock(dock: BugDock, key: string): BugDock | null {
  const step = 0.05;
  if (key === "ArrowUp") return { ...dock, y: clamp(dock.y - step, Y_MIN, Y_MAX) };
  if (key === "ArrowDown") return { ...dock, y: clamp(dock.y + step, Y_MIN, Y_MAX) };
  if (key === "ArrowLeft") return { ...dock, side: "left" };
  if (key === "ArrowRight") return { ...dock, side: "right" };
  return null;
}

export type ScreenBox = { left: number; top: number; right: number; bottom: number };

/** `peek`: celý brouček se nikam nevešel, aniž by zakryl hlavní akci, proto vykoukne jen jazýček. */
export type BugPlacement = { left: number; top: number; peek: boolean };

/**
 * Kam brouček vykreslit: ze zvolené strany a výšky, pak mimo překážky. Nejdřív zkusí uhnout nad překážku,
 * když nahoře není místo, tak pod ni, jinak zůstane jen jazýček u okraje.
 */
export function placeBug(
  dock: Pick<BugDock, "side" | "y">,
  width: number,
  viewport: { width: number; height: number },
  obstacles: readonly ScreenBox[],
): BugPlacement {
  const tucked = width < BUG_SIZE;
  let left = dock.side === "right" ? viewport.width - width - (tucked ? 0 : EDGE_GAP) : tucked ? 0 : EDGE_GAP;

  for (const box of obstacles) {
    const tall = box.bottom - box.top >= viewport.height * TALL_OBSTACLE_RATIO;
    if (tall && left < box.right && left + width > box.left) {
      left = dock.side === "left" ? box.right + (tucked ? 0 : EDGE_GAP) : box.left - width - EDGE_GAP;
    }
  }

  const maxTop = viewport.height - BUG_SIZE - MIN_TOP;
  const desired = clamp(dock.y * viewport.height - BUG_SIZE / 2, MIN_TOP, maxTop);
  const inColumn = obstacles.filter(
    (box) => box.bottom - box.top < viewport.height * TALL_OBSTACLE_RATIO && box.left < left + width + AVOID_GAP && box.right > left - AVOID_GAP,
  );
  const hit = (top: number) => inColumn.find((box) => box.top < top + BUG_SIZE + AVOID_GAP && box.bottom > top - AVOID_GAP);

  for (const direction of ["up", "down"] as const) {
    let top = desired;
    for (let attempt = 0; attempt <= inColumn.length; attempt += 1) {
      const box = hit(top);
      if (!box) {
        if (top >= MIN_TOP && top <= maxTop) return { left, top, peek: false };
        break;
      }
      top = direction === "up" ? box.top - BUG_SIZE - AVOID_GAP : box.bottom + AVOID_GAP;
    }
  }
  return { left: dock.side === "right" ? viewport.width - BUG_TAB_WIDTH : 0, top: desired, peek: true };
}
