"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { GROUP_LABELS, TYPE_LABELS } from "@/lib/labels";
import { EVENT_TYPES, GROUPS } from "@/lib/types";
import { defaultAudience } from "@/server/domain/generation";
import { topicFitsAudience } from "@/server/domain/topics";
import type { EventFormValues } from "@/server/services/detail";
import type { ChangeImpact } from "@/server/services/impact";
import { previewImpactAction, saveEventAction, type ActionResult } from "../actions";

export type Person = { id: string; name: string };
export type TopicOption = { name: string; audience: string; reason: string };

type Props = {
  mode: "create" | "edit";
  id?: string;
  revision?: number;
  initial: EventFormValues;
  /** Zveřejněná verze akce. Slouží k ukázání dopadu změny na pozvané. */
  published: EventFormValues | null;
  people: Person[];
  topics: TopicOption[];
  inviteeCount: number;
};

/** Přidání a úprava akce v jednom plovoucím dialogu. */
export function EventDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return (
    <>
      <button
        type="button"
        className={props.mode === "create" ? "btn btn-primary" : "btn"}
        onClick={() => {
          setSession((s) => s + 1);
          setOpen(true);
        }}
      >
        <Icon name={props.mode === "create" ? "plus" : "pencil"} />
        {props.mode === "create" ? "Přidat akci" : "Upravit"}
      </button>
      {open && <EventForm key={session} {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Pole, jejichž změna zasáhne pozvané. Přesný dopad počítá a potvrzení ověřuje server. */
const SIGNIFICANT: Array<keyof EventFormValues> = ["label", "topicTitle", "date", "endDate", "startTime", "endTime", "audience"];

function EventForm({ mode, id, revision, initial, published, people, topics, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [multiDay, setMultiDay] = useState(initial.endDate !== null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [impact, setImpact] = useState<{ key: string; data: ChangeImpact } | null>(null);
  const [previewError, setPreviewError] = useState<ActionResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await saveEventAction(prev, formData);
    if (result.ok) {
      onClose();
      if (mode === "create" && result.id) router.push(`/vzdelavani/akce/${encodeURIComponent(result.id)}`);
    }
    return result;
  }, null);

  const valuesKey = JSON.stringify({ ...values, endDate: multiDay ? values.endDate : null });
  const dirty = valuesKey !== JSON.stringify(initial);
  // Potvrzení dopadu platí jen pro hodnoty, pro které vzniklo. Jakákoli další úprava formuláře ho zruší.
  const confirmed = impact?.key === valuesKey ? impact.data : null;
  const isHoliday = values.type === "holiday";
  const incomplete = !isHoliday && (!values.topicTitle.trim() || !values.leadId);
  const changed = (key: keyof EventFormValues) =>
    published !== null && (key === "endDate" ? (multiDay ? values.endDate : null) : values[key]) !== published[key];
  const significant = SIGNIFICANT.some(changed);

  // Formulář se neodesílá přes <form action>: React by po akci vrátil výběry (typ, publikum) na první
  // možnost. Ruční odeslání nechá po chybě všechna pole tak, jak je organizátor vyplnil.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    setPreviewError(null);
    if (formData.get("intent") === "publish" && significant && !confirmed) {
      setChecking(true);
      void previewImpactAction(formData)
        .then((result) => {
          if (!result.ok) return setPreviewError(result);
          if (result.impact) return setImpact({ key: valuesKey, data: result.impact });
          startTransition(() => action(formData));
        })
        .finally(() => setChecking(false));
      return;
    }
    startTransition(() => action(formData));
  };
  const suggestions = topics.filter((t) => topicFitsAudience(t.audience, values.audience)).slice(0, 3);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const changeType = (type: EventFormValues["type"]) =>
    setValues((v) => ({
      ...v,
      type,
      label: v.label === TYPE_LABELS[v.type] || !v.label ? TYPE_LABELS[type] : v.label,
      audience: mode === "create" ? defaultAudience(type) : v.audience,
    }));

  const requestClose = () => (dirty && !pending ? setConfirmDiscard(true) : onClose());

  return (
    <Modal open title={mode === "create" ? "Přidat akci" : "Upravit akci"} onRequestClose={requestClose} wide>
      {confirmDiscard ? (
        <div className="stack">
          <p>Máte neuložené změny. Opravdu chcete dialog zavřít a změny zahodit?</p>
          <div className="row">
            <button type="button" className="btn btn-danger" onClick={onClose}>
              Zahodit změny
            </button>
            <button type="button" className="btn" onClick={() => setConfirmDiscard(false)}>
              Pokračovat v úpravách
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="stack">
          {confirmed && <input type="hidden" name="confirmToken" value={confirmed.token} />}
          {id && <input type="hidden" name="id" value={id} />}
          {revision !== undefined && <input type="hidden" name="revision" value={revision} />}
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Typ</span>
              <select className="select" name="type" value={values.type} onChange={(e) => changeType(e.target.value as EventFormValues["type"])}>
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Název v plánu</span>
              <input className="input" name="label" value={values.label} onChange={(e) => set("label", e.target.value)} required minLength={2} maxLength={80} />
            </label>
            <label className="field">
              <span className="field-label">Datum</span>
              <input className="input" type="date" name="date" value={values.date} onChange={(e) => set("date", e.target.value)} required />
            </label>
            {!isHoliday && (
              <div className="form-grid">
                <label className="field">
                  <span className="field-label">Od</span>
                  <input className="input" type="time" name="startTime" value={values.startTime} onChange={(e) => set("startTime", e.target.value)} required />
                </label>
                <label className="field">
                  <span className="field-label">Do</span>
                  <input className="input" type="time" name="endTime" value={values.endTime} onChange={(e) => set("endTime", e.target.value)} required />
                </label>
              </div>
            )}
            {isHoliday && (
              <>
                <input type="hidden" name="startTime" value="00:00" />
                <input type="hidden" name="endTime" value="00:00" />
              </>
            )}
            <label className="check span-2">
              <input type="checkbox" name="multiDay" checked={multiDay} onChange={(e) => setMultiDay(e.target.checked)} />
              <span>Akce trvá více dní</span>
            </label>
            {multiDay && (
              <label className="field">
                <span className="field-label">Poslední den</span>
                <input
                  className="input"
                  type="date"
                  name="endDate"
                  min={values.date}
                  value={values.endDate ?? values.date}
                  onChange={(e) => set("endDate", e.target.value)}
                  required
                />
              </label>
            )}
            {!isHoliday && (
              <>
                <label className="field span-2">
                  <span className="field-label">Téma</span>
                  <input
                    className="input"
                    name="topicTitle"
                    list="topic-options"
                    value={values.topicTitle}
                    onChange={(e) => set("topicTitle", e.target.value)}
                    maxLength={120}
                    placeholder="Zatím nedoplněno"
                  />
                  <datalist id="topic-options">
                    {topics.map((t) => (
                      <option key={t.name} value={t.name} />
                    ))}
                  </datalist>
                </label>
                {suggestions.length > 0 && (
                  <div className="span-2 suggestions" aria-label="Doporučená témata">
                    <span className="field-hint">Doporučená témata pro {GROUP_LABELS[values.audience]}:</span>
                    {suggestions.map((t) => (
                      <button key={t.name} type="button" className="suggestion" onClick={() => set("topicTitle", t.name)}>
                        <span className="suggestion-name">{t.name}</span>
                        <span className="field-hint">{t.reason}</span>
                      </button>
                    ))}
                  </div>
                )}
                <label className="field">
                  <span className="field-label">Vede</span>
                  <select className="select" name="leadId" value={values.leadId} onChange={(e) => set("leadId", e.target.value)}>
                    <option value="">Zatím nedoplněno</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Kontrolor zápisu</span>
                  <select className="select" name="reviewerId" value={values.reviewerId} onChange={(e) => set("reviewerId", e.target.value)}>
                    <option value="">Jen vedoucí</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {isHoliday && (
              <>
                <input type="hidden" name="topicTitle" value="" />
                <input type="hidden" name="leadId" value="" />
                <input type="hidden" name="reviewerId" value="" />
              </>
            )}
            <label className="field">
              <span className="field-label">Publikum</span>
              <select className="select" name="audience" value={values.audience} onChange={(e) => set("audience", e.target.value as EventFormValues["audience"])}>
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {incomplete && (
            <label className="check">
              <input type="checkbox" name="allowIncomplete" />
              <span>
                Zveřejnit i bez tématu nebo vedoucího. Pozvaní uvidí obecný název „{values.label}“.
              </span>
            </label>
          )}

          {published && !significant && (
            <p className="notice notice-ok">Tato úprava se pozvaných nedotkne. Pozvánka v Kalendáři i hosté zůstanou beze změny.</p>
          )}
          {published && significant && !confirmed && (
            <p className="notice">
              Změna zasáhne pozvané. Po kliknutí na Zveřejnit změnu nejdřív uvidíte, co přesně se změní a komu, a teprve
              potom ji potvrdíte.
            </p>
          )}
          {confirmed && (
            <div className="notice" role="status" aria-live="polite">
              <p>
                <strong>Zkontrolujte dopad změny</strong>
              </p>
              <ul className="prose-list">
                {confirmed.changes.map((c) => (
                  <li key={c.field}>
                    {c.field}: <s>{c.from}</s> → <strong>{c.to}</strong>
                  </li>
                ))}
                {confirmed.guests.add.length > 0 && <li>Wiki do pozvánky přidá: {confirmed.guests.add.join(", ")}</li>}
                {confirmed.guests.remove.length > 0 && <li>Wiki z pozvánky odebere: {confirmed.guests.remove.join(", ")}</li>}
                {confirmed.guests.manual.length > 0 && <li>Ručně přidaní hosté zůstanou: {confirmed.guests.manual.join(", ")}</li>}
                {confirmed.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <p className="small">Když ve formuláři cokoli změníte, potvrzení se zruší a dopad se spočítá znovu.</p>
            </div>
          )}

          <ActionMessage state={previewError ?? state} />

          {/* Enter ve formuláři uloží jen návrh. Zveřejnění je vždy vědomá volba. */}
          <div className="dialog-actions">
            <button type="submit" name="intent" value="draft" className="btn" disabled={pending || checking}>
              {published ? "Uložit návrh změny" : "Uložit návrh"}
            </button>
            <button type="submit" name="intent" value="publish" className="btn btn-primary" disabled={pending || checking}>
              {checking ? "Počítám dopad…" : confirmed ? "Potvrdit dopad a zveřejnit" : published ? "Zveřejnit změnu" : "Zveřejnit"}
            </button>
            <button type="button" className="btn" onClick={requestClose}>
              Zrušit
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
