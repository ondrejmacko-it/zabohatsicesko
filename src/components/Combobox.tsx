"use client";

import { useEffect, useId, useRef, useState } from "react";

export type ComboboxOption = {
  value: string;
  /** Zobrazený název, když se liší od hodnoty (režim `selectOnly`, například klíč pohledu). Výchozí je hodnota. */
  label?: string;
  /** Nadpis skupiny. Sousední možnosti se stejnou skupinou se vykreslí pod jedním nadpisem. */
  group?: string;
  /** Štítky za názvem (garantované, doporučené). */
  badges?: React.ReactNode;
  /** Krátký doplněk pod názvem, například počet zájemců. */
  hint?: string;
};

type Props = {
  id?: string;
  name: string;
  options: ComboboxOption[];
  placeholder?: string;
  /** Název nabídky pro čtečky, například „Témata“. */
  listLabel: string;
  maxLength?: number;
  /**
   * Jen výběr z nabídky (náhrada nativního <select>): pole nejde přepsat, na telefonu neotevře klávesnici,
   * hodnota se odesílá ve skrytém poli `name` a zobrazuje se `label`. Bez něj je platný i ručně napsaný text.
   */
  selectOnly?: boolean;
  /** Volá se po výběru možnosti, až je nová hodnota zapsaná ve formuláři (například okamžité odeslání). */
  onCommit?: (value: string, field: HTMLInputElement) => void;
  /** Další atributy pole (aria-label, aria-describedby, data-*). */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> & { [key: `data-${string}`]: string | boolean | undefined };
} & (
  | {
      /** Řízené pole: hodnotu drží rodič. */
      value: string;
      onChange: (value: string) => void;
      defaultValue?: never;
    }
  | {
      /**
       * Neřízené pole uvnitř formuláře, který čte hodnoty z DOM (Připravit měsíc s mnoha řádky).
       * Výběr z nabídky zapíše hodnotu do pole a vyvolá událost `input`, takže ho formulář zaznamená
       * stejně jako psaní (přehled mezer, neuložené změny). Rodič se při psaní nepřekresluje kvůli poli.
       */
      defaultValue: string;
      value?: never;
      onChange?: never;
    }
);

/** Porovnání bez ohledu na velikost písmen a diakritiku: „uvodni“ najde „Úvodní“. */
const labelOf = (option: ComboboxOption) => option.label ?? option.value;

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Textové pole s nabídkou (vzor ARIA combobox + listbox). Nahrazuje <datalist>: ten se v každém
 * prohlížeči kreslí jinak, neukáže skupiny ani štítky a na telefonu ho často není vidět.
 *
 * Psaní nabídku filtruje, šipky vybírají (`aria-activedescendant`, fokus zůstává v poli), Enter potvrdí
 * zvýrazněnou možnost, Esc zavře jen nabídku. Ručně napsaný text je platná hodnota, nabídka jen pomáhá.
 * Panel je pod polem uvnitř okna, ne v portálu: posouvá se s formulářem a nepřekryje jiná okna.
 */
export function Combobox({ id, name, value, onChange, defaultValue, options, placeholder, listLabel, maxLength, selectOnly, onCommit, inputProps }: Props) {
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // V režimu selectOnly nese hodnotu skryté pole, viditelné pole jen ukazuje název.
  const hiddenRef = useRef<HTMLInputElement>(null);
  const valueRef = selectOnly ? hiddenRef : inputRef;
  const controlled = value !== undefined;
  // Hodnota pole v okamžiku otevření nabídky (u neřízeného pole se čte z DOM, ne při vykreslení).
  const [current, setCurrent] = useState(value ?? defaultValue ?? "");
  const selected = controlled ? value : current;
  const [open, setOpen] = useState(false);
  // Filtr platí jen pro text, který člověk právě píše. Otevření šipkou nebo klikem ukáže všechno.
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);

  const matches = (filter: string) => options.filter((o) => normalize(labelOf(o)).includes(normalize(filter)));
  const shown = query ? matches(query) : options;
  const optionId = (index: number) => `${listId}-${index}`;
  const visible = open && shown.length > 0;

  const show = (filter: string | null) => {
    const list = filter ? matches(filter) : options;
    const now = controlled ? value : (valueRef.current?.value ?? "");
    setCurrent(now);
    setQuery(filter);
    setActive(filter ? (list.length > 0 ? 0 : -1) : list.findIndex((o) => o.value === now));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setQuery(null);
    setActive(-1);
  };
  const choose = (option: ComboboxOption) => {
    if (selectOnly && hiddenRef.current) {
      // Skryté pole se zapíše hned, aby ho onCommit (odeslání formuláře) četl ještě před překreslením.
      hiddenRef.current.value = option.value;
      if (controlled) onChange(option.value);
      else setCurrent(option.value);
      close();
      onCommit?.(option.value, hiddenRef.current);
      return;
    }
    if (controlled) onChange(option.value);
    else if (inputRef.current) {
      inputRef.current.value = option.value;
      inputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    close();
    if (inputRef.current) onCommit?.(option.value, inputRef.current);
  };

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[id="${optionId(active)}"]`)?.scrollIntoView({ block: "nearest" });
    // optionId závisí jen na listId, který se nemění.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return show(null);
      if (shown.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => Math.min(shown.length - 1, Math.max(0, current + step)));
    } else if (selectOnly && !open && (event.key === "Enter" || event.key === " ")) {
      // Jako u <select>: Enter a mezerník nabídku otevřou, formulář se neodešle.
      event.preventDefault();
      show(null);
    } else if ((event.key === "Enter" || (selectOnly && event.key === " ")) && open && active >= 0 && shown[active]) {
      // Enter vybere možnost, formulář se neodešle.
      event.preventDefault();
      choose(shown[active]);
    } else if (event.key === "Escape" && visible) {
      // Esc zavře jen nabídku. Bez preventDefault by se zavřelo i okno, ve kterém pole je.
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close();
    }
  };

  // Sousední možnosti se stejnou skupinou tvoří jednu skupinu listboxu s vlastním nadpisem.
  const groups: Array<{ label?: string; items: Array<{ option: ComboboxOption; index: number }> }> = [];
  shown.forEach((option, index) => {
    const last = groups.at(-1);
    if (last && last.label === option.group) last.items.push({ option, index });
    else groups.push({ label: option.group, items: [{ option, index }] });
  });
  const renderOption = ({ option, index }: { option: ComboboxOption; index: number }) => (
    <div
      key={option.value}
      id={optionId(index)}
      role="option"
      aria-selected={index === active}
      className="combobox-option"
      data-value={option.value}
      data-current={option.value === selected || undefined}
      // Fokus zůstává v poli, jinak by se nabídka zavřela dřív, než klik doběhne.
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={() => setActive(index)}
      onClick={() => choose(option)}
    >
      <span className="combobox-option-head">
        <span className="combobox-option-name">{labelOf(option)}</span>
        {option.badges}
      </span>
      {option.hint && <span className="field-hint">{option.hint}</span>}
    </div>
  );

  return (
    <div className="combobox">
      {selectOnly && <input ref={hiddenRef} type="hidden" name={name} value={selected} />}
      <input
        {...inputProps}
        ref={inputRef}
        id={id}
        className={inputProps?.className ? `input combobox-input ${inputProps.className}` : "input combobox-input"}
        name={selectOnly ? undefined : name}
        {...(selectOnly
          ? { value: labelOf(options.find((o) => o.value === selected) ?? { value: selected }), readOnly: true }
          : controlled
            ? { value }
            : { defaultValue })}
        role="combobox"
        aria-autocomplete={selectOnly ? "none" : "list"}
        aria-expanded={visible}
        aria-controls={listId}
        aria-activedescendant={visible && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => {
          if (selectOnly) return;
          if (controlled) onChange(event.target.value);
          show(event.target.value);
        }}
        // Klik nabídku jen otevře. Zavírá ji výběr, Esc, Tab nebo odchod z pole, takže klik do rozepsaného
        // textu (například kvůli posunu kurzoru) nabídku neschová.
        onClick={() => {
          if (!open) show(null);
          // Výběr bez psaní se druhým klepnutím zavře jako <select>.
          else if (selectOnly) close();
        }}
        onKeyDown={onKeyDown}
        onBlur={close}
      />
      {/* Když psanému textu nic neodpovídá, nabídka se schová: ručně napsaná hodnota je platná. */}
      <div ref={listRef} className="combobox-panel" hidden={!visible}>
        <div id={listId} role="listbox" aria-label={listLabel}>
          {groups.map((group, g) =>
            group.label ? (
              <div key={group.label} role="group" aria-labelledby={`${listId}-g${g}`}>
                <div id={`${listId}-g${g}`} className="combobox-group" role="presentation">
                  {group.label}
                </div>
                {group.items.map(renderOption)}
              </div>
            ) : (
              group.items.map(renderOption)
            ),
          )}
        </div>
      </div>
    </div>
  );
}
