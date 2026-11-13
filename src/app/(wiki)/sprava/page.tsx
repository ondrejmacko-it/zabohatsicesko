import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { AccessForm, InviteForm } from "@/features/sprava/components/AccessForms";
import { rejectRequestAction } from "@/features/sprava/actions";
import { GROUP_LABELS, ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/labels";
import { formatDate, toDateKey } from "@/lib/time";
import { ROLES, type Role } from "@/lib/types";
import { requireUser } from "@/server/auth/session";
import { config } from "@/server/config";
import { canManageUsers, isAdmin } from "@/server/policy";
import { listAccounts, type Account } from "@/server/services/users";

export const metadata: Metadata = { title: "Správa systému" };

export default async function AdminPage() {
  const user = await requireUser();
  // Stejná odpověď jako neexistující stránka: bez oprávnění se o správě nic nedozví.
  if (!canManageUsers(user)) notFound();
  const accounts = await listAccounts(user);
  const roles: Role[] = ROLES.filter((r) => r !== "admin" || isAdmin(user));
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
      </div>

      <section className="section" aria-labelledby="jak-to-funguje">
        <h2 id="jak-to-funguje">Jak to funguje</h2>
        <ul className="prose-list">
          <li>
            <strong>Role</strong> říká, co člověk smí dělat. Člen týmu vidí plán a zápisy, organizátor plánuje a zveřejňuje akce a
            spravuje uživatele, správce navíc přiděluje roli správce.
          </li>
          <li>
            <strong>Skupiny</strong> říkají, co člověk uvidí: jen akce a zápisy určené jeho skupinám. Všichni = celá firma, FP = finanční
            poradci, RM = relationship manažeři, Tým A = účastníci Action time.
          </li>
          <li>
            <strong>Vedoucí akce</strong> není role. Organizátor ho vybere u konkrétní akce a vedoucí pak u ní nahrává záznam a
            zveřejňuje zápis.
          </li>
        </ul>
      </section>

      <section className="section stack" aria-labelledby="zadosti">
        <h2 id="zadosti">Čekající žádosti {pending.length > 0 && <span className="badge badge-ochre">{pending.length}</span>}</h2>
        {pending.length === 0 ? (
          <p className="muted small">Nikdo nečeká. Nový kolega se přihlásí účtem Google a jeho žádost se objeví tady.</p>
        ) : (
          pending.map((a) => (
            <article key={a.id} className="item-card stack">
              <AccountHead account={a} />
              <AccessForm userId={a.id} roles={roles} role={a.role} groups={a.groups} mode="approve" />
              <ActionForm
                action={rejectRequestAction}
                fields={{ userId: a.id }}
                label="Zamítnout"
                small
                variant="danger"
                confirm={{
                  title: "Zamítnout žádost",
                  text: `Žádost účtu ${a.email} zmizí. Pokud se přihlásí znovu, vznikne nová žádost.`,
                  confirmLabel: "Zamítnout",
                }}
              />
            </article>
          ))
        )}
      </section>

      <section className="section stack" aria-labelledby="pozvat">
        <h2 id="pozvat">Pozvat kolegu</h2>
        <InviteForm roles={roles} appUrl={config.appUrl} />
      </section>

      <section className="section stack" aria-labelledby="uzivatele">
        <h2 id="uzivatele">Uživatelé</h2>
        {others.map((a) => (
          <article key={a.id} className="item-card stack">
            <AccountHead account={a} />
            {a.editable ? (
              <details>
                <summary className="small">{a.status === "disabled" ? "Vrátit přístup" : "Upravit roli a skupiny"}</summary>
                <AccessForm
                  userId={a.id}
                  roles={roles}
                  role={a.role}
                  groups={a.groups}
                  mode={a.status === "disabled" ? "restore" : "edit"}
                />
              </details>
            ) : (
              <p className="small muted">
                {a.id === user.id ? "Svůj účet měnit nemůžete." : "Účet správce může měnit jen jiný správce."}
              </p>
            )}
          </article>
        ))}
      </section>

      <p className="small muted">
        <Link href="/vzdelavani/integrace">Technické nastavení ukázky</Link> (stav propojení, ukázka chyb, obnova ukázkových dat)
      </p>
    </>
  );
}

function AccountHead({ account: a }: { account: Account }) {
  return (
    <div className="spread">
      <div>
        <p className="item-title">{a.name}</p>
        <p className="item-meta">
          {a.email} · {ROLE_LABELS[a.role]}
          {a.groups.length > 0 && ` · ${a.groups.map((g) => GROUP_LABELS[g]).join(", ")}`}
        </p>
        <p className="item-meta">
          {a.origin === "demo"
            ? "Fiktivní role ukázky"
            : a.googleLinked
              ? `Účet Google svázán${a.lastLoginAt ? `, naposledy ${formatDate(toDateKey(a.lastLoginAt))}` : ""}`
              : "Pozvánka čeká na první přihlášení"}
        </p>
      </div>
      {a.status === "active" && a.origin !== "demo" && !a.googleLinked ? (
        // Účet už platí, ale kolega se ještě nepřihlásil. „Aktivní“ by tu mátlo.
        <span className="badge badge-ochre">Pozvaný</span>
      ) : (
        <span className={`badge${a.status === "active" ? " badge-ok" : a.status === "pending" ? " badge-ochre" : " badge-danger"}`}>
          {USER_STATUS_LABELS[a.status]}
        </span>
      )}
    </div>
  );
}
