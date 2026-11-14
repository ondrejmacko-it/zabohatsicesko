"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { EXTRAORDINARY_TYPES, GROUP_HINTS, GROUP_LABELS, TYPE_LABELS } from "@/lib/labels";
import { formatDayMonth, isoWeekday } from "@/lib/time";
import { EVENT_TYPES, GROUPS } from "@/lib/types";
import { defaultAudience } from "@/server/domain/generation";
import { topicFitsAudience } from "@/server/domain/topics";
import { interestedLabel } from "@/server/domain/topics";
import type { InvitePreview } from "@/server/services/calendar-status";
import type { EventFormValues } from "@/server/services/detail";
import type { ChangeImpact } from "@/server/services/impact";
import { previewImpactAction, saveEventAction, type ActionResult } from "../actions";

export type Person = { id: string; name: string };
export type TopicOption = { name: string; audience: string; interestCount: number; lastHeld: string | null; nextPlanned: string | null };

type Props = {
  mode: "create" | "edit";
  id?: string;
  revision?: number;
  initial: EventFormValues;
  /** Zveřejněná verze akce. Slouží k ukázání dopadu změny na pozvané. */
  published: EventFormValues | null;
  people: Person[];
  topics: TopicOption[];
  /** Skuteční hosté podle skupiny a režim Kalendáře. Null, když je stránka neumí zjistit. */
  invite: InvitePreview | null;
  /** Nahrazení pravidelného termínu jinou akcí na stejném místě v rozpisu. */
  replace?: boolean;
  /** Dny v týdnu (1 = pondělí), kdy se podle šablony běžně plánuje. Jiný den dialog výrazně ohlásí. */
  planDays?: number[];
  /** Tlačítko Upravit jako hlavní krok (v náhledu akce). */
  primary?: boolean;
};

const peopleCount = (count: number) => `${count} ${count === 1 ? "člověk" : count >= 2 && count <= 4 ? "lidé" : "lidí"}`;

/** Co se s pozvánkou stane po zveřejnění, podle režimu Kalendáře. */
const INVITE_NOTES: Record<InvitePreview["mode"], string> = {
  simulation: "Ukázkový režim: e-maily se neposílají, pozvánka se zapíše jen do ukázkového kalendáře.",
  allowlist: "Testovací režim: pozvánka půjde jen na testovací adresy, kolegům ze skupiny zatím ne.",
  audience: "Po zveřejnění jim Google pošle e-mail s pozvánkou.",
  disconnected: "Kalendář není propojený. Akce bude vidět ve Wiki, pozvánky odejdou po propojení.",
};

/** Kolik jmen se ukáže hned. Zbytek je po rozkliknutí, aby blok nenatahoval okno. */
const GUESTS_SHOWN = 6;

const WEEKDAY_NAMES = ["", "pondělí", "úterý", "středu", "čtvrtek", "pátek", "sobotu", "neděli"];

/** Přidání a úprava akce v jednom plovoucím dialogu. */
export function EventDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
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
        {props.replace ? "Nahradit pravidelný termín" : props.mode === "create" ? "Přidat akci" : "Upravit"}
      </button>
      {open && <EventForm key={session} {...props} onClose={() => setOpen(false)} />}
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
  // Pořadí určuje server (nenaplánovaná, podle zájmu, déle neprobraná). Už naplánovaná témata se nenabízejí.
  const suggestions = topics.filter((t) => topicFitsAudience(t.audience, values.audience) && t.nextPlanned === null && t.name !== values.topicTitle).slice(0, 3);
  const guests = invite?.recipients[values.audience] ?? [];

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

  const labelField = (
    <label className="field">
      <span className="field-label">Název v plánu</span>
      <input className="input" name="label" value={values.label} onChange={(e) => set("label", e.target.value)} required minLength={2} maxLength={80} />
    </label>
  );

  const requestClose = () => (dirty && !pending ? setConfirmDiscard(true) : onClose());

  return (
    <Modal open title={replace ? "Nahradit pravidelný termín" : mode === "create" ? "Přidat akci" : "Upravit akci"} onRequestClose={requestClose} wide selfGuarded>
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
        <form onSubmit={submit} onInvalidCapture={() => setMoreOpen(true)} className="stack">
          {confirmed && <input type="hidden" name="confirmToken" value={confirmed.token} />}
          {id && <input type="hidden" name="id" value={id} />}
          {revision !== undefined && <input type="hidden" name="revision" value={revision} />}
          {replace && (
            <p className="notice">
              Vyberte, co se v tomto termínu bude konat místo pravidelné aktivity. Akce zůstane na stejném místě
              v rozpisu, takže další doplnění měsíce ze šablony sem nic nepřidá.
              {published ? " Protože je termín zveřejněný, změna se uloží jako návrh a zveřejníte ji po potvrzení dopadu." : ""}
            </p>
          )}
          <fieldset className="form-main">
            <legend>Základní údaje</legend>
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
            {isHoliday && labelField}
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
                  <div className="span-2 suggestions" role="group" aria-label="Doporučená témata">
                    <span className="field-hint">Doporučená témata pro skupinu {GROUP_LABELS[values.audience]}, kliknutím vyplníte:</span>
                    {suggestions.map((t) => (
                      <button key={t.name} type="button" className="suggestion" onClick={() => set("topicTitle", t.name)}>
                        <span className="suggestion-name">{t.name}</span>
                        <span className="suggestion-meta">
                          <span className="suggestion-count" data-empty={t.interestCount === 0}>
                            {interestedLabel(t.interestCount)}
                          </span>
                          <span className="field-hint">{t.lastHeld ? `naposledy ${formatDayMonth(t.lastHeld)}` : "zatím neproběhlo"}</span>
                        </span>
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
              <span className="field-label">Publikum</span>
              <select className="select" name="audience" value={values.audience} onChange={(e) => set("audience", e.target.value as EventFormValues["audience"])}>
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </option>
                ))}
              </select>
              <span className="field-hint">{GROUP_HINTS[values.audience]}</span>
            </label>
            {invite && !isHoliday && (
              <div className="span-2 guest-preview" role="status" aria-live="polite">
                <p className="guest-preview-head">
                  <Icon name="calendar" />
                  <span>
                    {invite.mode === "allowlist" ? "Pozvánka půjde na" : guests.length >= 2 && guests.length <= 4 ? "Pozvánku dostanou" : "Pozvánku dostane"}{" "}
                    <strong>{guests.length ? (invite.mode === "allowlist" ? `${guests.length} testovací ${guests.length === 1 ? "adresu" : guests.length < 5 ? "adresy" : "adres"}` : peopleCount(guests.length)) : "zatím nikdo"}</strong>
                  </span>
                </p>
                {guests.length > 0 ? (
                  <div className="guest-preview-names">
                    {guests.slice(0, GUESTS_SHOWN).map((g) => (
                      <span key={g.email} className="guest-chip" title={g.email}>
                        {g.name}
                      </span>
                    ))}
                    {guests.length > GUESTS_SHOWN && (
                      <details className="guest-more">
                        <summary>a dalších {guests.length - GUESTS_SHOWN}</summary>
                        {guests.slice(GUESTS_SHOWN).map((g) => (
                          <span key={g.email} className="guest-chip" title={g.email}>
                            {g.name}
                          </span>
                        ))}
                      </details>
                    )}
                  </div>
                ) : (
                  <p className="field-hint">Ve skupině {GROUP_LABELS[values.audience]} není žádný aktivní účet s adresou. Lidi do skupin přidáte ve Správě.</p>
                )}
                <p className="field-hint">{INVITE_NOTES[invite.mode]}</p>
              </div>
            )}
          </div>
          {!isHoliday && <p className="field-hint">Návrh jde uložit i neúplný. Pro zveřejnění je potřeba téma a vedoucí.</p>}
          </fieldset>

          {!isHoliday && (
            <details className="more-settings" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
              <summary>Další nastavení: název v plánu a kontrolor zápisu</summary>
              <div className="form-grid">
                {labelField}
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
              {checking ? "Počítám dopad…" : pending ? "Ukládám…" : confirmed ? "Potvrdit dopad a zveřejnit" : published ? "Zveřejnit změnu" : "Zveřejnit"}
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
