"use client";

import { useActionState, useState } from "react";
import { Consequences } from "@/components/Consequences";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import type { Role } from "@/lib/types";
import type { BulkInviteRow } from "@/server/services/users";
import { bulkInviteAction } from "../actions";
import { AccessFields } from "./AccessForms";

const PROBLEM: Record<Exclude<BulkInviteRow["status"], "ok">, string> = {
  invalid: "není platná adresa",
  duplicate: "v seznamu je dvakrát",
  existing: "už ve Wiki je",
};

const people = (n: number) => (n === 1 ? "1 člověka" : `${n} lidí`);

function BulkInviteForm({ roles, onClose }: { roles: Role[]; onClose: () => void }) {
  const [state, action, pending] = useActionState(bulkInviteAction, null);
  // Přehled platí jen pro seznam, ze kterého vznikl. Po úpravě textu se musí zkontrolovat znovu.
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [text, setText] = useState("");
  const rows = state?.ok ? state.rows : [];
  const ok = rows.filter((r) => r.status === "ok");
  const problems = rows.filter((r) => r.status !== "ok");
  const reviewed = Boolean(state?.ok && !state.saved && checkedText === text);

  if (state?.ok && state.saved) {
    return (
      <div className="stack">
        <p className="notice notice-ok" role="status">
          <strong>Přístup má {people(ok.length)}.</strong> Každý potřebuje svůj osobní odkaz: v seznamu účtů u něj zvolte „Nový odkaz k přihlášení“ a zprávu mu pošlete.
        </p>
        {problems.length > 0 && <ProblemList rows={problems} title="Přeskočené řádky" />}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Hotovo
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(event) => {
        setCheckedText(text);
        submitKeepingValues(action)(event);
      }}
      className="stack"
    >
      <label className="field">
        <span className="field-label">Adresy účtů Google</span>
        <textarea className="textarea" name="text" rows={6} required value={text} onChange={(e) => setText(e.target.value)} placeholder={"jana.novakova@gmail.com\nPetr Svoboda <petr.svoboda@gmail.com>"} />
        <span className="field-hint">Jedna adresa na řádek, nejvýš 50. Jméno můžete napsat před adresu, jinak se odvodí z adresy.</span>
      </label>
      <AccessFields roles={roles} role="member" groups={["vsichni"]} />
      {reviewed && (
        <div className="stack" role="status">
          <Consequences
            title={ok.length ? `Pozvete ${people(ok.length)}` : "Není koho pozvat"}
            points={[
              ok.length > 0 && "Všichni dostanou roli a skupiny vybrané výše a hned se mohou přihlásit.",
              ok.length > 0 && "Budoucí akce jejich skupin je přiberou mezi hosty pozvánek.",
              ok.length > 0 && "Wiki jim e-mail nepošle. Po uložení dostanete zprávu s odkazem ke zkopírování.",
              problems.length > 0 && `Řádky s chybou se přeskočí (${problems.length}).`,
            ]}
          />
          {ok.length > 0 && (
            <ul className="bulk-rows">
              {ok.map((row) => (
                <li key={row.email}>
                  <strong>{row.name}</strong>
                  <span>{row.email}</span>
                </li>
              ))}
            </ul>
          )}
          {problems.length > 0 && <ProblemList rows={problems} title="Řádky, které se přeskočí" />}
        </div>
      )}
      {state && !state.ok && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <div className="dialog-actions">
        {reviewed && ok.length > 0 ? (
          <button type="submit" name="step" value="save" className="btn btn-primary" disabled={pending}>
            {pending ? "Ukládám…" : `Pozvat ${people(ok.length)}`}
          </button>
        ) : (
          <button type="submit" name="step" value="preview" className="btn btn-primary" disabled={pending}>
            {pending ? "Kontroluji…" : "Zkontrolovat seznam"}
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>
          Zrušit
        </button>
      </div>
    </form>
  );
}

function ProblemList({ rows, title }: { rows: BulkInviteRow[]; title: string }) {
  return (
    <div className="bulk-problems">
      <p className="field-label">{title}</p>
      <ul>
        {rows.map((row, index) => (
          <li key={`${row.line}-${index}`}>
            Řádek {row.line}: <strong>{row.raw}</strong> · {PROBLEM[row.status as keyof typeof PROBLEM]}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pozvání více lidí najednou: vložený seznam, jedna role a skupiny, přehled před uložením. */
export function BulkInviteDialog({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Pozvat víc lidí najednou
      </button>
      <Modal open={open} title="Pozvat víc lidí najednou" onRequestClose={() => setOpen(false)}>
        {open && <BulkInviteForm roles={roles} onClose={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
