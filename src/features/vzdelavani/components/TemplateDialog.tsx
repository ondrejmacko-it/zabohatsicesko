"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import { TYPE_LABELS } from "@/lib/labels";
import type { EventType } from "@/lib/types";
import { updateTemplateAction, type ActionResult } from "../actions";
import { lockedProps, usePreviewLock } from "@/components/PreviewLock";

export type SlotValue = { isoWeekday: number; startTime: string; endTime: string; types: string[]; active: boolean };

const WEEKDAYS = ["", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];
const REGULAR_TYPES: EventType[] = ["action", "training-fp", "portfolio", "training-rm", "education-fp", "education-rm"];

/** Pravidelný rozvrh (týdenní šablona): z něj vzniká návrh měsíce. Ruční úpravy akcí šablona nepřepisuje. */
export function TemplateDialog({ slots }: { slots: SlotValue[] }) {
  const [open, setOpen] = useState(false);
  const lock = lockedProps(usePreviewLock());
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await updateTemplateAction(prev, formData);
    if (result.ok) setOpen(false);
    return result;
  }, null);

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Nastavit pravidelný rozvrh
      </button>
      {state?.ok && <ActionMessage state={state} />}
      <Modal open={open} title="Nastavit pravidelný rozvrh" onRequestClose={() => setOpen(false)} wide>
        <p className="hint">
          Dny a časy, kdy se akce konají každý týden. Podle nich se připraví návrhy na měsíc. Změna nic nezveřejní
          a hotové akce nemění. Víc typů v jednom dni se střídá po týdnech.
        </p>
        <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
          {slots.map((slot) => (
            <fieldset key={slot.isoWeekday} className="slot">
              <legend className="slot-day">{WEEKDAYS[slot.isoWeekday]}</legend>
              <input type="hidden" name="weekday" value={slot.isoWeekday} />
              <div className="slot-time">
                <label className="check">
                  <input type="checkbox" name={`active-${slot.isoWeekday}`} defaultChecked={slot.active} />
                  <span>Používat</span>
                </label>
                <label className="field">
                  <span className="field-label">Od</span>
                  <input className="input" type="time" name={`start-${slot.isoWeekday}`} defaultValue={slot.startTime} required />
                </label>
                <label className="field">
                  <span className="field-label">Do</span>
                  <input className="input" type="time" name={`end-${slot.isoWeekday}`} defaultValue={slot.endTime} required />
                </label>
              </div>
              <fieldset className="slot-types">
                <legend className="field-label">Typy akcí</legend>
                {REGULAR_TYPES.map((type) => (
                  <label key={type} className="check-chip">
                    <input type="checkbox" name={`types-${slot.isoWeekday}`} value={type} defaultChecked={slot.types.includes(type)} />
                    <span>{TYPE_LABELS[type]}</span>
                  </label>
                ))}
              </fieldset>
            </fieldset>
          ))}
          {state && !state.ok && <ActionMessage state={state} />}
          <div className="dialog-actions">
            <button type="submit" className="btn btn-primary" disabled={pending} {...lock}>
              Uložit šablonu
            </button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Zrušit úpravy
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
