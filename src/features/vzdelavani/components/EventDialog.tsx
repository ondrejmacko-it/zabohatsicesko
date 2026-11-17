"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { EXTRAORDINARY_TYPES, GROUP_HINTS, GROUP_LABELS, TYPE_LABELS } from "@/lib/labels";
import { isoWeekday } from "@/lib/time";
import { EVENT_TYPES, GROUPS } from "@/lib/types";
import { defaultAudience } from "@/server/domain/generation";
import { interestedLabel, isRecommendable, topicFitsAudience } from "@/server/domain/topics";
import type { InviteRecipients } from "@/server/services/calendar-status";
import type { EventFormValues } from "@/server/services/detail";
import type { ChangeImpact } from "@/server/services/impact";
import { previewImpactAction, saveEventAction, type ActionResult } from "../actions";

type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function invalidFields(form: HTMLFormElement): FormField[] {
  return Array.from(form.elements).filter(
    (element): element is FormField =>
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) && !element.validity.valid,
  );
}

/** Název pole pro souhrn chyb: popisek pole, jinak jeho přístupný název. */
function fieldName(field: FormField): string {
  const label = field.closest(".field, .check")?.querySelector(".field-label, span")?.textContent;
  return (label || field.getAttribute("aria-label") || field.name).trim();
}

export type Person = { id: string; name: string };
export type TopicOption = { name: string; audience: string; reason: string; interestCount: number; nextPlanned?: string | null };

type Props = {
  mode: "create" | "edit";
  id?: string;
  revision?: number;
  initial: EventFormValues;
  /** Zveřejněná verze akce. Slouží k ukázání dopadu změny na pozvané. */
  published: EventFormValues | null;
  people: Person[];
  topics: TopicOption[];
  /** Komu Wiki pošle pozvánku podle skupiny. Null, když ho dialog nemá ukazovat (bez Kalendáře, chyba načtení). */
  invite: InviteRecipients | null;
  /** Nahrazení pravidelného termínu jinou akcí na stejném místě v rozpisu. */
  replace?: boolean;
  /** Dny v týdnu (1 = pondělí), kdy se podle šablony běžně plánuje. Jiný den dialog výrazně ohlásí. */
  planDays?: number[];
  /** Tlačítko Upravit jako hlavní krok (v náhledu akce). */
  primary?: boolean;
  /** Dialog se otevře hned (odkaz „+“ na dni v Plánu). Po zavření se adresa vrátí na `closeHref`. */
  openOnMount?: boolean;
  closeHref?: string;
};

const WEEKDAY_NAMES = ["", "pondělí", "úterý", "středu", "čtvrtek", "pátek", "sobotu", "neděli"];

/** Přidání a úprava akce v jednom plovoucím dialogu. */
export function EventDialog(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(props.openOnMount));
  const [session, setSession] = useState(0);
  const close = () => {
    setOpen(false);
    if (props.closeHref) router.replace(props.closeHref, { scroll: false });
  };
  return (
    <>
      <button
        type="button"
        className={props.mode === "create" || props.primary ? "btn btn-primary" : "btn"}
        title={props.replace ? "Místo pravidelné aktivity naplánuje jinou akci, třeba workshop" : undefined}
        onClick={() => {
          setSession((s) => s + 1);
          setOpen(true);
        }}
      >
        {!props.replace && <Icon name={props.mode === "create" ? "plus" : "pencil"} />}
        {props.replace ? "Změnit typ tohoto termínu" : props.mode === "create" ? "Přidat akci" : "Upravit"}
      </button>
      {open && <EventForm key={session} {...props} onClose={close} />}
    </>
  );
}

/** Pole, jejichž změna zasáhne pozvané. Přesný dopad počítá a potvrzení ověřuje server. */
const SIGNIFICANT: Array<keyof EventFormValues> = ["label", "topicTitle", "date", "endDate", "startTime", "endTime", "audience"];

/** Výchozí nabídka při nahrazení: mimořádný typ místo pravidelného, termín, publikum a vedoucí zůstávají. */
function replacementOf(initial: EventFormValues): EventFormValues {
  if (EXTRAORDINARY_TYPES.has(initial.type)) return initial;
  return { ...initial, type: "workshop", label: TYPE_LABELS.workshop, topicTitle: "" };
}

function EventForm({ mode, id, revision, initial, published, people, topics, invite, replace, planDays, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState(() => (replace ? replacementOf(initial) : initial));
  const [multiDay, setMultiDay] = useState(initial.endDate !== null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Méně časté údaje jsou sbalené. Otevřené jsou, když je správce už vyplnil jinak než výchozím způsobem.
  const [moreOpen, setMoreOpen] = useState(initial.reviewerId !== "" || initial.label !== TYPE_LABELS[initial.type]);
  const [impact, setImpact] = useState<{ key: string; data: ChangeImpact } | null>(null);
  const [previewError, setPreviewError] = useState<ActionResult | null>(null);
  const [checking, setChecking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Souhrn chyb z kontroly prohlížeče: názvy polí, která je potřeba opravit (U08).
  const [invalid, setInvalid] = useState<string[]>([]);
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
  // možnost. Ruční odeslání nechá po chybě všechna pole tak, jak je správce vyplnil.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    setPreviewError(null);
    setInvalid([]);
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
  const weekday = /^\d{4}-\d{2}-\d{2}$/.test(values.date) ? isoWeekday(values.date) : null;
  const unusualDay = !isHoliday && planDays !== undefined && planDays.length > 0 && weekday !== null && !planDays.includes(weekday);
  const suggestions = topics.filter((t) => isRecommendable(t) && topicFitsAudience(t.audience, values.audience)).slice(0, 3);

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
      // Výchozí název přebírá typ. U jiné akce žádný výchozí název není, správce ho napíše sám.
      label: v.label === TYPE_LABELS[v.type] || !v.label ? (type === "other" ? "" : TYPE_LABELS[type]) : v.label,
      audience: mode === "create" ? defaultAudience(type) : v.audience,
    }));

  // U jiné akce a svátku je název hlavní údaj, jinak jen volitelná úprava v dalších nastaveních.
  const labelInMain = isHoliday || values.type === "other";
  const labelField = (
    <label className={labelInMain ? "field span-2" : "field"}>
      <span className="field-label">{labelInMain ? "Název" : "Název v plánu"}</span>
      <input className="input" name="label" value={values.label} onChange={(e) => set("label", e.target.value)} required minLength={2} maxLength={80} />
    </label>
  );

  // Neplatné pole může být ve sbalených „Dalších údajích“. Ty se otevřou, po vykreslení se ukáže souhrn
  // a fokus skočí na první chybné pole (prohlížeč by na skryté pole fokus dát nemohl).
  const onInvalid = () => {
    setMoreOpen(true);
    requestAnimationFrame(() => {
      const fields = formRef.current ? invalidFields(formRef.current) : [];
      setInvalid([...new Set(fields.map(fieldName))]);
      fields[0]?.focus();
    });
  };

  const requestClose = () => (dirty && !pending ? setConfirmDiscard(true) : onClose());

  return (
    <Modal open title={replace ? "Změnit typ tohoto termínu" : mode === "create" ? "Přidat akci" : "Upravit akci"} onRequestClose={requestClose} wide selfGuarded>
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
        <form ref={formRef} onSubmit={submit} onInvalidCapture={onInvalid} className="stack event-form">
          {invalid.length > 0 && (
            <div className="notice notice-danger" role="alert">
              <strong>Akci zatím nejde uložit.</strong> Doplňte nebo opravte: {invalid.join(", ")}.
            </div>
          )}
          {confirmed && <input type="hidden" name="confirmToken" value={confirmed.token} />}
          {id && <input type="hidden" name="id" value={id} />}
          {revision !== undefined && <input type="hidden" name="revision" value={revision} />}
          {replace && (
            <p className="notice">
              Vyberte, co se v tomto termínu bude konat místo pravidelné aktivity. Doplnění chybějících termínů sem pak nic nepřidá.
            </p>
          )}
          <fieldset className="form-main">
            <legend>Základní údaje</legend>
          <div className="form-grid">
            {labelInMain && labelField}
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
              <span className="field-label">Datum</span>
              <input className="input" type="date" name="date" value={values.date} onChange={(e) => set("date", e.target.value)} required />
            </label>
            {unusualDay && (
              <p className="notice notice-danger span-2" role="alert">
                <strong>Pozor, vybrali jste {WEEKDAY_NAMES[weekday!]}.</strong> V tento den se vzdělávání běžně nekoná a měsíční tabulka
                pro něj nemá sloupec. Akce se ukáže jen jako řádek u svého týdne a v Seznamu. Pokud je to záměr, pokračujte.
              </p>
            )}
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
                        <span className="suggestion-head">
                          <span className="suggestion-name">{t.name}</span>
                          <span className="badge badge-ochre">{interestedLabel(t.interestCount)}</span>
                        </span>
                        {/* Počet zájemců je v odznaku, v podtextu zůstává jen historie tématu. */}
                        <span className="field-hint">{t.reason.split(" · ").slice(1).join(" · ")}</span>
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
              <span className="field-label">Pro koho</span>
              <select className="select" name="audience" value={values.audience} onChange={(e) => set("audience", e.target.value as EventFormValues["audience"])}>
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </option>
                ))}
              </select>
              <span className="field-hint">{GROUP_HINTS[values.audience]}</span>
            </label>
          </div>
          {invite && !isHoliday && <InviteeList invite={invite} audience={values.audience} />}
          {!isHoliday && <p className="field-hint">Návrh jde uložit i bez tématu a vedoucího. Pozvaní ho neuvidí, dokud ho nezveřejníte.</p>}
          </fieldset>

          {!isHoliday && (
            <details className="more-settings" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
              <summary>{labelInMain ? "Další nastavení: kdo zkontroluje zápis" : "Další nastavení: název v plánu a kdo zkontroluje zápis"}</summary>
              <div className="form-grid">
                {!labelInMain && labelField}
                <label className="field">
              <span className="field-label">Kdo zkontroluje zápis</span>
              <select className="select" name="reviewerId" value={values.reviewerId} onChange={(e) => set("reviewerId", e.target.value)}>
                <option value="">Jen vedoucí</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
              </div>
            </details>
          )}

          {incomplete && (
            <label className="check">
              <input type="checkbox" name="allowIncomplete" />
              <span>
                Zveřejnit i bez tématu nebo vedoucího. Pozvaní uvidí obecný název „{values.label}“.
              </span>
            </label>
          )}

          {published && significant && !confirmed && (
            <p className="field-hint">Změna se dotkne pozvaných. Před zveřejněním uvidíte, co se změní a komu.</p>
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
              {checking ? "Ověřuji změny a příjemce…" : pending ? "Ukládám…" : confirmed || published ? "Zveřejnit změnu" : "Zveřejnit"}
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

const SHOWN_GUESTS = 8;

function guestCountLabel(count: number): string {
  if (count === 0) return "Pozvánku nedostane nikdo";
  if (count === 1) return "1 příjemce pozvánky";
  if (count < 5) return `${count} příjemci pozvánky`;
  return `${count} příjemců pozvánky`;
}

/** Kdo dostane pozvánku podle vybraného publika. Ukazuje skutečné příjemce, v testovacím režimu i to, kdo zatím pozván nebude. */
function InviteeList({ invite, audience }: { invite: InviteRecipients; audience: EventFormValues["audience"] }) {
  const guests = invite.recipients[audience];
  const group = invite.audienceRecipients[audience];
  const names = guests.map((g) => g.name || g.email);
  const shown = names.slice(0, SHOWN_GUESTS);
  const rest = names.slice(SHOWN_GUESTS);
  return (
    <div className="invitees" aria-live="polite">
      <p className="invitees-head">
        <strong>
          {guestCountLabel(guests.length)}
        </strong>
        <span className="field-hint">
          {invite.attendeeSource === "allowlist"
            ? `Testovací režim: jen povolené adresy, ne celá skupina (${group.length} lidí).`
            : `Skupina ${GROUP_LABELS[audience]}.`}
        </span>
      </p>
      {guests.length > 0 && (
        <div className="invitees-names">
          {shown.join(", ")}
          {rest.length > 0 && (
            <details className="invitees-more">
              <summary>a další {rest.length}</summary>
              {rest.join(", ")}
            </details>
          )}
        </div>
      )}
    </div>
  );
}
