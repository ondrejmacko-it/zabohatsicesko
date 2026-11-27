"use client";

import { useActionState, useState } from "react";
import { ActionForm, ActionMessage, callAction } from "@/components/ActionForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { changeParticipationAction, type ActionResult } from "@/features/vzdelavani/actions";
import { calendarNote, type OwnCalendar } from "@/lib/calendar-note";
import { StatusBadge } from "./StatusBadge";
import { EXCUSE_REASON_LABELS } from "@/lib/labels";
import { EXCUSE_NOTE_MAX, EXCUSE_REASONS, type ExcuseReason, type ParticipationState } from "@/lib/types";
import { lockedProps, usePreviewLock } from "@/components/PreviewLock";


type Action = "enroll" | "withdraw" | "excuse" | "revoke_excuse";

type Props = {
  eventId: string;
  state: ParticipationState;
  label: string | null;
  actions: Action[];
  /** Vlastní omluva, jen pro omluveného samotného. */
  excuse: { reason: ExcuseReason; note: string | null } | null;
  /** Vlastní pozvánka v Kalendáři (F04). Null = Wiki stav nezná a panel o Kalendáři nic netvrdí. */
  calendar?: OwnCalendar | null;
  /**
   * Náhled „Zobrazit jako“: `person` = konkrétní kolega 1:1 (jeho stav a jeho tlačítka, ale zamčená),
   * `group` = hypotetický člen skupiny jen podle rolí, bez individuálních přihlášek a omluv.
   */
  preview?: "person" | "group";
  /** Přihlášky a omluvy zapnuté. Bez nich jen stav podle rolí, stejně jako v měsíci (U10). */
  enrollment?: boolean;
};

// Texty bez rodu (vlastník: „jsi omluvený“ neplatí pro každého). Přihlášení nabízí tlačítko, text ho neopakuje.
const STATE_TEXT: Partial<Record<ParticipationState, string>> = {
  required: "Akce je pro tebe povinná.",
  optional: "Akce není povinná.",
  voluntary_enrolled: "Máš přihlášenou dobrovolnou účast.",
  excused: "Z této akce máš platnou omluvu.",
  withdrawn: "Přihláška je zrušená, můžeš se znovu přihlásit.",
  cancelled: "Akce je zrušená.",
};

/** Přihlášky ve Wiki vypnuté: jen co vyplývá z rolí, nic se nenabízí. */
const READ_ONLY_TEXT: Partial<Record<ParticipationState, string>> = {
  required: "Akce je pro tebe povinná.",
  optional: "Akce není povinná.",
  cancelled: "Akce je zrušená.",
};

const ACTION_LABELS: Record<Action, string> = {
  enroll: "Přihlásit se",
  withdraw: "Odhlásit se",
  excuse: "Omluvit se",
  revoke_excuse: "Zrušit omluvu",
};

/** Akce už začala: žádné nabídky ani sliby o Kalendáři, jen jak to s účastí bylo. */
const CLOSED_TEXT: Partial<Record<ParticipationState, string>> = {
  optional: "Akce nebyla povinná.",
  withdrawn: "Z akce ses odhlásil.",
};

/**
 * Tvoje účast u akce: stav, štítek a akce Přihlásit se / Odhlásit se / Omluvit se / Zrušit omluvu.
 * Každá změna se potvrzuje v samostatném okně. Server znovu ověří session, stav i čas akce.
 */
export function ParticipationPanel({ eventId, state, label, actions, excuse, calendar = null, preview, enrollment = true }: Props) {
  // Se zapnutými přihláškami jsou akce prázdné jen u akce, která už začala (i v náhledu, akce se počítají 1:1).
  const closed = enrollment && actions.length === 0 && state !== "cancelled";
  const note = preview || closed ? null : calendarNote(state, calendar);
  const stateText = !enrollment ? READ_ONLY_TEXT[state] : (closed && CLOSED_TEXT[state]) || STATE_TEXT[state];
  return (
    <section
      className="section participation-panel"
      aria-labelledby="ucast"
      data-ucast-panel={state}
      data-ucast-closed={closed || undefined}
      data-kalendar-stav={calendar ? `${calendar.link}:${calendar.inCalendar}` : "neznamy"}
    >
      {/* Hlavička: nadpis a jeden stavový štítek vedle sebe (na mobilu se zalomí). */}
      <div className="participation-head">
        {/* V náhledu nejde o účast přihlášeného, proto ani „Tvoje“, ani vysvětlení vlastní omluvy. */}
        <h2 id="ucast">{preview ? "Účast v náhledu" : "Tvoje účast"}</h2>
        {label && <StatusBadge ucast={state} label={label} />}
      </div>
      <div className="participation-body">
        <div className="participation-info">
          {/* Náhled ukáže stejný text jako kolegovi; „tebe“ v něm znamená kolegu, za kterého se správce dívá. */}
          <p className="participation-text">{stateText}</p>
          {preview === "group" && <p className="small muted">Jen podle rolí, bez přihlášek a omluv.</p>}
          {note && <p className="small" data-kalendar={calendar?.inCalendar ? "v-kalendari" : "mimo-kalendar"}>{note}</p>}
          {/* Důvod jen omluvenému samotnému; kdo další ho smí vidět, říká okno omluvy. */}
          {state === "excused" && !preview && excuse && (
            <p className="small muted">
              <span data-feedback-redact="">{`Důvod: ${EXCUSE_REASON_LABELS[excuse.reason]}${excuse.note ? ` · ${excuse.note}` : ""}`}</span>
            </p>
          )}
          {closed && <p className="small muted">Akce už začala, účast nejde změnit.</p>}
        </div>
        {preview && enrollment && actions.length > 0 && (
          <div className="participation-locked" data-testid="ucast-zamcena">
            <div className="row participation-actions">
              {actions.map((action) => (
                <button key={action} type="button" className={`btn${action === "enroll" ? " btn-primary" : ""}`} disabled aria-describedby={`ucast-zamek-${eventId}`}>
                  {ACTION_LABELS[action]}
                </button>
              ))}
            </div>
            <p className="small muted" id={`ucast-zamek-${eventId}`}>
              Náhled je jen ke čtení.
            </p>
          </div>
        )}
        {!preview && enrollment && actions.length > 0 && (
          <div className="row participation-actions">
            {actions.includes("enroll") && (
              <ActionForm
                action={changeParticipationAction}
                fields={{ id: eventId, change: "enroll" }}
                label={ACTION_LABELS.enroll}
                pendingLabel="Přihlašuji…"
                variant="primary"
                confirm={{ title: "Přihlásit se na akci?", text: "Přihláška se uloží ve Wiki a akce se ti objeví v Moje. Kalendář se synchronizuje automaticky.", confirmLabel: "Přihlásit se" }}
              />
            )}
            {actions.includes("withdraw") && (
              <ActionForm
                action={changeParticipationAction}
                fields={{ id: eventId, change: "withdraw" }}
                label={ACTION_LABELS.withdraw}
                pendingLabel="Odhlašuji…"
                confirm={{ title: "Odhlásit se z akce?", text: "Odhlášení se uloží ve Wiki a Kalendář se synchronizuje automaticky. Přihlásit se můžeš znovu až do začátku akce.", confirmLabel: "Odhlásit se" }}
              />
            )}
            {actions.includes("excuse") && <ExcuseButton eventId={eventId} />}
            {actions.includes("revoke_excuse") && (
              <ActionForm
                action={changeParticipationAction}
                fields={{ id: eventId, change: "revoke_excuse" }}
                label={ACTION_LABELS.revoke_excuse}
                pendingLabel="Ruším…"
                confirm={{ title: "Zrušit omluvu?", text: "Akce pro tebe bude zase povinná. Změna se uloží ve Wiki a Kalendář se synchronizuje automaticky.", confirmLabel: "Zrušit omluvu" }}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Omluva: důvod (Nemoc / Dovolená / Jiné, záměrně nepředvybraný) a volitelná poznámka v samostatném okně. */
function ExcuseButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const lock = lockedProps(usePreviewLock());
  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await callAction(changeParticipationAction, prev, formData);
    if (result.ok) setOpen(false);
    return result;
  }, null);
  const formId = `omluva-${eventId}`;
  return (
    <div className="action-form">
      <button type="button" className="btn" onClick={() => setOpen(true)} disabled={pending}>
        Omluvit se
      </button>
      <ConfirmDialog
        open={open}
        title="Omluvit se z akce?"
        description={
          <form id={formId} action={formAction} className="excuse-form">
            <input type="hidden" name="id" value={eventId} />
            <input type="hidden" name="change" value="excuse" />
            <fieldset className="field">
              <legend className="field-label">Důvod</legend>
              {EXCUSE_REASONS.map((reason) => (
                <label key={reason} className="row excuse-reason">
                  <input type="radio" name="reason" value={reason} required /> {EXCUSE_REASON_LABELS[reason]}
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span className="field-label">Poznámka (nepovinná)</span>
              <textarea className="textarea" name="note" maxLength={EXCUSE_NOTE_MAX} rows={3} />
              <span className="field-hint">Důvod a poznámku vidíš ty a tvůj oprávněný nadřízený. Do Google Kalendáře se neposílají.</span>
            </label>
            {state && !state.ok && <ActionMessage state={state} />}
          </form>
        }
        onCancel={() => setOpen(false)}
        busy={pending}
      >
        <button type="button" className="btn" onClick={() => setOpen(false)} disabled={pending} autoFocus>
          Zpět
        </button>
        <button type="submit" form={formId} className="btn btn-primary" disabled={pending} {...lock}>
          {pending ? "Ukládám…" : "Omluvit se"}
        </button>
      </ConfirmDialog>
      {state?.ok && <ActionMessage state={state} />}
    </div>
  );
}
