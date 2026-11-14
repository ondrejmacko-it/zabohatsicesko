"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { submitKeepingValues } from "@/features/shared/keep-values";
import { GROUP_LABELS, ROLE_LABELS } from "@/lib/labels";
import { GROUPS, type Group, type Role } from "@/lib/types";
import type { ActionResult } from "@/features/shared/run-action";
import { inviteUserAction, updateAccessAction } from "../actions";

/** Výběr role a skupin. Nabízí jen role, které smí přihlášený uživatel přidělit (hlídá i server). */
const PRESETS: Array<{ label: string; role: Role; groups: Group[] }> = [
  { label: "Účastník FP", role: "member", groups: ["vsichni", "fp"] },
  { label: "Účastník RM", role: "member", groups: ["vsichni", "rm"] },
  { label: "Člen Týmu A", role: "member", groups: ["vsichni", "tym-a"] },
  { label: "Správce", role: "admin", groups: [...GROUPS] },
];

export function AccessFields({ roles, role: initialRole, groups: initialGroups }: { roles: Role[]; role: Role; groups: Group[] }) {
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
  /** Zavolá se po úspěšném uložení (zavření okna). */
  onDone?: () => void;
  onCancel?: () => void;
};

/** Schválení žádosti, úprava přístupu, nebo jeho odebrání a vrácení. Stav posílá stisknuté tlačítko. */
export function AccessForm({ userId, roles, role, groups, mode, onDone, onCancel }: AccessProps) {
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await updateAccessAction(prev, formData);
    if (result.ok) onDone?.();
    return result;
  }, null);
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value="active" />
      <AccessFields roles={roles} role={role} groups={mode === "approve" && groups.length === 0 ? ["vsichni"] : groups} />
      <ActionMessage state={state} />
      <div className="dialog-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Ukládám…" : mode === "approve" ? "Schválit přístup" : mode === "restore" ? "Vrátit přístup" : "Uložit změny"}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Zrušit
          </button>
        )}
      </div>
    </form>
  );
}

/** Hotová zpráva pro pozvaného kolegu. Wiki sama e-mail neposílá, správce ji vloží do e-mailu nebo chatu. */
export const inviteMessage = (appUrl: string, email?: string) =>
  `Ahoj, zvu tě do firemní Wiki Za bohatší Česko. Najdeš tam plán vzdělávání, témata a zápisy z akcí.\n\nOtevři ${appUrl} a přihlas se účtem Google${email ? ` ${email}` : ", na který ti přišla tato zpráva"}.`;

/** Zkopíruje zprávu do schránky. Když to prohlížeč nedovolí, ukáže text k ručnímu označení. */
export function CopyMessage({ text }: { text: string }) {
  const [copied, setCopied] = useState<"yes" | "manual" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
    } catch {
      setCopied("manual");
    }
  };
  return (
    <div className="copy-message">
      <button type="button" className="btn btn-primary" onClick={copy}>
        Kopírovat zprávu s odkazem
      </button>
      <span className="field-hint" role="status">
        {copied === "yes" ? "Zkopírováno. Vložte zprávu do e-mailu nebo chatu." : "Wiki e-mail neposílá. Zprávu vložíte do e-mailu nebo chatu sami."}
      </span>
      {copied === "manual" && <textarea className="textarea" readOnly rows={4} value={text} onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}

type InviteState = ActionResult & { invited?: { name: string; email: string } };

export function InviteForm({ roles, appUrl, onCancel }: { roles: Role[]; appUrl: string; onCancel?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: InviteState | null, formData: FormData): Promise<InviteState> => {
    const result = await inviteUserAction(prev, formData);
    return result.ok ? { ...result, invited: { name: String(formData.get("name")).trim(), email: String(formData.get("email")).trim().toLowerCase() } } : result;
  }, null);
  if (state?.ok && state.invited) {
    return (
      <div className="stack">
        <p className="notice notice-ok" role="status">
          <strong>{state.invited.name} má přístup.</strong> Teď mu pošlete odkaz, přihlásí se adresou {state.invited.email}.
        </p>
        <CopyMessage text={inviteMessage(appUrl, state.invited.email)} />
        <div className="dialog-actions">
          {onCancel && (
            <button type="button" className="btn" onClick={onCancel}>
              Hotovo
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
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
        Po uložení dostanete hotovou zprávu s odkazem, kterou kolegovi pošlete. Wiki sama e-mail neposílá.
      </p>
      <ActionMessage state={state} />
      <div className="dialog-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Ukládám…" : "Pozvat"}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Zavřít
          </button>
        )}
      </div>
    </form>
  );
}
