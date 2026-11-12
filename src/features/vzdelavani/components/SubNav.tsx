"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SubNav({ showIntegrations }: { showIntegrations: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/vzdelavani/moje-cesta", label: "Moje cesta" },
    { href: "/vzdelavani/harmonogram", label: "Harmonogram", also: "/vzdelavani/akce" },
    { href: "/vzdelavani/temata", label: "Témata" },
    ...(showIntegrations ? [{ href: "/vzdelavani/integrace", label: "Integrace" }] : []),
  ];
  return (
    <nav aria-label="Vzdělávání">
      <ul className="pill-nav">
        {items.map((item) => {
          const active = pathname.startsWith(item.href) || ("also" in item && item.also && pathname.startsWith(item.also));
          return (
            <li key={item.href}>
              <Link className="pill" href={item.href} aria-current={active ? "page" : undefined}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
