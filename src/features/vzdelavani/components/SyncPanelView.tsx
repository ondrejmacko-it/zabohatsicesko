import { ActionForm } from "@/components/ActionForm";
import { Menu } from "@/components/Menu";
import { ERROR_LABELS, SYNC_STATUS_LABELS } from "@/lib/labels";
import { formatDayMonth, formatEventTime, toDateKey } from "@/lib/time";
import type { SyncPanel } from "@/server/services/detail";
import type { ManagedFields } from "@/server/db/schema";
import { createInviteAction, pairInviteAction, retrySyncAction, simulateManualEditAction } from "../actions";

const RSVP: Record<string, string> = { accepted: "přijato", declined: "odmítnuto", tentative: "možná", needsAction: "bez odpovědi" };
const NOTIFICATION: Record<string, string> = { created: "pozvánka odeslána", updated: "oznámení o změně", cancelled: "oznámení o zrušení" };

const describe = (f: ManagedFields) =>
  `${f.summary} · ${formatDayMonth(toDateKey(new Date(f.startsAt)))} ${formatEventTime(new Date(f.startsAt), new Date(f.endsAt), false)}${f.cancelled ? " · zrušeno" : ""}`;

/** Stav vazby na Google Kalendář pro správce. Simulace i testovací režim Googlu mají stejné rozhraní. */
export function SyncPanelView({ eventId, sync }: { eventId: string; sync: SyncPanel }) {
  const statusBadge =
    sync.status === "synced"
      ? "badge badge-ok"
      : sync.status === "attention"
        ? "badge badge-danger"
        : sync.status === "pending"
          ? "badge badge-ochre"
          : "badge badge-outline";
  const statusLabel =
    sync.status === "unlinked"
      ? sync.candidates.length > 0
        ? "Čeká na spárování"
        : "Zatím bez pozvánky"
      : sync.status === "none"
        ? "Návrh se do Kalendáře neposílá"
        : sync.status === "synced" && sync.external?.cancelled
          ? "Zrušeno i v Kalendáři"
          : sync.status === "pending" && sync.personal
            ? "Zapisuje se do kalendářů"
            : SYNC_STATUS_LABELS[sync.status];
  // Když jsou v Kalendáři kandidáti ke spárování, je hlavní krok párování a nová pozvánka jde do nabídky.
  const createInMenu = sync.status === "unlinked" && sync.candidates.length > 0;
  const simulationTools = sync.mode === "simulation" && sync.status === "synced" && Boolean(sync.externalId);
  const createInvite = (inMenu: boolean) => (
    <ActionForm action={createInviteAction} fields={{ id: eventId }} label={inMenu ? "Vytvořit novou pozvánku…" : "Vytvořit novou pozvánku"} variant={inMenu ? "default" : "primary"}
      confirm={inMenu ? { title: "Vytvořit novou pozvánku", text: "V Kalendáři je v tomto čase pozvánka, kterou jde spárovat. Nová pozvánka vznikne vedle ní a pozvaní dostanou e-mail.", confirmLabel: "Vytvořit" } : undefined}
    />
  );

  // Funkční synchronizace běžného správce nezajímá: panel je sbalený. Otevřený je jen tam, kde je potřeba zásah.
  const needsAction =
    sync.status === "attention" ||
    Boolean(sync.conflict) ||
    sync.calendarUnavailable ||
    (sync.status === "unlinked" && (sync.candidates.length > 0 || sync.unlinkedReason === "lookalike"));

  const panel = (
    <section className="section" aria-labelledby="kalendar">
      <div className="spread">
        <h2 id="kalendar">Google Kalendář</h2>
        <span className="row">
          <span className="badge badge-outline">{sync.personal ? "osobní kalendáře" : sync.mode === "simulation" ? "simulace" : sync.attendeeSource === "allowlist" ? "test Google · jen testovací příjemci" : "test Google · publikum akce"}</span>
          <span className={statusBadge} role="status">
            {statusLabel}
          </span>
          <Menu label="Další možnosti Kalendáře" small iconOnly>
            {createInMenu && createInvite(true)}
            {simulationTools && (
              <ActionForm action={simulateManualEditAction} fields={{ externalId: sync.externalId! }} label="Simulovat ruční úpravu v Kalendáři" />
            )}
            {(createInMenu || simulationTools) && <hr className="menu-divider" />}
            <a className="btn" href="/vzdelavani/integrace">
              Technické nastavení Kalendáře
            </a>
          </Menu>
        </span>
      </div>

      {sync.personal && (
        <p className="small">Akce se zapisuje kolegům do jejich kalendářů. Pozvánky ani e-maily se neposílají.</p>
      )}
      {sync.calendarUnavailable && (
        <p className="notice notice-danger">
          {sync.calendarErrorCode === "calendar_revoked" || sync.calendarErrorCode === "calendar_not_configured" ? (
            <>
              {sync.calendarErrorCode === "calendar_revoked" ? "Google Kalendář není připojený." : ERROR_LABELS.calendar_not_configured}{" "}
              <a href="/vzdelavani/integrace">Otevřít technické nastavení</a>
            </>
          ) : (
            "Kalendář teď neodpovídá. Údaje o pozvánce nejsou k dispozici."
          )}
        </p>
      )}
      {sync.errorCode && sync.status === "attention" && (
        <p className="notice notice-danger">{ERROR_LABELS[sync.errorCode] ?? "Synchronizace se nepovedla."}</p>
      )}

      {sync.conflict && (
        <div className="stack conflict">
          <dl className="dl">
            <dt>V Kalendáři</dt>
            <dd>{describe(sync.conflict.external)}</dd>
            <dt>Ve Wiki</dt>
            <dd>{describe(sync.conflict.wiki)}</dd>
          </dl>
          <ActionForm
            action={retrySyncAction}
            fields={{ id: eventId, force: "on" }}
            label="Použít údaje z Wiki"
            variant="primary"
            confirm={{
              title: "Přepsat pozvánku",
              text: "Změna provedená přímo v Kalendáři se nahradí hodnotami z Wiki a pozvaní dostanou oznámení.",
              confirmLabel: "Přepsat",
            }}
          />
        </div>
      )}

      {sync.status === "attention" && !sync.conflict && (
        <ActionForm action={retrySyncAction} fields={{ id: eventId }} label="Zkusit synchronizaci znovu" variant="primary" />
      )}

      {sync.status === "unlinked" && (
        <div className="stack">
          <p className="small">
            {sync.unlinkedReason === "lookalike" &&
              "V Kalendáři je ten den pozvánka, která může být touto akcí (blízký čas nebo stejný název). Wiki proto sama novou nezaloží, aby nevznikl duplikát. Spárujte ji, nebo výslovně založte novou. Rozhodnutí můžete i odložit."}
            {sync.unlinkedReason === "automatic" &&
              "Pozvánka zatím nevznikla. Wiki ji založí sama při příštím otevření Plánu správcem, nebo ji založte hned."}
            {sync.unlinkedReason === "past" && "Akce už proběhla, Wiki k ní pozvánku sama nezakládá. Můžete ji spárovat s existující."}
            {sync.unlinkedReason === "unavailable" && "Akce zatím nemá pozvánku. Kalendář teď neodpovídá, stav jde ověřit až po jeho obnovení."}
          </p>
          {sync.candidates.map((c, i) => (
            <div key={c.id} className="spread candidate">
              <span>
                {c.summary} · {formatEventTime(new Date(c.startsAt), new Date(c.endsAt), false)}
              </span>
              <ActionForm action={pairInviteAction} fields={{ id: eventId, externalId: c.id }} label="Spárovat" variant={i === 0 ? "primary" : "default"} small />
            </div>
          ))}
          <p className="small muted">
            {sync.attendeeSource === "allowlist"
              ? `Testovací režim: nová pozvánka půjde jen povoleným testovacím příjemcům (${sync.inviteeCount}), ne publiku akce.`
              : `Nová pozvánka půjde publiku akce (${sync.inviteeCount}). Hosty, které přidáte ručně v Kalendáři, Wiki nemění.`}
            {createInMenu && " Novou pozvánku místo spárování založíte v nabídce ⋯."}
          </p>
          {!createInMenu && <div className="row">{createInvite(false)}</div>}
        </div>
      )}

      {sync.external && (
        <details className="fold" open={sync.status !== "synced"}>
          <summary>Podrobnosti pozvánky: hosté ({sync.external.attendees.length}) a oznámení</summary>
        <div className="stack invite">
          <dl className="dl">
            <dt>Pozvánka</dt>
            <dd>
              {sync.external.summary}
              <span className="muted small"> · ID {sync.externalId}</span>
              {sync.seriesInstance && <span className="muted small"> · jeden výskyt série, ostatní termíny se nemění</span>}
            </dd>
            <dt>Hosté</dt>
            <dd>
              {sync.external.attendees.length
                ? sync.external.attendees.map((a) => `${a.name} (${RSVP[a.responseStatus] ?? a.responseStatus})`).join(", ")
                : "bez hostů"}
            </dd>
            {sync.external.meetingUrl && (
              <>
                <dt>Schůzka</dt>
                <dd>odkaz zachován</dd>
              </>
            )}
            <dt>Oznámení</dt>
            <dd>
              {sync.personal
                ? "neposílají se (osobní kalendáře)"
                : sync.mode === "google-test"
                ? "Wiki žádá Google o oznámení pozvaným při každé změně. Doručení Google nehlásí."
                : sync.notifications.length
                  ? sync.notifications.map((n) => `${NOTIFICATION[n.kind] ?? n.kind} (${n.recipients})`).join(" · ")
                  : "zatím žádné"}
            </dd>
          </dl>
        </div>
        </details>
      )}
    </section>
  );
  if (needsAction) return panel;
  return (
    <details className="fold tech-fold">
      <summary>Technické informace</summary>
      {panel}
    </details>
  );
}
