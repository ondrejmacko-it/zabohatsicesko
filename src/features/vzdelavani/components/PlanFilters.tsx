"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { TYPE_LABELS } from "@/lib/labels";
import type { EventType } from "@/lib/types";
import type { PlanState } from "../status";
import { SelectToggle } from "./PlanSelection";

type Option = { key: string; label: string };

/** Štítek stavu měsíce (jen správce): počet a odkaz, který harmonogram zúží na dotčené termíny. */
export type StateChip = { state: PlanState; label: string; count: number; href: string };

type Props = {
  /** Parametry, které filtr nemění (měsíc, zobrazení, stav). Posílají se spolu s výběrem. */
  keep: Record<string, string>;
  types: EventType[];
  type: EventType | undefined;
  /** Odkaz, který zruší filtr typu. Null, když typ není vybraný. */
  typeResetHref: string | null;
  /** Nabídka „Zobrazit jako“ (pohled skupiny nebo kolegy). Jen pro správce, jinak null. */
  preview: { groups: Option[]; people: Option[]; value: string } | null;
  /** Co v měsíci čeká na správce. Prázdné pole = nic, štítky se nevykreslí. */
  chips: StateChip[];
  state: PlanState | undefined;
};

/**
 * Jeden řádek pod lištou Plánu: vlevo Návrhy a Chybí údaje (klik zúží plán, znovu klik zruší) a vybraný
 * typ s křížkem, vpravo nabídka Filtry (typ akce, Zobrazit jako) a Vybrat akce. Výběr v nabídce se odešle
 * hned, tlačítko Použít zůstává pro prohlížeč bez JavaScriptu.
 */
export function PlanFilters({ keep, types, type, typeResetHref, preview, chips, state }: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const submit = (event: React.ChangeEvent<HTMLSelectElement>) => event.currentTarget.form?.requestSubmit();
  // Nabídka se zavře klikem mimo ni a klávesou Esc (fokus se vrátí na tlačítko Filtry).
  useEffect(() => {
    const close = (event: Event) => {
      const el = menu.current;
      if (!el?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        el.open = false;
        el.querySelector("summary")?.focus();
      } else if (!el.contains(event.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const typeSelect = types.length > 1;
  const active = (type ? 1 : 0) + (preview?.value ? 1 : 0);
  // Bez nabídky „Zobrazit jako“ nejde o správce, takže ani Vybrat akce: bez štítků a filtrů není co ukázat.
  if (!chips.length && !type && !typeSelect && !preview) return null;
  return (
    <div className="plan-filters">
      <div className="plan-filters-start" role="group" aria-label="Zúžit plán">
        {chips.map((chip) => {
          const on = chip.state === state;
          return (
            <Link
              key={chip.state}
              className="pill pill-count"
              href={chip.href}
              aria-current={on ? "true" : undefined}
              aria-label={on ? `${chip.label}: ${chip.count}, zrušit filtr` : `${chip.label}: ${chip.count}`}
            >
              {chip.label}
              <span className="pill-number">{chip.count}</span>
              {on && <Icon name="close" size={14} />}
            </Link>
          );
        })}
        {type && typeResetHref && (
          <Link className="pill pill-count" href={typeResetHref} aria-current="true" aria-label={`Typ: ${TYPE_LABELS[type]}, zrušit filtr`}>
            {TYPE_LABELS[type]}
            <Icon name="close" size={14} />
          </Link>
        )}
      </div>
      <div className="plan-filters-end">
        {(typeSelect || preview) && (
          <details ref={menu} className="filter-menu">
            <summary className="btn btn-small btn-quiet filter-button">
              <Icon name="filter" />
              Filtry
              {active > 0 && <span className="count-badge">{active}</span>}
            </summary>
            <form className="filter-menu-panel stack" method="get" aria-label="Filtr harmonogramu">
              {Object.entries(keep).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              {typeSelect && (
                <label className="field">
                  <span className="field-label">Typ akce</span>
                  <select className="select select-small" name="typ" defaultValue={type ?? ""} onChange={submit}>
                    <option value="">Všechny typy</option>
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {preview && (
                <label className="field">
                  <span className="field-label">Zobrazit jako</span>
                  <select className="select select-small" name="jako" defaultValue={preview.value} onChange={submit} aria-describedby="zobrazit-jako-napoveda">
                    <option value="">Můj pohled</option>
                    <optgroup label="Očima skupiny">
                      {preview.groups.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Očima kolegy">
                      {preview.people.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <span id="zobrazit-jako-napoveda" className="small muted">
                    Jen náhled, nic se nezmění.
                  </span>
                </label>
              )}
              <noscript>
                <button className="btn btn-small" type="submit">
                  Použít
                </button>
              </noscript>
            </form>
          </details>
        )}
        <SelectToggle />
      </div>
    </div>
  );
}
