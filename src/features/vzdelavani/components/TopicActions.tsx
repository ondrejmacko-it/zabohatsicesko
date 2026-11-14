"use client";

import { useActionState, useState, useTransition } from "react";
import { ActionForm, ActionMessage } from "@/components/ActionForm";
import { Menu } from "@/components/Menu";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import { GROUP_LABELS } from "@/lib/labels";
import type { Group } from "@/lib/types";
import { archiveTopicAction, proposeTopicAction, toggleInterestAction, updateTopicAction, type ActionResult } from "../actions";

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

/** Správa tématu pro správce: úprava názvu a skupiny, archivace. */
/** Správa tématu v jedné nabídce: úprava názvu a skupiny, archivace s potvrzením. */
export function TopicManage({ topic, groups }: { topic: { id: string; name: string; audience: string }; groups: Group[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Menu label={`Možnosti tématu ${topic.name}`} small iconOnly>
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Upravit téma
        </button>
        <ActionForm
          action={archiveTopicAction}
          fields={{ topicId: topic.id, archived: "true" }}
          label="Archivovat…"
          confirm={{
            title: "Archivovat téma",
            text: `Téma „${topic.name}“ zmizí z nabídky a z doporučení. Akce, které ho už měly, si vazbu nechají a téma můžete kdykoli obnovit.`,
            confirmLabel: "Archivovat téma",
          }}
        />
      </Menu>
      {open && <EditTopicForm topic={topic} groups={groups} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditTopicForm({ topic, groups, onClose }: { topic: { id: string; name: string; audience: string }; groups: Group[]; onClose: () => void }) {
  const [name, setName] = useState(topic.name);
  const [audience, setAudience] = useState(topic.audience);
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  // Ruční odeslání: po chybě (například duplicitní název) zůstanou hodnoty tak, jak je správce vyplnil.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    start(async () => {
      const result = await updateTopicAction(formData);
      if (result.ok) onClose();
      else setState(result);
    });
  };
  return (
    <Modal open title="Upravit téma" onRequestClose={onClose}>
      <form onSubmit={submit} className="stack">
        <input type="hidden" name="topicId" value={topic.id} />
        <label className="field">
          <span className="field-label">Téma</span>
          <input className="input" name="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={120} />
        </label>
        <label className="field">
          <span className="field-label">Pro skupinu</span>
          <select className="select" name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {groups.map((g) => (
              <option key={g} value={g}>
                {GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </label>
        <p className="small muted">Akce, které téma už mají v plánu nebo v zápisu, si nechají název, pod kterým byly zveřejněné.</p>
        <ActionMessage state={state} />
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Ukládám…" : "Uložit"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Zrušit
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function RestoreTopicButton({ topicId }: { topicId: string }) {
  return <ActionForm action={archiveTopicAction} fields={{ topicId, archived: "false" }} label="Obnovit" small />;
}
