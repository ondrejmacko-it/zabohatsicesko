"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

type Item = { label: string; icon: IconName; href?: string; match?: (path: string) => boolean };

// Ostatní sekce Wiki jsou v ukázce jen kulisy shellu, bez interního obsahu.
const ITEMS: Item[] = [
  { label: "Knihovna", icon: "library", href: "/", match: (p) => p === "/" },
  { label: "Moje role", icon: "user" },
  { label: "Jak pracujeme", icon: "workflow" },
  { label: "Vzdělávání", icon: "education", href: "/vzdelavani", match: (p) => p.startsWith("/vzdelavani") },
  { label: "Správa systému", icon: "settings" },
];

export function Sidebar({ badge }: { badge: number }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar" aria-label="Hlavní navigace">
      <nav>
        <ul className="nav">
          {ITEMS.map((item) => {
            const content = (
              <>
                <Icon name={item.icon} />
                {item.label}
                {item.label === "Vzdělávání" && badge > 0 && (
                  <span className="nav-badge" aria-label={`${badge} čeká na vás`}>
                    {badge}
                  </span>
                )}
              </>
            );
            return (
              <li key={item.label}>
                {item.href ? (
                  <Link className="nav-item" href={item.href} aria-current={item.match?.(pathname) ? "page" : undefined}>
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
        </ul>
      </nav>
      <div className="sidebar-section">
        <p className="sidebar-label">Dokumenty</p>
        <input className="sidebar-search" placeholder="Hledat v Knihovně…" disabled aria-label="Hledat v Knihovně (v ukázce není k dispozici)" />
        <p className="sidebar-note">Knihovna dokumentů není součástí ukázky.</p>
      </div>
    </aside>
  );
}
