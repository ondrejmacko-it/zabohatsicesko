import type { Metadata } from "next";
import type { EventCard } from "@/server/services/events";
import Link from "next/link";
import { after } from "next/server";
import { ActionForm } from "@/components/ActionForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icon";
import { generateMonthAction } from "@/features/vzdelavani/actions";
import { CalendarAlert } from "@/features/vzdelavani/components/CalendarStatusLine";
import { EventDialog } from "@/features/vzdelavani/components/EventDialog";
import { PersonalCalendarStatus } from "@/features/vzdelavani/components/PersonalCalendarStatus";
import { EventPeek } from "@/features/vzdelavani/components/EventPeek";
import { SelectionZone } from "@/features/vzdelavani/components/PlanSelection";
import { PrepareMonthDialog } from "@/features/vzdelavani/components/PrepareMonthDialog";
import { inviteModeOf } from "@/lib/invite-mode";
import { PlanFilters, type StateChip } from "@/features/vzdelavani/components/PlanFilters";
import { Agenda, NextEventsList, ScheduleGrid } from "@/features/vzdelavani/components/Schedule";
import { TasksCard } from "@/features/vzdelavani/components/TasksCard";
import { PLAN_STATES, cardActions, filterCards, filterValues, isPickable, monthSummary, type CardActionKind } from "@/features/vzdelavani/status";
import type { CardMenuFor } from "@/features/vzdelavani/components/Schedule";
import styles from "@/features/vzdelavani/components/schedule.module.css";
import { MoveDropZone } from "@/features/vzdelavani/components/MoveEvent";
import { formatMonth, isValidDateKey, isValidMonthKey, monthOf, shiftMonth, toDateKey } from "@/lib/time";
import { EVENT_TYPES } from "@/lib/types";
import { syncPublished } from "@/server/calendar/sync";
import { requireUser } from "@/server/auth/session";
import { now, participationEnabled } from "@/server/config";
import { isMine } from "@/server/domain/participation";
import { withOwnParticipation } from "@/server/services/participation";
import { defaultAudience } from "@/server/domain/generation";
import { isOrganizer } from "@/server/policy";
import { listMonth, listMonthDrafts, listPeople, loadTemplate, nextEventFor } from "@/server/services/events";
import { loadCalendarStatus, loadPersonalCalendar } from "@/server/services/calendar-status";
import { listTasks } from "@/server/services/journey";
import { currentPreview } from "@/server/services/preview-context";
import { duplicateFormValues, topicFormValues } from "@/server/services/detail";
import { listTopics } from "@/server/services/topics";
import { ShotGrant } from "@/components/feedback/ShotGrant";

export const metadata: Metadata = { title: "Plán vzdělávání" };

type SearchParams = Promise<{ mesic?: string; pohled?: string; ucast?: string; typ?: string | string[]; stav?: string | string[]; akce?: string; den?: string; kopie?: string; tema?: string }>;

/** Nejbližší zveřejněná akce: z již načteného aktuálního měsíce, jinak jedním dotazem dopředu. */
async function nearestEvent(viewer: Parameters<typeof nextEventFor>[0], monthCards: EventCard[]): Promise<EventCard | null> {
  const from = now();
  const inMonth = monthCards.find((c) => c.planStatus === "published" && c.type !== "holiday" && new Date(c.startsAt) >= from);
  return inMonth ?? (await nextEventFor(viewer));
}

export default async function PlanPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const todayKey = toDateKey(now());
  const monthKey = params.mesic && isValidMonthKey(params.mesic) ? params.mesic : monthOf(todayKey);
  const listView = params.pohled === "seznam";
  const organizer = isOrganizer(user);

  // Globální náhled (lišta Pohled) očima skupiny nebo kolegy počítá server stejnými pravidly jako pro skutečného uživatele.
  const preview = await currentPreview(user);
  const managing = organizer && !preview;
  // Celá stránka, tedy i úkoly, se počítá pro stejného diváka jako harmonogram.
  const viewer = preview?.viewer ?? user;
  // Všechna data stránky v jedné vlně: dotazy na sobě nezávisí, takže se čeká jen na nejpomalejší z nich.
  const [rawMonthCards, template, viewerTasks, people, topics, calendar, monthDrafts, personal] = await Promise.all([
    listMonth(viewer, monthKey),
    loadTemplate(),
    listTasks(viewer),
    organizer ? listPeople(user) : [],
    organizer ? listTopics(user) : [],
    managing ? loadCalendarStatus(user) : null,
    managing ? listMonthDrafts(user, monthKey) : null,
    // Vlastní kalendář patří přihlášenému, v náhledu očima kolegy se neukazuje.
    preview ? null : loadPersonalCalendar(user),
  ]);
  // Vlastní účast (PARTICIPATION=on): štítky a filtr Moje. Bez přepínače karty beze změny a bez dotazu.
  const participation = participationEnabled();
  const mineOnly = participation && params.ucast === "moje";
  const monthCards = await withOwnParticipation(user, preview, rawMonthCards);
  const activeSlots = template.filter((s) => s.active);
  const slotTimes = Object.fromEntries(activeSlots.map((s) => [s.isoWeekday, `${s.startTime}–${s.endTime}`]));
  const inviteMode = calendar ? inviteModeOf(calendar) : "simulation";

  const types = EVENT_TYPES.filter((t) => monthCards.some((c) => c.type === t && monthOf(toDateKey(new Date(c.startsAt))) === monthKey));
  // Více hodnot v jedné kategorii (`typ=a&typ=b`) platí NEBO, mezi typem a stavem A. Stavy jsou jen pro správce.
  const selectedTypes = filterValues(params.typ, types);
  const states = managing ? filterValues(params.stav, PLAN_STATES) : [];
  const filtered = filterCards(monthCards, monthKey, { types: selectedTypes, states });
  // Svátky zůstávají i v Moje, jsou jen pro orientaci v měsíci.
  const cards = mineOnly ? filtered.filter((c) => c.type === "holiday" || isMine(c.participation, c.handler)) : filtered;
  const filtering = selectedTypes.length > 0 || states.length > 0;
  const syncing = monthCards.some((c) => c.syncStatus === "pending");
  // Čekající pozvánky (nový host ve skupině, obnovené propojení) i zveřejněné akce bez vazby se odešlou
  // samy, jakmile správce otevře Plán. Souběh hlídá zámek u každé vazby v `syncPending`.
  if (managing) after(() => syncPublished());

  type Current = { mesic: string; pohled?: string; ucast?: string; typ: string[]; stav: string[]; akce?: string; den?: string; kopie?: string };
  const current: Current = { mesic: monthKey, pohled: listView ? "seznam" : undefined, ucast: mineOnly ? "moje" : undefined, typ: selectedTypes, stav: states };
  const link = (change: Partial<Current>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...current, ...change })) {
      for (const v of Array.isArray(value) ? value : [value]) if (v) query.append(key, v);
    }
    return `/vzdelavani/harmonogram?${query}`;
  };
  const toggled = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  // Klik na akci otevře náhled v okně nad Plánem. Měsíc, pohled i filtry zůstávají v adrese.
  const peekHref = (card: EventCard) => link({ akce: card.id });
  const peekId = (params.akce ?? "").slice(0, 120);
  // „+“ na dni v mřížce otevře Přidat akci s předvyplněným datem (`?den=`). Server datum ověří jako vždy.
  const addDay = managing && params.den && isValidDateKey(params.den) ? params.den : null;
  const addHref = (day: string) => link({ den: day });
  const newDate = addDay ?? (monthOf(todayKey) === monthKey ? todayKey : `${monthKey}-01`);
  // Duplikovat (`?kopie=`): Přidat akci předvyplněná podle existující akce, uloží se jen jako návrh.
  // Neznámá akce nebo svátek okno neotevře.
  const copyId = managing && params.kopie ? params.kopie.slice(0, 120) : null;
  const copyValues = copyId ? await duplicateFormValues(user, copyId, todayKey) : null;
  // Naplánovat téma (`?tema=`): s `akce` předvyplní téma v okně akce, bez ní otevře Přidat akci k tématu.
  // Uloží se běžnou cestou (návrh, nebo zveřejnění s kontrolou dopadu). Neznámé či archivované téma nic neotevře.
  const topicParam = managing && params.tema ? params.tema.slice(0, 120) : null;
  const topicValues = topicParam && !peekId && !copyValues ? await topicFormValues(user, topicParam, todayKey) : null;

  // Menu ⋯ na kartách: položky podle stavu a role (`cardActions`), adresy se zachovaným měsícem a filtry.
  const fullHref = (card: EventCard) => `/vzdelavani/akce/${encodeURIComponent(card.id)}`;
  const actionHref: Partial<Record<CardActionKind, (card: EventCard) => string>> = {
    edit: peekHref,
    duplicate: (card) => link({ kopie: card.id }),
    details: fullHref,
    minutes: (card) => `/vzdelavani/zapisy?zapis=${encodeURIComponent(card.id)}`,
    recording: (card) => `${fullHref(card)}#nahravka`,
  };
  const menuNow = now();
  const menuFor: CardMenuFor = (card) =>
    cardActions(card, {
      managing,
      preview: Boolean(preview),
      movable: managing && monthOf(toDateKey(new Date(card.startsAt))) === monthKey && toDateKey(new Date(card.startsAt)) >= todayKey,
      now: menuNow,
    }).map((action) => {
      const href = actionHref[action.kind]?.(card);
      return href ? { ...action, href } : action;
    });
  const emptyText = filtering ? "Filtru v tomto měsíci neodpovídá žádná akce." : mineOnly ? "Tento měsíc pro tebe nemáš žádnou akci." : undefined;

  // Co v měsíci čeká na správce: štítky nad harmonogramem, klik plán zúží (znovu klik filtr zruší).
  const summary = managing && monthKey >= monthOf(todayKey) ? monthSummary(monthCards, monthKey) : null;
  const chips: StateChip[] = summary
    ? [
        { state: "navrhy" as const, label: "Návrhy", spoken: "ke zveřejnění", count: summary.toPublish, hint: "Návrhy, které kolegové uvidí až po zveřejnění." },
        { state: "doplnit" as const, label: "Doplnit", spoken: summary.toComplete <= 4 ? "akce" : "akcí", count: summary.toComplete, hint: "Chybí téma, vedoucí nebo oprava v Kalendáři." },
      ]
        .filter((chip) => chip.count > 0)
        // Kotva #mesic: zúžený plán pak začíná první akcí, kterou štítek počítá (mřížka i agenda jsou v DOM zároveň,
        // kotva na kartu by na telefonu mířila na skrytou mřížku).
        .map((chip) => ({ ...chip, href: `${link({ stav: toggled(states, chip.state) })}#mesic` }))
    : [];
  // Vlastní úkoly diváka (záznam, zápis…) jsou v Plánu sbalené do jednoho řádku. Celé jsou na Úvodu.
  const tasks = viewerTasks;
  // Kdo nemá úkoly ani neplánuje, uvidí na telefonu nejdřív nejbližší akci (měsíční seznam začíná prvním dnem).
  const nextEvent = !managing && tasks.length === 0 ? await nearestEvent(viewer, monthKey === monthOf(todayKey) ? monthCards : []) : null;
  const thisMonth = monthOf(todayKey);
  // Přesun (mřížka myší, agenda úchytem na telefonu) i „+“ u dne jen pro správce, od dneška dál.
  const planning = managing ? { addHref, movableFrom: todayKey } : {};
  const schedule = listView ? (
    <Agenda monthKey={monthKey} cards={cards} todayKey={todayKey} emptyText={emptyText} hrefFor={peekHref} managing={managing} menuFor={menuFor} {...planning} />
  ) : (
    <>
      <div className={styles.desktopOnly}>
        <ScheduleGrid monthKey={monthKey} cards={cards} todayKey={todayKey} slotTimes={slotTimes} hrefFor={peekHref} managing={managing} menuFor={menuFor} {...planning} />
      </div>
      <div className={styles.mobileOnly}>
        <Agenda monthKey={monthKey} cards={cards} todayKey={todayKey} emptyText={emptyText} hrefFor={peekHref} managing={managing} menuFor={menuFor} {...planning} />
      </div>
    </>
  );
  return (
    <>
      <ShotGrant page="/vzdelavani/harmonogram" />
      <AutoRefresh active={syncing} />
      {peekId && <EventPeek key={`${peekId}|${topicParam ?? ""}`} user={user} eventId={peekId} preview={preview} closeHref={link({})} presetTopicId={topicParam ?? undefined} />}
      {/* V režimu osobních kalendářů se do kalendáře správce nezapisuje, jeho propojení Plán nehlídá. */}
      {calendar && !personal && <CalendarAlert status={calendar} now={now()} />}
      {personal && <PersonalCalendarStatus state={personal} />}
      {tasks.length > 0 && (
        <details className="plan-tasks">
          <summary>
            {preview ? "Úkoly v náhledu" : "Čeká na vás"}
            <span className="count-badge">{tasks.length}</span>
          </summary>
          <TasksCard tasks={tasks} title={preview ? "Úkoly v náhledu" : undefined} readOnly={Boolean(preview)} className="tasks-card" />
        </details>
      )}

      {nextEvent && (
        <section className={`section ${styles.mobileOnly}`} aria-labelledby="nejblizsi">
          <h2 id="nejblizsi">Nejbližší akce</h2>
          <NextEventsList cards={[nextEvent]} todayKey={todayKey} hrefFor={peekHref} />
        </section>
      )}
      <section className="section" aria-labelledby="mesic">
        {/* Lišta Plánu ve třech zónách (mřížka se stejně širokými krajními sloupci): vlevo zobrazení,
            přesně uprostřed měsíc, vpravo akce správce. Pod ní jeden řádek filtrů a výběru. */}
        <div className="plan-head">
          <div className="schedule-toolbar">
            <div className="toolbar-start" role="group" aria-label="Zobrazení">
              <span className="view-toggle">
                <Link className="pill" href={link({ pohled: undefined })} aria-current={!listView ? "page" : undefined}>
                  Měsíc
                </Link>
                <Link className="pill" href={link({ pohled: "seznam" })} aria-current={listView ? "page" : undefined}>
                  Seznam
                </Link>
              </span>
              {participation && (
                <span className="view-toggle participation-toggle" role="group" aria-label="Akce">
                  <Link className="pill" href={link({ ucast: "moje" })} aria-current={mineOnly ? "page" : undefined}>
                    Moje
                  </Link>
                  <Link className="pill" href={link({ ucast: undefined })} aria-current={!mineOnly ? "page" : undefined}>
                    Všechny
                  </Link>
                </span>
              )}
              {monthKey !== thisMonth && (
                <Link className="btn btn-small btn-quiet" href={link({ mesic: thisMonth })}>
                  Dnes
                </Link>
              )}
            </div>
            <div className="month-nav">
              <Link className="btn btn-icon" href={link({ mesic: shiftMonth(monthKey, -1) })} aria-label="Předchozí měsíc">
                <Icon name="chevronLeft" />
              </Link>
              <h2 id="mesic" className="month-title">
                {formatMonth(monthKey)}
              </h2>
              <Link className="btn btn-icon" href={link({ mesic: shiftMonth(monthKey, 1) })} aria-label="Další měsíc">
                <Icon name="chevronRight" />
              </Link>
            </div>
            <div className="toolbar-end">
              {monthDrafts && calendar && (
                <PrepareMonthDialog
                  monthKey={monthKey}
                  monthName={formatMonth(monthKey)}
                  todayKey={todayKey}
                  drafts={monthDrafts.drafts}
                  changeDrafts={monthDrafts.changeDrafts}
                  people={people}
                  topics={topics.map((t) => t.name)}
                  recipients={calendar.recipients}
                  inviteMode={inviteMode}
                  template={template}
                />
              )}
              {managing && (
                <EventDialog
                  key={copyValues ? `kopie-${copyId}` : topicValues ? `tema-${topicParam}` : (addDay ?? "nova")}
                  openOnMount={addDay !== null || copyValues !== null || topicValues !== null}
                  closeHref={addDay || copyValues || topicValues ? link({}) : undefined}
                  duplicateOf={copyValues ? copyId! : undefined}
                  initial={copyValues ?? topicValues ?? {
                    type: "other",
                    label: "",
                    date: newDate,
                    endDate: null,
                    startTime: "09:00",
                    endTime: "11:00",
                    topicTitle: "",
                    audience: defaultAudience("other"),
                    leadId: "",
                    reviewerId: "",
                  }}
                  people={people}
                  topics={topics}
                  invite={calendar}
                  planDays={activeSlots.map((s) => s.isoWeekday)}
                />
              )}
            </div>
          </div>
        </div>
        <SelectionZone
          monthKey={monthKey}
          items={managing ? cards.filter(isPickable).map((c) => ({ id: c.id, revision: c.revision! })) : []}
          publishable={monthDrafts?.drafts ?? []}
          changeDrafts={monthDrafts?.changeDrafts ?? 0}
          invite={calendar ? { recipients: calendar.recipients, mode: inviteMode } : null}
        >
          <PlanFilters
            key={preview?.key ?? ""}
            keep={[["mesic", monthKey], ...(current.pohled ? [["pohled", current.pohled] as [string, string]] : []), ...(current.ucast ? [["ucast", current.ucast] as [string, string]] : []), ...states.map((s): [string, string] => ["stav", s])]}
            types={types}
            selectedTypes={selectedTypes.map((t) => ({ type: t, removeHref: link({ typ: selectedTypes.filter((x) => x !== t) }) }))}
            resetHref={filtering ? link({ typ: [], stav: [] }) : null}
            chips={chips}
            states={states}
            quick={{ monthKey, todayKey, planHref: link({}), addDate: managing ? (monthOf(todayKey) === monthKey ? todayKey : `${monthKey}-01`) : null }}
          />

          {summary && !summary.planned && (
            <div className="notice month-summary-empty">
              <p>V tomto měsíci zatím nejsou žádné akce.</p>
              {managing && <ActionForm action={generateMonthAction} fields={{ month: monthKey }} label="Přidat chybějící termíny jako návrhy" pendingLabel="Přidávám…" variant="primary" />}
            </div>
          )}

          {managing ? <MoveDropZone movableFrom={todayKey}>{schedule}</MoveDropZone> : schedule}
        </SelectionZone>
      </section>
    </>
  );
}
