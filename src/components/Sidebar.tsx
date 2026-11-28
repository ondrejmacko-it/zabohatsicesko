"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FEEDBACK_OPEN_EVENT } from "./feedback/FeedbackRoot";
import { Icon, type IconName } from "./Icon";

type Item = { label: string; icon: IconName; href?: string; match?: (path: string) => boolean; badgeKey?: "education" | "admin" };

// Ostatní sekce Wiki jsou v ukázce jen kulisy shellu, bez interního obsahu.
const ITEMS: Item[] = [
  { label: "Domů", icon: "library", href: "/", match: (p) => p === "/" },
  { label: "Moje role", icon: "user" },
  { label: "Jak pracujeme", icon: "workflow" },
  { label: "Vzdělávání", icon: "education", href: "/vzdelavani", match: (p) => p.startsWith("/vzdelavani"), badgeKey: "education" },
];

const ADMIN: Item = { label: "Správa systému", icon: "settings", href: "/sprava", match: (p) => p.startsWith("/sprava"), badgeKey: "admin" };

/** `live`: ostrá Wiki. Neaktivní kulisy ukázky (další sekce, dokumenty, hledání) se v ní nezobrazují. */
type Props = { badge: number; canManageUsers: boolean; pendingRequests: number; live: boolean };

/** Tablet: mřížka stejně širokých položek, do čtyř v jedné řadě, víc ve dvou řadách. Telefon má sbalené menu. */
const columns = (count: number) => (count <= 4 ? count : Math.ceil(count / 2));

export function Sidebar({ badge, canManageUsers, pendingRequests, live }: Props) {
  const pathname = usePathname();
  // Správa se ukazuje jen tomu, kdo ji smí používat. Ostatním by byla jen neaktivní položka bez účelu.
  const shell = canManageUsers ? [...ITEMS, ADMIN] : ITEMS;
  const items = live ? shell.filter((item) => item.href) : shell;
  const counts = { education: badge, admin: pendingRequests };
  // +1 za Zpětnou vazbu.
  const gridStyle = { "--nav-cols": columns(items.length + 1) } as React.CSSProperties;
  const current = items.find((item) => item.href && item.match?.(pathname));
  const waiting = items.reduce((sum, item) => sum + (item.badgeKey ? counts[item.badgeKey] : 0), 0);

  // Telefon: menu se sbalí pod tlačítko (vzor „disclosure“). Na širších oknech je tlačítko skryté a seznam vidět vždy.
  // Stav patří stránce, na které se menu otevřelo: po přechodu jinam (i tlačítkem Zpět) je menu zase sbalené.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean) => setOpenAt(value ? pathname : null);
  const rootRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenAt(null);
      toggleRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenAt(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);
  // Fokus odešel z menu (Tab za poslední položku): menu se zavře, aby nepřekrývalo obsah, kam fokus míří.
  const onBlur = (event: React.FocusEvent) => {
    if (open && !rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
  };

  return (
    <aside className="sidebar" aria-label="Hlavní navigace" ref={rootRef} onBlur={onBlur}>
      <button
        ref={toggleRef}
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="hlavni-menu"
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? "close" : "menu"} />
        <span className="nav-toggle-label">Menu</span>
        {current && <span className="nav-toggle-current">{current.label}</span>}
        {!open && waiting > 0 && (
          <span className="nav-badge" aria-label={`${waiting} čeká na tebe`}>
            {waiting}
          </span>
        )}
      </button>
      <nav>
        <ul className="nav" id="hlavni-menu" style={gridStyle} data-open={open}>
          {items.map((item) => {
            const count = item.badgeKey ? counts[item.badgeKey] : 0;
            const content = (
              <>
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {count > 0 && (
                  <span className="nav-badge" aria-label={`${count} čeká na tebe`}>
                    {count}
                  </span>
                )}
              </>
            );
            return (
              <li key={item.label}>
                {item.href ? (
                  <Link className="nav-item" href={item.href} onClick={() => setOpen(false)} aria-current={item.match?.(pathname) ? "page" : undefined}>
                    {content}
                  </Link>
                ) : (
                  <span className="nav-item" aria-disabled="true" title="V ukázce není k dispozici">
                    {content}
                  </span>
                )}
              </li>
            );
          })}
          {/* Zpětná vazba je poslední položkou téže mřížky, aby na tabletu nezůstala osamocená na dalším řádku. */}
          <li className="sidebar-feedback">
            <button type="button" className="nav-item" onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event(FEEDBACK_OPEN_EVENT));
              }}>
              <Icon name="bug" />
              <span>Zpětná vazba</span>
            </button>
          </li>
        </ul>
      </nav>
      {!live && (
        <div className="sidebar-section">
          <p className="sidebar-label">Dokumenty</p>
          <input className="sidebar-search" placeholder="Hledat v Knihovně…" disabled aria-label="Hledat v Knihovně (v ukázce není k dispozici)" />
          <p className="sidebar-note">Knihovna dokumentů není součástí ukázky.</p>
        </div>
      )}
    </aside>
  );
}
