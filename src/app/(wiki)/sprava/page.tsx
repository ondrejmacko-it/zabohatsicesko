import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AccountActions,
  InviteButton,
} from "@/features/sprava/components/AccessForms";
import { GROUP_LABELS, ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/labels";
import { formatDate, formatDayMonth, toDateKey } from "@/lib/time";
import type { Role } from "@/lib/types";
import { ActionForm } from "@/components/ActionForm";
import { cleanupLegacyInvitesAction } from "@/features/sprava/actions";
import {
  CalendarStatusLine,
  calendarExpiresSoon,
  InviteRecipients,
} from "@/features/vzdelavani/components/CalendarStatusLine";
import { PersonalCalendarStatus, personalCalendarLabel, personalCalendarView } from "@/features/vzdelavani/components/PersonalCalendarStatus";
import type { PersonalCalendarState } from "@/server/calendar/personal";
import { legacyInviteCount } from "@/server/calendar/legacy-invites";
import { workerHealth } from "@/server/calendar/worker";
import { CalendarWorkerHealth } from "@/features/vzdelavani/components/CalendarWorkerHealth";
import { getDb } from "@/server/db/client";
import { loadCalendarStatus, loadPersonalCalendars } from "@/server/services/calendar-status";
import { requireUser } from "@/server/auth/session";
import { isLiveWiki, now, personalSelfInvite } from "@/server/config";
import { canManageUsers } from "@/server/policy";
import { listAccounts, type Account } from "@/server/services/users";

export const metadata: Metadata = { title: "Správa systému" };

export default async function AdminPage() {
  const user = await requireUser();
  // Stejná odpověď jako neexistující stránka: bez oprávnění se o správě nic nedozví.
  if (!canManageUsers(user)) notFound();
  const [accounts, calendar, personal, legacyInvites, worker] = await Promise.all([
    listAccounts(user),
    loadCalendarStatus(user),
    loadPersonalCalendars(user),
    legacyInviteCount(user),
    getDb().then(workerHealth),
  ]);
  // Jedna role pro plánování a správu. Starší hodnota „organizer“ se už nepřiděluje, pravidla ji berou stejně.
  const roles: Role[] = ["admin", "member"];
  const pending = accounts.filter((a) => a.status === "pending");
  const others = accounts.filter((a) => a.status !== "pending");
  const live = isLiveWiki();
  // Integrace a diagnostika jsou sbalené. Otevřou se samy, jen když něco vyžaduje zásah správce.
  const ownCalendar = personal?.get(user.id);
  const attention = personal
    ? legacyInvites > 0 || Boolean(ownCalendar && personalCalendarView(ownCalendar).action)
    : calendar.mode !== "simulation" && (!calendar.connection || calendarExpiresSoon(calendar.connection.expiresAt, now())) ||
      Boolean(worker?.alerts.length);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Správa systému</h1>
          <p className="page-sub">
            Role určuje, co člověk smí, skupiny, které akce a zápisy uvidí.
          </p>
        </div>
        <InviteButton roles={roles} />
      </div>

      {pending.length > 0 && (
        <section className="section stack" aria-labelledby="zadosti">
          <h2 id="zadosti">
            Čekající žádosti{" "}
            {pending.length > 0 && (
              <span className="badge badge-ochre">{pending.length}</span>
            )}
          </h2>
          {pending.map((a) => (
            <article key={a.id} className="item-card">
              <AccountHead
                account={a}
                actions={<AccountActions account={a} roles={roles} />}
              />
            </article>
          ))}
        </section>
      )}

      <section className="section stack" aria-labelledby="uzivatele">
        <h2 id="uzivatele">Lidé</h2>
        {others.map((a) => (
          <article key={a.id} className="item-card">
            <AccountHead
              account={a}
              live={live}
              personal={personal}
              actions={
                !a.primary && (a.editable || live) ? (
                  <AccountActions
                    account={a}
                    roles={roles}
                    editable={a.editable}
                    {...(live
                      ? {
                          live: {
                            inviteWaiting: a.access.invite.kind === "waiting",
                            devices: a.access.devices,
                          },
                        }
                      : {})}
                  />
                ) : (
                  <span className="menu-placeholder" aria-hidden="true" />
                )
              }
            />
          </article>
        ))}
      </section>

      <details className="section admin-tech" id="pozvanky-kalendare" open={attention}>
        <summary>
          <h2 id="pozvanky">Kalendář a technický stav</h2>
          {attention && <span className="badge badge-danger">Vyžaduje zásah</span>}
        </summary>
        {/* Stejné pořadí v obou režimech: stav Kalendáře, co chce zásah, podrobnosti. Každý řádek má stejnou stavbu. */}
        <div className="stack">
        {personal ? (
          <div className="cal-status" role="status">
            <span className="cal-status-main">
              <strong>Kalendář</strong>
              <span className="badge badge-ok">Osobní kalendáře</span>
              <span className="cal-status-rest">
                Akce se zapisují do kalendáře „Vzdělávání ZBC“ v účtu Google každého člověka, podle jeho skupin.{" "}
                {personalSelfInvite()
                  ? "Zkušební režim upozornění: každý je hostem svých akcí a Google mu má poslat e-mail o nové, změněné a zrušené akci."
                  : "Pozvánky ani e-maily o pozvání se neposílají."}{" "}
                Stav u každého je v seznamu Lidé.
              </span>
            </span>
          </div>
        ) : (
          <CalendarStatusLine status={calendar} now={now()} />
        )}
        {/* Vlastní kalendář správce: při odpojení tady rovnou tlačítko „Připojit Kalendář znovu“. Za kolegy to udělat nejde. */}
        {ownCalendar && <PersonalCalendarStatus state={ownCalendar} />}
        {legacyInvites > 0 && (
          <div className="cal-status cal-status-warn" data-testid="stare-pozvanky">
            <span className="cal-status-main">
              <strong>Staré pozvánky: {legacyInvites}</strong>
              <span className="cal-status-rest">
                Z dřívějška jsou v kalendáři {calendar.connection?.accountEmail ?? "správce"}. Účastník by akci viděl dvakrát. Wiki smaže jen pozvánky, které sama založila, a hostům nepošle žádný e-mail.
              </span>
            </span>
            <ActionForm
              action={cleanupLegacyInvitesAction}
              label="Uklidit staré pozvánky"
              pendingLabel="Uklízím…"
              small
              confirm={{
                title: "Uklidit staré pozvánky",
                text: `Wiki ověří ${legacyInvites} událostí přímo u Googlu a smaže ty, které sama založila. Hosté nedostanou e-mail. Události, které založil někdo jiný a jen jste je spárovali, zůstanou beze změny. Akce zůstanou v osobních kalendářích.`,
                confirmLabel: "Smazat staré pozvánky",
              }}
            />
          </div>
        )}
        {worker && <CalendarWorkerHealth health={worker} />}
        {!personal && (
          <details>
            <summary className="small">Kdo dostane pozvánky do Kalendáře</summary>
            <InviteRecipients status={calendar} />
          </details>
        )}
        {/* Tlačítko v kartě, jako ostatní akce Správy, ne volný odkaz pod ní. */}
        <div className="row">
          <Link className="btn btn-small" href="/vzdelavani/integrace">
            {live ? "Připojit Kalendář znovu" : "Technické nastavení ukázky"}
          </Link>
        </div>
        </div>
      </details>
    </>
  );
}

/** Stav přístupu v ostré Wiki: každé zařízení a poslední odkaz na vlastním řádku. */
function accessLines(a: Account): string[] {
  const { invite, devices } = a.access;
  const lines = devices.map((d) => `${d.label} · naposledy ${formatDayMonth(toDateKey(d.lastSeenAt))}`);
  if (invite.kind === "waiting") lines.push(`Odkaz pro přihlášení čeká do ${formatDayMonth(toDateKey(invite.expiresAt))}`);
  if (invite.kind === "expired") lines.push("Odkaz pro přihlášení vypršel");
  return lines.length ? lines : ["Bez zařízení. Pošlete nový odkaz."];
}

function AccountHead({
  account: a,
  actions,
  live = false,
  personal = null,
}: {
  account: Account;
  actions: React.ReactNode;
  live?: boolean;
  /** Stav osobních kalendářů, jen v režimu `CALENDAR_DELIVERY=personal`. */
  personal?: Map<string, PersonalCalendarState> | null;
}) {
  return (
    <div className="spread account-head">
      <div className="account-main">
        <p className="item-title">
          {a.name}
          {a.primary ? (
            <span className="small muted"> · hlavní správce</span>
          ) : (
            !a.editable && a.status === "active" && <span className="small muted"> · váš účet</span>
          )}
        </p>
        <p className="item-meta">{a.email}</p>
        <p className="item-meta">
          {ROLE_LABELS[a.role]}
          {a.groups.length > 0 &&
            ` · ${a.groups.map((g) => GROUP_LABELS[g]).join(", ")}`}
        </p>
        {/* Fiktivní role ukázky druhý řádek nemají: že jde o ukázku, říká štítek v hlavičce. */}
        {live && a.status === "active" ? (
          <ul className="access-lines" aria-label="Přihlašování se zařízeními">
            {accessLines(a).map((line, i) => (
              <li key={i} className="item-meta">
                {line}
              </li>
            ))}
          </ul>
        ) : (live || a.origin !== "demo") && (
          <p className="item-meta">
            {a.googleLinked
                ? `Účet Google svázán${a.lastLoginAt ? `, naposledy ${formatDate(toDateKey(a.lastLoginAt))}` : ""}`
                : "Pozvánka čeká na první přihlášení"}
          </p>
        )}
        {personal && a.status === "active" && <p className="item-meta">{personalCalendarLabel(personal.get(a.id))}</p>}
      </div>
      <div className="account-side">
        {a.status === "active" && a.origin !== "demo" && !a.googleLinked ? (
          // Účet už platí, ale kolega se ještě nepřihlásil. „Aktivní“ by tu mátlo.
          <span className="badge badge-ochre">Pozvaný</span>
        ) : a.status === "active" ? null : (
          // Aktivní je běžný stav, štítek dostane jen to, co se od něj liší.
          <span
            className={`badge${a.status === "pending" ? " badge-ochre" : " badge-danger"}`}
          >
            {USER_STATUS_LABELS[a.status]}
          </span>
        )}
        {actions}
      </div>
    </div>
  );
}
