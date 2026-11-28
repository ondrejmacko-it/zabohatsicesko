"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type MissingStatus = "no-lead" | "none" | "progress" | "draft";

export const MISSING_STATUS_LABELS: Record<MissingStatus, string> = {
  "no-lead": "Chybí vedoucí",
  none: "Chybí zápis",
  progress: "Rozpracováno",
  draft: "Čeká na schválení",
};

const STATUS_BADGE: Record<MissingStatus, string> = {
  "no-lead": "badge badge-danger",
  none: "badge badge-ochre",
  progress: "badge",
  draft: "badge badge-ok",
};

/** Řádek okna K dokončení. Adresy a texty spočítá server, klient jen hledá a filtruje. */
export type MissingRow = {
  eventId: string;
  title: string;
  date: string;
  lead: string;
  status: MissingStatus;
  /** Upřesnění rozpracovaného stavu (přepis běží, selhal…). */
  detail?: string;
  href: string;
  action: string;
  primary: boolean;
  assignHref?: string;
  mine: boolean;
};

/** Od tohoto počtu nabídne okno hledání a filtr stavu. */
const SEARCH_FROM = 7;

export function MissingMinutesList({ rows, othersLabel }: { rows: MissingRow[]; othersLabel: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MissingStatus | "">("");
  const searchable = rows.length >= SEARCH_FROM;
  const statuses = useMemo(() => (Object.keys(MISSING_STATUS_LABELS) as MissingStatus[]).filter((s) => rows.some((r) => r.status === s)), [rows]);
  const needle = query.trim().toLocaleLowerCase("cs");
  const shown = rows.filter((r) => (!status || r.status === status) && (!needle || `${r.title} ${r.lead} ${r.date}`.toLocaleLowerCase("cs").includes(needle)));
  const filtered = Boolean(needle || status);
  const mine = shown.filter((r) => r.mine);
  const others = shown.filter((r) => !r.mine);
  // Nadpisy skupin, jakmile okno ukazuje i cizí akce: samotný seznam vlastních úkolů je nepotřebuje.
  const grouped = rows.some((r) => !r.mine);
  const hasMine = rows.some((r) => r.mine);

  const mineTotal = rows.filter((r) => r.mine).length;
  return (
    <>
      {/* Počty jednou nahoře, nadpisy skupin je neopakují. */}
      <p className="hint missing-summary">
        {grouped && mineTotal > 0 ? `${mineTotal} moje · ${rows.length} celkem.` : `Celkem ${rows.length}.`} Vyber akci a dokonči její zápis.
      </p>
      {searchable && (
        <div className="filter-bar missing-filter" role="search">
          <label className="field filter-grow">
            <span className="field-label">Hledat akci</span>
            <input className="input" type="search" value={query} maxLength={80} onChange={(e) => setQuery(e.target.value)} placeholder="Název, vedoucí, datum…" />
          </label>
          {statuses.length > 1 && (
            <label className="field">
              <span className="field-label">Stav</span>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value as MissingStatus | "")}>
                <option value="">Všechny stavy</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {MISSING_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {filtered && (
        <p className="small muted" role="status">
          Zobrazeno {shown.length} z {rows.length}
          {shown.length === 0 && " · hledání nic nenašlo. "}
          <button type="button" className="link-button" onClick={() => { setQuery(""); setStatus(""); }}>
            Zrušit filtr
          </button>
        </p>
      )}
      {grouped ? (
        <>
          {hasMine ? <MissingGroup title="Moje úkoly" rows={mine} /> : <p className="muted">Na tebe teď žádný zápis nečeká.</p>}
          <MissingGroup title={othersLabel} rows={others} />
        </>
      ) : (
        <MissingTable rows={shown} />
      )}
    </>
  );
}

function MissingGroup({ title, rows }: { title: string; rows: MissingRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="missing-group" aria-label={title}>
      <h3 className="missing-group-title">
        {title}
      </h3>
      <MissingTable rows={rows} />
    </section>
  );
}

function MissingTable({ rows }: { rows: MissingRow[] }) {
  if (!rows.length) return null;
  return (
    <ul className="missing-list" data-testid="k-dokonceni">
      {rows.map((row) => (
        <li key={row.eventId} className="missing-row">
          <div className="missing-main">
            {/* Název vede vždy na zápis: u akce bez vedoucího ho správce smí psát i před přiřazením. */}
            <Link className="missing-title item-title" href={row.href} scroll={false}>
              {row.title}
            </Link>
            <p className="missing-meta item-meta">
              <span className="missing-date">{row.date}</span>
              <span className="missing-lead">{row.lead}</span>
            </p>
          </div>
          <div className="missing-side">
            <span className="missing-status">
              <span className={STATUS_BADGE[row.status]}>{MISSING_STATUS_LABELS[row.status]}</span>
              {row.detail && <span className="item-meta">{row.detail}</span>}
            </span>
            <Link
              className={row.primary ? "btn btn-small btn-primary missing-action" : "btn btn-small missing-action"}
              href={row.assignHref ?? row.href}
              scroll={false}
              aria-label={`${row.assignHref ? "Přiřadit vedoucího" : row.action}: ${row.title}, ${row.date}`}
            >
              {row.assignHref ? "Přiřadit vedoucího" : row.action}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
