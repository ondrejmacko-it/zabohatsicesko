"use client";

import { useActionState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { GROUP_LABELS, ROLE_LABELS } from "@/lib/labels";
import { GROUPS, type Group, type Role } from "@/lib/types";
import { inviteUserAction, updateAccessAction } from "../actions";

/** Výběr role a skupin. Nabízí jen role, které smí přihlášený uživatel přidělit (hlídá i server). */
function AccessFields({ roles, role, groups }: { roles: Role[]; role: Role; groups: Group[] }) {
  return (
    <>
      <label className="field">
        <span className="field-label">Role</span>
        <select className="select" name="role" defaultValue={role}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="field">
        <legend className="field-label">Skupiny (určují, které akce a zápisy uvidí)</legend>
        <div className="row">
          {GROUPS.map((g) => (
            <label key={g} className="check">
              <input type="checkbox" name="groups" value={g} defaultChecked={groups.includes(g)} />
              {GROUP_LABELS[g]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

type AccessProps = {
  userId: string;
  roles: Role[];
  role: Role;
  groups: Group[];
  /** approve = čekající žádost, edit = aktivní účet, restore = účet s odebraným přístupem. */
  mode: "approve" | "edit" | "restore";
};

/** Schválení žádosti, úprava přístupu, nebo jeho odebrání a vrácení. Stav posílá stisknuté tlačítko. */
export function AccessForm({ userId, roles, role, groups, mode }: AccessProps) {
  const [state, action, pending] = useActionState(updateAccessAction, null);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="userId" value={userId} />
      <AccessFields roles={roles} role={role} groups={mode === "approve" && groups.length === 0 ? ["vsichni"] : groups} />
      <div className="row">
        <button type="submit" name="status" value="active" className="btn btn-primary btn-small" disabled={pending}>
          {mode === "approve" ? "Schválit přístup" : mode === "restore" ? "Vrátit přístup" : "Uložit změny"}
        </button>
        {mode === "edit" && (
          <button type="submit" name="status" value="disabled" className="btn btn-danger btn-small" disabled={pending}>
            Odebrat přístup
          </button>
        )}
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function InviteForm({ roles, appUrl }: { roles: Role[]; appUrl: string }) {
  const [state, action, pending] = useActionState(inviteUserAction, null);
  return (
    <form action={action} className="stack" key={state?.ok ? state.message : undefined}>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Jméno</span>
          <input className="input" name="name" required minLength={2} maxLength={80} autoComplete="off" />
        </label>
        <label className="field">
          <span className="field-label">Adresa účtu Google</span>
          <input className="input" name="email" type="email" required maxLength={254} autoComplete="off" />
        </label>
      </div>
      <AccessFields roles={roles} role="member" groups={["vsichni"]} />
      <p className="field-hint">
        Wiki zatím e-mail s pozvánkou neposílá. Pošlete kolegovi odkaz {appUrl} a ať se přihlásí touto adresou.
      </p>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Ukládám…" : "Pozvat"}
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
