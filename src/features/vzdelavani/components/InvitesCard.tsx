import Link from "next/link";
import { formatDayMonth, toDateKey, toTimeKey } from "@/lib/time";
import { gmailSearchHref, type Invitation, type InvitationsView } from "@/server/calendar/rsvp";

// Jedna seskupená karta pozvánek na Úvodu. Červeně jen akce do 7 dní bez odpovědi, ostatní neutrálně.
// Odpovídá se v e-mailu nebo v Google Kalendáři, Wiki odpověď jen čte.

const STATUS_LABEL: Record<Invitation["status"], string> = {
  needsAction: "Čeká na odpověď",
  accepted: "Přijata",
  tentative: "Možná",
  declined: "Odmítnuto",
  unknown: "Stav nelze ověřit",
};

const when = (iso: string) => {
  const date = new Date(iso);
  return `${formatDayMonth(toDateKey(date))} v ${toTimeKey(date)}`;
};

/** Souhrn vyřízených pozvánek jednou větou, např. „Přijato 2, možná 1.“ */
export function answeredSummary(items: Invitation[]): string | null {
  const count = (status: Invitation["status"]) => items.filter((i) => i.status === status).length;
  const parts = [
    ["přijato", count("accepted")],
    ["možná", count("tentative")],
    ["odmítnuto", count("declined")],
  ].filter(([, n]) => Number(n) > 0).map(([label, n]) => `${label} ${n}`);
  if (!parts.length) return null;
  const text = parts.join(", ");
  return `Vyřízené: ${text}.`;
}

export function InvitesCard({ view }: { view: InvitationsView }) {
  const open = view.items.filter((i) => i.status === "needsAction" || i.status === "unknown");
  const summary = answeredSummary(view.items);
  if (!view.items.length) return null;
  return (
    <section className="section tasks-card" aria-labelledby="pozvanky-uvod" data-testid="pozvanky-uvod">
      <h2 id="pozvanky-uvod">Pozvánky do Kalendáře</h2>
      {open.length > 0 ? (
        <ul className="brief-list">
          {open.map((item) => (
            <li key={item.eventId} className="brief-row" data-urgent={item.urgent || undefined}>
              <span className="brief-main">
                <Link className="item-title" href={`/vzdelavani/akce/${item.eventId}`}>
                  {item.title}
                </Link>
                <span className="item-meta">{when(item.startsAt)}</span>
              </span>
              <span className={`badge${item.urgent ? " badge-danger" : item.status === "unknown" ? " badge-outline" : " badge-ochre"}`}>
                {STATUS_LABEL[item.status]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="item-meta">Na všechny pozvánky jste odpověděli.</p>
      )}
      {summary && <p className="item-meta">{summary}</p>}
      <p className="item-meta">
        {view.verified
          ? "Odpovězte v e-mailu s pozvánkou nebo v Google Kalendáři. Když pozvánku nevidíte, podívejte se i do Spamu."
          : "Odpovědi teď nejde u Googlu ověřit. Wiki to zkusí znovu sama."}
      </p>
      {view.organizerEmail && (
        // Vyhledávání podle odesílatele včetně Spamu. Odkaz na konkrétní zprávu Wiki nezná.
        <a className="btn btn-small" href={gmailSearchHref(view.organizerEmail)} target="_blank" rel="noopener noreferrer">
          Otevřít Gmail
        </a>
      )}
    </section>
  );
}
