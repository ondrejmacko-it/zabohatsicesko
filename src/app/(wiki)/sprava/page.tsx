import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountActions, InviteDialog } from "@/features/sprava/components/AccountActions";
import { GROUP_LABELS, ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/labels";
import { formatDate, toDateKey } from "@/lib/time";
import type { Role } from "@/lib/types";
import { CalendarStatusLine, InviteRecipients } from "@/features/vzdelavani/components/CalendarStatusLine";
import { loadCalendarStatus } from "@/server/services/calendar-status";
import { requireUser } from "@/server/auth/session";
import { config, now } from "@/server/config";
import { canManageUsers } from "@/server/policy";
import { listAccounts, type Account } from "@/server/services/users";

export const metadata: Metadata = { title: "Správa systému" };

export default async function AdminPage() {
  const user = await requireUser();
  // Stejná odpověď jako neexistující stránka: bez oprávnění se o správě nic nedozví.
  if (!canManageUsers(user)) notFound();
  const [accounts, calendar] = await Promise.all([listAccounts(user), loadCalendarStatus(user)]);
  // Jedna role pro plánování a správu. Starší hodnota „organizer“ se už nepřiděluje, pravidla ji berou stejně.
  const roles: Role[] = ["admin", "member"];
  const pending = accounts.filter((a) => a.status === "pending");
  const others = accounts.filter((a) => a.status !== "pending");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Správa systému</h1>
          <p className="page-sub">
            Kdo smí do Wiki a co uvidí. Google jen ověří, kdo se přihlašuje. Roli a skupiny přidělujete tady.
          </p>
        </div>
        <InviteDialog roles={roles} appUrl={config.appUrl} />
      </div>

      <section className="section" aria-labelledby="jak-to-funguje">
        <h2 id="jak-to-funguje">Jak to funguje</h2>
        <ul className="prose-list">
          <li>
            <strong>Role</strong> říká, co člověk smí dělat. Člen týmu vidí plán a zápisy svých skupin. Správce plánuje a zveřejňuje
            akce, spravuje účty, vidí vše a u každé akce smí nahrát záznam a zveřejnit zápis.
          </li>
          <li>
            <strong>Skupiny</strong> říkají, co člověk uvidí: jen akce a zápisy určené jeho skupinám. Všichni = celá firma, FP = finanční
            poradci, RM = relationship manažeři, Tým A = účastníci Action time.
          </li>
          <li>
            <strong>Vedoucí akce</strong> není role. Správce ho vybere u konkrétní akce a vedoucí pak u ní nahrává záznam a
            zveřejňuje zápis.
          </li>
        </ul>
      </section>

      <section className="section stack" aria-labelledby="pozvanky" id="pozvanky-kalendare">
        <h2 id="pozvanky">Kalendář a pozvánky</h2>
        <CalendarStatusLine status={calendar} now={now()} detailed />
        <InviteRecipients status={calendar} />
      </section>

      <section className="section stack" aria-labelledby="zadosti">
        <h2 id="zadosti">Čekající žádosti {pending.length > 0 && <span className="count-badge">{pending.length}</span>}</h2>
        {pending.length === 0 ? (
          <p className="muted small">Nikdo nečeká. Nový kolega se přihlásí účtem Google a jeho žádost se objeví tady.</p>
        ) : (
          <ul className="account-list">{pending.map((a) => accountRow(a, roles))}</ul>
        )}
      </section>

      <section className="section stack" aria-labelledby="uzivatele">
        <h2 id="uzivatele">
          Uživatelé <span className="count-badge">{others.length}</span>
        </h2>
        <ul className="account-list">{others.map((a) => accountRow(a, roles))}</ul>
      </section>

      <p className="small muted">
        <Link href="/vzdelavani/integrace">Technické nastavení ukázky</Link> (stav propojení, ukázka chyb, obnova ukázkových dat)
      </p>
    </>
  );
}

function accountRow(a: Account, roles: Role[]) {
  // Účet už platí, ale kolega se ještě nepřihlásil. „Aktivní“ by tu mátlo.
  const invited = a.status === "active" && a.origin !== "demo" && !a.googleLinked;
  return (
    <li key={a.id} className="account-row" data-status={a.status}>
      <div className="account-main">
        <p className="account-name">
          <span className="item-title">{a.name}</span>
          <span className={`badge${invited || a.status === "pending" ? " badge-ochre" : a.status === "active" ? " badge-ok" : " badge-danger"}`}>
            {invited ? "Pozvaný" : USER_STATUS_LABELS[a.status]}
          </span>
        </p>
        <p className="item-meta">
          {a.status !== "pending" && <strong>{ROLE_LABELS[a.role]}</strong>}
          {a.status !== "pending" && a.groups.length > 0 && ` · ${a.groups.map((g) => GROUP_LABELS[g]).join(", ")}`}
          {a.status === "pending" && "Žádá o přístup"}
        </p>
        <p className="item-meta account-contact">
          {a.email} ·{" "}
          {a.origin === "demo"
            ? "fiktivní role ukázky"
            : a.googleLinked
              ? `účet Google svázán${a.lastLoginAt ? `, naposledy ${formatDate(toDateKey(a.lastLoginAt))}` : ""}`
              : "čeká na první přihlášení"}
        </p>
      </div>
      {a.editable ? (
        <AccountActions account={{ id: a.id, name: a.name, email: a.email, role: a.role, groups: a.groups, status: a.status }} roles={roles} />
      ) : (
        <span className="item-meta">Váš účet</span>
      )}
    </li>
  );
}
