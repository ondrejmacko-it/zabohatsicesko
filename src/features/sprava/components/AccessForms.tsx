"use client";

import { useActionState, useEffect, useState } from "react";
import { ActionForm, ActionMessage } from "@/components/ActionForm";
import { Menu } from "@/components/Menu";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import { GROUP_LABELS, ROLE_LABELS } from "@/lib/labels";
import { GROUPS, type Group, type Role } from "@/lib/types";
import { createLoginLinkAction, inviteUserAction, rejectRequestAction, revokeDeviceAction, revokeLoginLinkAction, updateAccessAction } from "../actions";

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
        {role !== "member" && <span className="field-hint">Správce plánuje akce, spravuje lidi a vidí všechny zápisy.</span>}
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
  onDone: () => void;
};

/** Schválení žádosti, úprava přístupu, nebo jeho vrácení. Po úspěšném uložení se okno zavře. */
function AccessForm({ userId, roles, role, groups, mode, onDone }: AccessProps) {
  const [state, action, pending] = useActionState(updateAccessAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
      <input type="hidden" name="userId" value={userId} />
      <AccessFields roles={roles} role={role} groups={mode === "approve" && groups.length === 0 ? ["vsichni"] : groups} />
      <ActionMessage state={state} />
      <div className="row">
        <button type="submit" name="status" value="active" className="btn btn-primary" disabled={pending}>
          {pending ? "Ukládám…" : mode === "approve" ? "Schválit přístup" : mode === "restore" ? "Vrátit přístup" : "Uložit změny"}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Zrušit
        </button>
      </div>
    </form>
  );
}

type AccountActionsProps = {
  account: { id: string; name: string; email: string; role: Role; groups: Group[]; status: "pending" | "active" | "disabled" };
  roles: Role[];
  /** Ostrá Wiki: odkazy a zařízení. Úpravy role a přístupu jen u cizího účtu. */
  live?: { inviteWaiting: boolean; devices: Array<{ id: string; label: string }> };
  editable?: boolean;
};

/** Zvací odkaz s kopírováním. Ukáže se jen jednou, v DB je jen jeho otisk. */
export function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="stack">
      <input className="input" readOnly value={link} aria-label="Zvací odkaz" onFocus={(e) => e.currentTarget.select()} />
      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true), () => setCopied(false))}
        >
          {copied ? "Zkopírováno" : "Kopírovat"}
        </button>
      </div>
      <p className="field-hint">Odkaz funguje jednou a jen na zařízení, kde ho kolega otevře. Pošlete ho jen jemu.</p>
    </div>
  );
}

/** Nový odkaz pro existující účet: potvrzení, pak odkaz ke zkopírování. */
function NewLink({ account: a, onClose }: { account: AccountActionsProps["account"]; onClose: () => void }) {
  const [state, action, pending] = useActionState(createLoginLinkAction, null);
  return (
    <Modal open title="Nový odkaz" onRequestClose={onClose}>
      <p className="small muted">
        {a.name} · {a.email}
      </p>
      {state?.ok && state.link ? (
        <>
          <ActionMessage state={state} />
          <InviteLink link={state.link} />
        </>
      ) : (
        <form action={action} className="stack">
          <input type="hidden" name="userId" value={a.id} />
          <p>Odkaz přidá jedno zařízení. Starší nepoužitý odkaz přestane platit.</p>
          <ActionMessage state={state} />
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Vytvářím…" : "Vytvořit odkaz"}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Zrušit
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

const MODAL_TITLES = { approve: "Schválit přístup", edit: "Role a skupiny", restore: "Vrátit přístup" } as const;

/**
 * Akce nad účtem ve Správě. Hlavní krok (schválení žádosti) je vidět, ostatní jsou v menu.
 * Úpravy role a skupin běží v okně, odebrání přístupu se potvrzuje.
 */
export function AccountActions({ account: a, roles, live, editable = true }: AccountActionsProps) {
  const [mode, setMode] = useState<AccessProps["mode"] | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [linking, setLinking] = useState(false);
  const close = () => setMode(null);
  return (
    <div className="row account-actions">
      {a.status === "pending" && (
        <button type="button" className="btn btn-primary btn-small" onClick={() => setMode("approve")}>
          Schválit…
        </button>
      )}
      <Menu label={`Možnosti účtu ${a.name}`} small iconOnly>
        {a.status === "pending" && (
          <ActionForm
            action={rejectRequestAction}
            fields={{ userId: a.id }}
            label="Zamítnout žádost…"
            variant="danger"
            confirm={{
              title: "Zamítnout žádost",
              text: `Žádost účtu ${a.email} zmizí. Pokud se přihlásí znovu, vznikne nová žádost.`,
              confirmLabel: "Zamítnout",
            }}
          />
        )}
        {live && a.status === "active" && (
          <>
            <button type="button" className="btn" onClick={() => setLinking(true)}>
              Nový odkaz…
            </button>
            {live.inviteWaiting && (
              <ActionForm action={revokeLoginLinkAction} fields={{ userId: a.id }} label="Zneplatnit odkaz" />
            )}
            {live.devices.map((d) => (
              <ActionForm
                key={d.id}
                action={revokeDeviceAction}
                fields={{ userId: a.id, deviceId: d.id }}
                label={`Odhlásit ${d.label}…`}
                variant="danger"
                confirm={{
                  title: "Odhlásit zařízení",
                  text: `${a.name} se z tohoto zařízení (${d.label}) přestane přihlašovat hned. Další přístup jen přes nový odkaz.`,
                  confirmLabel: "Odhlásit",
                }}
              />
            ))}
          </>
        )}
        {editable && a.status === "active" && (
          <>
            <button type="button" className="btn" onClick={() => setMode("edit")}>
              Upravit roli a skupiny
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setRevoking(true)}>
              Odebrat přístup…
            </button>
          </>
        )}
        {editable && a.status === "disabled" && (
          <button type="button" className="btn" onClick={() => setMode("restore")}>
            Vrátit přístup…
          </button>
        )}
      </Menu>
      {mode && (
        <Modal open title={MODAL_TITLES[mode]} onRequestClose={close}>
          <p className="small muted">
            {a.name} · {a.email}
          </p>
          <AccessForm userId={a.id} roles={roles} role={a.role} groups={a.groups} mode={mode} onDone={close} />
        </Modal>
      )}
      {revoking && <RevokeAccess account={a} onClose={() => setRevoking(false)} />}
      {linking && <NewLink account={a} onClose={() => setLinking(false)} />}
    </div>
  );
}

/** Odebrání přístupu s potvrzením. Role a skupiny zůstávají, aby šel přístup později vrátit beze změn. */
function RevokeAccess({ account: a, onClose }: { account: AccountActionsProps["account"]; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateAccessAction, null);
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);
  return (
    <Modal open title="Odebrat přístup" onRequestClose={onClose}>
      <form action={action} className="stack">
        <input type="hidden" name="userId" value={a.id} />
        <input type="hidden" name="role" value={a.role} />
        {a.groups.map((g) => (
          <input key={g} type="hidden" name="groups" value={g} />
        ))}
        <p>
          {a.name} ({a.email}) se do Wiki nepřihlásí a nedostane další pozvánky. Role a skupiny zůstanou uložené, přístup jde
          kdykoli vrátit.
        </p>
        <ActionMessage state={state} />
        <div className="row">
          <button type="submit" name="status" value="disabled" className="btn btn-danger" disabled={pending}>
            {pending ? "Odebírám…" : "Odebrat přístup"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Zrušit
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Tlačítko „Pozvat člověka“ s oknem. Po uložení okno ukáže odkaz ke zkopírování. */
export function InviteButton({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((n) => n + 1);
  };
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        Pozvat člověka
      </button>
      {open && (
        <Modal open title="Pozvat člověka" onRequestClose={close}>
          <InviteForm key={round} roles={roles} />
        </Modal>
      )}
    </>
  );
}

function InviteForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useActionState(inviteUserAction, null);
  if (state?.ok && state.link) {
    return (
      <div className="stack">
        <ActionMessage state={state} />
        <InviteLink link={state.link} />
      </div>
    );
  }
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
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Ukládám…" : "Vytvořit odkaz"}
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
