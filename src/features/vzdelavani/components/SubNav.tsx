"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/vzdelavani/harmonogram", label: "Plán", also: ["/vzdelavani/akce"] },
  { href: "/vzdelavani/zapisy", label: "Zápisy a témata", also: ["/vzdelavani/temata"] },
];

export function SubNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Vzdělávání">
      <ul className="pill-nav">
        {ITEMS.map((item) => {
          const active = [item.href, ...item.also].some((prefix) => pathname.startsWith(prefix));
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
