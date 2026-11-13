import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icon";
import { generateMonthAction } from "@/features/vzdelavani/actions";
import { EventDialog } from "@/features/vzdelavani/components/EventDialog";
import { PlanFilters } from "@/features/vzdelavani/components/PlanFilters";
import { Agenda, Legend, NextEventsList, ScheduleGrid } from "@/features/vzdelavani/components/Schedule";
import { TemplateDialog } from "@/features/vzdelavani/components/TemplateDialog";
import { PLAN_STATES, filterCards, monthSummary, monthTasks } from "@/features/vzdelavani/status";
import styles from "@/features/vzdelavani/components/schedule.module.css";
import { formatMonth, isValidMonthKey, monthOf, shiftMonth, toDateKey } from "@/lib/time";
import { EVENT_TYPES } from "@/lib/types";
import { requireUser } from "@/server/auth/session";
import { now } from "@/server/config";
import { defaultAudience } from "@/server/domain/generation";
import { isOrganizer } from "@/server/policy";
import { listMonth, listPeople, loadTemplate, nextEventsFor } from "@/server/services/events";
import { listTasks } from "@/server/services/journey";
import { listPreviewOptions, resolvePreview } from "@/server/services/preview";
import { listTopics } from "@/server/services/topics";

export const metadata: Metadata = { title: "Plán vzdělávání" };

type SearchParams = Promise<{ mesic?: string; pohled?: string; jako?: string; typ?: string; stav?: string }>;

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
  const [monthCards, upcoming, template, ownTasks] = await Promise.all([
    listMonth(preview?.viewer ?? user, monthKey),
    nextEventsFor(user, TOP_ROWS),
    loadTemplate(),
    listTasks(user),
  ]);
  const activeSlots = template.filter((s) => s.active);
  const slotTimes = Object.fromEntries(activeSlots.map((s) => [s.isoWeekday, `${s.startTime}–${s.endTime}`]));
  const [people, topics, previewOptions] = organizer
    ? await Promise.all([listPeople(user), listTopics(user), listPreviewOptions(user)])
    : [[], [], null];

  const types = EVENT_TYPES.filter((t) => monthCards.some((c) => c.type === t && monthOf(toDateKey(new Date(c.startsAt))) === monthKey));
  const type = types.find((t) => t === params.typ);
  const state = managing ? PLAN_STATES.find((s) => s === params.stav) : undefined;
  const cards = filterCards(monthCards, monthKey, { type, state });
  const filtering = Boolean(type || state);
  const syncing = monthCards.some((c) => c.syncStatus === "pending");

  const current = { mesic: monthKey, pohled: listView ? "seznam" : undefined, jako: preview ? params.jako : undefined, typ: type, stav: state };
  const link = (change: Partial<typeof current>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...current, ...change })) if (value) query.set(key, value);
    return `/vzdelavani/harmonogram?${query}`;
  };
  const newDate = monthOf(todayKey) === monthKey ? todayKey : `${monthKey}-01`;
  const emptyText = filtering ? "Filtru v tomto měsíci neodpovídá žádná akce." : undefined;

  // Stav měsíce patří organizátorovi mezi úkoly: odkaz zúží harmonogram na termíny, kterých se týká.
  const summary = managing && monthKey >= monthOf(todayKey) ? monthSummary(monthCards, monthKey) : null;
  const tasks = [
    ...ownTasks,
    ...(summary ? monthTasks(summary, formatMonth(monthKey).split(" ")[0]!) : []).map((task) => ({
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
      {task.external ? (
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
      <div className="plan-top">
        <section className="section" aria-labelledby="ceka">
          <h2 id="ceka">
            Čeká na vás{tasks.length > 0 && <span className="count-badge">{tasks.length}</span>}
          </h2>
          {tasks.length === 0 ? (
            <p className="muted">Teď po vás nic nechceme. Úkoly se tu objeví, když povedete akci nebo budete kontrolovat zápis.</p>
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
        </section>
        <section className="section" aria-labelledby="nejblizsi">
          <h2 id="nejblizsi">Nejbližší akce</h2>
          <NextEventsList cards={upcoming} todayKey={todayKey} />
        </section>
      </div>

      <section className="section" aria-labelledby="mesic">
        <div className="spread schedule-toolbar">
          <div className="row">
            <Link className="btn btn-small" href={link({ mesic: shiftMonth(monthKey, -1) })} aria-label="Předchozí měsíc">
              <Icon name="chevronLeft" />
            </Link>
            <h2 id="mesic" className="month-title">
              {formatMonth(monthKey)}
            </h2>
            <Link className="btn btn-small" href={link({ mesic: shiftMonth(monthKey, 1) })} aria-label="Další měsíc">
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
              <details className="menu">
                <summary className="btn">
                  <Icon name="more" /> Nástroje organizátora
                </summary>
                <div className="menu-list organizer-tools">
                  <ActionForm action={generateMonthAction} fields={{ month: monthKey }} label="Doplnit měsíc ze šablony" pendingLabel="Doplňuji…" />
                  <TemplateDialog slots={template} />
                </div>
              </details>
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
                inviteeCount={0}
                planDays={activeSlots.map((s) => s.isoWeekday)}
              />
            </div>
          )}
        </div>

        {summary && !summary.planned && (
          <p className="notice month-summary-empty">Měsíc je zatím prázdný. Doplňte ho ze šablony v Nástrojích organizátora, nebo přidejte akci.</p>
        )}

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
            Díváte se jako <strong>{preview.label}</strong>. Vidíte jen zveřejněné akce, které tento pohled opravdu vidí. Návrhy a úpravy
            jsou schované. <Link href={link({ jako: undefined })}>Zpět na pohled organizátora</Link>
          </p>
        )}

        {listView ? (
          <Agenda monthKey={monthKey} cards={cards} todayKey={todayKey} emptyText={emptyText} as={current.jako} />
        ) : (
          <>
            <div className={styles.desktopOnly}>
              <ScheduleGrid monthKey={monthKey} cards={cards} todayKey={todayKey} slotTimes={slotTimes} as={current.jako} />
              <Legend organizer={managing} />
            </div>
            <div className={styles.mobileOnly}>
              <Agenda monthKey={monthKey} cards={cards} todayKey={todayKey} emptyText={emptyText} as={current.jako} />
            </div>
          </>
        )}
      </section>
    </>
  );
}
