"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Consequences } from "@/components/Consequences";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import type { InviteMode } from "@/server/services/calendar-status";
import type { MonthDraft } from "@/server/services/events";
import { publishMonthAction, type ActionResult } from "../actions";
import { DraftGroups, PublishImpact, TopicOptions, plural, publishConsequences, usePickedDrafts, type Recipients } from "./MonthDrafts";

type Props = {
  monthKey: string;
  monthName: string;
  drafts: MonthDraft[];
  /** Návrhy změn už zveřejněných akcí. Hromadně se nezveřejňují. */
  changeDrafts: number;
  people: Array<{ id: string; name: string }>;
  topics: string[];
  recipients: Recipients;
  inviteMode: InviteMode;
};

/**
 * Zveřejnění návrhů měsíce najednou. Předvybraný je základ ze šablony, návrhy přidané navíc si správce
 * zaškrtne sám. Téma a vedoucího jde doplnit přímo v řádku, takže není nutné otevírat každý návrh zvlášť.
 */
export function PublishMonthDialog({ monthKey, monthName, drafts, changeDrafts, people, topics, recipients, inviteMode }: Props) {
  const [open, setOpen] = useState(false);
  const { picked, set } = usePickedDrafts(drafts);
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await publishMonthAction(prev, formData);
    if (result.ok) setOpen(false);
    return result;
  }, null);
  const chosen = drafts.filter((d) => picked.has(d.id));

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Zveřejnit návrhy <span className="count-badge">{drafts.length}</span>
      </button>
      {state?.ok && <ActionMessage state={state} />}
      <Modal open={open} title={`Zveřejnit návrhy: ${monthName}`} onRequestClose={() => setOpen(false)} wide>
        <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
          <input type="hidden" name="month" value={monthKey} />
          <TopicOptions topics={topics} />
          <PublishImpact chosen={chosen} recipients={recipients} inviteMode={inviteMode} />
          <DraftGroups drafts={drafts} picked={picked} onPick={set} people={people} />
          {changeDrafts > 0 && (
            <p className="hint">
              {plural(changeDrafts, "návrh změny", "návrhy změn", "návrhů změn")} u už zveřejněných akcí tu není. Mění platnou pozvánku, proto se
              zveřejňují jednotlivě u akce.
            </p>
          )}
          <Consequences points={publishConsequences(chosen.length, inviteMode)} />
          {state && !state.ok && <ActionMessage state={state} />}
          <div className="dialog-actions">
            <button type="submit" className="btn btn-primary" disabled={pending || chosen.length === 0}>
              {pending ? "Zveřejňuji…" : chosen.length ? `Zveřejnit ${plural(chosen.length, "akci", "akce", "akcí")}` : "Zveřejnit"}
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
