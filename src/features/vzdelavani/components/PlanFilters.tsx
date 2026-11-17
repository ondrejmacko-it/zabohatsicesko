"use client";

import Link from "next/link";
import { TYPE_LABELS } from "@/lib/labels";
import type { EventType } from "@/lib/types";
import type { PlanState } from "../status";

type Option = { key: string; label: string };

/** Štítek stavu měsíce (jen správce): počet a odkaz, který harmonogram zúží na dotčené termíny. */
export type StateChip = { state: PlanState; label: string; count: number; href: string };

type Props = {
  /** Parametry, které filtr nemění (měsíc, zobrazení, stav). Posílají se spolu s výběrem. */
  keep: Record<string, string>;
  types: EventType[];
  type: EventType | undefined;
  /** Nabídka „Pohled očima“. Jen pro správce, jinak null. */
  preview: { groups: Option[]; people: Option[]; value: string } | null;
  /** Co v měsíci čeká na správce. Prázdné pole = nic, štítky se nevykreslí. */
  chips: StateChip[];
  state: PlanState | undefined;
  resetHref: string | null;
};

/**
 * Jeden řádek nad harmonogramem: vlevo co v měsíci čeká (klik zúží plán), vpravo malé výběry typu
 * a pohledu. Výběr se odešle hned, tlačítko zůstává pro prohlížeč bez JavaScriptu.
 */
export function PlanFilters({ keep, types, type, preview, chips, state, resetHref }: Props) {
  const submit = (event: React.ChangeEvent<HTMLSelectElement>) => event.currentTarget.form?.requestSubmit();
  const selects = types.length > 1 || preview;
  if (!chips.length && !selects && !resetHref) return null;
  return (
    <div className="plan-filters">
      {chips.length > 0 && (
        <div className="row plan-chips" role="group" aria-label="Čeká na vás v tomto měsíci">
          {chips.map((chip) => (
            <Link key={chip.state} className="pill pill-count" href={chip.href} aria-current={chip.state === state ? "true" : undefined}>
              {chip.label}
              <span className="pill-number">{chip.count}</span>
            </Link>
          ))}
        </div>
      )}
      {selects && (
        <form className="row plan-selects" method="get" aria-label="Filtr harmonogramu">
          {Object.entries(keep).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {types.length > 1 && (
            <select className="select select-small" name="typ" defaultValue={type ?? ""} onChange={submit} aria-label="Typ akce">
              <option value="">Všechny typy akcí</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          )}
          {preview && (
            <select className="select select-small" name="jako" defaultValue={preview.value} onChange={submit} aria-label="Pohled očima skupiny nebo kolegy">
              <option value="">Můj pohled (vše)</option>
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
          )}
          <noscript>
            <button className="btn btn-small" type="submit">
              Použít
            </button>
          </noscript>
        </form>
      )}
      {resetHref && (
        <Link className="btn btn-small btn-quiet" href={resetHref}>
          Zrušit filtr
        </Link>
      )}
    </div>
  );
}
