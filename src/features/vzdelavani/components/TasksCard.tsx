import Link from "next/link";
import { formatMonth } from "@/lib/time";
import type { JourneyTask } from "@/server/services/journey";
import { monthTasks, type MonthSummary, type PlanState } from "../status";

/** Kolik úkolů se vejde bez rozbalení. */
export const TOP_ROWS = 3;

export type TaskRow = Pick<JourneyTask, "key" | "title" | "detail" | "href" | "action" | "external">;

/**
 * Úkoly diváka a krok měsíce správce v jednom pořadí. Krok měsíce je hlavní práce správce, proto
 * zůstane mezi úkoly viditelnými bez rozbalení (i na telefonu).
 */
export function orderTasks(
  own: TaskRow[],
  summary: MonthSummary | null,
  monthKey: string,
  hrefFor: (state: PlanState) => string,
  onlyState?: PlanState,
): TaskRow[] {
  const monthName = formatMonth(monthKey).split(" ")[0]!;
  const step = (summary ? monthTasks(summary, monthName) : [])
    .filter((task) => !onlyState || task.state === onlyState)
    .map((task) => ({ key: `mesic-${task.state}`, title: task.title, detail: task.detail, href: hrefFor(task.state), action: task.action }));
  const stepAt = Math.min(own.length, TOP_ROWS - 1);
  return [...own.slice(0, stepAt), ...step, ...own.slice(stepAt)];
}

function TaskItem({ task, readOnly }: { task: TaskRow; readOnly: boolean }) {
  return (
    <li className="brief-row">
      <span className="brief-main">
        <span className="item-title">{task.title}</span>
        <span className="item-meta">{task.detail}</span>
      </span>
      {readOnly ? null : task.external ? (
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
}

/**
 * Karta „Čeká na vás“ pro Plán i Úvod. Prázdná karta nic neříká, proto se bez úkolů nevykreslí.
 * Výjimkou je filtr Plánu, který úkoly schoval: karta zůstane s odkazem na zrušení filtru.
 */
export function TasksCard({
  tasks,
  title = "Čeká na vás",
  readOnly = false,
  planHref,
  hidden,
  className = "section tasks-card",
}: {
  tasks: TaskRow[];
  title?: string;
  /** Náhled očima jiného: úkoly jen ke čtení, bez tlačítek. */
  readOnly?: boolean;
  /** Odkaz „Celý plán“ v hlavičce (Úvod). V Plánu chybí, uživatel už v něm je. */
  planHref?: string;
  /** Kolik úkolů skryl filtr Plánu a kam vede jeho zrušení. */
  hidden?: { count: number; resetHref: string };
  className?: string;
}) {
  const hiddenCount = hidden?.count ?? 0;
  if (tasks.length === 0 && hiddenCount === 0) return null;
  return (
    <section className={className} aria-labelledby="ceka">
      <div className="spread section-head">
        <h2 id="ceka">
          {title}
          {tasks.length > 0 && <span className="count-badge">{tasks.length}</span>}
        </h2>
        {planHref && (
          <Link className="btn btn-small" href={planHref}>
            Celý plán
          </Link>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="muted">Vybranému filtru neodpovídá žádný úkol.</p>
      ) : (
        <>
          <ul className="brief-list">
            {tasks.slice(0, TOP_ROWS).map((task) => (
              <TaskItem key={task.key} task={task} readOnly={readOnly} />
            ))}
          </ul>
          {tasks.length > TOP_ROWS && (
            <details className="brief-more">
              <summary>Další úkoly ({tasks.length - TOP_ROWS})</summary>
              <ul className="brief-list">
                {tasks.slice(TOP_ROWS).map((task) => (
                  <TaskItem key={task.key} task={task} readOnly={readOnly} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {hidden && hiddenCount > 0 && (
        <p className="hint">
          Filtr skrývá další úkoly ({hiddenCount}). <Link href={hidden.resetHref}>Zobrazit všechny</Link>
        </p>
      )}
    </section>
  );
}
