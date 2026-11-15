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
import {
  CalendarStatusLine,
  InviteRecipients,
} from "@/features/vzdelavani/components/CalendarStatusLine";
import { loadCalendarStatus } from "@/server/services/calendar-status";
import { requireUser } from "@/server/auth/session";
import { isLiveWiki, now } from "@/server/config";
import { canManageUsers } from "@/server/policy";
import { listAccounts, type Account } from "@/server/services/users";

export const metadata: Metadata = { title: "Správa systému" };

export default async function AdminPage() {
  const user = await requireUser();
  // Stejná odpověď jako neexistující stránka: bez oprávnění se o správě nic nedozví.
  if (!canManageUsers(user)) notFound();
  const [accounts, calendar] = await Promise.all([
    listAccounts(user),
    loadCalendarStatus(user),
  ]);
  // Jedna role pro plánování a správu. Starší hodnota „organizer“ se už nepřiděluje, pravidla ji berou stejně.
  const roles: Role[] = ["admin", "member"];
  const pending = accounts.filter((a) => a.status === "pending");
  const others = accounts.filter((a) => a.status !== "pending");
  const live = isLiveWiki();

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

      <section
        className="section stack"
        aria-labelledby="pozvanky"
        id="pozvanky-kalendare"
      >
        <h2 id="pozvanky">Kalendář</h2>
        <CalendarStatusLine status={calendar} now={now()} />
        <details>
          <summary className="small">Kdo dostane pozvánky do Kalendáře</summary>
          <InviteRecipients status={calendar} />
        </details>
      </section>

      {live ? (
        <p className="small muted">
          <Link href="/vzdelavani/integrace">
            Připojit Kalendář znovu nebo jiným účtem
          </Link>
        </p>
      ) : (
        <p className="small muted">
          <Link href="/vzdelavani/integrace">Technické nastavení ukázky</Link>
        </p>
      )}
    </>
  );
}

/** Stav přístupu v ostré Wiki: zařízení a poslední odkaz. */
function accessLine(a: Account): string {
  const { invite, devices } = a.access;
  const parts: string[] = [];
  if (devices.length)
    parts.push(
      devices
        .map(
          (d) =>
            `${d.label} (naposledy ${formatDayMonth(toDateKey(d.lastSeenAt))})`,
        )
        .join(", "),
    );
  if (invite.kind === "waiting")
    parts.push(`odkaz čeká do ${formatDayMonth(toDateKey(invite.expiresAt))}`);
  if (invite.kind === "expired") parts.push("odkaz vypršel");
  return parts.length ? parts.join(" · ") : "Bez zařízení. Pošlete nový odkaz.";
}

function AccountHead({
  account: a,
  actions,
  live = false,
}: {
  account: Account;
  actions: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div className="spread">
      <div>
        <p className="item-title">
          {a.name}
          {a.primary ? (
            <span className="small muted"> · hlavní správce</span>
          ) : (
            !a.editable && a.status === "active" && <span className="small muted"> · váš účet</span>
          )}
        </p>
        <p className="item-meta">
          {a.email} · {ROLE_LABELS[a.role]}
          {a.groups.length > 0 &&
            ` · ${a.groups.map((g) => GROUP_LABELS[g]).join(", ")}`}
        </p>
        <p className="item-meta">
          {live && a.status === "active"
            ? accessLine(a)
            : a.origin === "demo"
              ? "Fiktivní role ukázky"
              : a.googleLinked
                ? `Účet Google svázán${a.lastLoginAt ? `, naposledy ${formatDate(toDateKey(a.lastLoginAt))}` : ""}`
                : "Pozvánka čeká na první přihlášení"}
        </p>
      </div>
      <div className="account-side">
        {a.status === "active" && a.origin !== "demo" && !a.googleLinked ? (
          // Účet už platí, ale kolega se ještě nepřihlásil. „Aktivní“ by tu mátlo.
          <span className="badge badge-ochre">Pozvaný</span>
        ) : (
          <span
            className={`badge${a.status === "active" ? " badge-ok" : a.status === "pending" ? " badge-ochre" : " badge-danger"}`}
          >
            {USER_STATUS_LABELS[a.status]}
          </span>
        )}
        {actions}
      </div>
    </div>
  );
}
