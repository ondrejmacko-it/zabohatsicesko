"use client";

import { useActionState, useState, useTransition } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Consequences } from "@/components/Consequences";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import type { InviteMode } from "@/server/services/calendar-status";
import type { MonthPreparation } from "@/server/services/events";
import { prepareMonthAction, publishMonthAction, type ActionResult } from "../actions";
import { DraftGroups, PublishImpact, TopicOptions, plural, publishConsequences, usePickedDrafts, type Recipients } from "./MonthDrafts";

type Props = {
  monthKey: string;
  monthName: string;
  people: Array<{ id: string; name: string }>;
  topics: Array<{ name: string; interestCount: number }>;
  recipients: Recipients;
  inviteMode: InviteMode;
};

const STEPS = ["Termíny", "Témata a vedoucí", "Zveřejnění"] as const;

/**
 * Průvodce „Připravit další měsíc“: tři kroky v jednom okně. Doplní termíny ze šablony, nabídne témata
 * podle zájmu a zveřejní vybrané návrhy. Každý krok dělá totéž co samostatný nástroj v menu, jen v pořadí,
 * ve kterém se měsíc opravdu připravuje. Až do posledního tlačítka se nic nezveřejní.
 */
export function PrepareMonthDialog({ monthKey, monthName, people, topics, recipients, inviteMode }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [prep, setPrep] = useState<MonthPreparation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const { picked, set, reset } = usePickedDrafts([]);
  const close = () => {
    setOpen(false);
    setStep(0);
    setPrep(null);
    setError(null);
  };
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await publishMonthAction(prev, formData);
    if (result.ok) close();
    return result;
  }, null);

  const fill = () =>
    startLoading(async () => {
      const result = await prepareMonthAction(monthKey);
      if (!result.ok || !result.preparation) {
        setError(result.ok ? "Měsíc se nepodařilo připravit. Zkuste to prosím znovu." : result.error);
        return;
      }
      setError(null);
      setPrep(result.preparation);
      reset(result.preparation.drafts);
      setStep(1);
    });

  const drafts = prep?.drafts ?? [];
  const chosen = drafts.filter((d) => picked.has(d.id));
  const interest = Object.fromEntries(topics.map((t) => [t.name, t.interestCount]));
  const suggested = prep ? Object.keys(prep.suggestions).length + prep.withTopic : 0;

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Připravit další měsíc
      </button>
      {state?.ok && <ActionMessage state={state} />}
      <Modal open={open} title={`Připravit další měsíc: ${monthName}`} onRequestClose={close} wide>
        <ol className="steps" aria-label="Kroky průvodce">
          {STEPS.map((name, index) => (
            <li key={name} className="step" data-state={index === step ? "current" : index < step ? "done" : "todo"} aria-current={index === step ? "step" : undefined}>
              <span className="step-number">{index + 1}</span>
              <span className="step-name">{name}</span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="stack">
            <p className="step-lead">Wiki doplní pravidelné termíny podle týdenní šablony.</p>
            <p className="hint">
              Vzniknou jen návrhy, které vidí správci. Nikdo zatím nedostane pozvánku. Termíny, které v měsíci už jsou, zůstanou beze změny.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary" onClick={fill} disabled={loading}>
                {loading ? "Doplňuji…" : "Doplnit termíny"}
              </button>
              <button type="button" className="btn" onClick={close}>
                Zrušit
              </button>
            </div>
          </div>
        )}

        {prep && step > 0 && drafts.length === 0 && (
          <div className="stack">
            <div className="empty-state">
              <p className="item-title">{monthName} nemá žádný návrh ke zveřejnění.</p>
              <p className="item-meta">Všechny termíny ze šablony už jsou zveřejněné. Další akci přidáte tlačítkem Přidat akci.</p>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary" onClick={close}>
                Hotovo
              </button>
            </div>
          </div>
        )}

        {prep && step > 0 && drafts.length > 0 && (
          <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
            <input type="hidden" name="month" value={monthKey} />
            <TopicOptions topics={topics.map((t) => t.name)} />
            {/* Řádky zůstávají ve formuláři i ve třetím kroku, jen se schovají: odesílají se jejich pole. */}
            <div className="stack" hidden={step !== 1}>
              <p className="step-lead">
                {prep.created > 0 ? "Termíny jsou doplněné." : "Termíny už v měsíci byly."} Zkontrolujte témata a vedoucí u {plural(drafts.length, "návrhu", "návrhů", "návrhů")}.
              </p>
              <p className="hint">
                {suggested > 0
                  ? "U vzdělávání je předvyplněné téma, o které mají kolegové největší zájem. Můžete ho přepsat nebo smazat."
                  : "Téma a vedoucího můžete doplnit teď, nebo později u každé akce."}{" "}
                Co nechcete zveřejnit, odškrtněte. Zůstane jako návrh.
              </p>
              <DraftGroups drafts={drafts} picked={picked} onPick={set} people={people} suggestions={prep.suggestions} interest={interest} />
              {prep.changeDrafts > 0 && (
                <p className="hint">
                  {plural(prep.changeDrafts, "návrh změny", "návrhy změn", "návrhů změn")} u už zveřejněných akcí tu není, zveřejňují se jednotlivě u akce.
                </p>
              )}
              <div className="dialog-actions">
                <button type="button" className="btn btn-primary" onClick={() => setStep(2)} disabled={chosen.length === 0}>
                  Pokračovat
                </button>
                <button type="button" className="btn" onClick={close}>
                  Nechat jako návrhy
                </button>
              </div>
            </div>
            {step === 2 && (
              <>
                <PublishImpact chosen={chosen} recipients={recipients} inviteMode={inviteMode} />
                <Consequences points={publishConsequences(chosen.length, inviteMode)} />
                {drafts.length > chosen.length && (
                  <p className="hint">{plural(drafts.length - chosen.length, "návrh zůstane", "návrhy zůstanou", "návrhů zůstane")} v Plánu jako návrh.</p>
                )}
                {state && !state.ok && <ActionMessage state={state} />}
                <div className="dialog-actions">
                  <button type="submit" className="btn btn-primary" disabled={pending || chosen.length === 0}>
                    {pending ? "Zveřejňuji…" : `Zveřejnit ${plural(chosen.length, "akci", "akce", "akcí")}`}
                  </button>
                  <button type="button" className="btn" onClick={() => setStep(1)} disabled={pending}>
                    Zpět
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}
