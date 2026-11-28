"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/vzdelavani/harmonogram", label: "Plán", also: ["/vzdelavani/akce"] },
  { href: "/vzdelavani/zapisy", label: "Zápisy", also: [] },
  { href: "/vzdelavani/temata", label: "Témata", also: [] },
];
const ATTENDANCE = { href: "/vzdelavani/ucast", label: "Účast", also: [] };

export function SubNav({ showAttendance = false }: { showAttendance?: boolean }) {
  const pathname = usePathname();
  const items = showAttendance ? [...ITEMS, ATTENDANCE] : ITEMS;
  return (
    <nav aria-label="Vzdělávání">
      <ul className="pill-nav">
        {items.map((item) => {
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
