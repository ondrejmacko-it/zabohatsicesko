"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Combobox, type ComboboxOption } from "@/components/Combobox";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { flash } from "@/components/FlashMessage";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { GROUP_LABELS, TYPE_LABELS } from "@/lib/labels";
import { isoWeekday } from "@/lib/time";
import { EVENT_TYPES, GROUPS } from "@/lib/types";
import { defaultAudience } from "@/server/domain/generation";
import { interestedLabel, isGuaranteed, recommendTopics, topicFitsAudience } from "@/server/domain/topics";
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
  return (label || field.getAttribute("aria-label") || field.name).replace("změněno", "").trim();
}

export type Person = { id: string; name: string };
export type TopicOption = {
  id: string;
  name: string;
  audience: string;
  reason: string;
  interestCount: number;
  nextPlanned?: string | null;
  /** Garantované téma (pořadí 1–3). */
  priorityRank?: number | null;
};

/** Svátek vzniká jen při doplnění měsíce, ručně ho založit ani na něj akci změnit nejde (hlídá i server). */
const FORM_TYPES = EVENT_TYPES.filter((type) => type !== "holiday");

type FormProps = {
  mode: "create" | "edit";
  id?: string;
  revision?: number;
  initial: EventFormValues;
  /** Zveřejněná verze akce. Slouží k vyznačení změn a k ukázání dopadu změny na pozvané. */
  published: EventFormValues | null;
  people: Person[];
  topics: TopicOption[];
  /** Komu Wiki pošle pozvánku podle skupiny. Null, když ho okno nemá ukazovat (bez Kalendáře, chyba načtení). */
  invite: InviteRecipients | null;
  /** Dny v týdnu (1 = pondělí), kdy se podle šablony běžně plánuje. Jiný den okno výrazně ohlásí. */
  planDays?: number[];
  /** Proběhlá akce: termín už měnit nejde (stejné pravidlo hlídá server). */
  termLocked?: boolean;
  /**
   * Kopie existující akce (Duplikovat): formulář uloží jen návrh a datum označí jako navržené. Server kopii
   * se zveřejněním odmítne (`duplicateOf`).
   */
  duplicateOf?: string;
  /**
   * Uložený stav akce, když `initial` obsahuje předvyplnění (Naplánovat téma). Neuložená změna se počítá
   * vůči němu, takže předvyplněné téma jde uložit i jako návrh.
   */
  saved?: EventFormValues;
};

type CreateProps = Omit<FormProps, "mode" | "id" | "revision" | "published" | "saved"> & {
  /** Okno se otevře hned (odkaz „+“ na dni v Plánu). Po zavření se adresa vrátí na `closeHref`. */
  openOnMount?: boolean;
  closeHref?: string;
};

const copyHref = (values: EventFormValues, id?: string) =>
  `/vzdelavani/harmonogram?mesic=${values.date.slice(0, 7)}${id ? `&akce=${encodeURIComponent(id)}` : ""}`;

/** Tlačítko a okno Přidat akci. Stejný formulář jako okno akce, jen s pořadím pro založení. */
export function EventDialog(props: CreateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(props.openOnMount));
  const [session, setSession] = useState(0);
  const edited = useRef(false);
  const close = () => {
    setOpen(false);
    if (props.closeHref) router.replace(props.closeHref, { scroll: false });
  };
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
        <Icon name="plus" />
        Přidat akci
      </button>
      {open && (
        <Modal open title={props.duplicateOf ? "Duplikovat akci" : "Přidat akci"} onRequestClose={close} wide hasUnsavedChanges={() => edited.current}>
          <EventForm
            key={session}
            {...props}
            mode="create"
            published={null}
            onEditedChange={(value) => {
              edited.current = value;
            }}
            onDone={(values, id) => {
              setOpen(false);
              // Nová akce se ukáže v měsíci, do kterého patří. Žádná další potvrzovací stránka. Kopie rovnou
              // otevře okno nové akce, aby ji správce zkontroloval a zveřejnil.
              router.replace(copyHref(values, props.duplicateOf ? id : undefined), { scroll: false });
            }}
          />
        </Modal>
      )}
    </>
  );
}

/**
 * Okno akce pro správce: údaje jdou upravit rovnou a dole se uloží jako návrh nebo zveřejní.
 * Záhlaví se stavem a nabídku dalších možností připraví server (`EventPeek`).
 */
export function EventWindow({ title, closeHref, intro, menu, ...props }: Omit<FormProps, "mode"> & { title: string; closeHref: string; intro: React.ReactNode; menu: React.ReactNode }) {
  const router = useRouter();
  const close = () => router.replace(closeHref, { scroll: false });
  const edited = useRef(false);
  return (
    <Modal open title={title} onRequestClose={close} wide hasUnsavedChanges={() => edited.current}>
      {intro}
      <EventForm
        {...props}
        mode="edit"
        menu={menu}
        onDone={close}
        onEditedChange={(value) => {
          edited.current = value;
        }}
      />
    </Modal>
  );
}

/** Pole, jejichž změna zasáhne pozvané. Přesný dopad počítá a potvrzení ověřuje server. */
const SIGNIFICANT: Array<keyof EventFormValues> = ["label", "topicTitle", "date", "endDate", "startTime", "endTime", "audience"];

const ON_WEEKDAY = ["", "V pondělí", "V úterý", "Ve středu", "Ve čtvrtek", "V pátek", "V sobotu", "V neděli"];

const peopleCount = (n: number) => (n === 1 ? "1 člověka" : `${n} lidí`);

/** Jedna věta o tom, co zveřejnění změní: „Změníte termín akce pro 12 lidí.“ */
function impactHeadline(impact: ChangeImpact): string {
  const fields = impact.changes.map((c) => c.field);
  const what = fields.includes("Termín") ? "termín" : fields.includes("Publikum") ? "skupinu" : fields.includes("Téma") ? "téma" : "název";
  return impact.affected ? `Změníte ${what} akce pro ${peopleCount(impact.affected)}.` : `Změníte ${what} zveřejněné akce.`;
}

type Ask = "incomplete" | "impact" | null;

function EventForm({
  mode,
  id,
  revision,
  initial,
  published,
  people,
  topics,
  invite,
  planDays,
  termLocked = false,
  duplicateOf,
  saved,
  menu,
  onDone,
  onEditedChange,
}: FormProps & {
  menu?: React.ReactNode;
  onDone: (values: EventFormValues, id?: string) => void;
  /** Hlásí oknu, jestli se hodnoty liší od otevření. Okno se podle toho při zavření zeptá. */
  onEditedChange?: (edited: boolean) => void;
}) {
  const [values, setValues] = useState(initial);
  const [multiDay, setMultiDay] = useState(initial.endDate !== null);
  // Méně časté údaje jsou sbalené. Otevřené jsou, když je správce už vyplnil jinak než výchozím způsobem.
  const [moreOpen, setMoreOpen] = useState(initial.reviewerId !== "" || multiDay || (initial.type !== "other" && initial.label !== TYPE_LABELS[initial.type]));
  const [impact, setImpact] = useState<{ key: string; data: ChangeImpact } | null>(null);
  const [acceptedIncomplete, setAcceptedIncomplete] = useState<string | null>(null);
  const [askState, setAskState] = useState<{ ask: Ask; key: string } | null>(null);
  const [previewError, setPreviewError] = useState<ActionResult | null>(null);
  const [checking, setChecking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Souhrn chyb z kontroly prohlížeče: názvy polí, která je potřeba opravit (U08).
  const [invalid, setInvalid] = useState<string[]>([]);
  const valuesKey = JSON.stringify({ ...values, endDate: multiDay ? values.endDate : null });
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await saveEventAction(prev, formData);
    if (result.ok) {
      flash(result.message);
      onDone(values, result.id);
    }
    return result;
  }, null);

  const dirty = valuesKey !== JSON.stringify(saved ?? initial);
  // Dotaz při zavření porovnává s tím, co okno ukázalo při otevření. Předvyplnění (kopie, téma) je výchozí
  // stav: zavření bez další úpravy se neptá, i když předvyplněný návrh není uložený (`saved`).
  const edited = valuesKey !== JSON.stringify(initial);
  useEffect(() => {
    onEditedChange?.(edited);
  }, [edited, onEditedChange]);
  // Potvrzení dopadu platí jen pro hodnoty, pro které vzniklo. Jakákoli další úprava formuláře ho zruší.
  const confirmed = impact?.key === valuesKey ? impact.data : null;
  const missing = [!values.topicTitle.trim() && "téma", !values.leadId && "vedoucí"].filter((m): m is string => Boolean(m));
  const changed = (key: keyof EventFormValues) =>
    published !== null && (key === "endDate" ? (multiDay ? values.endDate : null) : values[key]) !== published[key];
  const significant = SIGNIFICANT.some(changed);
  const unpublishedChanges = published !== null && SIGNIFICANT.concat(["leadId", "reviewerId", "type"]).some(changed);

  // Rozpracované potvrzení platí jen pro hodnoty, které správce viděl. Další úprava formuláře ho schová.
  const ask = askState?.key === valuesKey ? askState.ask : null;
  const setAsk = (next: Ask) => setAskState(next ? { ask: next, key: valuesKey } : null);
  // Potvrzení je samostatné okno nad formulářem (`ConfirmDialog`). Po „Zpět k úpravám“ vrátí fokus samo.
  const back = () => setAsk(null);
  // Tlačítka potvrzení jsou v portálu mimo <form>, k formuláři je váže atribut `form`.
  const formId = useId();
  const publishButton = () => formRef.current?.querySelector<HTMLButtonElement>('.event-actions button[value="publish"]');

  // Formulář se neodesílá přes <form action>: React by po akci vrátil výběry (typ, publikum) na první
  // možnost. Ruční odeslání nechá po chybě všechna pole tak, jak je správce vyplnil.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    setPreviewError(null);
    setInvalid([]);
    if (formData.get("intent") === "publish") {
      const incompleteOk = acceptedIncomplete === valuesKey || submitter?.dataset.confirm === "incomplete";
      if (missing.length > 0 && !incompleteOk) return setAsk("incomplete");
      if (missing.length > 0) {
        setAcceptedIncomplete(valuesKey);
        formData.set("allowIncomplete", "on");
      }
      if (published && significant && !confirmed) {
        setChecking(true);
        void previewImpactAction(formData)
          .then((result) => {
            if (!result.ok) return setPreviewError(result);
            if (result.impact) {
              setImpact({ key: valuesKey, data: result.impact });
              return setAsk("impact");
            }
            setAsk(null);
            startTransition(() => action(formData));
          })
          .finally(() => setChecking(false));
        return;
      }
    }
    setAsk(null);
    startTransition(() => action(formData));
  };
  const weekday = /^\d{4}-\d{2}-\d{2}$/.test(values.date) ? isoWeekday(values.date) : null;
  const unusualDay = planDays !== undefined && planDays.length > 0 && weekday !== null && !planDays.includes(weekday);
  // Pořadí doporučení: garantovaná témata skupiny, pak témata přímo pro skupinu, pak zájem (`recommendTopics`).
  const recommended = recommendTopics(topics, values.audience);
  const suggestions = recommended.slice(0, 3);
  // Nabídka tématu: garantovaná a doporučená pro skupinu nahoře (pořadí `recommendTopics`), pak ostatní.
  const topicId = useId();
  const recommendedIds = new Set(recommended.map((t) => t.id));
  const topicOptions: ComboboxOption[] = [
    ...recommended.map((t) => ({
      value: t.name,
      group: `Doporučená pro ${GROUP_LABELS[values.audience]}`,
      badges: isGuaranteed(t) ? <span className="badge badge-ok">Garantované</span> : <span className="badge badge-outline">Doporučené</span>,
      hint: interestedLabel(t.interestCount),
    })),
    ...topics.filter((t) => !recommendedIds.has(t.id)).map((t) => ({ value: t.name, group: "Ostatní témata", hint: interestedLabel(t.interestCount) })),
  ].filter((option, index, all) => all.findIndex((o) => o.value === option.value) === index);
  // Vybrané téma je pro jinou skupinu: jen upozornění, rozhoduje správce (téma se uloží i tak).
  const chosenTopic = topics.find((t) => t.name.toLowerCase() === values.topicTitle.trim().toLowerCase());
  const audienceMismatch = chosenTopic && !topicFitsAudience(chosenTopic.audience, values.audience) ? chosenTopic : null;

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

  // Neplatné pole může být ve sbalených „Dalších možnostech“. Ty se otevřou, po vykreslení se ukáže souhrn
  // a fokus skočí na první chybné pole (prohlížeč by na skryté pole fokus dát nemohl).
  const onInvalid = () => {
    setMoreOpen(true);
    requestAnimationFrame(() => {
      const fields = formRef.current ? invalidFields(formRef.current) : [];
      setInvalid([...new Set(fields.map(fieldName))]);
      fields[0]?.focus();
    });
  };

  const mark = (key: keyof EventFormValues) => changed(key) && <span className="changed-mark">změněno</span>;
  // U jiné akce je název hlavní údaj, jinak jen volitelná úprava v dalších možnostech.
  const labelInMain = values.type === "other";
  const labelField = (
    <label className={labelInMain ? "field span-2" : "field"}>
      <span className="field-label">
        {labelInMain ? "Název akce" : "Název v plánu"} {mark("label")}
      </span>
      <input
        className="input"
        name="label"
        value={values.label}
        // Prohlížeč by jinak nabízel dřívější názvy přes nabídku témat a štítků.
        autoComplete="off"
        onChange={(e) => set("label", e.target.value)}
        required
        minLength={2}
        maxLength={80}
        placeholder={labelInMain ? "Například Den otevřených dveří" : undefined}
      />
    </label>
  );
  const typeField = (
    <label className="field">
      <span className="field-label">Typ {mark("type")}</span>
      <select className="select" name="type" value={values.type} onChange={(e) => changeType(e.target.value as EventFormValues["type"])}>
        {FORM_TYPES.map((type) => (
          <option key={type} value={type}>
            {TYPE_LABELS[type]}
          </option>
        ))}
      </select>
    </label>
  );
  const topicField = (
    <>
      <div className="field span-2">
        <label className="field-label" htmlFor={topicId}>
          Téma {mark("topicTitle")}
        </label>
        <Combobox
          id={topicId}
          name="topicTitle"
          value={values.topicTitle}
          onChange={(topic) => set("topicTitle", topic)}
          options={topicOptions}
          listLabel="Nabídka témat"
          maxLength={120}
          placeholder="Napište nebo vyberte téma"
        />
      </div>
      {suggestions.length > 0 && !values.topicTitle.trim() && (
        <div className="span-2 suggestions" aria-label="Doporučená témata">
          <span className="field-hint">Doporučená témata pro {GROUP_LABELS[values.audience]}:</span>
          {suggestions.map((t) => (
            <button key={t.name} type="button" className="suggestion" onClick={() => set("topicTitle", t.name)}>
              <span className="suggestion-head">
                <span className="suggestion-name">{t.name}</span>
                {isGuaranteed(t) ? <span className="badge badge-ok">Garantované</span> : <span className="badge badge-outline">Doporučené</span>}
                <span className="badge badge-ochre">{interestedLabel(t.interestCount)}</span>
              </span>
              {/* Počet zájemců je v odznaku, v podtextu zůstává jen historie tématu. */}
              <span className="field-hint">{t.reason.split(" · ").slice(1).join(" · ")}</span>
            </button>
          ))}
        </div>
      )}
      {audienceMismatch && (
        <p className="notice span-2" role="status">
          Téma „{audienceMismatch.name}“ je pro skupinu {GROUP_LABELS[audienceMismatch.audience as keyof typeof GROUP_LABELS] ?? audienceMismatch.audience}, akce je pro{" "}
          {GROUP_LABELS[values.audience]}. Zkontrolujte skupinu nebo téma.
        </p>
      )}
    </>
  );
  const leadField = (
    <label className="field">
      <span className="field-label">Vede {mark("leadId")}</span>
      <select className="select" name="leadId" value={values.leadId} onChange={(e) => set("leadId", e.target.value)}>
        <option value="">Vyberte vedoucího</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
  // Příjemci pozvánky patří přímo pod „Pro koho“: změna skupiny je hned vidět na seznamu, kdo pozvánku dostane.
  const audienceField = (
    <div className="field">
      <label className="field-label" htmlFor={`${formId}-audience`}>
        Pro koho {mark("audience")}
      </label>
      <select
        id={`${formId}-audience`}
        className="select"
        name="audience"
        value={values.audience}
        onChange={(e) => set("audience", e.target.value as EventFormValues["audience"])}
      >
        {GROUPS.map((g) => (
          <option key={g} value={g}>
            {GROUP_LABELS[g]}
          </option>
        ))}
      </select>
      {invite && <InviteeList invite={invite} audience={values.audience} />}
    </div>
  );
  const termFields = (
    <>
      <div className="form-grid form-term span-2">
        <label className="field">
          <span className="field-label">Datum {mark("date")}</span>
          <input className="input" type="date" name="date" value={values.date} onChange={(e) => set("date", e.target.value)} required readOnly={termLocked} />
        </label>
        <label className="field">
          <span className="field-label">Od {mark("startTime")}</span>
          <input className="input" type="time" name="startTime" value={values.startTime} onChange={(e) => set("startTime", e.target.value)} required readOnly={termLocked} />
        </label>
        <label className="field">
          <span className="field-label">Do {mark("endTime")}</span>
          <input className="input" type="time" name="endTime" value={values.endTime} onChange={(e) => set("endTime", e.target.value)} required readOnly={termLocked} />
        </label>
      </div>
      {termLocked && <p className="field-hint span-2">Akce už proběhla, termín zůstává.</p>}
      {duplicateOf && <p className="field-hint field-hint-key span-2">Navržené datum, zkontrolujte.</p>}
      {unusualDay && !termLocked && (
        <p className="notice notice-danger span-2" role="alert">
          <strong>{ON_WEEKDAY[weekday!]} se vzdělávání běžně nekoná.</strong> V Plánu bude akce jako řádek pod týdnem.
        </p>
      )}
    </>
  );
  const moreFields = (
    <details className="more-settings" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
      <summary>Další údaje</summary>
      <div className="form-grid">
        {mode === "edit" && typeField}
        {!labelInMain && labelField}
        <label className="check span-2">
          <input type="checkbox" name="multiDay" checked={multiDay} onChange={(e) => setMultiDay(e.target.checked)} disabled={termLocked} />
          <span>Akce trvá více dní</span>
        </label>
        {multiDay && (
          <label className="field">
            <span className="field-label">Poslední den {mark("endDate")}</span>
            <input
              className="input"
              type="date"
              name="endDate"
              min={values.date}
              value={values.endDate ?? values.date}
              onChange={(e) => set("endDate", e.target.value)}
              required
              readOnly={termLocked}
            />
          </label>
        )}
        <label className="field">
          <span className="field-label">Kdo zkontroluje zápis {mark("reviewerId")}</span>
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
  );

  const busy = pending || checking;
  const publishLabel = published ? "Zveřejnit změny" : "Zveřejnit";
  // Zveřejněná akce bez návrhu změny a bez úprav: není co uložit ani zveřejnit, patička to jen oznámí (A-07, A-13).
  const unchanged = published !== null && !unpublishedChanges && !dirty;

  return (
    <form ref={formRef} id={formId} onSubmit={submit} onInvalidCapture={onInvalid} className="stack event-form">
      {invalid.length > 0 && (
        <div className="notice notice-danger" role="alert">
          <strong>Akci zatím nejde uložit.</strong> Doplňte nebo opravte: {invalid.join(", ")}.
        </div>
      )}
      {confirmed && <input type="hidden" name="confirmToken" value={confirmed.token} />}
      {acceptedIncomplete === valuesKey && missing.length > 0 && <input type="hidden" name="allowIncomplete" value="on" />}
      {id && <input type="hidden" name="id" value={id} />}
      {duplicateOf && <input type="hidden" name="duplicateOf" value={duplicateOf} />}
      {revision !== undefined && <input type="hidden" name="revision" value={revision} />}

      {mode === "create" ? (
        <>
          <fieldset className="form-main form-step">
            <legend>
              <span className="step-no">1</span> Akce
            </legend>
            <div className="form-grid">
              {typeField}
              {audienceField}
              {labelInMain && labelField}
              {topicField}
            </div>
          </fieldset>
          <fieldset className="form-main form-step">
            <legend>
              <span className="step-no">2</span> Termín a vedení
            </legend>
            <div className="form-grid">
              {termFields}
              {leadField}
            </div>
            {moreFields}
          </fieldset>
        </>
      ) : (
        <fieldset className="form-main">
          <legend className="visually-hidden">Údaje akce</legend>
          <div className="form-grid">
            {labelInMain && labelField}
            {topicField}
            {leadField}
            {audienceField}
            {termFields}
          </div>
          {moreFields}
        </fieldset>
      )}

      <ActionMessage state={previewError ?? state} />

      <ConfirmDialog
        open={ask === "incomplete"}
        title={`Zveřejnit bez ${missing.length > 1 ? "tématu a vedoucího" : missing[0] === "téma" ? "tématu" : "vedoucího"}?`}
        description={<p>Kolegové uvidí obecný název „{values.label.trim() || TYPE_LABELS[values.type]}“. Doplnit to půjde i později.</p>}
        onCancel={back}
        returnFocusTo={publishButton}
        busy={busy}
      >
        <button type="button" className="btn" onClick={back} autoFocus>
          Zpět k úpravám
        </button>
        <button type="submit" form={formId} name="intent" value="publish" data-confirm="incomplete" className="btn btn-primary" disabled={busy}>
          {checking ? "Ověřuji…" : pending ? "Zveřejňuji…" : "Zveřejnit bez nich"}
        </button>
      </ConfirmDialog>
      <ConfirmDialog
        open={ask === "impact" && confirmed !== null}
        title="Zveřejnit změny?"
        returnFocusTo={publishButton}
        busy={busy}
        description={
          confirmed && (
            <>
              <p>
                <strong>{impactHeadline(confirmed)}</strong>
              </p>
              <ul className="prose-list small">
                {confirmed.changes.map((c) => (
                  <li key={c.field}>
                    {c.field}: <s>{c.from}</s> → <strong>{c.to}</strong>
                  </li>
                ))}
                {confirmed.guests.add.length > 0 && <li>Do pozvánky přibude: {confirmed.guests.add.join(", ")}</li>}
                {confirmed.guests.remove.length > 0 && <li>Z pozvánky ubude: {confirmed.guests.remove.join(", ")}</li>}
              </ul>
              {confirmed.notes.length > 0 && (
                <details className="small">
                  <summary>Podrobnosti</summary>
                  <ul className="prose-list">
                    {confirmed.guests.manual.length > 0 && <li>Ručně přidaní hosté zůstanou: {confirmed.guests.manual.join(", ")}</li>}
                    {confirmed.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )
        }
        onCancel={back}
      >
        <button type="button" className="btn" onClick={back} autoFocus>
          Zpět k úpravám
        </button>
        <button type="submit" form={formId} name="intent" value="publish" data-confirm="impact" className="btn btn-primary" disabled={busy}>
          {pending ? "Zveřejňuji…" : "Potvrdit zveřejnění"}
        </button>
      </ConfirmDialog>

      {/* Enter ve formuláři uloží jen návrh. Zveřejnění je vždy vědomá volba. */}
      <div className="dialog-actions event-actions">
        {menu && <div className="event-actions-menu">{menu}</div>}
        {unchanged && <span className="small muted event-actions-note">Beze změn</span>}
        {duplicateOf && <span className="small muted event-actions-note">Kopie se uloží jako návrh, zveřejníte ji po kontrole.</span>}
        <button type="submit" name="intent" value="draft" data-confirm-save="Uložit jako návrh" className={duplicateOf ? "btn btn-primary" : "btn"} disabled={busy || (mode === "edit" && !dirty)}>
          Uložit jako návrh
        </button>
        {duplicateOf ? null : (
          // Primární vzhled jen tehdy, když je skutečně co zveřejnit; bez změn tlačítko k ničemu nevybízí.
          <button type="submit" name="intent" value="publish" className={unchanged ? "btn" : "btn btn-primary"} disabled={busy || unchanged}>
            {checking ? "Ověřuji…" : pending ? "Ukládám…" : publishLabel}
          </button>
        )}
      </div>
    </form>
  );
}

const SHOWN_GUESTS = 8;

function guestCountLabel(count: number): string {
  if (count === 1) return "1 příjemce pozvánky";
  if (count < 5) return `${count} příjemci pozvánky`;
  return `${count} příjemců pozvánky`;
}

/**
 * Kdo dostane pozvánku podle vybraného publika. Počet je jen sbalený řádek; bez příjemců stačí krátká
 * poznámka, protože zveřejnění pak nikoho nepozve. V testovacím režimu jen povolené adresy.
 */
function InviteeList({ invite, audience }: { invite: InviteRecipients; audience: EventFormValues["audience"] }) {
  const guests = invite.recipients[audience];
  if (guests.length === 0) return <p className="field-hint field-hint-key invitees-none">Ze skupiny {GROUP_LABELS[audience]} zatím pozvánku nedostane nikdo.</p>;
  const names = guests.map((g) => g.name || g.email);
  const shown = names.slice(0, SHOWN_GUESTS);
  const rest = names.slice(SHOWN_GUESTS);
  return (
    <details className="invitees" aria-live="polite">
      <summary className="invitees-head">{guestCountLabel(guests.length)}</summary>
      <div className="invitees-names">
        {shown.join(", ")}
        {rest.length > 0 && <> a další {rest.length}</>}
        {invite.attendeeSource === "allowlist" && <span className="field-hint field-hint-key"> · testovací režim, jen povolené adresy</span>}
      </div>
    </details>
  );
}
