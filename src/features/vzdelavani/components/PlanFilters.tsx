"use client";

import Link from "next/link";
import { TYPE_LABELS } from "@/lib/labels";
import type { EventType } from "@/lib/types";
import type { MonthSummary, PlanState } from "../status";

type Option = { key: string; label: string };

type Props = {
  /** Parametry, které filtr nemění (měsíc, zobrazení). Posílají se spolu s výběrem. */
  keep: Record<string, string>;
  types: EventType[];
  type: EventType | undefined;
  /** Nabídka „Zobrazit jako“. Jen pro organizátora, jinak null. */
  preview: { groups: Option[]; people: Option[]; value: string } | null;
  /** Filtr podle stavu s počty za měsíc. Jen pro organizátora ve vlastním pohledu, jinak null. */
  states: { summary: MonthSummary; value: PlanState | undefined } | null;
  resetHref: string | null;
};

/** Filtry harmonogramu. Výběr se odešle hned, tlačítko zůstává pro prohlížeč bez JavaScriptu. */
export function PlanFilters({ keep, types, type, preview, states, resetHref }: Props) {
  const submit = (event: React.ChangeEvent<HTMLSelectElement>) => event.currentTarget.form?.requestSubmit();
  return (
    <form className="plan-filters" method="get" aria-label="Filtr harmonogramu">
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {preview && (
        <label className="field">
          <span className="field-label">Zobrazit jako</span>
          <select className="select" name="jako" defaultValue={preview.value} onChange={submit}>
            <option value="">Organizátor (vidím vše)</option>
            <optgroup label="Co vidí skupina">
              {preview.groups.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Co vidí kolega (například vedoucí)">
              {preview.people.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      )}
      {types.length > 1 && (
        <label className="field">
          <span className="field-label">Typ akce</span>
          <select className="select" name="typ" defaultValue={type ?? ""} onChange={submit}>
            <option value="">Všechny typy</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      )}
      {states && (
        <label className="field">
          <span className="field-label">Stav</span>
          <select className="select" name="stav" defaultValue={states.value ?? ""} onChange={submit}>
            <option value="">Vše v plánu ({states.summary.planned})</option>
            <option value="navrhy">Čeká na zveřejnění ({states.summary.toPublish})</option>
            <option value="doplnit">K doplnění ({states.summary.toComplete})</option>
          </select>
        </label>
      )}
      <noscript>
        <button className="btn" type="submit">
          Použít
        </button>
      </noscript>
      {resetHref && (
        <Link className="btn btn-small" href={resetHref}>
          Zrušit filtry
        </Link>
      )}
    </form>
  );
}
