import Link from "next/link";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDayMonth, toDateKey } from "@/lib/time";
import { GROUPS } from "@/lib/types";
import type { CalendarStatus } from "@/server/services/calendar-status";

const CONNECT_HREF = "/api/google/kalendar/pripojit?auto=1";
const DAY_MS = 24 * 3600 * 1000;

const PROBLEMS: Record<NonNullable<CalendarStatus["problem"]>, string> = {
  not_connected: "Kalendář Google není propojený. Zveřejněné akce se nikomu do kalendáře nepropíšou.",
  lapsed: "Propojení Kalendáře vypršelo nebo bylo u Googlu odvoláno. Zveřejněné akce se teď nikomu nepropíšou.",
  not_configured: "Kalendář Google nemá na serveru úplné nastavení. Pozvánky se neposílají.",
  unreachable: "Google teď neodpovídá, stav propojení se nepodařilo ověřit. Změny se odešlou, jakmile bude dostupný.",
};

/** Jeden řádek se stavem Kalendáře pro správce: kdo je propojený, kam se zapisuje a kdo dostává pozvánky. */
/** Platnost propojení Kalendáře končí do dvou dnů. */
export function calendarExpiresSoon(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) return false;
  return Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS) <= 2;
}

export function CalendarStatusLine({ status, now, detailed }: { status: CalendarStatus; now: Date; detailed?: boolean }) {
  if (status.mode === "simulation") {
    return (
      <p className="cal-status" role="status">
        <strong>Kalendář</strong>
        <span className="badge badge-outline">ukázkový režim</span>
        <span className="cal-status-rest">Simulace · skutečné e-maily se neodesílají.</span>
      </p>
    );
  }
  const { connection, problem } = status;
  if (!connection) {
    return (
      <div className="cal-status cal-status-alert" role="alert">
        <span className="cal-status-main">
          <strong>{PROBLEMS[problem ?? "not_connected"]}</strong>
          {problem !== "not_configured" && <span className="cal-status-rest">Stačí jednou potvrdit souhlas u Googlu.</span>}
        </span>
        {problem !== "not_configured" && (
          <a className="btn btn-primary" href={CONNECT_HREF}>
            Propojit Kalendář
          </a>
        )}
      </div>
    );
  }
  const expiring = calendarExpiresSoon(connection.expiresAt, now);
  const accounts = new Set(GROUPS.flatMap((g) => status.recipients[g].map((r) => r.email)));
  return (
    <div className={`cal-status${expiring ? " cal-status-warn" : ""}`} role="status">
      <span className="cal-status-main">
        <strong>Kalendář</strong>
        <span className="badge badge-ok">Propojeno</span>
        <span className="cal-status-rest">
          účtem {connection.accountEmail} · kalendář {status.calendarId} · pozvánky dostává:{" "}
          {status.attendeeSource === "allowlist"
            ? `pouze testovací příjemci (${accounts.size})`
            : `účty podle skupin (${accounts.size})`}
          {!detailed && (
            <>
              {" · "}
              <Link href="/sprava#pozvanky">Příjemci pozvánek podle skupin</Link>
            </>
          )}
        </span>
        {problem === "unreachable" && <span className="cal-status-rest">{PROBLEMS.unreachable}</span>}
        {connection.expiresAt && (
          <span className="cal-status-rest">
            {expiring ? <strong>Souhlas u Googlu vyprší {formatDayMonth(toDateKey(new Date(connection.expiresAt)))}.</strong> : `Souhlas platí do ${formatDayMonth(toDateKey(new Date(connection.expiresAt)))}`}{" "}
            (aplikace je u Googlu v režimu Testing, 7 dní). Obnovíš ho jedním potvrzením.
          </span>
        )}
      </span>
      {expiring && (
        <a className="btn btn-primary btn-small" href={CONNECT_HREF}>
          Obnovit propojení
        </a>
      )}
    </div>
  );
}

/**
 * Krátké upozornění pro Plán. Ukáže se jen, když propojení nefunguje nebo brzy vyprší.
 * Podrobný stav (účet, kalendář, příjemci) je ve Správě.
 */
export function CalendarAlert({ status, now }: { status: CalendarStatus; now: Date }) {
  if (status.mode === "simulation") return null;
  const { connection, problem } = status;
  const fixable = problem !== "not_configured";
  if (!connection) {
    return (
      <div className="cal-status cal-status-alert" role="alert">
        <span className="cal-status-main">
          <strong>{PROBLEMS[problem ?? "not_connected"]}</strong>
        </span>
        {fixable ? (
          <a className="btn btn-primary btn-small" href={CONNECT_HREF}>
            Propojit Kalendář
          </a>
        ) : (
          <Link className="btn btn-small" href="/sprava#pozvanky">
            Otevřít Správu
          </Link>
        )}
      </div>
    );
  }
  if (problem === "unreachable") {
    return (
      <p className="cal-status cal-status-warn" role="status">
        <span className="cal-status-main">{PROBLEMS.unreachable}</span>
      </p>
    );
  }
  const daysLeft = connection.expiresAt ? Math.ceil((new Date(connection.expiresAt).getTime() - now.getTime()) / DAY_MS) : null;
  if (daysLeft === null || daysLeft > 2) return null;
  return (
    <div className="cal-status cal-status-warn" role="status">
      <span className="cal-status-main">
        <strong>Propojení Kalendáře vyprší {formatDayMonth(toDateKey(new Date(connection.expiresAt!)))}.</strong>
        <span className="cal-status-rest">Obnovíš ho jedním potvrzením u Googlu.</span>
      </span>
      <a className="btn btn-primary btn-small" href={CONNECT_HREF}>
        Obnovit propojení
      </a>
    </div>
  );
}

/** Komu Wiki pošle pozvánku podle skupiny akce. Na Správě, ať je před zapnutím skutečných pozvánek jasno. */
export function InviteRecipients({ status }: { status: CalendarStatus }) {
  const real = status.mode === "google";
  const pending = real && status.attendeeSource === "allowlist";
  return (
    <div className="stack">
      <p className="small muted">
        {!real
          ? "V ukázkovém režimu se žádné e-maily neposílají. Tabulka ukazuje, komu by pozvánky šly podle skupin."
          : pending
            ? "Teď Wiki zve jen testovací adresu. Po zapnutí skutečných pozvánek (CALENDAR_ATTENDEES=audience) dostanou e-mail od Googlu účty níže, vždy podle skupiny akce."
            : "Skutečné pozvánky jsou zapnuté. E-mail od Googlu dostávají účty níže, vždy podle skupiny akce."}
      </p>
      <table className="table recipients-table">
        <thead>
          <tr>
            <th scope="col">Akce pro skupinu</th>
            <th scope="col">{pending ? "Pozvánku dostane po zapnutí" : "Pozvánku dostane"}</th>
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((g) => {
            const list = status.audienceRecipients[g];
            return (
              <tr key={g}>
                <th scope="row">
                  {GROUP_LABELS[g]} <span className="muted">({list.length})</span>
                </th>
                <td>{list.length ? list.map((r) => `${r.name} (${r.email})`).join(", ") : <span className="muted">nikdo, ve skupině není žádný účet se skutečnou adresou</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
