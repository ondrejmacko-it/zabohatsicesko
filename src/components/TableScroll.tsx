import type { ReactNode } from "react";

/**
 * Obal široké tabulky: na středních šířkách se posouvá jen tabulka, ne celá stránka.
 * `tabIndex` a `role="region"` dovolí posun klávesnicí (šipky) a čtečce oznámí, co se posouvá.
 */
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
