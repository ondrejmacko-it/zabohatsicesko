import Link from "next/link";
import { Icon } from "@/components/Icon";
import { eventContext, eventTitle } from "@/lib/labels";
import {
  addDays,
  formatDayMonth,
  formatEventTime,
  formatRange,
  isoWeekday,
  monthOf,
  monthWeeks,
  toDateKey,
  weekdayLong,
  weekdayShort,
} from "@/lib/time";
import type { EventCard } from "@/server/services/events";
import { ParticipationBadge } from "./ParticipationBadge";
import { badgeClass, cardDetails, cardStatus, cardTone, hiddenMissingDetails, isMovable, isPickable, pickBlockReason, primaryStatus } from "../status";
import { CardMenu, type CardMenuItem } from "./CardMenu";
import { PickBox } from "./PlanSelection";
import styles from "./schedule.module.css";

const COLUMNS = [
  { weekday: 2, label: "Úterý" },
  { weekday: 3, label: "Středa" },
  { weekday: 4, label: "Čtvrtek" },
  { weekday: 5, label: "Pátek" },
];

export type SlotTimes = Record<number, string>;

/** Kam vede klik na akci. Plán posílá odkaz, který otevře náhled v okně a zachová měsíc i filtry. */
export type CardHref = (card: EventCard) => string;
const pageHref: CardHref = (card) => `/vzdelavani/akce/${encodeURIComponent(card.id)}`;
/** Položky menu ⋯ karty (jen Plán). Server je odvodí z `cardActions` a doplní adresy se zachovaným měsícem a filtry. */
export type CardMenuFor = (card: EventCard) => CardMenuItem[];
/**
 * `managing`: správce smí v Plánu měnit (výběr, přesun, menu úprav). `planView`: karty se ukazují správcovsky
 * (stavy, „— doplnit“), i když jde jen o náhled očima kolegy-správce. Bez `planView` platí `managing`.
 */
type Linking = { hrefFor?: CardHref; managing?: boolean; planView?: boolean; menuFor?: CardMenuFor };
/** Plánování v mřížce (jen správce): odkaz „+“ pro přidání akce na den a přesun tažením od dneška dál. */
type Planning = { addHref?: (day: string) => string; movableFrom?: string };
const dayOf = (card: EventCard) => toDateKey(new Date(card.startsAt));

function byDay(cards: EventCard[]): Map<string, EventCard[]> {
  const map = new Map<string, EventCard[]>();
  for (const card of cards) {
    const day = dayOf(card);
    map.set(day, [...(map.get(day) ?? []), card]);
  }
  return map;
}

/** Zveřejněné termíny, které rozpracovaný návrh přesouvá jinam. Vidí je jen správce. */
function ghostsByDay(cards: EventCard[]): Map<string, EventCard[]> {
  const map = new Map<string, EventCard[]>();
  for (const card of cards) {
    if (!card.movedFrom) continue;
    const day = toDateKey(new Date(card.movedFrom.startsAt));
    map.set(day, [...(map.get(day) ?? []), card]);
  }
  return map;
}

/** Stín původního termínu: kolegové a Kalendář ho vidí, dokud správce přesun nezveřejní. */
function GhostBlock({ card, hrefFor = pageHref }: { card: EventCard; hrefFor?: CardHref }) {
  const from = card.movedFrom!;
  return (
    <Link href={hrefFor(card)} scroll={false} className={`${styles.event} ${styles.ghost}`} data-pick-reason="Původní termín patří zveřejněné akci, vybrat nejde.">
      <span className={styles.title}>{card.label}</span>
      <span className={styles.line}>{formatEventTime(new Date(from.startsAt), new Date(from.endsAt), from.allDay)}</span>
      <span className={styles.line}>
        Zveřejněný termín, návrh ho přesouvá na {weekdayShort(dayOf(card))} {formatDayMonth(dayOf(card))}
      </span>
    </Link>
  );
}

/**
 * Stav karty: nejvýš jeden štítek a decentní indikátor chybějících údajů (jen správce). Co přesně chybí,
 * říká popisek indikátoru a čtečce i text odkazu; podrobnosti jsou v okně akce.
 */
function CardMeta({ card, managing }: { card: EventCard; managing: boolean }) {
  const status = cardStatus(card);
  // Jeden stavový štítek; výstraha jen pro chybějící údaj, který karta jinak neukazuje.
  const missing = hiddenMissingDetails(card, managing);
  // Vlastní účast (jen se zapnutou účastí): „Povinné pro tebe“, „Můžeš se přihlásit“, „Přihlášeno“, „Omluveno“.
  const own = card.participation?.label ?? null;
  if (!status && !missing.length && !own) return null;
  const missingText = `Chybí ${missing.join(" a ")}`;
  return (
    <span className={styles.meta}>
      {status && <span className={badgeClass(status.tone)}>{status.label}</span>}
      {own && (
        <ParticipationBadge state={card.participation!.state} label={own} />
      )}
      {missing.length > 0 && (
        <span className={styles.missing} title={missingText}>
          <Icon name="alert" />
          <span className="visually-hidden">{missingText}</span>
        </span>
      )}
    </span>
  );
}

/**
 * Obal karty: v režimu výběru (jen správce, jen návrhy) k ní přidá checkbox, v agendě případně úchyt přesunu
 * a menu ⋯ s rychlými akcemi. Všechno jsou sourozenci odkazu karty, nikdy ne jeho obsah.
 */
function CardWrap({
  card,
  managing,
  handle = false,
  menu = [],
  menuClass,
  stacked = false,
  children,
}: {
  card: EventCard;
  managing: boolean;
  handle?: boolean;
  menu?: CardMenuItem[];
  menuClass?: string;
  /** Návrh změny zveřejněné akce: decentní náznak druhé vrstvy bez textu. */
  stacked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={stacked ? `${styles.cardWrap} ${styles.stacked}` : styles.cardWrap}>
      {children}
      {menu.length > 0 && (
        <CardMenu
          target={{ id: card.id, revision: card.revision ?? 0, label: card.label, from: dayOf(card) }}
          items={menu}
          className={menuClass}
        />
      )}
      {handle && <MoveHandle card={card} />}
      {managing && isPickable(card) && <PickBox id={card.id} label={card.label} />}
    </div>
  );
}

/**
 * Úchyt přesunu v agendě (telefon): samostatné tlačítko vedle odkazu karty, ne uvnitř něj. Podržení a tažení
 * i ťuknutí nebo klávesu obsluhuje `MoveDropZone`. Vlastní atributy, aby se nepletl s tažitelnou kartou mřížky.
 */
function MoveHandle({ card }: { card: EventCard }) {
  return (
    <button
      type="button"
      className={styles.handle}
      data-move-handle={card.id}
      data-handle-revision={card.revision ?? 0}
      data-handle-label={card.label}
      data-handle-from={dayOf(card)}
      aria-label={`Přesunout akci ${card.label} na jiný den`}
      title="Podrž a přetáhni na jiný den"
    >
      <Icon name="grip" size={18} />
    </button>
  );
}

/** Kolonky Kdo a Téma pod názvem akce. Prázdná pole jsou tlumená, ať nepřebíjí vyplněné údaje. */
function CardDetails({ card, managing }: { card: EventCard; managing: boolean }) {
  return cardDetails(card, managing).map((detail) => (
    <span key={detail.label} className={styles.topic} data-detail={detail.label}>
      <span className={styles.detailLabel}>{detail.label}:</span>{" "}
      <span className={detail.missing ? styles.detailMissing : undefined}>{detail.value}</span>
    </span>
  ));
}

/**
 * Režim výběru (jen správce): vybíratelná karta nese `data-pick-id`, ostatní `data-pick-reason`. `SelectionZone`
 * podle toho klik buď přepne výběr, nebo jen ukáže důvod. Karta tak během výběru nikdy neotevře okno akce.
 */
const pickAttr = (card: EventCard, managing: boolean) =>
  !managing ? {} : isPickable(card) ? { "data-pick-id": card.id } : { "data-pick-reason": pickBlockReason(card) ?? "" };

/** Návrh změny zveřejněné akce se kreslí jako návrh (okrově), i když je akce zveřejněná. */
const toneOf = (card: EventCard) => (card.original ? "draft" : cardTone(card));

const changesText = (card: EventCard) =>
  card.original?.changes.length ? `Mění ${card.original.changes.join(", ")}` : "Liší se od zveřejněné verze";

// Karta v mřížce: název, Kdo a Téma, čas a jeden stav. Podrobnosti ukáže okno akce po kliknutí.
function EventBlock({ card, hrefFor = pageHref, managing = false, planView = managing, movable = false, menuFor }: { card: EventCard; movable?: boolean } & Linking) {
  const tone = toneOf(card);
  const isHoliday = card.type === "holiday";
  const cancelled = card.planStatus === "cancelled";
  // Data pro přesun tažením čte `MoveDropZone`. Odkaz zůstává odkazem: klik i klávesnice otevřou náhled.
  const drag = movable && !isHoliday
    ? { draggable: true, "data-move-id": card.id, "data-move-revision": card.revision ?? 0, "data-move-label": card.label, "data-move-from": dayOf(card) }
    : {};
  return (
    <CardWrap card={card} managing={managing} menu={menuFor?.(card)} menuClass={styles.menuGrid} stacked={card.original !== null}>
      <Link href={hrefFor(card)} scroll={false} className={`${styles.event} ${styles[tone]}`} data-ucast={card.participation?.state} {...drag} {...pickAttr(card, managing)}>
        <span className={styles.title}>{card.label}</span>
        <CardDetails card={card} managing={planView} />
        {!isHoliday && !cancelled && <span className={styles.line}>{formatEventTime(new Date(card.startsAt), new Date(card.endsAt), card.allDay)}</span>}
        {card.original && <span className={styles.changes}>{changesText(card)}</span>}
        <CardMeta card={card} managing={planView} />
      </Link>
    </CardWrap>
  );
}

export function ScheduleGrid({
  monthKey,
  cards,
  todayKey,
  slotTimes,
  hrefFor = pageHref,
  managing = false,
  planView = managing,
  addHref,
  movableFrom,
  menuFor,
}: {
  monthKey: string;
  cards: EventCard[];
  todayKey: string;
  slotTimes: SlotTimes;
} & Linking &
  Planning) {
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
                    <Link key={card.id} href={hrefFor(card)} scroll={false} className={styles.offDay} data-pick-reason={managing ? "Termín mimo sloupce vyber v zobrazení Seznam." : undefined}>
                      {weekdayShort(dayOf(card))} {formatDayMonth(dayOf(card))} · {card.label}
                      {primaryStatus(card) && <span className="visually-hidden">, {primaryStatus(card)!.label}</span>}
                    </Link>
                  ))}
                </th>
                {COLUMNS.map((col) => {
                  const day = week[col.weekday - 1]!;
                  const inMonth = monthOf(day) === monthKey;
                  const dayCards = inMonth ? (days.get(day) ?? []) : [];
                  const plannable = inMonth && movableFrom !== undefined && day >= movableFrom;
                  return (
                    <td
                      key={day}
                      className={`${styles.cell} ${inMonth ? "" : styles.outside} ${day === todayKey ? styles.todayCell : ""}`}
                      data-drop-day={plannable ? day : undefined}
                    >
                      <span className={styles.date}>
                        {formatDayMonth(day)}
                        {day === todayKey && <span className={styles.today}>dnes</span>}
                      </span>
                      {plannable && addHref && (
                        <Link
                          href={addHref(day)}
                          scroll={false}
                          className={styles.addDay}
                          aria-label={`Přidat akci na ${weekdayLong(day)} ${formatDayMonth(day)}`}
                          title="Přidat akci na tento den"
                        >
                          <Icon name="plus" />
                        </Link>
                      )}
                      {dayCards.map((card) => (
                        <EventBlock
                          key={card.id}
                          card={card}
                          hrefFor={hrefFor}
                          managing={managing}
                          planView={planView}
                          movable={plannable && isMovable(card)}
                          menuFor={menuFor}
                        />
                      ))}
                      {inMonth && (ghosts.get(day) ?? []).map((card) => <GhostBlock key={`stin-${card.id}`} card={card} hrefFor={hrefFor} />)}
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

/**
 * Chronologický seznam po týdnech a dnech. Výchozí pohled na úzkém displeji. Správce tu na telefonu má „+“
 * u dne a úchyt přesunu (na širší obrazovce je skrývá CSS, plánuje se v mřížce). Den nese `id` pro Přejít na datum.
 */
export function Agenda({
  monthKey,
  cards,
  todayKey,
  emptyText,
  hrefFor = pageHref,
  managing = false,
  planView = managing,
  addHref,
  movableFrom,
  menuFor,
}: {
  monthKey: string;
  cards: EventCard[];
  todayKey: string;
  /** Text prázdného měsíce. Null: prázdný stav už ukazuje stránka sama (Plán správce, F06). */
  emptyText?: string | null;
} & Linking & Planning) {
  const days = byDay(cards.filter((c) => monthOf(dayOf(c)) === monthKey));
  const ghosts = ghostsByDay(cards);
  const weeks = monthWeeks(monthKey)
    .map((week) => ({
      monday: week[0]!,
      days: week.filter((d) => days.has(d) || (ghosts.has(d) && monthOf(d) === monthKey)),
      current: week.includes(todayKey),
    }))
    .filter((w) => w.days.length);
  if (!weeks.length) return emptyText === null ? null : <p className="muted">{emptyText ?? "V tomto měsíci zatím nejsou žádné akce."}</p>;
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
            {week.days.map((day) => {
              const plannable = managing && movableFrom !== undefined && day >= movableFrom;
              return (
              <li
                key={day}
                id={`den-${day}`}
                className={`${styles.agendaDay} ${day === todayKey ? styles.agendaToday : ""}`}
                data-agenda-day={day}
                data-drop-day={plannable ? day : undefined}
              >
                <div className={styles.agendaDate}>
                  {weekdayShort(day)} {formatDayMonth(day)}
                  {day === todayKey && <span className={styles.today}>dnes</span>}
                  {plannable && addHref && (
                    <Link
                      href={addHref(day)}
                      scroll={false}
                      className={styles.agendaAdd}
                      aria-label={`Přidat akci na ${weekdayLong(day)} ${formatDayMonth(day)}`}
                      title="Přidat akci na tento den"
                    >
                      <Icon name="plus" />
                    </Link>
                  )}
                </div>
                <ul className={styles.agendaEvents}>
                  {(days.get(day) ?? []).map((card) => {
                    const handle = plannable && isMovable(card);
                    const menu = menuFor?.(card) ?? [];
                    return (
                      <li key={card.id}>
                        <CardWrap card={card} managing={managing} handle={handle} menu={menu} menuClass={handle ? styles.menuAgendaHandle : styles.menuAgenda}>
                          <Link
                            href={hrefFor(card)}
                            scroll={false}
                            className={`${styles.agendaEvent} ${styles[toneOf(card)]}${handle ? ` ${styles.withHandle}` : ""}${menu.length ? ` ${styles.withMenu}` : ""}`} data-ucast={card.participation?.state}
                            {...pickAttr(card, managing)}
                          >
                            <span className={styles.agendaTime}>
                              {formatEventTime(new Date(card.startsAt), new Date(card.endsAt), card.allDay)}
                            </span>
                            <span className={styles.agendaMain}>
                              <span className={styles.title}>{card.label}</span>
                              <CardDetails card={card} managing={planView} />
                              {card.original && <span className={styles.changes}>{changesText(card)}</span>}
                            </span>
                            <CardMeta card={card} managing={planView} />
                          </Link>
                        </CardWrap>
                      </li>
                    );
                  })}
                  {(ghosts.get(day) ?? []).map((card) => (
                    <li key={`stin-${card.id}`}>
                      <GhostBlock card={card} hrefFor={hrefFor} />
                    </li>
                  ))}
                </ul>
              </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function NextEventCard({ card }: { card: EventCard | null }) {
  if (!card) return <p className="muted">V nejbližších týdnech tě nečeká žádná zveřejněná akce.</p>;
  const day = dayOf(card);
  const title = eventTitle(card.label, card.topicTitle);
  return (
    <Link href={pageHref(card)} className="item-card">
      <p className="eyebrow">{[...eventContext(title, card.type), `${weekdayShort(day)} ${formatDayMonth(day)}`].join(" · ")}</p>
      <p className="item-title">{title}</p>
      <p className="item-meta">
        {formatEventTime(new Date(card.startsAt), new Date(card.endsAt), card.allDay)}
        {card.leadName ? ` · Vede: ${card.leadName}` : ""}
      </p>
    </Link>
  );
}

/** Několik nejbližších akcí pod sebou: den vlevo, název a čas vpravo. První je nejblíž, proto je zvýrazněná. */
export function NextEventsList({ cards, todayKey, hrefFor = pageHref, emptyText }: { cards: EventCard[]; todayKey: string; hrefFor?: CardHref; emptyText?: string }) {
  if (!cards.length) return <p className="muted">{emptyText ?? "V nejbližších týdnech tě nečeká žádná zveřejněná akce."}</p>;
  return (
    <ul className="brief-list">
      {cards.map((card, index) => {
        const day = dayOf(card);
        return (
          <li key={card.id}>
            <Link href={hrefFor(card)} scroll={false} className={`brief-row brief-link${index === 0 ? " brief-first" : ""}`}>
              <span className="brief-date">
                <span className="brief-weekday">{day === todayKey ? "dnes" : weekdayShort(day)}</span>
                <span>{formatDayMonth(day)}</span>
              </span>
              <span className="brief-main">
                <span className="item-title">
                  {eventTitle(card.label, card.topicTitle)}
                  {card.planStatus === "draft" && (
                    <span className="badge badge-draft" title="Návrh, do Kalendáře zatím nejde">
                      Návrh
                    </span>
                  )}
                </span>
                <span className="item-meta">
                  {formatEventTime(new Date(card.startsAt), new Date(card.endsAt), card.allDay)}
                  {card.leadName ? ` · Vede: ${card.leadName}` : ""}
                </span>
                {card.participation?.label && (
                  <ParticipationBadge state={card.participation.state} label={card.participation.label} />
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
