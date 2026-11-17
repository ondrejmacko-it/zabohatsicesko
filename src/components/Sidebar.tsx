"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

type Item = { label: string; /** Část názvu, kterou úzký telefon skryje jen vizuálně, čtečka ji přečte. */ labelTail?: string; icon: IconName; href?: string; match?: (path: string) => boolean; badgeKey?: "education" | "admin" };

// Ostatní sekce Wiki jsou v ukázce jen kulisy shellu, bez interního obsahu.
const ITEMS: Item[] = [
  { label: "Domů", icon: "library", href: "/", match: (p) => p === "/" },
  { label: "Moje role", icon: "user" },
  { label: "Jak pracujeme", icon: "workflow" },
  { label: "Vzdělávání", icon: "education", href: "/vzdelavani", match: (p) => p.startsWith("/vzdelavani"), badgeKey: "education" },
];

const ADMIN: Item = { label: "Správa", labelTail: " systému", icon: "settings", href: "/sprava", match: (p) => p.startsWith("/sprava"), badgeKey: "admin" };

/** `live`: ostrá Wiki. Neaktivní kulisy ukázky (další sekce, dokumenty, hledání) se v ní nezobrazují. */
type Props = { badge: number; canManageUsers: boolean; pendingRequests: number; live: boolean };

export function Sidebar({ badge, canManageUsers, pendingRequests, live }: Props) {
  const pathname = usePathname();
  // Správa se ukazuje jen tomu, kdo ji smí používat. Ostatním by byla jen neaktivní položka bez účelu.
  const shell = canManageUsers ? [...ITEMS, ADMIN] : ITEMS;
  const items = live ? shell.filter((item) => item.href) : shell;
  const counts = { education: badge, admin: pendingRequests };
  return (
    <aside className="sidebar" aria-label="Hlavní navigace">
      <nav>
        <ul className="nav">
          {items.map((item) => {
            const count = item.badgeKey ? counts[item.badgeKey] : 0;
            const content = (
              <>
                <Icon name={item.icon} />
                {item.label}
                {item.labelTail && <span className="nav-label-tail">{item.labelTail}</span>}
                {count > 0 && (
                  <span className="nav-badge" aria-label={`${count} čeká na vás`}>
                    {count}
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
