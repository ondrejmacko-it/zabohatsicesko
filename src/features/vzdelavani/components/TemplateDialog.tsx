"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import { TYPE_LABELS } from "@/lib/labels";
import type { EventType } from "@/lib/types";
import { updateTemplateAction, type ActionResult } from "../actions";

export type SlotValue = { isoWeekday: number; startTime: string; endTime: string; types: string[]; active: boolean };

const WEEKDAYS = ["", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];
const REGULAR_TYPES: EventType[] = ["action", "training-fp", "portfolio", "training-rm", "education-fp", "education-rm"];

/** Týdenní šablona: z ní vzniká návrh měsíce. Ruční úpravy akcí šablona nepřepisuje. */
export function TemplateDialog({ slots }: { slots: SlotValue[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await updateTemplateAction(prev, formData);
    if (result.ok) setOpen(false);
    return result;
  }, null);

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Šablona týdne
      </button>
      {state?.ok && <ActionMessage state={state} />}
      <Modal open={open} title="Šablona týdne" onRequestClose={() => setOpen(false)} wide>
        <p className="small muted">
          Časy a typy pro pravidelné dny. Když má den víc typů, střídají se po týdnech. Konkrétní akce pak můžete
          kdykoli upravit ručně.
        </p>
        <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
          {slots.map((slot) => (
            <fieldset key={slot.isoWeekday} className="slot">
              <legend className="field-label">{WEEKDAYS[slot.isoWeekday]}</legend>
              <input type="hidden" name="weekday" value={slot.isoWeekday} />
              <div className="row">
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
              <div className="row">
                {REGULAR_TYPES.map((type) => (
                  <label key={type} className="check">
                    <input type="checkbox" name={`types-${slot.isoWeekday}`} value={type} defaultChecked={slot.types.includes(type)} />
                    <span>{TYPE_LABELS[type]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {state && !state.ok && <ActionMessage state={state} />}
          <div className="dialog-actions">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              Uložit šablonu
            </button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Zrušit
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
