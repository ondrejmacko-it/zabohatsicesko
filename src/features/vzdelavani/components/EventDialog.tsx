"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { flash } from "@/components/FlashMessage";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { GROUP_HINTS, GROUP_LABELS, TYPE_LABELS } from "@/lib/labels";
import { formatDate, isValidDateKey, isoWeekday } from "@/lib/time";
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
  return (label || field.getAttribute("aria-label") || field.name).replace("změněno", "").trim();
}

export type Person = { id: string; name: string };
export type TopicOption = { name: string; audience: string; reason: string; interestCount: number; nextPlanned?: string | null };

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
};

type CreateProps = Omit<FormProps, "mode" | "id" | "revision" | "published"> & {
  /** Okno se otevře hned (odkaz „+“ na dni v Plánu). Po zavření se adresa vrátí na `closeHref`. */
  openOnMount?: boolean;
  closeHref?: string;
};

/** Tlačítko a okno Přidat akci. Stejný formulář jako okno akce, jen s pořadím pro založení. */
export function EventDialog(props: CreateProps) {
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
        <Modal open title="Přidat akci" onRequestClose={close} wide>
          <EventForm
            key={session}
            {...props}
            mode="create"
            published={null}
            onDone={(values) => {
              setOpen(false);
              // Nová akce se ukáže v měsíci, do kterého patří. Žádná další potvrzovací stránka.
              router.replace(`/vzdelavani/harmonogram?mesic=${values.date.slice(0, 7)}`, { scroll: false });
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
  return (
    <Modal open title={title} onRequestClose={close} wide>
      {intro}
      <EventForm {...props} mode="edit" menu={menu} onDone={close} />
    </Modal>
  );
}

/** Pole, jejichž změna zasáhne pozvané. Přesný dopad počítá a potvrzení ověřuje server. */
const SIGNIFICANT: Array<keyof EventFormValues> = ["label", "topicTitle", "date", "endDate", "startTime", "endTime", "audience"];

const WEEKDAY_NAMES = ["", "pondělí", "úterý", "středu", "čtvrtek", "pátek", "sobotu", "neděli"];

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
  menu,
  onDone,
}: FormProps & { menu?: React.ReactNode; onDone: (values: EventFormValues) => void }) {
  const [values, setValues] = useState(initial);
  const [multiDay, setMultiDay] = useState(initial.endDate !== null);
  // Méně časté údaje jsou sbalené. Otevřené jsou, když je správce už vyplnil jinak než výchozím způsobem.
  const [moreOpen, setMoreOpen] = useState(initial.reviewerId !== "" || multiDay || (initial.type !== "other" && initial.label !== TYPE_LABELS[initial.type]));
  const [impact, setImpact] = useState<{ key: string; data: ChangeImpact } | null>(null);
  const [acceptedIncomplete, setAcceptedIncomplete] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
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
      onDone(values);
    }
    return result;
  }, null);

  const dirty = valuesKey !== JSON.stringify(initial);
  // Potvrzení dopadu platí jen pro hodnoty, pro které vzniklo. Jakákoli další úprava formuláře ho zruší.
  const confirmed = impact?.key === valuesKey ? impact.data : null;
  const missing = [!values.topicTitle.trim() && "téma", !values.leadId && "vedoucí"].filter((m): m is string => Boolean(m));
  const changed = (key: keyof EventFormValues) =>
    published !== null && (key === "endDate" ? (multiDay ? values.endDate : null) : values[key]) !== published[key];
  const significant = SIGNIFICANT.some(changed);
  const unpublishedChanges = published !== null && SIGNIFICANT.concat(["leadId", "reviewerId", "type"]).some(changed);

  // Rozpracované potvrzení platí jen pro hodnoty, které správce viděl.
  useEffect(() => setAsk(null), [valuesKey]);

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
      <label className="field span-2">
        <span className="field-label">Téma {mark("topicTitle")}</span>
        <input
          className="input"
          name="topicTitle"
          list="topic-options"
          value={values.topicTitle}
          onChange={(e) => set("topicTitle", e.target.value)}
          maxLength={120}
          placeholder="Napište nebo vyberte téma"
        />
        <datalist id="topic-options">
          {topics.map((t) => (
            <option key={t.name} value={t.name} />
          ))}
        </datalist>
      </label>
      {suggestions.length > 0 && !values.topicTitle.trim() && (
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
  const audienceField = (
    <label className="field">
      <span className="field-label">Pro koho {mark("audience")}</span>
      <select className="select" name="audience" value={values.audience} onChange={(e) => set("audience", e.target.value as EventFormValues["audience"])}>
        {GROUPS.map((g) => (
          <option key={g} value={g}>
            {GROUP_LABELS[g]}
          </option>
        ))}
      </select>
      <span className="field-hint">{GROUP_HINTS[values.audience]}</span>
    </label>
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
      {unusualDay && !termLocked && (
        <p className="notice notice-danger span-2" role="alert">
          <strong>Vybrali jste {WEEKDAY_NAMES[weekday!]}.</strong> V tento den se vzdělávání běžně nekoná, akce se ukáže jako řádek u svého týdne a v
          Seznamu.
        </p>
      )}
    </>
  );
  const moreFields = (
    <details className="more-settings" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
      <summary>Další možnosti</summary>
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

  const leadName = people.find((p) => p.id === values.leadId)?.name;
  const when = values.startTime && values.endTime ? whenLabel(values, multiDay) : null;
  const busy = pending || checking;
  const publishLabel = published ? "Zveřejnit změny" : "Zveřejnit";

  return (
    <form ref={formRef} onSubmit={submit} onInvalidCapture={onInvalid} className="stack event-form">
      {invalid.length > 0 && (
        <div className="notice notice-danger" role="alert">
          <strong>Akci zatím nejde uložit.</strong> Doplňte nebo opravte: {invalid.join(", ")}.
        </div>
      )}
      {confirmed && <input type="hidden" name="confirmToken" value={confirmed.token} />}
      {acceptedIncomplete === valuesKey && missing.length > 0 && <input type="hidden" name="allowIncomplete" value="on" />}
      {id && <input type="hidden" name="id" value={id} />}
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
          <section className="form-step form-review" aria-labelledby="kontrola-akce">
            <h3 id="kontrola-akce">
              <span className="step-no">3</span> Kontrola
            </h3>
            <p>
              <strong>{values.label.trim() || TYPE_LABELS[values.type]}</strong>
              {values.topicTitle.trim() && <>: {values.topicTitle.trim()}</>}
            </p>
            <p className="small">
              {when ?? "Termín zatím není vyplněný"} · {GROUP_LABELS[values.audience]} · {leadName ? `Vede ${leadName}` : "bez vedoucího"}
            </p>
            {missing.length > 0 && <p className="small muted">Chybí {missing.join(" a ")}. Návrh jde uložit i tak, zveřejnění se zeptá.</p>}
          </section>
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
          {invite && <InviteeList invite={invite} audience={values.audience} />}
          {moreFields}
        </fieldset>
      )}

      <ActionMessage state={previewError ?? state} />

      {/* Enter ve formuláři uloží jen návrh. Zveřejnění je vždy vědomá volba. */}
      {ask === "incomplete" ? (
        <div className="dialog-actions confirm-bar" role="alertdialog" aria-labelledby="potvrdit-neuplne">
          <p id="potvrdit-neuplne" className="confirm-text">
            <strong>Chybí {missing.join(" a ")}.</strong> Kolegové uvidí obecný název „{values.label.trim() || TYPE_LABELS[values.type]}“.
          </p>
          <button type="button" className="btn" onClick={() => setAsk(null)}>
            Zpět
          </button>
          <button type="submit" name="intent" value="publish" data-confirm="incomplete" className="btn btn-primary" disabled={busy} autoFocus>
            {checking ? "Ověřuji…" : pending ? "Zveřejňuji…" : "Zveřejnit bez nich"}
          </button>
        </div>
      ) : ask === "impact" && confirmed ? (
        <div className="dialog-actions confirm-bar" role="alertdialog" aria-labelledby="potvrdit-dopad">
          <div className="confirm-text">
            <p id="potvrdit-dopad">
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
          </div>
          <button type="button" className="btn" onClick={() => setAsk(null)}>
            Zpět
          </button>
          <button type="submit" name="intent" value="publish" data-confirm="impact" className="btn btn-primary" disabled={busy} autoFocus>
            {pending ? "Zveřejňuji…" : "Potvrdit zveřejnění"}
          </button>
        </div>
      ) : (
        <div className="dialog-actions event-actions">
          {menu && <div className="event-actions-menu">{menu}</div>}
          {published && !unpublishedChanges && !dirty && <span className="small muted event-actions-note">Beze změn</span>}
          <button type="submit" name="intent" value="draft" className="btn" disabled={busy || (mode === "edit" && !dirty)}>
            Uložit jako návrh
          </button>
          <button type="submit" name="intent" value="publish" className="btn btn-primary" disabled={busy || (published !== null && !unpublishedChanges && !dirty)}>
            {checking ? "Ověřuji…" : pending ? "Ukládám…" : publishLabel}
          </button>
        </div>
      )}
    </form>
  );
}

/** Termín pro souhrn: místní datum a čas tak, jak je správce zadal (bez převodu časové zóny prohlížeče). */
function whenLabel(values: EventFormValues, multiDay: boolean): string | null {
  if (!isValidDateKey(values.date)) return null;
  const last = multiDay && values.endDate && isValidDateKey(values.endDate) && values.endDate !== values.date ? ` až ${formatDate(values.endDate)}` : "";
  return `${formatDate(values.date)}${last}, ${values.startTime}–${values.endTime}`;
}

const SHOWN_GUESTS = 8;

function guestCountLabel(count: number): string {
  if (count === 0) return "Pozvánku nedostane nikdo";
  if (count === 1) return "1 příjemce pozvánky";
  if (count < 5) return `${count} příjemci pozvánky`;
  return `${count} příjemců pozvánky`;
}

/** Kdo dostane pozvánku podle vybraného publika. V testovacím režimu jen povolené adresy. */
function InviteeList({ invite, audience }: { invite: InviteRecipients; audience: EventFormValues["audience"] }) {
  const guests = invite.recipients[audience];
  const group = invite.audienceRecipients[audience];
  const names = guests.map((g) => g.name || g.email);
  const shown = names.slice(0, SHOWN_GUESTS);
  const rest = names.slice(SHOWN_GUESTS);
  return (
    <details className="invitees" aria-live="polite">
      <summary className="invitees-head">
        <strong>{guestCountLabel(guests.length)}</strong>
        {invite.attendeeSource === "allowlist" && <span className="field-hint">Testovací režim: jen povolené adresy, ne celá skupina ({group.length} lidí).</span>}
      </summary>
      {guests.length > 0 && (
        <div className="invitees-names">
          {shown.join(", ")}
          {rest.length > 0 && <> a další {rest.length}</>}
        </div>
      )}
    </details>
  );
}
