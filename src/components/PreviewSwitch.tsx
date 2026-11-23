"use client";

import { usePathname } from "next/navigation";
import { endPreview, startPreview } from "@/app/(wiki)/nahled-actions";

type Option = { key: string; label: string };

/** Stránky, na kterých náhled mění data. Ostatní (Správa, Integrace, Moje role…) používají vždy skutečný účet. */
export function previewApplies(pathname: string): boolean {
  return (
    pathname === "/" ||
    ["/vzdelavani/harmonogram", "/vzdelavani/akce/", "/vzdelavani/temata", "/vzdelavani/zapisy"].some((p) => pathname.startsWith(p))
  );
}

/**
 * Volba pohledu v horní liště (jen správce). Oddělená od účtu: mění, čí očima se stránky ukazují, ne kdo je
 * přihlášený. Volba odešle formulář hned, bez JavaScriptu tlačítkem Zobrazit.
 */
export function PreviewSwitch({ groups, people, active }: { groups: Option[]; people: Option[]; active: string | null }) {
  return (
    <div className={active ? "view-switch view-switch-active" : "view-switch"}>
      <form action={startPreview} className="view-switch-form">
        <label className="view-switch-label" htmlFor="pohled">
          Pohled
        </label>
        <select
          id="pohled"
          name="pohled"
          className="select select-small view-select"
          defaultValue={active ?? ""}
          key={active ?? ""}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          <option value="">Můj pohled</option>
          <optgroup label="Skupina">
            {groups.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Kolega">
            {people.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </optgroup>
        </select>
        <noscript>
          <button className="btn btn-small" type="submit">
            Zobrazit
          </button>
        </noscript>
      </form>
    </div>
  );
}

/** Pruh pod lištou při aktivním náhledu: čí pohled to je, že je jen ke čtení a kde platí. */
export function PreviewBar({ label }: { label: string }) {
  const pathname = usePathname();
  const applies = previewApplies(pathname);
  return (
    <div className="preview-bar" role="status" data-testid="pruh-nahledu">
      <p>
        {applies ? (
          <>
            Pohled: <strong>{label}</strong> · jen ke čtení
          </>
        ) : (
          <>
            Náhled <strong>{label}</strong> tu neplatí, stránka používá tvůj účet
          </>
        )}
        <span className="preview-bar-where"> · Domů, Plán, Témata, Zápisy a detail akce</span>
      </p>
      <form action={endPreview}>
        <button className="btn btn-small" type="submit">
          Ukončit pohled
        </button>
      </form>
    </div>
  );
}
