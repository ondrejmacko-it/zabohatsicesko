"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { TYPE_LABELS } from "@/lib/labels";
import type { EventType } from "@/lib/types";
import type { PlanState } from "../status";
import { QuickActions } from "./QuickActions";
import { SelectToggle, useSelection } from "./PlanSelection";

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
  /** Rychlé ovládání při posunu (telefon): měsíc, odkaz na Plán bez `den` a správcův den pro „+“ (null = nepřidává). */
  quick: { monthKey: string; todayKey: string; planHref: string; addDate: string | null };
};

/** Štítky Návrhy a Chybí údaje: klik plán zúží, znovu klik filtr zruší. Sdílí je řádek filtrů i rychlá nabídka. */
function ChipLinks({ chips, state }: { chips: StateChip[]; state: PlanState | undefined }) {
  return chips.map((chip) => {
    const on = chip.state === state;
    return (
      <Link key={chip.state} className="pill pill-count" href={chip.href} aria-current={on ? "true" : undefined}>
        {/* Přístupný název skládá viditelný text (WCAG 2.5.3), skrytá je jen nápověda ke zrušení. */}
        {chip.label} <span className="pill-number">{chip.count}</span>
        {on && (
          <>
            <span className="visually-hidden">, zrušit filtr</span>
            <Icon name="close" size={14} />
          </>
        )}
      </Link>
    );
  });
}

/** Pole filtru (typ akce, Zobrazit jako). Jediná implementace pro nabídku Filtry i rychlou nabídku. */
function FilterFields({ keep, types, type, preview, hintId }: Pick<Props, "keep" | "types" | "type" | "preview"> & { hintId: string }) {
  const submit = (event: React.ChangeEvent<HTMLSelectElement>) => event.currentTarget.form?.requestSubmit();
  return (
    <>
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {types.length > 1 && (
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
          <select className="select select-small" name="jako" defaultValue={preview.value} onChange={submit} aria-describedby={hintId}>
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
          <span id={hintId} className="small muted">
            Jen náhled, nic se nezmění.
          </span>
        </label>
      )}
      <noscript>
        <button className="btn btn-small" type="submit">
          Použít
        </button>
      </noscript>
    </>
  );
}

/**
 * Jeden řádek pod lištou Plánu: vlevo Návrhy a Chybí údaje (klik zúží plán, znovu klik zruší) a vybraný
 * typ s křížkem, vpravo nabídka Filtry (typ akce, Zobrazit jako) a Vybrat návrhy. Výběr v nabídce se odešle
 * hned, tlačítko Použít zůstává pro prohlížeč bez JavaScriptu. Na telefonu je řádek mřížka 2 × 2 a při posunu
 * stránky nabízí stejné filtry a výběr rychlé ovládání (`QuickActions`).
 */
export function PlanFilters({ keep, types, type, typeResetHref, preview, chips, state, quick }: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const selection = useSelection();
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
  const hasMenu = typeSelect || Boolean(preview);
  const active = (type ? 1 : 0) + (preview?.value ? 1 : 0);
  const canSelect = Boolean(selection?.available);
  // Lichý počet prvků: poslední v mřížce 2 × 2 na telefonu zabere celý řádek, aby nezůstala díra.
  const count = chips.length + (type && typeResetHref ? 1 : 0) + (hasMenu ? 1 : 0) + (canSelect ? 1 : 0);
  const wideLast = count % 2 === 1;
  const fields = { keep, types, type, preview };
  const quickActions = (
    <QuickActions
      {...quick}
      anchor={row}
      filters={
        hasMenu || chips.length ? (
          <div className="stack">
            {chips.length > 0 && (
              <div className="plan-filters-start" role="group" aria-label="Zúžit plán">
                <ChipLinks chips={chips} state={state} />
              </div>
            )}
            {hasMenu && (
              <form className="stack" method="get" aria-label="Filtr harmonogramu">
                <FilterFields {...fields} hintId="zobrazit-jako-napoveda-rychle" />
              </form>
            )}
          </div>
        ) : null
      }
    />
  );
  // Bez nabídky „Zobrazit jako“ nejde o správce, takže ani Vybrat návrhy: bez štítků a filtrů není co ukázat.
  if (!chips.length && !type && !typeSelect && !preview) return quickActions;
  return (
    <>
      <div ref={row} className="plan-filters" data-items={count}>
        <div className="plan-filters-start" role="group" aria-label="Zúžit plán">
          <ChipLinks chips={chips} state={state} />
          {type && typeResetHref && (
            <Link className="pill pill-count" href={typeResetHref} aria-current="true" data-wide={wideLast && !hasMenu && !canSelect ? true : undefined}>
              <span className="visually-hidden">Typ: </span>
              {TYPE_LABELS[type]}
              <span className="visually-hidden">, zrušit filtr</span>
              <Icon name="close" size={14} />
            </Link>
          )}
        </div>
        <div className="plan-filters-end">
          {hasMenu && (
            <details ref={menu} className="filter-menu" data-wide={wideLast && !canSelect ? true : undefined}>
              <summary className="btn btn-small btn-quiet filter-button">
                <Icon name="filter" />
                Filtry
                {active > 0 && <span className="count-badge">{active}</span>}
              </summary>
              <form className="filter-menu-panel stack" method="get" aria-label="Filtr harmonogramu">
                <FilterFields {...fields} hintId="zobrazit-jako-napoveda" />
              </form>
            </details>
          )}
          <SelectToggle wide={wideLast} />
        </div>
      </div>
      {quickActions}
    </>
  );
}
