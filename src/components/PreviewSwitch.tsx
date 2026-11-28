"use client";

import { usePathname } from "next/navigation";
import { endPreview, startPreview } from "@/app/(wiki)/nahled-actions";
import { Combobox, type ComboboxOption } from "@/components/Combobox";

type Option = { key: string; label: string };

/**
 * Stránky, na kterých náhled platí. Správa se řídí oprávněním zobrazeného, Integrace ukáže jen zástupný stav
 * (bez dat Googlu). Moje role a další položky shellu jsou bez obsahu, náhled na nich nic nemění.
 */
export function previewApplies(pathname: string): boolean {
  return (
    pathname === "/" ||
    ["/vzdelavani/harmonogram", "/vzdelavani/akce/", "/vzdelavani/temata", "/vzdelavani/zapisy", "/vzdelavani/integrace", "/sprava"].some((p) =>
      pathname.startsWith(p),
    )
  );
}

/**
 * Volba pohledu v horní liště (jen správce). Oddělená od účtu: mění, čí očima se stránky ukazují, ne kdo je
 * přihlášený. Výběr odešle formulář hned. Vlastní nabídka místo nativního <select>: ten na Androidu zakryje
 * celou obrazovku a skupiny Skupina/Kolega v něm splývají.
 */
export function PreviewSwitch({ groups, people, active }: { groups: Option[]; people: Option[]; active: string | null }) {
  // Úzký výběr dlouhý název zkrátí, celý je v title a v pruhu náhledu.
  const activeLabel = [...groups, ...people].find((o) => o.key === active)?.label;
  const options: ComboboxOption[] = [
    { value: "", label: "Můj pohled" },
    ...groups.map((o) => ({ value: o.key, label: o.label, group: "Skupina" })),
    ...people.map((o) => ({ value: o.key, label: o.label, group: "Kolega" })),
  ];
  return (
    <div className={active ? "view-switch view-switch-active" : "view-switch"}>
      <form action={startPreview} className="view-switch-form">
        <label className="view-switch-label" htmlFor="pohled">
          Pohled
        </label>
        <Combobox
          key={active ?? ""}
          id="pohled"
          name="pohled"
          selectOnly
          defaultValue={active ?? ""}
          options={options}
          listLabel="Pohledy"
          onCommit={(_, field) => field.form?.requestSubmit()}
          // Na telefonu je viditelný popisek skrytý (CSS), jméno pole proto nese i aria-label.
          inputProps={{ className: "select-small view-select", title: activeLabel ?? "Můj pohled", "aria-label": "Pohled" }}
        />
      </form>
    </div>
  );
}

/** Jeden stručný pruh pod lištou při aktivním náhledu: čí pohled to je a že je jen ke čtení. */
export function PreviewBar({ label }: { label: string }) {
  const pathname = usePathname();
  const applies = previewApplies(pathname);
  return (
    <div className="preview-bar" role="status" data-testid="pruh-nahledu">
      <p>
        {applies ? (
          <>
            Náhled: <strong>{label}</strong> · jen ke čtení
          </>
        ) : (
          <>
            Náhled <strong>{label}</strong> tu neplatí, stránka používá tvůj účet
          </>
        )}
      </p>
      <form action={endPreview}>
        <button className="btn btn-small" type="submit">
          Ukončit náhled
        </button>
      </form>
    </div>
  );
}
