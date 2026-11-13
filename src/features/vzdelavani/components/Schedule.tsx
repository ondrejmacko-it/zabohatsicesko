import Link from "next/link";
import { TYPE_LABELS } from "@/lib/labels";
import {
  addDays,
  formatDayMonth,
  formatEventTime,
  formatRange,
  isoWeekday,
  monthOf,
  monthWeeks,
  toDateKey,
  weekdayShort,
} from "@/lib/time";
import type { EventCard } from "@/server/services/events";
import { badgeClass, cardTone, primaryStatus, type MonthSummary, type PlanGap, type PlanState } from "../status";
import styles from "./schedule.module.css";

const COLUMNS = [
  { weekday: 2, label: "Úterý" },
  { weekday: 3, label: "Středa" },
  { weekday: 4, label: "Čtvrtek" },
  { weekday: 5, label: "Pátek" },
];

export type SlotTimes = Record<number, string>;

const href = (card: EventCard) => `/vzdelavani/akce/${encodeURIComponent(card.id)}`;
const dayOf = (card: EventCard) => toDateKey(new Date(card.startsAt));

function byDay(cards: EventCard[]): Map<string, EventCard[]> {
  const map = new Map<string, EventCard[]>();
  for (const card of cards) {
    const day = dayOf(card);
    map.set(day, [...(map.get(day) ?? []), card]);
  }
  return map;
}

/** Zveřejněné termíny, které rozpracovaný návrh přesouvá jinam. Vidí je jen organizátor. */
function ghostsByDay(cards: EventCard[]): Map<string, EventCard[]> {
  const map = new Map<string, EventCard[]>();
  for (const card of cards) {
    if (!card.movedFrom) continue;
    const day = toDateKey(new Date(card.movedFrom.startsAt));
    map.set(day, [...(map.get(day) ?? []), card]);
  }
  return map;
}

/** Stín původního termínu: kolegové a Kalendář ho vidí, dokud organizátor přesun nezveřejní. */
function GhostBlock({ card }: { card: EventCard }) {
  const from = card.movedFrom!;
  return (
    <Link href={href(card)} className={`${styles.event} ${styles.ghost}`}>
      <span className={styles.title}>{card.label}</span>
      <span className={styles.line}>{formatEventTime(new Date(from.startsAt), new Date(from.endsAt), from.allDay)}</span>
      <span className={styles.line}>
        Zveřejněný termín, návrh ho přesouvá na {weekdayShort(dayOf(card))} {formatDayMonth(dayOf(card))}
      </span>
    </Link>
  );
}

/** Hodnota, která zatím není doplněná: tečkovaná linka jako v harmonogramu v Numbers. */
function Missing() {
  return (
    <span className={styles.missing}>
      <span className="visually-hidden">zatím nedoplněno</span>
    </span>
  );
}

function EventBlock({ card }: { card: EventCard }) {
  const status = primaryStatus(card);
  const tone = cardTone(card);
  const isHoliday = card.type === "holiday";
  return (
    <Link href={href(card)} className={`${styles.event} ${styles[tone]}`}>
      <span className={styles.title}>{card.label}</span>
      {card.planStatus === "cancelled" && <span className={styles.cancelled}>Zrušeno</span>}
      {!isHoliday && card.planStatus !== "cancelled" && (
        <>
          <span className={styles.line}>{formatEventTime(new Date(card.startsAt), new Date(card.endsAt), card.allDay)}</span>
          <span className={styles.line}>Kdo: {card.leadName ?? <Missing />}</span>
          <span className={styles.line}>Téma: {card.topicTitle ?? <Missing />}</span>
        </>
      )}
      {status && status.label !== "Zrušeno" && status.label !== "Svátek" && (
        <span className={badgeClass(status.tone)}>{status.label}</span>
      )}
    </Link>
  );
}

export function ScheduleGrid({
  monthKey,
  cards,
  todayKey,
  slotTimes,
}: {
  monthKey: string;
  cards: EventCard[];
  todayKey: string;
  slotTimes: SlotTimes;
}) {
  const days = byDay(cards);
  const ghosts = ghostsByDay(cards);
  const columnDays = new Set(COLUMNS.map((c) => c.weekday));
  return (
    <div className={styles.gridWrap}>
      <table className={styles.grid}>
        <caption className="visually-hidden">Harmonogram po týdnech, sloupce úterý až pátek</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.weekCol}>
              Týden
            </th>
            {COLUMNS.map((col) => (
              <th scope="col" key={col.weekday}>
                {col.label}
                {slotTimes[col.weekday] && <span className={styles.slotTime}>{slotTimes[col.weekday]}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(monthKey).map((week) => {
            const monday = week[0]!;
            // Mimořádné termíny mimo sloupce zůstávají viditelné ve svém týdnu.
            const offDays = week.filter((d) => !columnDays.has(isoWeekday(d)) && monthOf(d) === monthKey);
            const offCards = offDays.flatMap((d) => days.get(d) ?? []);
            if (!week.slice(0, 5).some((d) => monthOf(d) === monthKey) && !offCards.length) return null;
            const current = week.includes(todayKey);
            return (
              <tr key={monday} className={current ? styles.currentWeek : undefined}>
                <th scope="row" className={styles.weekCell}>
                  <span>{formatRange(monday, addDays(monday, 4))}</span>
                  {current && <span className={styles.weekNow}>tento týden</span>}
                  {offCards.map((card) => (
                    <Link key={card.id} href={href(card)} className={styles.offDay}>
                      {weekdayShort(dayOf(card))} {formatDayMonth(dayOf(card))} · {card.label}
                      {primaryStatus(card) && <span className="visually-hidden">, {primaryStatus(card)!.label}</span>}
                    </Link>
                  ))}
                </th>
                {COLUMNS.map((col) => {
                  const day = week[col.weekday - 1]!;
                  const inMonth = monthOf(day) === monthKey;
                  const dayCards = inMonth ? (days.get(day) ?? []) : [];
                  return (
                    <td key={day} className={`${styles.cell} ${inMonth ? "" : styles.outside} ${day === todayKey ? styles.todayCell : ""}`}>
                      <span className={styles.date}>
                        {formatDayMonth(day)}
                        {day === todayKey && <span className={styles.today}>dnes</span>}
                      </span>
                      {dayCards.map((card) => (
                        <EventBlock key={card.id} card={card} />
                      ))}
                      {inMonth && (ghosts.get(day) ?? []).map((card) => <GhostBlock key={`stin-${card.id}`} card={card} />)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Legend({ organizer }: { organizer: boolean }) {
  return (
    <ul className={styles.legend} aria-label="Legenda">
      <li>
        <span className={`${styles.swatch} ${styles.regular}`} /> běžná aktivita
      </li>
      <li>
        <span className={`${styles.swatch} ${styles.extra}`} /> mimořádná akce místo pravidelné aktivity
      </li>
      <li>
        <span className={`${styles.swatch} ${styles.muted}`} /> zrušeno nebo svátek
      </li>
      {organizer && (
        <li>
          <span className={`${styles.swatch} ${styles.draft}`} /> návrh, vidí ho jen organizátor
        </li>
      )}
      <li>
        <span className={styles.missing} /> zatím nedoplněno
      </li>
    </ul>
  );
}

/** Chronologický seznam po týdnech a dnech. Výchozí pohled na úzkém displeji. */
export function Agenda({ monthKey, cards, todayKey, emptyText }: { monthKey: string; cards: EventCard[]; todayKey: string; emptyText?: string }) {
  const days = byDay(cards.filter((c) => monthOf(dayOf(c)) === monthKey));
  const ghosts = ghostsByDay(cards);
  const weeks = monthWeeks(monthKey)
    .map((week) => ({
      monday: week[0]!,
      days: week.filter((d) => days.has(d) || (ghosts.has(d) && monthOf(d) === monthKey)),
      current: week.includes(todayKey),
    }))
    .filter((w) => w.days.length);
  if (!weeks.length) return <p className="muted">{emptyText ?? "V tomto měsíci zatím nejsou žádné akce."}</p>;
  return (
    <div className={styles.agenda}>
      {weeks.map((week) => (
        <section
          key={week.monday}
          aria-labelledby={`tyden-${week.monday}`}
          className={`${styles.agendaWeekBlock} ${week.current ? styles.currentWeek : ""}`}
        >
          <h3 id={`tyden-${week.monday}`} className={styles.agendaWeek}>
            Týden {formatRange(week.monday, addDays(week.monday, 6))}
            {week.current && <span className={styles.weekNow}>tento týden</span>}
          </h3>
          <ol className={styles.agendaDays}>
            {week.days.map((day) => (
              <li key={day} className={`${styles.agendaDay} ${day === todayKey ? styles.agendaToday : ""}`}>
                <div className={styles.agendaDate}>
                  {weekdayShort(day)} {formatDayMonth(day)}
                  {day === todayKey && <span className={styles.today}>dnes</span>}
                </div>
                <ul className={styles.agendaEvents}>
                  {(days.get(day) ?? []).map((card) => {
                    const status = primaryStatus(card);
                    return (
                      <li key={card.id}>
                        <Link href={href(card)} className={`${styles.agendaEvent} ${styles[cardTone(card)]}`}>
                          <span className={styles.agendaTime}>
                            {formatEventTime(new Date(card.startsAt), new Date(card.endsAt), card.allDay)}
                          </span>
                          <span className={styles.agendaMain}>
                            <span className={styles.title}>{card.label}</span>
                            {card.type !== "holiday" && (
                              <span className={styles.line}>
                                {card.topicTitle ?? "Téma zatím nedoplněno"} · {card.leadName ?? "vedoucí zatím nedoplněn"}
                              </span>
                            )}
                          </span>
                          {status && <span className={badgeClass(status.tone)}>{status.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                  {(ghosts.get(day) ?? []).map((card) => (
                    <li key={`stin-${card.id}`}>
                      <GhostBlock card={card} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function NextEventCard({ card }: { card: EventCard | null }) {
  if (!card) return <p className="muted">V nejbližších týdnech vás nečeká žádná zveřejněná akce.</p>;
  const day = dayOf(card);
  return (
    <Link href={href(card)} className="item-card">
      <p className="eyebrow">
        {TYPE_LABELS[card.type]} · {weekdayShort(day)} {formatDayMonth(day)}
      </p>
      <p className="item-title">{card.topicTitle ? `${card.label}: ${card.topicTitle}` : card.label}</p>
      <p className="item-meta">
        {formatEventTime(new Date(card.startsAt), new Date(card.endsAt), card.allDay)}
        {card.leadName ? ` · Vede: ${card.leadName}` : ""}
      </p>
    </Link>
  );
}

/** Termíny, které ve vybraném měsíci čekají na doplnění. Ukáže se po kliknutí na „K doplnění“. */
export function PlanGaps({ gaps }: { gaps: PlanGap[] }) {
  if (!gaps.length) return null;
  return (
    <ul className="plan-gaps-list" aria-label="Termíny k doplnění">
      {gaps.map(({ card, reasons }) => (
        <li key={card.id}>
          <Link href={href(card)}>
            {weekdayShort(dayOf(card))} {formatDayMonth(dayOf(card))} · {card.label}
          </Link>
          <span className="small muted"> {reasons.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

type SummaryLinks = { all: string; toPublish: string; toComplete: string };

/**
 * Stav měsíce pro organizátora v jednom řádku. Čísla jsou zároveň filtr harmonogramu:
 * kliknutím zůstanou v tabulce jen návrhy ke zveřejnění, nebo jen termíny k doplnění.
 */
export function MonthSummaryBar({ summary, active, links }: { summary: MonthSummary; active: PlanState | undefined; links: SummaryLinks }) {
  if (!summary.planned) {
    return <p className="notice month-summary-empty">Měsíc je zatím prázdný. Doplňte ho ze šablony v Nástrojích organizátora, nebo přidejte akci.</p>;
  }
  const items: Array<{ key: PlanState | undefined; href: string; label: string; count: number; attention: boolean }> = [
    { key: undefined, href: links.all, label: "V plánu", count: summary.planned, attention: false },
    { key: "navrhy", href: links.toPublish, label: "Čeká na zveřejnění", count: summary.toPublish, attention: summary.toPublish > 0 },
    { key: "doplnit", href: links.toComplete, label: "K doplnění", count: summary.toComplete, attention: summary.toComplete > 0 },
  ];
  return (
    <nav aria-label="Stav měsíce">
      <ul className="month-summary">
        {items.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className={`month-summary-item${item.attention ? " attention" : ""}`} aria-current={active === item.key ? "true" : undefined}>
              <span className="month-summary-count">{item.count}</span>
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
