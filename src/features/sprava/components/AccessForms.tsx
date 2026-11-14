"use client";

import { useActionState, useEffect, useState } from "react";
import { ActionForm, ActionMessage } from "@/components/ActionForm";
import { Menu } from "@/components/Menu";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import { GROUP_LABELS, ROLE_LABELS } from "@/lib/labels";
import { GROUPS, type Group, type Role, type UserStatus } from "@/lib/types";
import { inviteUserAction, rejectRequestAction, updateAccessAction } from "../actions";

/** Výběr role a skupin. Nabízí jen role, které smí přihlášený uživatel přidělit (hlídá i server). */
const PRESETS: Array<{ label: string; role: Role; groups: Group[] }> = [
  { label: "Účastník FP", role: "member", groups: ["vsichni", "fp"] },
  { label: "Účastník RM", role: "member", groups: ["vsichni", "rm"] },
  { label: "Člen Týmu A", role: "member", groups: ["vsichni", "tym-a"] },
  { label: "Správce", role: "admin", groups: [...GROUPS] },
];

function AccessFields({ roles, role: initialRole, groups: initialGroups }: { roles: Role[]; role: Role; groups: Group[] }) {
  const [role, setRole] = useState(initialRole);
  const [groups, setGroups] = useState(initialGroups);
  const toggle = (group: Group, on: boolean) => setGroups((current) => (on ? [...current, group] : current.filter((g) => g !== group)));
  return (
    <>
      <div className="field">
        <span className="field-label">Rychlé nastavení</span>
        <div className="row">
          {PRESETS.filter((preset) => roles.includes(preset.role)).map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="btn btn-small"
              onClick={() => {
                setRole(preset.role);
                setGroups(preset.groups);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <span className="field-hint">Vyplní roli a skupiny níže. Potom je můžete ručně upravit.</span>
      </div>
      <label className="field">
        <span className="field-label">Role (co smí dělat)</span>
        <select className="select" name="role" value={role === "organizer" ? "admin" : role} onChange={(e) => setRole(e.target.value as Role)}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="field">
        <legend className="field-label">Skupiny (které akce a zápisy uvidí)</legend>
        <div className="row">
          {GROUPS.map((g) => (
            <label key={g} className="check">
              <input type="checkbox" name="groups" value={g} checked={groups.includes(g)} onChange={(e) => toggle(g, e.target.checked)} />
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
  /** Po úspěšném uložení (zavře okno). */
  onDone?: () => void;
  onCancel?: () => void;
};

/** Schválení žádosti, úprava přístupu, nebo jeho odebrání a vrácení. Stav posílá stisknuté tlačítko. */
export function AccessForm({ userId, roles, role, groups, mode, onDone, onCancel }: AccessProps) {
  const [state, action, pending] = useActionState(updateAccessAction, null);
  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
      <input type="hidden" name="userId" value={userId} />
      <AccessFields roles={roles} role={role} groups={mode === "approve" && groups.length === 0 ? ["vsichni"] : groups} />
      <div className="row">
        <button type="submit" name="status" value="active" className="btn btn-primary btn-small" disabled={pending}>
          {mode === "approve" ? "Schválit přístup" : mode === "restore" ? "Vrátit přístup" : "Uložit změny"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-small" onClick={onCancel}>
            Zrušit
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
    <form action={action} onSubmit={submitKeepingValues(action)} className="stack" key={state?.ok ? state.message : undefined}>
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

export type AccountRow = { id: string; name: string; email: string; role: Role; groups: Group[]; status: UserStatus };

const MODAL_TITLES = { approve: "Schválit žádost", edit: "Upravit roli a skupiny", restore: "Vrátit přístup" } as const;

/**
 * Akce u účtu ve Správě. Hlavní krok (schválení žádosti) je vidět jako tlačítko, úprava, odebrání přístupu
 * a zamítnutí jsou v menu. Role a skupiny se upravují v okně.
 */
export function AccountActions({ account: a, roles }: { account: AccountRow; roles: Role[] }) {
  const mode = a.status === "pending" ? "approve" : a.status === "disabled" ? "restore" : "edit";
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="row account-actions">
      {mode === "approve" && (
        <button type="button" className="btn btn-primary btn-small" onClick={() => setOpen(true)}>
          Schválit…
        </button>
      )}
      <Menu label={`Možnosti účtu ${a.name}`} small iconOnly>
        {mode !== "approve" && (
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            {mode === "restore" ? "Vrátit přístup…" : "Upravit roli a skupiny…"}
          </button>
        )}
        {mode === "edit" && (
          <ActionForm
            action={updateAccessAction}
            fields={{ userId: a.id, status: "disabled", role: a.role, groups: a.groups }}
            label="Odebrat přístup…"
            variant="danger"
            confirm={{
              title: "Odebrat přístup",
              text: `${a.name} (${a.email}) se do Wiki nepřihlásí a přestane dostávat pozvánky. Role a skupiny zůstanou uložené pro případné vrácení přístupu.`,
              confirmLabel: "Odebrat přístup",
            }}
          />
        )}
        {mode === "approve" && (
          <ActionForm
            action={rejectRequestAction}
            fields={{ userId: a.id }}
            label="Zamítnout…"
            variant="danger"
            confirm={{
              title: "Zamítnout žádost",
              text: `Žádost účtu ${a.email} zmizí. Pokud se přihlásí znovu, vznikne nová žádost.`,
              confirmLabel: "Zamítnout",
            }}
          />
        )}
      </Menu>
      <Modal open={open} title={`${MODAL_TITLES[mode]}: ${a.name}`} onRequestClose={close}>
        <AccessForm
          userId={a.id}
          roles={roles}
          role={a.role}
          groups={mode === "approve" && a.groups.length === 0 ? ["vsichni"] : a.groups}
          mode={mode}
          onDone={close}
          onCancel={close}
        />
      </Modal>
    </div>
  );
}
