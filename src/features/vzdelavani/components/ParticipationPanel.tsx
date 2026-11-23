"use client";

import { useActionState, useState } from "react";
import { ActionForm, ActionMessage } from "@/components/ActionForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { changeParticipationAction, type ActionResult } from "@/features/vzdelavani/actions";
import { calendarNote, type OwnCalendar } from "@/lib/calendar-note";
import { EXCUSE_NOTE_MAX, EXCUSE_REASONS, type ExcuseReason, type ParticipationState } from "@/lib/types";

export const EXCUSE_REASON_LABELS: Record<ExcuseReason, string> = { illness: "Nemoc", vacation: "Dovolená", other: "Jiné" };

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
  /** Náhled „Zobrazit jako“: jen stav, žádné akce. */
  preview?: boolean;
};

const STATE_TEXT: Partial<Record<ParticipationState, string>> = {
  required: "Akce je pro tebe povinná podle tvé role.",
  optional: "Akce pro tebe není povinná. Pokud chceš, můžeš se přihlásit.",
  voluntary_enrolled: "Jsi přihlášený dobrovolně.",
  excused: "Omluveno ve Wiki, platí hned.",
};

/**
 * Tvoje účast u akce: stav, štítek a akce Přihlásit se / Odhlásit se / Omluvit se / Zrušit omluvu.
 * Každá změna se potvrzuje v samostatném okně. Server znovu ověří session, stav i čas akce.
 */
export function ParticipationPanel({ eventId, state, label, actions, excuse, calendar = null, preview }: Props) {
  const note = preview ? null : calendarNote(state, calendar);
  return (
    <section className="section participation-panel" aria-labelledby="ucast" data-ucast-panel={state} data-kalendar-stav={calendar ? `${calendar.link}:${calendar.inCalendar}` : "neznamy"}>
      <h2 id="ucast">Tvoje účast</h2>
      {label && <p className="participation-state"><span className={state === "excused" || state === "optional" ? "badge badge-outline" : "badge badge-ok"}>{label}</span></p>}
      <p className="small">{preview ? "Takhle vypadá účast ve vybraném pohledu. Náhled je jen ke čtení." : STATE_TEXT[state]}</p>
      {note && <p className="small" data-kalendar={calendar?.inCalendar ? "v-kalendari" : "mimo-kalendar"}>{note}</p>}
      {state === "excused" && (
        <p className="small muted">
          {excuse ? `Důvod: ${EXCUSE_REASON_LABELS[excuse.reason]}${excuse.note ? ` · ${excuse.note}` : ""}. ` : ""}
          Důvod vidíš jen ty. Wiki tě z pozvánky odebere, odpověď v Google Kalendáři za tebe ale nemění.
        </p>
      )}
      {!preview && actions.length === 0 && state !== "cancelled" && <p className="small muted">Akce už začala, účast teď nejde změnit.</p>}
      {!preview && actions.length > 0 && (
        <div className="row participation-actions">
          {actions.includes("enroll") && (
            <ActionForm
              action={changeParticipationAction}
              fields={{ id: eventId, change: "enroll" }}
              label="Přihlásit se"
              pendingLabel="Přihlašuji…"
              variant="primary"
              confirm={{ title: "Přihlásit se na akci?", text: "Akce se ti objeví v Moje a pozvánku dostaneš do Kalendáře.", confirmLabel: "Přihlásit se" }}
            />
          )}
          {actions.includes("withdraw") && (
            <ActionForm
              action={changeParticipationAction}
              fields={{ id: eventId, change: "withdraw" }}
              label="Odhlásit se"
              pendingLabel="Odhlašuji…"
              confirm={{ title: "Odhlásit se z akce?", text: "Wiki tě odebere z pozvánky. Přihlásit se můžeš znovu až do začátku akce.", confirmLabel: "Odhlásit se" }}
            />
          )}
          {actions.includes("excuse") && <ExcuseButton eventId={eventId} />}
          {actions.includes("revoke_excuse") && (
            <ActionForm
              action={changeParticipationAction}
              fields={{ id: eventId, change: "revoke_excuse" }}
              label="Zrušit omluvu"
              pendingLabel="Ruším…"
              confirm={{ title: "Zrušit omluvu?", text: "Akce pro tebe bude zase povinná a Wiki tě vrátí do pozvánky.", confirmLabel: "Zrušit omluvu" }}
            />
          )}
        </div>
      )}
    </section>
  );
}

/** Omluva: důvod (Nemoc / Dovolená / Jiné) a volitelná poznámka v samostatném okně. */
function ExcuseButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await changeParticipationAction(prev, formData);
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
              {EXCUSE_REASONS.map((reason, index) => (
                <label key={reason} className="row excuse-reason">
                  <input type="radio" name="reason" value={reason} defaultChecked={index === 0} required /> {EXCUSE_REASON_LABELS[reason]}
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span className="field-label">Poznámka (nepovinná)</span>
              <textarea className="textarea" name="note" maxLength={EXCUSE_NOTE_MAX} rows={3} />
              <span className="field-hint">Důvod i poznámku vidíš jen ty. Do Kalendáře ani kolegům se neposílají.</span>
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
        <button type="submit" form={formId} className="btn btn-primary" disabled={pending}>
          {pending ? "Ukládám…" : "Omluvit se"}
        </button>
      </ConfirmDialog>
      {state?.ok && <ActionMessage state={state} />}
    </div>
  );
}
