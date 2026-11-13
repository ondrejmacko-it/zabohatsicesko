import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icon";
import { generateMonthAction } from "@/features/vzdelavani/actions";
import { EventDialog } from "@/features/vzdelavani/components/EventDialog";
import { Agenda, Legend, NextEventCard, PlanGaps, ScheduleGrid } from "@/features/vzdelavani/components/Schedule";
import { TemplateDialog } from "@/features/vzdelavani/components/TemplateDialog";
import { planGaps } from "@/features/vzdelavani/status";
import styles from "@/features/vzdelavani/components/schedule.module.css";
import { formatMonth, isValidMonthKey, monthOf, shiftMonth, toDateKey } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { now } from "@/server/config";
import { defaultAudience } from "@/server/domain/generation";
import { isOrganizer } from "@/server/policy";
import { listMonth, listPeople, loadTemplate, nextEventFor } from "@/server/services/events";
import { listTopics } from "@/server/services/topics";

export const metadata: Metadata = { title: "Harmonogram" };

type SearchParams = Promise<{ mesic?: string; pohled?: string }>;

export default async function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const todayKey = toDateKey(now());
  const monthKey = params.mesic && isValidMonthKey(params.mesic) ? params.mesic : monthOf(todayKey);
  const listView = params.pohled === "seznam";
  const organizer = isOrganizer(user);

  const [cards, next, template] = await Promise.all([listMonth(user, monthKey), nextEventFor(user), loadTemplate()]);
  const slotTimes = Object.fromEntries(template.filter((s) => s.active).map((s) => [s.isoWeekday, `${s.startTime}–${s.endTime}`]));
  const [people, topics] = organizer ? await Promise.all([listPeople(user), listTopics(user)]) : [[], []];
  const syncing = cards.some((c) => c.syncStatus === "pending");
  const link = (month: string, list = listView) => `/vzdelavani/harmonogram?mesic=${month}${list ? "&pohled=seznam" : ""}`;
  const newDate = monthOf(todayKey) === monthKey ? todayKey : `${monthKey}-01`;

  return (
    <>
      <AutoRefresh active={syncing} />
      <section className="section">
        <h2>Nejbližší akce</h2>
        <NextEventCard card={next} />
      </section>

      <section className="section" aria-labelledby="mesic">
        <div className="spread schedule-toolbar">
          <div className="row">
            <Link className="btn btn-small" href={link(shiftMonth(monthKey, -1))} aria-label="Předchozí měsíc">
              <Icon name="chevronLeft" />
            </Link>
            <h2 id="mesic" className="month-title">
              {formatMonth(monthKey)}
            </h2>
            <Link className="btn btn-small" href={link(shiftMonth(monthKey, 1))} aria-label="Další měsíc">
              <Icon name="chevronRight" />
            </Link>
          </div>
          <div className="row">
            <div className="row view-toggle" role="group" aria-label="Zobrazení">
              <Link className="pill" href={link(monthKey, false)} aria-current={!listView ? "page" : undefined}>
                Měsíc
              </Link>
              <Link className="pill" href={link(monthKey, true)} aria-current={listView ? "page" : undefined}>
                Seznam
              </Link>
            </div>
            {organizer && (
              <>
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
                />
                <details className="menu">
                  <summary className="btn">
                    <Icon name="more" /> Nástroje organizátora
                  </summary>
                  <div className="menu-list organizer-tools">
                    <ActionForm action={generateMonthAction} fields={{ month: monthKey }} label="Doplnit měsíc ze šablony" pendingLabel="Doplňuji…" />
                    <TemplateDialog slots={template} />
                  </div>
                </details>
              </>
            )}
          </div>
        </div>

        {organizer && <PlanGaps gaps={planGaps(cards, monthKey)} />}

        {listView ? (
          <Agenda monthKey={monthKey} cards={cards} todayKey={todayKey} />
        ) : (
          <>
            <div className={styles.desktopOnly}>
              <ScheduleGrid monthKey={monthKey} cards={cards} todayKey={todayKey} slotTimes={slotTimes} />
              <Legend />
            </div>
            <div className={styles.mobileOnly}>
              <Agenda monthKey={monthKey} cards={cards} todayKey={todayKey} />
            </div>
          </>
        )}
      </section>
    </>
  );
}
