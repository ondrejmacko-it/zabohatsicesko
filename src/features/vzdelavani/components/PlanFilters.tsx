"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { TYPE_LABELS } from "@/lib/labels";
import type { EventType } from "@/lib/types";
import type { PlanState } from "../status";
import { QuickActions } from "./QuickActions";
import { SelectToggle, useSelection } from "./PlanSelection";


/** Štítek stavu měsíce (jen správce): počet a odkaz, který harmonogram zúží na dotčené termíny. */
/** Štítek souhrnu měsíce. `spoken` doplní přístupný název za počtem („Doplnit 8 akcí“), `hint` vysvětlí, co počet znamená. */
export type StateChip = { state: PlanState; label: string; spoken: string; count: number; hint: string; href: string };

type Props = {
  /** Parametry, které filtr nemění (měsíc, zobrazení). Posílají se spolu s výběrem. */
  keep: [string, string][];
  types: EventType[];
  /** Vybrané typy akce, každý s odkazem, který odebere jen jeho. */
  selectedTypes: { type: EventType; removeHref: string }[];
  /** Odkaz, který zruší všechny filtry (typy i stavy). Null, když žádný není vybraný. */
  resetHref: string | null;
  /** Co v měsíci čeká na správce. Prázdné pole = nic, štítky se nevykreslí. */
  chips: StateChip[];
  states: PlanState[];
  /** Rychlé ovládání při posunu (telefon): měsíc, odkaz na Plán bez `den` a správcův den pro „+“ (null = nepřidává). */
  quick: { monthKey: string; todayKey: string; planHref: string; addDate: string | null };
};

/** Štítky Návrhy a Doplnit (souhrn celého měsíce, ne osobní úkoly): klik plán zúží, znovu klik filtr zruší. Sdílí je řádek filtrů i rychlá nabídka. */
function ChipLinks({ chips, states }: { chips: StateChip[]; states: PlanState[] }) {
  return chips.map((chip) => {
    const on = states.includes(chip.state);
    return (
      <Link key={chip.state} className="pill pill-count" href={chip.href} aria-current={on ? "true" : undefined} title={chip.hint}>
        {/* Přístupný název začíná viditelným textem (WCAG 2.5.3): „Doplnit 10 akcí“, skrytá je jen nápověda ke zrušení. */}
        {chip.label} <span className="pill-number">{chip.count}</span>
        <span className="visually-hidden"> {chip.spoken}</span>
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

type FieldsProps = Pick<Props, "keep" | "types" | "chips"> & { selected: EventType[]; states: PlanState[] };

/**
 * Pole filtru (typy akce a stavy jako zaškrtávací volby; pohled je globálně v horní liště). Jediná implementace pro nabídku Filtry
 * i rychlou nabídku. Změna volby hned přejde na novou adresu (historie prohlížeče ji vrátí), nabídka zůstane
 * otevřená pro další volbu. Bez JavaScriptu se formulář odešle tlačítkem Použít.
 */
function FilterFields({ keep, types, chips, selected, states }: FieldsProps) {
  const router = useRouter();
  // Volby se ukážou hned po kliknutí, adresa je dožene; návrat v historii je srovná s adresou.
  const urlKey = `${selected.join(",")}|${states.join(",")}`;
  const [picked, setPicked] = useState({ key: urlKey, typ: selected as string[], stav: states as string[] });
  if (picked.key !== urlKey) setPicked({ key: urlKey, typ: selected, stav: states });
  const toggle = (name: "typ" | "stav", value: string) => {
    const list = picked[name];
    const next = { ...picked, [name]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    // Klíč se srovná s adresou až po navigaci; do té doby platí, co uživatel právě zaškrtl.
    setPicked(next);
    const query = new URLSearchParams(keep);
    for (const t of next.typ) query.append("typ", t);
    for (const st of next.stav) query.append("stav", st);
    router.push(`/vzdelavani/harmonogram?${query}`, { scroll: false });
  };
  return (
    <>
      {keep.map(([name, value]) => (
        <input key={`${name}-${value}`} type="hidden" name={name} value={value} />
      ))}
      {types.length > 1 && (
        <fieldset className="filter-group">
          <legend className="field-label">Typ akce</legend>
          {types.map((t) => (
            <label key={t} className="check filter-check">
              <input type="checkbox" name="typ" value={t} checked={picked.typ.includes(t)} onChange={() => toggle("typ", t)} />
              {TYPE_LABELS[t]}
            </label>
          ))}
        </fieldset>
      )}
      {chips.length > 0 && (
        <fieldset className="filter-group">
          <legend className="field-label">Stav</legend>
          {chips.map((chip) => (
            <label key={chip.state} className="check filter-check">
              <input type="checkbox" name="stav" value={chip.state} checked={picked.stav.includes(chip.state)} onChange={() => toggle("stav", chip.state)} />
              <span>
                {chip.label} <span className="muted">({chip.count})</span>
              </span>
            </label>
          ))}
        </fieldset>
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
export function PlanFilters({ keep, types, selectedTypes, resetHref, chips, states, quick }: Props) {
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
  const hasMenu = typeSelect || chips.length > 0;
  const active = selectedTypes.length + states.length;
  const canSelect = Boolean(selection?.available);
  // Lichý počet prvků: poslední v mřížce 2 × 2 na telefonu zabere celý řádek, aby nezůstala díra.
  const count = chips.length + selectedTypes.length + (resetHref ? 1 : 0) + (hasMenu ? 1 : 0) + (canSelect ? 1 : 0);
  const wideLast = count % 2 === 1;
  const fields = { keep, types, chips, selected: selectedTypes.map((s) => s.type), states };
  const quickActions = (
    <QuickActions
      {...quick}
      anchor={row}
      filters={
        hasMenu || chips.length ? (
          <div className="stack">
            {chips.length > 0 && (
              <div className="plan-filters-start" role="group" aria-label="Zúžit plán měsíce">
                <ChipLinks chips={chips} states={states} />
              </div>
            )}
            {hasMenu && (
              <form className="stack" method="get" aria-label="Filtr harmonogramu">
                <FilterFields {...fields} />
              </form>
            )}
          </div>
        ) : null
      }
    />
  );
  // Bez nabídky „Zobrazit jako“ nejde o správce, takže ani Vybrat návrhy: bez štítků a filtrů není co ukázat.
  if (!chips.length && !selectedTypes.length && !typeSelect) return quickActions;
  return (
    <>
      <div ref={row} className="plan-filters" data-items={count}>
        <div className="plan-filters-start" role="group" aria-label="Zúžit plán měsíce">
          <ChipLinks chips={chips} states={states} />
          {selectedTypes.map(({ type, removeHref }) => (
            <Link key={type} className="pill pill-count" href={removeHref} aria-current="true">
              <span className="visually-hidden">Typ: </span>
              {TYPE_LABELS[type]}
              <span className="visually-hidden">, zrušit filtr</span>
              <Icon name="close" size={14} />
            </Link>
          ))}
          {resetHref && (
            <Link className="filter-reset small" href={resetHref} data-wide={wideLast && !hasMenu && !canSelect ? true : undefined}>
              Zrušit filtry
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
                <FilterFields {...fields} />
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
