"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Menu } from "@/components/Menu";
import { Modal } from "@/components/Modal";
import { formatDayMonth, weekdayLong, weekdayShort } from "@/lib/time";
import { dayNumber, MonthDays } from "./MonthDays";
import { useSelection } from "./PlanSelection";

type Props = {
  monthKey: string;
  todayKey: string;
  /** Plán se současným měsícem, pohledem a filtry, bez `den`. Přidání akce k němu jen připojí `den`. */
  planHref: string;
  /** Datum pro „+“ (stejná výchozí hodnota jako Přidat akci v liště). Null = divák akce nepřidává. */
  addDate: string | null;
  /** Řádek filtrů, pod kterým začíná harmonogram. Bez něj se měří lišta Plánu. */
  anchor: React.RefObject<HTMLElement | null>;
  /** Obsah okna Filtry (stejné štítky a pole jako v řádku filtrů). Null = filtry nejsou. */
  filters: React.ReactNode;
};

type Panel = "filters" | "date" | null;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Dny, které agenda na stránce opravdu ukazuje (bez skryté kopie pro jinou šířku). */
const shownDays = () =>
  new Map(
    [...document.querySelectorAll<HTMLElement>("[data-agenda-day]")].filter((el) => el.offsetParent !== null).map((el) => [el.dataset.agendaDay!, el]),
  );

/** Posune k dni agendy, krátce ho zvýrazní a předá mu fokus (klávesnice pokračuje odtud). */
function jumpTo(day: HTMLElement) {
  day.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  day.tabIndex = -1;
  day.focus({ preventScroll: true });
  day.setAttribute("data-flash", "");
  window.setTimeout(() => day.removeAttribute("data-flash"), 1600);
}

/**
 * Rychlé ovládání Plánu na telefonu: dvě malá tlačítka vpravo dole, jen když lišta Plánu a řádek filtrů
 * odjely z obrazovky. „+“ otevře stávající Přidat akci, „⋯“ nabídne Filtry, Vybrat návrhy a Přejít na datum.
 * Všechno vede na stejné ovládání jako lišta (stejné odkazy, formulář filtrů i stav výběru), nic vlastního.
 * Ustoupí oknu, tažení akce i hromadnému výběru (CSS) a jde skrýt, dokud se lišta znovu neukáže.
 */
export function QuickActions({ monthKey, todayKey, planHref, addDate, anchor, filters }: Props) {
  const selection = useSelection();
  const [past, setPast] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [daysWithEvents, setDaysWithEvents] = useState<Set<string>>(new Set());

  // Ukáže se, až spodní okraj lišty (řádku filtrů) zmizí nad horním okrajem obrazovky. Návrat nahoru ho zase schová.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = anchor.current ?? document.querySelector<HTMLElement>(".plan-head");
      const gone = el ? el.getBoundingClientRect().bottom < 0 : false;
      setPast(gone);
      if (!gone) setHidden(false);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [anchor]);

  const openDate = () => {
    setDaysWithEvents(new Set(shownDays().keys()));
    setMissing(null);
    setPanel("date");
  };
  const pickDay = (day: string) => {
    const el = shownDays().get(day);
    if (!el) return setMissing(day);
    setPanel(null);
    // Až po zavření okna: okno vrací fokus na tlačítko, skok ho pak předá dni.
    window.setTimeout(() => jumpTo(el), 0);
  };
  const nextShown = missing ? [...daysWithEvents].sort().find((day) => day > missing) : undefined;
  const canAddOn = (day: string) => addDate !== null && day >= todayKey;

  return (
    <>
      {past && !hidden && (
      <div className="quick-actions" role="group" aria-label="Rychlé ovládání Plánu">
        {addDate && (
          <Link className="btn btn-icon quick-add" href={`${planHref}&den=${addDate}`} scroll={false} aria-label="Přidat akci" title="Přidat akci">
            <Icon name="plus" />
          </Link>
        )}
        <Menu label="Další možnosti Plánu" iconOnly className="quick-menu">
          {filters && (
            <button type="button" className="btn" onClick={() => setPanel("filters")}>
              <Icon name="filter" />
              Filtry
            </button>
          )}
          {selection?.available && (
            <button type="button" className="btn" onClick={selection.start}>
              <Icon name="select" />
              Vybrat návrhy
            </button>
          )}
          <button type="button" className="btn" onClick={openDate}>
            <Icon name="calendar" />
            Přejít na datum
          </button>
          <button type="button" className="btn" onClick={() => setHidden(true)}>
            <Icon name="close" />
            Skrýt rychlé ovládání
          </button>
        </Menu>
      </div>
      )}
      {panel === "filters" && (
        <Modal open title="Filtry" onRequestClose={() => setPanel(null)}>
          {/* Štítek zúžení vede na novou adresu: okno se zavře, stránka se překreslí se stejným měsícem. */}
          <div onClick={(event) => (event.target as HTMLElement).closest("a") && setPanel(null)}>{filters}</div>
        </Modal>
      )}
      {panel === "date" && (
        <Modal open title="Přejít na datum" onRequestClose={() => setPanel(null)}>
          <div className="stack">
            <MonthDays
              monthKey={monthKey}
              label="Den v měsíci"
              renderDay={(day) => (
                <button
                  type="button"
                  className="month-day"
                  data-has-events={daysWithEvents.has(day) || undefined}
                  aria-current={day === todayKey ? "date" : undefined}
                  aria-pressed={day === missing || undefined}
                  aria-label={`${weekdayLong(day)} ${formatDayMonth(day)}${daysWithEvents.has(day) ? ", má akce" : ""}`}
                  onClick={() => pickDay(day)}
                >
                  {dayNumber(day)}
                </button>
              )}
            />
            {missing && (
              <div className="notice" role="status">
                <p>
                  {weekdayLong(missing)} {formatDayMonth(missing)}: v seznamu tu není žádná akce.
                </p>
                <div className="row">
                  {canAddOn(missing) && (
                    <Link className="btn btn-small" href={`${planHref}&den=${missing}`} scroll={false} onClick={() => setPanel(null)}>
                      <Icon name="plus" />
                      Přidat akci na tento den
                    </Link>
                  )}
                  {nextShown && (
                    <button type="button" className="btn btn-small" onClick={() => pickDay(nextShown)}>
                      Nejbližší den s akcí: {weekdayShort(nextShown)} {formatDayMonth(nextShown)}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
