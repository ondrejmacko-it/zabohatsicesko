"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { Menu } from "@/components/Menu";
import { Modal } from "@/components/Modal";
import type { Group, Role, UserStatus } from "@/lib/types";
import type { ActionResult } from "@/features/shared/run-action";
import { createAccessAction, rejectRequestAction, updateAccessAction, type AccessResult } from "../actions";
import { AccessForm, CopyMessage, InviteForm, inviteMessage } from "./AccessForms";

type AccountSummary = { id: string; name: string; email: string; role: Role; groups: Group[]; status: UserStatus };

type Dialog = "access" | "disable" | "reject" | "link" | "code" | null;

/**
 * Akce u jednoho účtu. Hlavní krok je tlačítko (Schválit, Vrátit přístup), méně časté a nevratné kroky jsou
 * v menu. Každá úprava se děje v okně, takže seznam účtů zůstává krátký a čitelný.
 */
export function AccountActions({ account, roles }: { account: AccountSummary; roles: Role[] }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const mode = account.status === "pending" ? "approve" : account.status === "disabled" ? "restore" : "edit";
  const accessTitle = mode === "approve" ? "Schválit přístup" : mode === "restore" ? "Vrátit přístup" : "Upravit roli a skupiny";
  return (
    <div className="row account-actions">
      {mode !== "edit" && (
        <button type="button" className={`btn btn-small${mode === "approve" ? " btn-primary" : ""}`} onClick={() => setDialog("access")}>
          {mode === "approve" ? "Schválit" : "Vrátit přístup"}
        </button>
      )}
      {mode !== "restore" && (
        <Menu label={`Další akce: ${account.name}`} small iconOnly>
          {mode === "edit" && (
            <>
              <button type="button" className="btn" onClick={() => setDialog("access")}>
                Upravit roli a skupiny
              </button>
              <button type="button" className="btn" onClick={() => setDialog("link")}>
                Nový odkaz k přihlášení
              </button>
              <button type="button" className="btn" onClick={() => setDialog("code")}>
                Jednorázový kód (bez účtu Google)
              </button>
              <hr className="menu-divider" />
              <button type="button" className="btn menu-danger" onClick={() => setDialog("disable")}>
                Odebrat přístup…
              </button>
            </>
          )}
          {mode === "approve" && (
            <button type="button" className="btn menu-danger" onClick={() => setDialog("reject")}>
              Zamítnout žádost…
            </button>
          )}
        </Menu>
      )}
      {dialog === "access" && (
        <Modal open title={`${accessTitle}: ${account.name}`} onRequestClose={close}>
          <p className="item-meta">{account.email}</p>
          <AccessForm userId={account.id} roles={roles} role={account.role} groups={account.groups} mode={mode} onDone={close} onCancel={close} />
        </Modal>
      )}
      {(dialog === "link" || dialog === "code") && <AccessLinkDialog account={account} withCode={dialog === "code"} onClose={close} />}
      {dialog === "disable" && (
        <ConfirmDialog
          title="Odebrat přístup"
          text={`${account.name} (${account.email}) se do Wiki nepřihlásí a přestane dostávat pozvánky na budoucí akce. Účet zůstane v seznamu a přístup jde kdykoli vrátit.`}
          confirmLabel="Odebrat přístup"
          action={updateAccessAction}
          fields={{ userId: account.id, role: account.role === "organizer" ? "admin" : account.role, status: "disabled" }}
          groups={account.groups}
          onClose={close}
        />
      )}
      {dialog === "reject" && (
        <ConfirmDialog
          title="Zamítnout žádost"
          text={`Žádost účtu ${account.email} zmizí. Pokud se přihlásí znovu, vznikne nová žádost.`}
          confirmLabel="Zamítnout"
          action={rejectRequestAction}
          fields={{ userId: account.id }}
          onClose={close}
        />
      )}
    </div>
  );
}

/** Vytvoří osobní odkaz (a případně kód) a ukáže hotovou zprávu. Hodnoty jsou vidět jen teď. */
function AccessLinkDialog({ account, withCode, onClose }: { account: AccountSummary; withCode: boolean; onClose: () => void }) {
  const [state, action, pending] = useActionState<AccessResult | null, FormData>(createAccessAction, null);
  const title = withCode ? "Jednorázový kód" : "Nový odkaz k přihlášení";
  return (
    <Modal open title={`${title}: ${account.name}`} onRequestClose={onClose}>
      {state?.ok && state.access ? (
        <div className="stack">
          <p className="notice notice-ok" role="status">
            <strong>Hotovo.</strong> {withCode ? "Odkaz i kód uvidíte jen teď." : "Odkaz uvidíte jen teď."} Pošlete zprávu jen tomuto člověku.
          </p>
          {state.access.code && <p className="access-code">{state.access.code}</p>}
          <CopyMessage text={inviteMessage(state.access)} />
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onClose}>
              Hotovo
            </button>
          </div>
        </div>
      ) : (
        <form action={action} className="stack">
          <input type="hidden" name="userId" value={account.id} />
          {withCode && <input type="hidden" name="withCode" value="1" />}
          <p>
            {withCode
              ? `${account.name} dostane osobní odkaz a kód na jedno přihlášení. Zařízení pak zůstane přihlášené 30 dní. Hodí se pro toho, kdo nemá účet Google.`
              : `${account.name} dostane nový osobní odkaz, třeba pro nový telefon nebo počítač. Přihlásí se účtem Google ${account.email}.`}
          </p>
          <p className="item-meta">Starší nepoužité odkazy a kódy tohoto člověka přestanou platit. Platnost je 7 dní.</p>
          <ActionMessage state={state} />
          <div className="dialog-actions">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Vytvářím…" : withCode ? "Vytvořit odkaz a kód" : "Vytvořit odkaz"}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Zpět
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

type ConfirmProps = {
  title: string;
  text: string;
  confirmLabel: string;
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  groups?: Group[];
  onClose: () => void;
};

function ConfirmDialog({ title, text, confirmLabel, action, fields, groups = [], onClose }: ConfirmProps) {
  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.ok) onClose();
    return result;
  }, null);
  return (
    <Modal open title={title} onRequestClose={onClose}>
      <form action={formAction} className="stack">
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {groups.map((g) => (
          <input key={g} type="hidden" name="groups" value={g} />
        ))}
        <p>{text}</p>
        <ActionMessage state={state} />
        <div className="dialog-actions">
          <button type="submit" className="btn btn-danger" disabled={pending}>
            {pending ? "Probíhá…" : confirmLabel}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Zpět
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Pozvání kolegy v okně. Po uložení zůstává otevřené, aby byl vidět pokyn, co kolegovi poslat. */
export function InviteDialog({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" />
        Pozvat kolegu
      </button>
      <Modal open={open} title="Pozvat kolegu" onRequestClose={() => setOpen(false)}>
        {/* Nové otevření okna začíná prázdným formulářem, ne potvrzením minulého pozvání. */}
        {open && <InviteForm roles={roles} onCancel={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
