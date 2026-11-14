import type { Metadata } from "next";
import type { EventCard } from "@/server/services/events";
import Link from "next/link";
import { after } from "next/server";
import { ActionForm } from "@/components/ActionForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icon";
import { Menu } from "@/components/Menu";
import { generateMonthAction } from "@/features/vzdelavani/actions";
import { CalendarStatusLine } from "@/features/vzdelavani/components/CalendarStatusLine";
import { EventDialog } from "@/features/vzdelavani/components/EventDialog";
import { EventPeek } from "@/features/vzdelavani/components/EventPeek";
import { PrepareMonthDialog } from "@/features/vzdelavani/components/PrepareMonthDialog";
import { PublishMonthDialog } from "@/features/vzdelavani/components/PublishMonthDialog";
import { PlanFilters } from "@/features/vzdelavani/components/PlanFilters";
import { Agenda, Legend, NextEventsList, ScheduleGrid } from "@/features/vzdelavani/components/Schedule";
import { TemplateDialog } from "@/features/vzdelavani/components/TemplateDialog";
import { PLAN_STATES, filterCards, matchesPlanFilter, monthSummary, monthTasks } from "@/features/vzdelavani/status";
import styles from "@/features/vzdelavani/components/schedule.module.css";
import { formatMonth, isValidMonthKey, monthOf, shiftMonth, toDateKey } from "@/lib/time";
import { EVENT_TYPES } from "@/lib/types";
import { syncPublished } from "@/server/calendar/sync";
import { requireUser } from "@/server/auth/session";
import { now } from "@/server/config";
import { defaultAudience } from "@/server/domain/generation";
import { isOrganizer } from "@/server/policy";
import { listMonth, listMonthDrafts, listPeople, loadTemplate, nextEventsFor } from "@/server/services/events";
import { inviteModeOf, loadCalendarStatus } from "@/server/services/calendar-status";
import { listTasks } from "@/server/services/journey";
import { listPreviewOptions, resolvePreview } from "@/server/services/preview";
import { listTopics } from "@/server/services/topics";

export const metadata: Metadata = { title: "Plán vzdělávání" };

type SearchParams = Promise<{ mesic?: string; pohled?: string; jako?: string; typ?: string; stav?: string; akce?: string }>;

/** Kolik řádků se v horních blocích vejde bez rozbalení. Oba bloky tak zůstávají podobně vysoké. */
const TOP_ROWS = 3;

export default async function PlanPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const todayKey = toDateKey(now());
  const monthKey = params.mesic && isValidMonthKey(params.mesic) ? params.mesic : monthOf(todayKey);
  const listView = params.pohled === "seznam";
  const organizer = isOrganizer(user);

  // Náhled očima skupiny nebo kolegy počítá server stejnými pravidly jako pro skutečného uživatele.
  const preview = await resolvePreview(user, params.jako);
  const managing = organizer && !preview;
  // Celá stránka, tedy i oba horní bloky, se počítá pro stejného diváka jako harmonogram.
  const viewer = preview?.viewer ?? user;
  const [monthCards, template, viewerTasks] = await Promise.all([listMonth(viewer, monthKey), loadTemplate(), listTasks(viewer)]);
  const activeSlots = template.filter((s) => s.active);
  const slotTimes = Object.fromEntries(activeSlots.map((s) => [s.isoWeekday, `${s.startTime}–${s.endTime}`]));
  const [people, topics, previewOptions] = organizer
    ? await Promise.all([listPeople(user), listTopics(user), listPreviewOptions(user)])
    : [[], [], null];

  const calendar = managing ? await loadCalendarStatus(user) : null;
  const monthDrafts = managing ? await listMonthDrafts(user, monthKey) : null;
  const invite = calendar ? { mode: inviteModeOf(calendar), recipients: calendar.recipients } : null;

  const types = EVENT_TYPES.filter((t) => monthCards.some((c) => c.type === t && monthOf(toDateKey(new Date(c.startsAt))) === monthKey));
  const type = types.find((t) => t === params.typ);
  const state = managing ? PLAN_STATES.find((s) => s === params.stav) : undefined;
  const cards = filterCards(monthCards, monthKey, { type, state });
  const filtering = Boolean(type || state);
  const upcoming = await nextEventsFor(viewer, TOP_ROWS, filtering ? (card) => matchesPlanFilter(card, { type, state }) : undefined, Boolean(state));
  const syncing = monthCards.some((c) => c.syncStatus === "pending");
  // Čekající pozvánky (nový host ve skupině, obnovené propojení) i zveřejněné akce bez vazby se odešlou
  // samy, jakmile správce otevře Plán. Souběh hlídá zámek u každé vazby v `syncPending`.
  if (managing) after(() => syncPublished());

  const current = { mesic: monthKey, pohled: listView ? "seznam" : undefined, jako: preview ? params.jako : undefined, typ: type, stav: state };
  const link = (change: Partial<typeof current> & { akce?: string }) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...current, ...change })) if (value) query.set(key, value);
    return `/vzdelavani/harmonogram?${query}`;
  };
  // Klik na akci otevře náhled v okně nad Plánem. Měsíc, pohled i filtry zůstávají v adrese.
  const peekHref = (card: EventCard) => link({ akce: card.id });
  const peekId = (params.akce ?? "").slice(0, 120);
  const nextMonthKey = shiftMonth(monthOf(todayKey), 1);
  const newDate = monthOf(todayKey) === monthKey ? todayKey : `${monthKey}-01`;
  const emptyText = filtering ? "Filtru v tomto měsíci neodpovídá žádná akce." : undefined;

  // Stav měsíce patří správci mezi úkoly: odkaz zúží harmonogram na termíny, kterých se týká.
  // Počty ve filtru Stav jsou za celý měsíc, úkoly měsíce respektují vybraný typ akce.
  const summary = managing && monthKey >= monthOf(todayKey) ? monthSummary(monthCards, monthKey) : null;
  const taskSummary = summary && type ? monthSummary(filterCards(monthCards, monthKey, { type }), monthKey) : summary;
  const ownTasks = viewerTasks.filter((task) => !state && (!type || task.eventType === type));
  const hiddenTasks = viewerTasks.length - ownTasks.length;
  const tasks = [
    ...ownTasks,
    ...(taskSummary ? monthTasks(taskSummary, formatMonth(monthKey).split(" ")[0]!).filter((task) => !state || task.state === state) : []).map((task) => ({
      key: `mesic-${task.state}`,
      title: task.title,
      detail: task.detail,
      href: `${link({ stav: task.state })}#mesic`,
      action: task.action,
    })),
  ];
  const taskRow = (task: (typeof tasks)[number] & { external?: boolean }) => (
    <li key={task.key} className="brief-row">
      <span className="brief-main">
        <span className="item-title">{task.title}</span>
        <span className="item-meta">{task.detail}</span>
      </span>
      {preview ? null : task.external ? (
        <a className="btn btn-small btn-primary" href={task.href}>
          {task.action}
        </a>
      ) : (
        <Link className="btn btn-small btn-primary" href={task.href}>
          {task.action}
        </Link>
      )}
    </li>
  );

  return (
    <>
      <AutoRefresh active={syncing} />
      {peekId && <EventPeek key={peekId} user={user} eventId={peekId} preview={preview} previewKey={current.jako} closeHref={link({})} />}
      <div className="plan-filter-bar">
    {(previewOptions || types.length > 1) && (
      <PlanFilters
        key={`${params.jako ?? ""}|${type ?? ""}|${state ?? ""}`}
        keep={Object.fromEntries(Object.entries({ mesic: monthKey, pohled: current.pohled }).filter((e): e is [string, string] => Boolean(e[1])))}
        types={types}
        type={type}
        preview={previewOptions && { ...previewOptions, value: preview ? (params.jako ?? "") : "" }}
        states={summary && summary.planned ? { summary, value: state } : null}
        resetHref={filtering || preview ? link({ jako: undefined, typ: undefined, stav: undefined }) : null}
      />
    )}
    {preview && (
      <p className="notice" role="status">
        Díváte se jako <strong>{preview.label}</strong>. Celá stránka ukazuje jen to, co tento pohled opravdu vidí. Návrhy a úpravy
        jsou schované, úkoly jsou jen ke čtení. <Link href={link({ jako: undefined })}>Zpět na pohled správce</Link>
      </p>
    )}
      </div>
      {calendar && <CalendarStatusLine status={calendar} now={now()} />}
      <div className="plan-top">
        <section className="section" aria-labelledby="ceka">
          <h2 id="ceka">
            {preview ? "Úkoly v náhledu" : "Čeká na vás"}
            {tasks.length > 0 && <span className="count-badge">{tasks.length}</span>}
          </h2>
          {tasks.length === 0 ? (
            <p className="muted">
              {hiddenTasks > 0
                ? "Vybranému filtru neodpovídá žádný úkol."
                : preview
                  ? "Tento pohled teď žádný úkol nemá."
                  : "Teď po vás nic nechceme. Úkoly se tu objeví, když povedete akci nebo budete kontrolovat zápis."}
            </p>
          ) : (
            <>
              <ul className="brief-list">{tasks.slice(0, TOP_ROWS).map(taskRow)}</ul>
              {tasks.length > TOP_ROWS && (
                <details className="brief-more">
                  <summary>Další úkoly ({tasks.length - TOP_ROWS})</summary>
                  <ul className="brief-list">{tasks.slice(TOP_ROWS).map(taskRow)}</ul>
                </details>
              )}
            </>
          )}
          {hiddenTasks > 0 && (
            <p className="hint">
              Filtr skrývá další úkoly ({hiddenTasks}). <Link href={link({ typ: undefined, stav: undefined })}>Zobrazit všechny</Link>
            </p>
          )}
        </section>
        <section className="section" aria-labelledby="nejblizsi">
          <h2 id="nejblizsi">Nejbližší akce</h2>
          <NextEventsList cards={upcoming} todayKey={todayKey} hrefFor={peekHref} emptyText={filtering ? "Filtru v nejbližších týdnech neodpovídá žádná akce." : preview ? "Tento pohled v nejbližších týdnech žádnou zveřejněnou akci nemá." : undefined} />
        </section>
      </div>

      <section className="section" aria-labelledby="mesic">
        <div className="spread schedule-toolbar">
          <div className="row">
            <Link className="btn" href={link({ mesic: shiftMonth(monthKey, -1) })} aria-label="Předchozí měsíc">
              <Icon name="chevronLeft" />
            </Link>
            <h2 id="mesic" className="month-title">
              {formatMonth(monthKey)}
            </h2>
            <Link className="btn" href={link({ mesic: shiftMonth(monthKey, 1) })} aria-label="Další měsíc">
              <Icon name="chevronRight" />
            </Link>
            <div className="row view-toggle" role="group" aria-label="Zobrazení">
              <Link className="pill" href={link({ pohled: undefined })} aria-current={!listView ? "page" : undefined}>
                Měsíc
              </Link>
              <Link className="pill" href={link({ pohled: "seznam" })} aria-current={listView ? "page" : undefined}>
                Seznam
              </Link>
            </div>
          </div>
          {managing && (
            <div className="row">
              <Menu label="Nástroje správce" className="organizer-tools">
                <ActionForm action={generateMonthAction} fields={{ month: monthKey }} label="Doplnit měsíc ze šablony" pendingLabel="Doplňuji…" />
                <TemplateDialog slots={template} />
              </Menu>
              {invite && (
                <PrepareMonthDialog
                  monthKey={nextMonthKey}
                  monthName={formatMonth(nextMonthKey)}
                  people={people}
                  topics={topics.map((t) => ({ name: t.name, interestCount: t.interestCount }))}
                  recipients={invite.recipients}
                  inviteMode={invite.mode}
                />
              )}
              {monthDrafts && invite && monthDrafts.drafts.length > 0 && (
                <PublishMonthDialog
                  key={monthDrafts.drafts.map((d) => `${d.id}:${d.revision}`).join("|")}
                  monthKey={monthKey}
                  monthName={formatMonth(monthKey)}
                  drafts={monthDrafts.drafts}
                  changeDrafts={monthDrafts.changeDrafts}
                  people={people}
                  topics={topics.map((t) => t.name)}
                  recipients={invite.recipients}
                  inviteMode={invite.mode}
                />
              )}
              <EventDialog
                mode="create"
                initial={{
                  type: "other",
                  label: "Jiná akce",
                  date: newDate,
                  endDate: null,
                  startTime: "09:00",
                  endTime: "11:00",
                  topicTitle: "",
                  audience: defaultAudience("other"),
                  leadId: "",
                  reviewerId: "",
                }}
                published={null}
                people={people}
                topics={topics}
                invite={invite}
                planDays={activeSlots.map((s) => s.isoWeekday)}
              />
            </div>
          )}
        </div>

        {summary && !summary.planned && (
          <p className="notice month-summary-empty">Měsíc je zatím prázdný. Doplňte ho ze šablony v Nástrojích správce, nebo přidejte akci.</p>
        )}

        {listView ? (
          <Agenda monthKey={monthKey} cards={cards} todayKey={todayKey} emptyText={emptyText} hrefFor={peekHref} managing={managing} />
        ) : (
          <>
            <div className={styles.desktopOnly}>
              <ScheduleGrid monthKey={monthKey} cards={cards} todayKey={todayKey} slotTimes={slotTimes} hrefFor={peekHref} managing={managing} />
              <Legend organizer={managing} />
            </div>
            <div className={styles.mobileOnly}>
              <Agenda monthKey={monthKey} cards={cards} todayKey={todayKey} emptyText={emptyText} hrefFor={peekHref} managing={managing} />
            </div>
          </>
        )}
      </section>
    </>
  );
}
