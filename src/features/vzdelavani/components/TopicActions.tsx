"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import { GROUP_LABELS } from "@/lib/labels";
import type { Group } from "@/lib/types";
import { proposeTopicAction, toggleInterestAction, type ActionResult } from "../actions";

/** Přepínač zájmu. Jeden uživatel = nejvýš jeden zájem o téma (hlídá server). */
export function InterestButton({ topicId, interested, topicName }: { topicId: string; interested: boolean; topicName: string }) {
  const [state, action, pending] = useActionState(toggleInterestAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="interested" value={interested ? "false" : "true"} />
      <button
        type="submit"
        className={interested ? "btn btn-small interest-on" : "btn btn-small"}
        aria-pressed={interested}
        aria-label={`${interested ? "Zrušit zájem o téma" : "Mám zájem o téma"} ${topicName}`}
        disabled={pending}
      >
        {interested ? "✓ Mám zájem" : "Mám zájem"}
      </button>
      {state && !state.ok && <ActionMessage state={state} />}
    </form>
  );
}

export function ProposeTopicDialog({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          setSession((s) => s + 1);
          setOpen(true);
        }}
      >
        Navrhnout téma
      </button>
      {open && <ProposeForm key={session} groups={groups} onClose={() => setOpen(false)} />}
    </>
  );
}

function ProposeForm({ groups, onClose }: { groups: Group[]; onClose: () => void }) {
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await proposeTopicAction(prev, formData);
    if (result.ok) onClose();
    return result;
  }, null);
  return (
    <Modal open title="Navrhnout téma" onRequestClose={onClose}>
      <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
        <p className="small muted">Popište stručně, co byste chtěli na vzdělávání probrat. Zájem se vám označí automaticky.</p>
        <label className="field">
          <span className="field-label">Téma</span>
          <input className="input" name="name" required minLength={3} maxLength={120} autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Pro skupinu</span>
          <select className="select" name="audience" defaultValue={groups[0]}>
            {groups.map((g) => (
              <option key={g} value={g}>
                {GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </label>
        <ActionMessage state={state} />
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            Odeslat
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Zrušit
          </button>
        </div>
      </form>
    </Modal>
  );
}
