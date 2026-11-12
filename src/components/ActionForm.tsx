"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/features/vzdelavani/actions";
import { Modal } from "./Modal";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  /** Skrytá pole s identifikátory (ID akce, revize). */
  fields?: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "default" | "danger";
  small?: boolean;
  /** Pokud je vyplněno, akce se provede až po potvrzení v dialogu. */
  confirm?: { title: string; text: string; confirmLabel: string };
};

/** Jednotlačítková serverová akce se stavem odeslání, výsledkem a volitelným potvrzením. */
export function ActionForm({ action, fields = {}, label, pendingLabel, variant = "default", small, confirm }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await action(prev, formData);
    setConfirming(false);
    return result;
  }, null);
  const className = `btn${variant === "primary" ? " btn-primary" : variant === "danger" ? " btn-danger" : ""}${small ? " btn-small" : ""}`;

  const hidden = Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);

  return (
    <div className="action-form">
      {confirm ? (
        <>
          <button type="button" className={className} onClick={() => setConfirming(true)} disabled={pending}>
            {label}
          </button>
          <Modal open={confirming} title={confirm.title} onRequestClose={() => setConfirming(false)}>
            <p>{confirm.text}</p>
            <form action={formAction} className="row">
              {hidden}
              <button type="submit" className={`btn ${variant === "danger" ? "btn-danger" : "btn-primary"}`} disabled={pending}>
                {pending ? (pendingLabel ?? "Probíhá…") : confirm.confirmLabel}
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                Zpět
              </button>
            </form>
          </Modal>
        </>
      ) : (
        <form action={formAction}>
          {hidden}
          <button type="submit" className={className} disabled={pending}>
            {pending ? (pendingLabel ?? "Probíhá…") : label}
          </button>
        </form>
      )}
      <ActionMessage state={state} />
    </div>
  );
}

export function ActionMessage({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <p className="form-error" role="alert">
        {state.error}
      </p>
    );
  }
  return state.message ? (
    <p className="small" role="status">
      {state.message}
    </p>
  ) : null;
}
