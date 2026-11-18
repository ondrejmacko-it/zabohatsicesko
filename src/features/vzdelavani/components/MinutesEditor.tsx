"use client";

import { useActionState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { submitKeepingValues } from "@/features/shared/keep-values";
import type { MinutesContent } from "@/lib/types";
import { saveMinutesAction } from "../actions";

/**
 * Úprava návrhu zápisu vedoucím, kontrolorem nebo správcem. Body se píší po řádcích. Schválit a zveřejnit
 * smí jen vedoucí akce (rozhoduje server), ostatní návrh jen uloží.
 */
export function MinutesEditor({
  eventId,
  minutesId,
  version,
  content,
  canApprove,
  hasLead,
  published = false,
}: {
  eventId: string;
  minutesId: string;
  version: number;
  content: MinutesContent;
  canApprove: boolean;
  hasLead: boolean;
  /** Úprava už schváleného zápisu: uložení změny schválení zruší. */
  published?: boolean;
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
      {published && (
        <p className="notice">Uložením změny se schválení zruší. Kolegové zápis neuvidí, dokud ho vedoucí znovu neschválí.</p>
      )}
      {!published && !hasLead && <p className="notice notice-danger">Doplňte vedoucího akce. Zápis schvaluje a zveřejňuje vedoucí, bez něj zveřejnit nejde.</p>}
      {!published && hasLead && !canApprove && <p className="small muted">Zápis zveřejní vedoucí akce, až návrh schválí.</p>}
      <ActionMessage state={state} />
      <div className="row">
        <button type="submit" name="intent" value="save" className={canApprove && !published ? "btn" : "btn btn-primary"} disabled={pending}>
          {published ? "Uložit změny" : "Uložit návrh zápisu"}
        </button>
        {canApprove && !published && (
          <button type="submit" name="intent" value="approve" className="btn btn-primary" disabled={pending}>
            Schválit a zveřejnit
          </button>
        )}
      </div>
    </form>
  );
}
