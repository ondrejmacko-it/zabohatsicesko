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
  /**
   * „card“: nenápadné tlačítko ⋯ v rohu karty akce (jen ikona). Na desktopu se zvýrazní při najetí nebo fokusu
   * na kartu, na dotykovém displeji je vidět vždy. Větší dotyková plocha nemění rozměry karty.
   */
  variant?: "card";
};

const GAP = 6;
const EDGE = 8;

/**
 * Rozbalovací menu podle vzoru disclosure: tlačítko s `aria-expanded` a za ním obyčejný seznam odkazů a tlačítek,
 * kterým se prochází běžným Tab (proto bez `aria-haspopup` a bez šipek). Odchod fokusu mimo menu ho zavře.
 * Seznam je ukotvený k oknu prohlížeče (position: fixed), takže ho neořízne rolovaná část dialogu ani tabulka,
 * a otevře se nahoru, když se dolů nevejde. Zavírá se klikem mimo, klávesou Esc, posunem stránky (když tlačítko
 * ujede) a volbou položky. Položky zůstávají v dokumentu i po zavření: okna otevřená z menu (Upravit, Zrušit)
 * si tak drží stav.
 */
export function Menu({ label, children, small, iconOnly, className, variant }: Props) {
  const card = variant === "card";
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
    // Menu roste do volné strany: tlačítko v levé půlce okna → menu zarovnané k jeho levé hraně, jinak k pravé.
    // Na krajích ho drží uvnitř okna EDGE.
    const fromLeft = anchor.left + anchor.width / 2 < window.innerWidth / 2;
    const left = Math.min(Math.max(EDGE, fromLeft ? anchor.left : anchor.right - size.width), window.innerWidth - size.width - EDGE);
    setPlace({ top: Math.max(EDGE, top), left: Math.max(EDGE, left) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Posun stránky menu zavře, jen když tlačítko opravdu ujelo. Událost scroll z posunu těsně před
    // klepnutím (telefon, posun k tlačítku) přijde až po otevření a menu by hned zase zavřela.
    const element = root.current;
    const openedAt = trigger.current?.getBoundingClientRect().top ?? 0;
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
    // Tab z poslední položky (nebo Shift+Tab z tlačítka) menu zavře. Fokus do okna otevřeného z menu
    // menu také zavře, okno si stav drží a po zavření vrátí fokus na tlačítko menu.
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && !root.current?.contains(next)) close();
    };
    const onScroll = (event: Event) => {
      if (list.current?.contains(event.target as Node)) return;
      const top = trigger.current?.getBoundingClientRect().top ?? openedAt;
      if (Math.abs(top - openedAt) > 4) close();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    element?.addEventListener("focusout", onFocusOut);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
      element?.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className={`menu${card ? " menu-card" : ""}${className ? ` ${className}` : ""}`} ref={root} data-open={open || undefined}>
      <button
        ref={trigger}
        type="button"
        className={card ? "menu-card-trigger" : `btn${small ? " btn-small" : ""}${iconOnly ? " btn-icon" : ""}`}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={iconOnly || card ? label : undefined}
        title={iconOnly || card ? label : undefined}
        onClick={() => {
          setPlace({ visibility: "hidden" });
          setOpen((value) => !value);
        }}
      >
        <Icon name="more" size={card ? 18 : 16} />
        {!iconOnly && !card && label}
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
