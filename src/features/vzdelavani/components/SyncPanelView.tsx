import { ActionForm } from "@/components/ActionForm";
import { ERROR_LABELS, SYNC_STATUS_LABELS } from "@/lib/labels";
import { formatDayMonth, formatEventTime, toDateKey } from "@/lib/time";
import type { SyncPanel } from "@/server/services/detail";
import type { ManagedFields } from "@/server/db/schema";
import { createInviteAction, pairInviteAction, retrySyncAction, simulateManualEditAction } from "../actions";

const RSVP: Record<string, string> = { accepted: "přijato", declined: "odmítnuto", tentative: "možná", needsAction: "bez odpovědi" };
const NOTIFICATION: Record<string, string> = { created: "pozvánka odeslána", updated: "oznámení o změně", cancelled: "oznámení o zrušení" };

const describe = (f: ManagedFields) =>
  `${f.summary} · ${formatDayMonth(toDateKey(new Date(f.startsAt)))} ${formatEventTime(new Date(f.startsAt), new Date(f.endsAt), false)}${f.cancelled ? " · zrušeno" : ""}`;

/** Stav vazby na Google Kalendář pro organizátora. Simulace i testovací režim Googlu mají stejné rozhraní. */
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
      ? "Bez vazby na pozvánku"
      : sync.status === "none"
        ? "Návrh se do Kalendáře neposílá"
        : SYNC_STATUS_LABELS[sync.status];

  return (
    <section className="section" aria-labelledby="kalendar">
      <div className="spread">
        <h2 id="kalendar">Google Kalendář</h2>
        <span className="row">
          <span className="badge badge-outline">{sync.mode === "simulation" ? "simulace" : "test Google · neověřeno proti Googlu"}</span>
          <span className={statusBadge} role="status">
            {statusLabel}
          </span>
        </span>
      </div>

      {sync.calendarUnavailable && (
        <p className="notice notice-danger">
          {sync.calendarErrorCode === "calendar_revoked" || sync.calendarErrorCode === "calendar_not_configured" ? (
            <>
              {sync.calendarErrorCode === "calendar_revoked" ? "Google Kalendář není připojený." : ERROR_LABELS.calendar_not_configured}{" "}
              <a href="/vzdelavani/integrace">Otevřít Integrace</a>
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
            label="Přepsat pozvánku hodnotami z Wiki"
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
            Akce ve Wiki zatím není spárovaná s žádnou pozvánkou. Spárujte ji s existující pozvánkou, nebo výslovně
            založte novou. Wiki sama novou pozvánku nevytvoří, aby nevznikl duplikát.
          </p>
          {sync.candidates.map((c) => (
            <div key={c.id} className="spread candidate">
              <span>
                {c.summary} · {formatEventTime(new Date(c.startsAt), new Date(c.endsAt), false)}
              </span>
              <ActionForm action={pairInviteAction} fields={{ id: eventId, externalId: c.id }} label="Spárovat" small />
            </div>
          ))}
          {sync.mode === "google-test" && (
            <p className="small muted">
              Testovací režim: nová pozvánka půjde jen povoleným testovacím příjemcům ({sync.inviteeCount}), ne publiku akce.
            </p>
          )}
          <ActionForm action={createInviteAction} fields={{ id: eventId }} label="Vytvořit novou pozvánku" />
        </div>
      )}

      {sync.external && (
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
          {sync.mode === "simulation" && sync.status === "synced" && sync.externalId && (
            <details className="small">
              <summary>Nástroje ukázky</summary>
              <div className="section-actions">
                <ActionForm
                  action={simulateManualEditAction}
                  fields={{ externalId: sync.externalId }}
                  label="Simulovat ruční úpravu v Kalendáři"
                  small
                />
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
