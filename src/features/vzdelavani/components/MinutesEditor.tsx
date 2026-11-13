"use client";

import { useActionState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { submitKeepingValues } from "@/features/shared/keep-values";
import type { MinutesContent } from "@/lib/types";
import { saveMinutesAction } from "../actions";

/** Kontrola návrhu zápisu vedoucím nebo kontrolorem. Body se píší po řádcích. */
export function MinutesEditor({
  eventId,
  minutesId,
  version,
  content,
}: {
  eventId: string;
  minutesId: string;
  version: number;
  content: MinutesContent;
}) {
  const [state, action, pending] = useActionState(saveMinutesAction, null);
  const area = (name: keyof MinutesContent, label: string, value: string, hint?: string) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <textarea className="textarea" name={name} defaultValue={value} maxLength={4000} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="minutesId" value={minutesId} />
      <input type="hidden" name="version" value={version} />
      {area("summary", "Shrnutí", content.summary)}
      {area("keyPoints", "Hlavní body", content.keyPoints.join("\n"), "Každý bod na samostatný řádek.")}
      {area("decisions", "Rozhodnutí", content.decisions.join("\n"))}
      {area("nextSteps", "Další kroky", content.nextSteps.join("\n"))}
      <ActionMessage state={state} />
      <div className="row">
        <button type="submit" name="intent" value="save" className="btn" disabled={pending}>
          Uložit úpravy
        </button>
        <button type="submit" name="intent" value="publish" className="btn btn-primary" disabled={pending}>
          Zveřejnit zápis
        </button>
      </div>
    </form>
  );
}
