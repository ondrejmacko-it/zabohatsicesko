"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/features/vzdelavani/actions";
import { Icon, type IconName } from "./Icon";
import { ConfirmDialog } from "./ConfirmDialog";
import { lockedProps, usePreviewLock } from "./PreviewLock";

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
  /** Ikona před popiskem (položky v `Menu`). */
  icon?: IconName;
  /** Další třída tlačítka (například `menu-danger`). */
  buttonClassName?: string;
};

/** Výpadek spojení: požadavek mohl, ale nemusel dojít na server, proto zpráva nic neslibuje. */
export const NETWORK_ERROR = "Spojení se serverem selhalo. Obnov stránku a zkontroluj, jestli se změna uložila.";

/** Serverová akce, jejíž síťová chyba skončí zprávou u tlačítka místo chybové stránky. */
export async function callAction(action: Props["action"], prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    return await action(prev, formData);
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

/** Jednotlačítková serverová akce se stavem odeslání, výsledkem a volitelným potvrzením. */
export function ActionForm({ action, fields = {}, label, pendingLabel, variant = "default", small, confirm, icon, buttonClassName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const lock = lockedProps(usePreviewLock());
  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await callAction(action, prev, formData);
    // Chyba zůstane v potvrzovacím okně (spouštěcí tlačítko může být ve skrytém menu), úspěch ho zavře.
    if (result.ok) setConfirming(false);
    return result;
  }, null);
  const className = `btn${variant === "primary" ? " btn-primary" : variant === "danger" ? " btn-danger" : ""}${small ? " btn-small" : ""}${buttonClassName ? ` ${buttonClassName}` : ""}`;
  const iconMark = icon ? <Icon name={icon} /> : null;

  const hidden = Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);

  return (
    <div className="action-form">
      {confirm ? (
        <>
          <button type="button" className={className} onClick={() => setConfirming(true)} disabled={pending} {...lock}>
            {iconMark}
            {label}
          </button>
          <ConfirmDialog
            open={confirming}
            title={confirm.title}
            description={
              <>
                <p>{confirm.text}</p>
                {state && !state.ok && <ActionMessage state={state} />}
              </>
            }
            onCancel={() => setConfirming(false)}
            urgent={variant === "danger"}
            busy={pending}
          >
            <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={pending} autoFocus>
              Zpět
            </button>
            <form action={formAction} className={variant === "danger" ? "confirm-destructive" : undefined}>
              {hidden}
              <button type="submit" className={`btn ${variant === "danger" ? "btn-danger" : "btn-primary"}`} disabled={pending}>
                {pending ? (pendingLabel ?? "Probíhá…") : confirm.confirmLabel}
              </button>
            </form>
          </ConfirmDialog>
        </>
      ) : (
        <form action={formAction}>
          {hidden}
          <button type="submit" className={className} disabled={pending} {...lock}>
            {iconMark}
            {pending ? (pendingLabel ?? "Probíhá…") : label}
          </button>
        </form>
      )}
      {!(confirming && state && !state.ok) && <ActionMessage state={state} />}
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
