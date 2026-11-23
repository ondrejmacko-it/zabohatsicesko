import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
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

const FAILURE: Record<NonNullable<SyncPanel["personalDelivery"]>["failing"][number]["reason"], string> = {
  retrying: "zápis se nepovedl, Wiki to zkusí znovu",
  blocked: "Google zápis odmítá",
  revoked: "přístup ke kalendáři odvolán",
  calendar_deleted: "kalendář smazán",
};

const people = (count: number) => `${count} ${count === 1 ? "člověk" : count >= 2 && count <= 4 ? "lidé" : "lidí"}`;

/**
 * Osobní režim: jen to, co Wiki skutečně ví ze záznamů o zápisu do osobních kalendářů. Žádný souhrnný
 * stav „synchronizováno“, žádná pozvánka organizátora, párování ani e-maily. Chyby jsou zvlášť.
 */
function PersonalSyncView({ sync }: { sync: SyncPanel }) {
  const delivery = sync.personalDelivery;
  const failing = delivery?.failing ?? [];
  const panel = (
    <section className="section" aria-labelledby="kalendar">
      <div className="spread">
        <h2 id="kalendar">Google Kalendář</h2>
        <span className="row">
          <span className="badge badge-outline">osobní kalendáře</span>
          {failing.length > 0 && (
            <span className="badge badge-danger" role="status">
              Chyba zápisu: {people(failing.length)}
            </span>
          )}
          <a className="btn btn-small" href="/vzdelavani/integrace">
            Technické nastavení
          </a>
        </span>
      </div>
      <p className="small">Akce se zapisuje kolegům do jejich vlastních kalendářů. Pozvánky ani e-maily se neposílají.</p>
      {!delivery ? (
        <p className="small muted">Návrh se do kalendářů nezapisuje.</p>
      ) : (
        <dl className="dl">
          <dt>Publikum</dt>
          <dd>{people(delivery.audience)}</dd>
          {delivery.expected ? (
            <>
              <dt>Aktuálně zapsáno</dt>
              <dd>{`do ${delivery.current} z ${delivery.audience} osobních kalendářů`}</dd>
              {delivery.outdated > 0 && (
                <>
                  <dt>Starší podoba akce</dt>
                  <dd>{delivery.outdated}, čeká na aktualizaci při další synchronizaci</dd>
                </>
              )}
              {delivery.missing > 0 && (
                <>
                  <dt>Ještě nezapsáno</dt>
                  <dd>{delivery.missing}, zapíše se při další synchronizaci</dd>
                </>
              )}
            </>
          ) : (
            <>
              <dt>Ještě v kalendářích</dt>
              <dd>{delivery.written > 0 ? `${delivery.written}, zrušená akce se odebere při další synchronizaci` : "nikde, zrušená akce je odebraná"}</dd>
            </>
          )}
          {delivery.notConnected > 0 && (
            <>
              <dt>Bez osobního kalendáře</dt>
              <dd>{people(delivery.notConnected)} (nepropojeno nebo odmítnuto)</dd>
            </>
          )}
          <dt>Poslední běh synchronizace kalendářů</dt>
          <dd>{delivery.lastSyncedAt ? new Date(delivery.lastSyncedAt).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", dateStyle: "short", timeStyle: "short" }) : "zatím žádný"}</dd>
        </dl>
      )}
      {failing.length > 0 && (
        <div className="notice notice-danger">
          <p>Synchronizace kalendáře selhává:</p>
          <ul>
            {failing.map((f) => (
              <li key={f.name}>
                {f.name} · {FAILURE[f.reason]}
              </li>
            ))}
          </ul>
        </div>
      )}
      {sync.legacyInviteId && (
        <p className="small muted">Starší pozvánka v kalendáři správce z doby před osobními kalendáři (ID {sync.legacyInviteId}). Wiki ji už neaktualizuje.</p>
      )}
    </section>
  );
  if (failing.length > 0) return panel;
  return (
    <details className="fold tech-fold">
      <summary>Technické informace</summary>
      {panel}
    </details>
  );
}

/** Stav vazby na Google Kalendář pro správce. Simulace i testovací režim Googlu mají stejné rozhraní. */
export function SyncPanelView({ eventId, sync }: { eventId: string; sync: SyncPanel }) {
  if (sync.personal) return <PersonalSyncView sync={sync} />;
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
          : sync.status === "personal"
            ? "Osobní kalendáře"
            : SYNC_STATUS_LABELS[sync.status];
  // Když jsou v Kalendáři kandidáti ke spárování, je hlavní krok párování a nová pozvánka jde do nabídky.
  const createInMenu = sync.status === "unlinked" && sync.candidates.length > 0;
  const simulationTools = sync.mode === "simulation" && sync.status === "synced" && Boolean(sync.externalId);
  const createInvite = (inMenu: boolean) => (
    <ActionForm action={createInviteAction} fields={{ id: eventId }} label={inMenu ? "Vytvořit novou pozvánku…" : "Vytvořit novou pozvánku"} variant={inMenu ? "default" : "primary"}
      icon={inMenu ? "send" : undefined}
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
          <span className="badge badge-outline">{sync.mode === "simulation" ? "simulace" : sync.attendeeSource === "allowlist" ? "test Google · jen testovací příjemci" : "test Google · publikum akce"}</span>
          <span className={statusBadge} role="status">
            {statusLabel}
          </span>
          <Menu label="Další možnosti Kalendáře" small iconOnly>
            {createInMenu && createInvite(true)}
            {simulationTools && (
              <ActionForm action={simulateManualEditAction} fields={{ externalId: sync.externalId! }} label="Simulovat ruční úpravu v Kalendáři" icon="pencil" />
            )}
            {(createInMenu || simulationTools) && <hr className="menu-divider" />}
            <a className="btn" href="/vzdelavani/integrace">
              <Icon name="settings" />
              Technické nastavení Kalendáře
            </a>
          </Menu>
        </span>
      </div>

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
              "V Kalendáři je ten den pozvánka, která může být touto akcí (blízký čas nebo stejný název). Wiki proto sama novou nezaloží, aby nevznikl duplikát. Spáruj ji, nebo výslovně založ novou. Rozhodnutí můžeš i odložit."}
            {sync.unlinkedReason === "automatic" &&
              "Pozvánka zatím nevznikla. Wiki ji založí sama při příštím otevření Plánu správcem, nebo ji založ hned."}
            {sync.unlinkedReason === "past" && "Akce už proběhla, Wiki k ní pozvánku sama nezakládá. Můžeš ji spárovat s existující."}
            {sync.unlinkedReason === "unavailable" && "Akce zatím nemá pozvánku. Kalendář teď neodpovídá, stav jde ověřit až po jeho obnovení."}
            {sync.unlinkedReason === "cancelled" && "Akce je zrušená, pozvánka se nezakládá."}
          </p>
          {sync.candidates.map((c, i) => (
            <div key={c.id} className="spread candidate">
              <span>
                {c.summary} · {formatEventTime(new Date(c.startsAt), new Date(c.endsAt), false)}
              </span>
              <ActionForm action={pairInviteAction} fields={{ id: eventId, externalId: c.id }} label="Spárovat" variant={i === 0 ? "primary" : "default"} small />
            </div>
          ))}
          <p className="small muted" hidden={sync.unlinkedReason === "cancelled"}>
            {sync.attendeeSource === "allowlist"
              ? `Testovací režim: nová pozvánka půjde jen povoleným testovacím příjemcům (${sync.inviteeCount}), ne publiku akce.`
              : `Nová pozvánka půjde publiku akce (${sync.inviteeCount}). Hosty, které přidáte ručně v Kalendáři, Wiki nemění.`}
            {createInMenu && " Novou pozvánku místo spárování založíš v nabídce ⋯."}
          </p>
          {!createInMenu && sync.unlinkedReason !== "cancelled" && <div className="row">{createInvite(false)}</div>}
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
              {sync.mode === "google-test"
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
