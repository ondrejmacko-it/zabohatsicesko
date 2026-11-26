"use client";

import { useActionState, useEffect, useRef } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { useMarkModalSaved } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import type { MinutesContent } from "@/lib/types";
import { saveMinutesAction } from "../actions";
import { lockedProps, usePreviewLock } from "@/components/PreviewLock";

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
  const lock = lockedProps(usePreviewLock());
  const [state, action, pending] = useActionState(saveMinutesAction, null);
  // V okně zápisu (Zápisy → ?zapis=) je uložený text nový výchozí stav: zavření okna se pak na nic neptá.
  const markSaved = useMarkModalSaved();
  const formRef = useRef<HTMLFormElement>(null);
  const savedText = useRef<string | null>(null);
  const currentText = () => [...(formRef.current?.querySelectorAll("textarea") ?? [])].map((field) => field.value).join("");
  useEffect(() => {
    // Výchozí stav = text při prvním vykreslení, po úspěšném uložení uložený text (jinak by se opakovala chyba P1-Z2).
    if (savedText.current === null || state?.ok) savedText.current = currentText();
    if (state?.ok) markSaved?.();
  }, [state, markSaved]);
  // Rozhodnutí vlastníka (audit P1): rozepsaný zápis na stránce detailu se při odchodu ohlásí, stejně jako okno.
  // Zavření nebo obnovení karty hlídá `beforeunload`, odkazy ve Wiki (Next `Link`) klik zachycený před Reactem.
  useEffect(() => {
    const dirty = () => savedText.current !== null && currentText() !== savedText.current;
    const onUnload = (event: BeforeUnloadEvent) => {
      if (dirty()) event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || event.defaultPrevented || event.button !== 0 || link.target === "_blank" || formRef.current?.contains(link)) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (dirty() && !window.confirm("Zápis má neuložené změny. Odejít a zahodit je?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  // Nízká pole, která rostou s obsahem (`field-sizing`, jinde aspoň počet řádků podle textu).
  const area = (name: keyof MinutesContent, label: string, value: string, hint?: string) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <textarea
        className="textarea textarea-grow"
        name={name}
        defaultValue={value}
        maxLength={4000}
        rows={Math.min(8, Math.max(2, value.split("\n").length + 1))}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
  return (
    <form ref={formRef} action={action} onSubmit={submitKeepingValues(action)} className="stack">
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="minutesId" value={minutesId} />
      <input type="hidden" name="version" value={version} />
      {area("summary", "Shrnutí", content.summary)}
      {area("keyPoints", "Hlavní body", content.keyPoints.join("\n"), "Každý bod na samostatný řádek.")}
      {area("decisions", "Rozhodnutí", content.decisions.join("\n"))}
      {area("nextSteps", "Další kroky", content.nextSteps.join("\n"))}
      {published && (
        <p className="small muted">Uložení založí nový návrh. Kolegové do jeho schválení dál vidí tuto schválenou verzi.</p>
      )}
      {!published && !hasLead && <p className="notice notice-danger">Doplň vedoucího akce. Zápis schvaluje a zveřejňuje vedoucí, bez něj zveřejnit nejde.</p>}
      {!published && hasLead && !canApprove && <p className="small muted">Zápis zveřejní vedoucí akce, až návrh schválí.</p>}
      {!published && canApprove && <p className="small muted">Kolegové zápis uvidí až po schválení.</p>}
      <ActionMessage state={state} />
      <div className="row">
        <button type="submit" name="intent" value="save" className={canApprove && !published ? "btn" : "btn btn-primary"} disabled={pending} {...lock}>
          {published ? "Uložit změny" : "Uložit návrh zápisu"}
        </button>
        {canApprove && !published && (
          <button type="submit" name="intent" value="approve" className="btn btn-primary" disabled={pending} {...lock}>
            Schválit a zveřejnit
          </button>
        )}
      </div>
    </form>
  );
}
