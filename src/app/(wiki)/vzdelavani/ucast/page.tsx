import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { calendarStatus } from "@/lib/calendar-note";
import { EXCUSE_REASON_LABELS, GROUP_LABELS } from "@/lib/labels";
import { addDays, formatDate, fromPragueLocal, isValidDateKey, toDateKey, toTimeKey } from "@/lib/time";
import { GROUPS, type Group, type ParticipationState } from "@/lib/types";
import { requireUser } from "@/server/auth/session";
import {
  attendanceByEvent,
  attendanceByPerson,
  attendanceDetail,
  attendanceHistory,
  attendanceScope,
  type AttendanceCounts,
} from "@/server/services/attendance";
import { currentPreview } from "@/server/services/preview-context";

export const metadata: Metadata = { title: "Účast" };

type SearchParams = Promise<{ pohled?: string; akce?: string; clovek?: string; q?: string; od?: string; do?: string; skupina?: string; stav?: string; kalendar?: string }>;

/** Stavy, podle kterých jde filtrovat. Klíč v adrese = pole v počtech. */
const STATES = {
  povinni: { label: "Povinní", count: "required", state: "required" },
  prihlaseni: { label: "Přihlášení", count: "enrolled", state: "voluntary_enrolled" },
  omluveni: { label: "Omluvení", count: "excused", state: "excused" },
  odhlaseni: { label: "Odhlášení", count: "withdrawn", state: "withdrawn" },
} as const satisfies Record<string, { label: string; count: keyof AttendanceCounts; state: ParticipationState }>;
type StateKey = keyof typeof STATES;

const STATE_LABELS: Partial<Record<ParticipationState, string>> = {
  required: "Povinná účast",
  voluntary_enrolled: "Přihlášen/a",
  excused: "Omluven/a",
  withdrawn: "Odhlášen/a",
  cancelled: "Akce zrušena",
};

const HISTORY_LABELS: Record<string, string> = {
  "participation.enroll": "Přihlásil/a se",
  "participation.withdraw": "Odhlásil/a se",
  "participation.excuse": "Omluvil/a se",
  "participation.revoke_excuse": "Zrušil/a omluvu",
  "user.invited": "Pozvánka do Wiki",
  "user.approved": "Přístup schválen",
  "user.enabled": "Přístup obnoven",
  "user.disabled": "Přístup odebrán",
  "user.rejected": "Žádost zamítnuta",
  "user.access_changed": "Změna role nebo skupin",
  "excuse_managers.changed": "Změna nadřízených pro omluvy",
};

/** Nejdelší období jednoho přehledu, ať jeden dotaz nenačítá celou historii. */
const MAX_DAYS = 366;

const when = (iso: string) => {
  const date = new Date(iso);
  return `${formatDate(toDateKey(date))} ${toTimeKey(date)}`;
};

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const preview = await currentPreview(user);
  // Přehled je jen pro správce a určené nadřízené. Ostatním (i v náhledu Pohled) stránka neexistuje.
  const scope = await attendanceScope(user, Boolean(preview));
  if (!scope) notFound();
  const params = await searchParams;

  const today = toDateKey(new Date());
  const from = params.od && isValidDateKey(params.od) ? params.od : addDays(today, -30);
  let to = params.do && isValidDateKey(params.do) && params.do >= from ? params.do : addDays(today, 60);
  if (to > addDays(from, MAX_DAYS)) to = addDays(from, MAX_DAYS);
  const view = params.pohled === "lide" ? "lide" : "akce";
  const query = (params.q ?? "").trim().slice(0, 80);
  const group = GROUPS.find((g: Group) => g === params.skupina);
  const stateKey = (Object.keys(STATES) as StateKey[]).find((k) => k === params.stav);
  const calendarOnly = params.kalendar === "1";
  const filters = { pohled: view === "lide" ? "lide" : undefined, q: query, od: from, do: to, skupina: group, stav: stateKey, kalendar: calendarOnly ? "1" : undefined };
  const link = (change: Record<string, string | undefined> = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, ...change })) if (value) search.set(key, value);
    return `/vzdelavani/ucast?${search.toString()}`;
  };
  const back = <Link className="btn" href={link()}>Zpět na přehled</Link>;
  const range = [fromPragueLocal(from, "00:00"), fromPragueLocal(addDays(to, 1), "00:00")] as const;
  const matches = (text: string) => !query || text.toLocaleLowerCase("cs").includes(query.toLocaleLowerCase("cs"));

  if (params.akce) {
    const detail = await attendanceDetail(user, scope, params.akce.slice(0, 120));
    if (!detail) notFound();
    const people = detail.people
      .map((p) => ({ ...p, status: calendarStatus(detail.cancelled ? "cancelled" : p.state, p.calendar) }))
      .filter((p) => matches(p.name) && (!stateKey || p.state === STATES[stateKey].state) && (!calendarOnly || p.status?.problem));
    return (
      <section className="section" aria-labelledby="ucast-akce">
        <div className="row">{back}</div>
        <p className="eyebrow">{[when(detail.startsAt), GROUP_LABELS[detail.audience]].join(" · ")}</p>
        <h2 id="ucast-akce">{detail.title}</h2>
        {detail.cancelled && <p className="badge badge-danger">Akce je zrušená</p>}
        <CountsLine counts={detail.counts} />
        {people.length === 0 ? (
          <div className="empty-state">
            <p className="item-title">Filtru neodpovídá nikdo.</p>
          </div>
        ) : (
          <table className="table table-stack">
            <thead>
              <tr>
                <th scope="col">Člověk</th>
                <th scope="col">Stav</th>
                <th scope="col">Omluva</th>
                <th scope="col">Kalendář</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={link({ clovek: p.id })}>{p.name}</Link>
                  </td>
                  <td>{STATE_LABELS[p.state] ?? "—"}</td>
                  <td>{p.excuse ? [EXCUSE_REASON_LABELS[p.excuse.reason], p.excuse.note].filter(Boolean).join(": ") : p.state === "excused" ? "Důvod vidí určený nadřízený" : "—"}</td>
                  <td>{p.status ? <span className={`badge ${p.status.problem ? "badge-danger" : "badge-outline"}`}>{p.status.label}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  }

  if (params.clovek) {
    const userId = params.clovek.slice(0, 120);
    const [history, people] = await Promise.all([attendanceHistory(scope, userId), attendanceByPerson(scope, ...range)]);
    const person = people.find((p) => p.id === userId);
    if (!history || !person) notFound();
    return (
      <section className="section" aria-labelledby="ucast-clovek">
        <div className="row">{back}</div>
        <h2 id="ucast-clovek">{person.name}</h2>
        <p className="small muted">Období {formatDate(from)} – {formatDate(to)}{person.active ? "" : " · bez aktivního přístupu"}</p>
        <CountsLine counts={person.counts} />
        <h3>Historie změn</h3>
        {history.length === 0 ? (
          <div className="empty-state">
            <p className="item-title">Zatím žádná zaznamenaná změna.</p>
          </div>
        ) : (
          <ul className="card-list">
            {history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="item-card">
                <p className="eyebrow">{when(h.at)}</p>
                <p className="item-title">{HISTORY_LABELS[h.action] ?? h.action}</p>
                {h.eventId && (
                  <p className="item-meta">
                    <Link href={link({ akce: h.eventId })}>{h.eventTitle ?? "Akce už není dostupná"}</Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const stateFilter = (counts: AttendanceCounts) => !stateKey || counts[STATES[stateKey].count] > 0;
  return (
    <section className="section" aria-labelledby="ucast">
      <h2 id="ucast">Očekávaná účast</h2>
      <p className="small muted">
        {scope.kind === "all" ? "Všichni zaměstnanci." : "Lidé, u kterých jsi určeným nadřízeným pro omluvy."} Podle přihlášek a omluv ve Wiki, nejde o potvrzenou docházku.
      </p>
      <ul className="pill-nav" aria-label="Pohled">
        <li>
          <Link className="pill" href={link({ pohled: undefined })} aria-current={view === "akce" ? "page" : undefined}>Podle akcí</Link>
        </li>
        <li>
          <Link className="pill" href={link({ pohled: "lide" })} aria-current={view === "lide" ? "page" : undefined}>Podle lidí</Link>
        </li>
      </ul>
      <form className="filter-bar" method="get" role="search">
        {view === "lide" && <input type="hidden" name="pohled" value="lide" />}
        <label className="field filter-grow">
          <span className="field-label">{view === "lide" ? "Hledat člověka" : "Hledat akci"}</span>
          <input className="input" type="search" name="q" defaultValue={query} maxLength={80} />
        </label>
        <label className="field">
          <span className="field-label">Od</span>
          <input className="input" type="date" name="od" defaultValue={from} />
        </label>
        <label className="field">
          <span className="field-label">Do</span>
          <input className="input" type="date" name="do" defaultValue={to} />
        </label>
        <label className="field">
          <span className="field-label">Skupina</span>
          <select className="select" name="skupina" defaultValue={group ?? ""}>
            <option value="">Všechny skupiny</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>{GROUP_LABELS[g]}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Stav</span>
          <select className="select" name="stav" defaultValue={stateKey ?? ""}>
            <option value="">Všechny stavy</option>
            {(Object.keys(STATES) as StateKey[]).map((k) => (
              <option key={k} value={k}>{STATES[k].label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Kalendář</span>
          <select className="select" name="kalendar" defaultValue={calendarOnly ? "1" : ""}>
            <option value="">Vše</option>
            <option value="1">Jen problémy Kalendáře</option>
          </select>
        </label>
        <div className="row">
          <button className="btn btn-primary" type="submit">Zobrazit</button>
          <Link className="btn" href={view === "lide" ? "/vzdelavani/ucast?pohled=lide" : "/vzdelavani/ucast"}>Zrušit filtr</Link>
        </div>
      </form>
      {calendarOnly && view === "lide" && <p className="small muted">Filtr Kalendáře platí pro pohled podle akcí a pro detail akce.</p>}
      {view === "akce" ? <EventsTable rows={(await attendanceByEvent(scope, ...range)).filter((e) => matches(e.title) && (!group || e.audience === group) && stateFilter(e.counts) && (!calendarOnly || e.calendarProblems > 0))} link={link} /> : <PeopleTable rows={(await attendanceByPerson(scope, ...range)).filter((p) => matches(p.name) && (!group || p.groups.includes(group)) && stateFilter(p.counts))} link={link} />}
    </section>
  );
}

function CountsLine({ counts }: { counts: AttendanceCounts }) {
  return (
    <p className="small" role="status">
      Očekává se <strong>{counts.expected}</strong> · povinných {counts.required} · přihlášených {counts.enrolled} · omluvených {counts.excused} · odhlášených {counts.withdrawn}
    </p>
  );
}

type LinkFor = (change?: Record<string, string | undefined>) => string;

function EventsTable({ rows, link }: { rows: Awaited<ReturnType<typeof attendanceByEvent>>; link: LinkFor }) {
  if (rows.length === 0) return <div className="empty-state"><p className="item-title">V tomto období a filtru není žádná akce.</p></div>;
  return (
    <table className="table table-stack">
      <thead>
        <tr>
          <th scope="col">Akce</th>
          <th scope="col">Termín</th>
          <th scope="col">Očekává se</th>
          <th scope="col">Povinní</th>
          <th scope="col">Přihlášení</th>
          <th scope="col">Omluvení</th>
          <th scope="col">Odhlášení</th>
          <th scope="col">Kalendář</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id}>
            <td>
              <Link href={link({ akce: e.id })}>{e.title}</Link>
              {e.cancelled && <> <span className="badge badge-danger">Zrušeno</span></>}
            </td>
            <td>{[when(e.startsAt), GROUP_LABELS[e.audience]].join(" · ")}</td>
            <td><span className="visually-hidden">Očekává se </span>{e.counts.expected}</td>
            <td><span className="visually-hidden">Povinní </span>{e.counts.required}</td>
            <td><span className="visually-hidden">Přihlášení </span>{e.counts.enrolled}</td>
            <td><span className="visually-hidden">Omluvení </span>{e.counts.excused}</td>
            <td><span className="visually-hidden">Odhlášení </span>{e.counts.withdrawn}</td>
            <td>
              <span className="visually-hidden">Kalendář </span>
              {e.calendarProblems > 0 ? <Link className="badge badge-danger" href={link({ akce: e.id, kalendar: "1" })}>Problémy: {e.calendarProblems}</Link> : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PeopleTable({ rows, link }: { rows: Awaited<ReturnType<typeof attendanceByPerson>>; link: LinkFor }) {
  if (rows.length === 0) return <div className="empty-state"><p className="item-title">Filtru neodpovídá nikdo.</p></div>;
  return (
    <table className="table table-stack">
      <thead>
        <tr>
          <th scope="col">Člověk</th>
          <th scope="col">Skupiny</th>
          <th scope="col">Očekává se</th>
          <th scope="col">Povinné</th>
          <th scope="col">Přihlášen/a</th>
          <th scope="col">Omluven/a</th>
          <th scope="col">Odhlášen/a</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id}>
            <td>
              <Link href={link({ clovek: p.id })}>{p.name}</Link>
              {!p.active && <> <span className="badge badge-outline">Bez přístupu</span></>}
            </td>
            <td>{p.groups.map((g) => GROUP_LABELS[g as Group] ?? g).join(", ") || "—"}</td>
            <td><span className="visually-hidden">Očekává se </span>{p.counts.expected}</td>
            <td><span className="visually-hidden">Povinné </span>{p.counts.required}</td>
            <td><span className="visually-hidden">Přihlášen/a </span>{p.counts.enrolled}</td>
            <td><span className="visually-hidden">Omluven/a </span>{p.counts.excused}</td>
            <td><span className="visually-hidden">Odhlášen/a </span>{p.counts.withdrawn}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
