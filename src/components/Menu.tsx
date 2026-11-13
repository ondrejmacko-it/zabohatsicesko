"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

type Props = {
  label: string;
  children: React.ReactNode;
  /** Malé tlačítko pro řádky tabulek a seznamů. */
  small?: boolean;
  /** Jen ikona, popisek zůstává pro čtečky. */
  iconOnly?: boolean;
  className?: string;
};

const GAP = 6;
const EDGE = 8;

/**
 * Rozbalovací menu. Seznam je ukotvený k oknu prohlížeče (position: fixed), takže ho neořízne rolovaná část
 * dialogu ani tabulka, a otevře se nahoru, když se dolů nevejde. Zavírá se klikem mimo, klávesou Esc,
 * posunem stránky a volbou položky. Položky zůstávají v dokumentu i po zavření: okna otevřená z menu
 * (Upravit, Zrušit) si tak drží stav.
 */
export function Menu({ label, children, small, iconOnly, className }: Props) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<React.CSSProperties>({ visibility: "hidden" });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();

  useLayoutEffect(() => {
    if (!open || !trigger.current || !list.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const size = list.current.getBoundingClientRect();
    const below = window.innerHeight - anchor.bottom - GAP - EDGE;
    const top = size.height <= below || anchor.top < size.height + GAP + EDGE ? anchor.bottom + GAP : anchor.top - GAP - size.height;
    const left = Math.min(Math.max(EDGE, anchor.right - size.width < EDGE ? anchor.left : anchor.right - size.width), window.innerWidth - size.width - EDGE);
    setPlace({ top: Math.max(EDGE, top), left: Math.max(EDGE, left) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Esc zavře jen menu, ne okno, ve kterém menu je.
      event.preventDefault();
      event.stopPropagation();
      close();
      trigger.current?.focus();
    };
    const onScroll = (event: Event) => {
      if (!list.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className={`menu${className ? ` ${className}` : ""}`} ref={root}>
      <button
        ref={trigger}
        type="button"
        className={`btn${small ? " btn-small" : ""}${iconOnly ? " btn-icon" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        onClick={() => {
          setPlace({ visibility: "hidden" });
          setOpen((value) => !value);
        }}
      >
        <Icon name="more" />
        {!iconOnly && label}
      </button>
      <div
        ref={list}
        id={listId}
        className="menu-list"
        hidden={!open}
        style={place}
        // Volba položky (odkaz nebo tlačítko, které něco otevírá) menu zavře. Odesílací tlačítka ho nechají
        // otevřené, aby byl vidět výsledek akce. Kliky z oken otevřených z menu sem nepatří.
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (!event.currentTarget.contains(target)) return;
          if (target.closest("a, button[type='button']")) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
