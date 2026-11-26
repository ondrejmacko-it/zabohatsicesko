"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionForm, ActionMessage } from "@/components/ActionForm";
import { Combobox } from "@/components/Combobox";
import { Modal, fieldsFingerprint } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import { publishInviteNote, type InviteMode } from "@/lib/invite-mode";
import { GROUP_LABELS } from "@/lib/labels";
import { addDays, formatDayMonth, formatEventTime, shiftMonth, toDateKey, weekdayShort } from "@/lib/time";
import type { Group } from "@/lib/types";
import type { DeletedSlot, MonthDraft } from "@/server/services/events";
import { generateMonthAction, publishMonthAction, type ActionResult } from "../actions";
import {
  audienceOptions,
  draftGaps,
  fillEmptyLeads,
  fillEmptyTopics,
  matchesOverview,
  prepareOverview,
  publishBlockedReason,
  rowsMissingLead,
  rowsMissingTopic,
  type DraftRowState,
  type OverviewKey,
} from "../prepare-month";
import { TemplateDialog, type SlotValue } from "./TemplateDialog";
import { lockedProps, usePreviewLock } from "@/components/PreviewLock";

/** Jak se zveřejnění propíše do Kalendáře. Určuje jen text přehledu dopadu. */

type Props = {
  monthKey: string;
  monthName: string;
  todayKey: string;
  drafts: MonthDraft[];
  /** Návrhy změn už zveřejněných akcí. Hromadně se nezveřejňují. */
  changeDrafts: number;
  /** Smazané budoucí termíny z rozvrhu. Doplnění je nevrací, vrátí je až Obnovit smazané návrhy. */
  deletedSlots: number;
  /** Tytéž smazané termíny jednotlivě, každý jde obnovit zvlášť. */
  deleted: DeletedSlot[];
  people: Array<{ id: string; name: string }>;
  topics: string[];
  recipients: Record<Group, Array<{ email: string; name: string }>>;
  inviteMode: InviteMode;
  /** Pravidelný rozvrh, ze kterého se termíny doplňují. Upravuje se odsud. */
  template: SlotValue[];
  /** Prázdný měsíc: tlačítko je jediná hlavní akce stránky (F06). */
  primary?: boolean;
};

const plural = (count: number, one: string, few: string, many: string) => `${count} ${count === 1 ? one : count >= 2 && count <= 4 ? few : many}`;

/**
 * Okno Připravit měsíc: doplnění termínů ze šablony, mezery, úprava návrhů (datum, pro koho, téma,
 * vedoucí), stav párování zveřejněných akcí a nakonec uložení nebo zveřejnění. Tlačítko vidí správce
 * vždy, i v měsíci bez návrhů.
 */
export function PrepareMonthDialog(props: Props) {
  const [open, setOpen] = useState(false);
  // Výsledek akce drží obal: po uložení se stránka obnoví a formulář s novými verzemi návrhů se založí znovu.
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await publishMonthAction(prev, formData);
    // Uložení i rozhodnutí o doporučeném tématu nechají okno otevřené, zavře ho jen zveřejnění.
    if (result.ok && formData.get("intent") !== "save" && !formData.get("topicDecision")) setOpen(false);
    return result;
  }, null);
  const draftsKey = props.drafts.map((d) => `${d.id}:${d.revision}`).join("|");
  // Obnova zůstane v okně i po úspěchu (počet smazaných klesne na 0), jinak by zmizela i její hláška.
  const [showRestore, setShowRestore] = useState(props.deletedSlots > 0);
  if (props.deletedSlots > 0 && !showRestore) setShowRestore(true);
  // Rozepsané změny se měří od posledního načtení návrhů, ne od otevření okna: po doplnění termínů nebo uložení
  // se formulář založí znovu s novými řádky a zavření se nesmí ptát na změny, které nikdo neudělal.
  const unsaved = useRef<() => boolean>(() => false);
  const trackUnsaved = useCallback((check: () => boolean) => {
    unsaved.current = check;
  }, []);
  // Doplnit i Obnovit založí formulář návrhů znovu a rozepsané úpravy řádků by zmizely (rozhodnutí O4: zeptat se).
  const [dirty, setDirty] = useState(false);
  const keepEdits = dirty
    ? { title: "Neuložené úpravy", text: "Máš neuložené úpravy návrhů, doplněním se zahodí. Ulož je, nebo pokračuj bez nich.", confirmLabel: "Zahodit úpravy a pokračovat" }
    : undefined;

  return (
    <>
      <button type="button" className={props.primary ? "btn btn-primary" : "btn"} onClick={() => {
          setShowRestore(props.deletedSlots > 0);
          setOpen(true);
        }}>
        Připravit měsíc
        {props.drafts.length > 0 && (
          <span className="count-badge" aria-label={plural(props.drafts.length, "návrh", "návrhy", "návrhů")}>
            {props.drafts.length}
          </span>
        )}
      </button>
      {!open && state?.ok && <ActionMessage state={state} />}
      <Modal open={open} title={`Připravit měsíc: ${props.monthName}`} onRequestClose={() => setOpen(false)} wide="extra" hasUnsavedChanges={() => unsaved.current()}>
        <div className="stack">
          <section className="prepare-step" aria-labelledby="prepare-fill">
            <h3 id="prepare-fill">
              <span className="step-no">1</span> Doplnit termíny
            </h3>
            <p className="hint">Doplní návrhy podle pravidelného rozvrhu, nic nezveřejní.</p>
            <div className="row prepare-fill">
              {/* Bez návrhů je doplnění termínů jediný možný krok, a proto hlavní tlačítko okna. */}
              {/* Klíč: po obnově smazaných by stará hláška „se nevrací“ odporovala výsledku, formulář se založí znovu. */}
              <ActionForm key={props.deletedSlots} action={generateMonthAction} fields={{ month: props.monthKey }} label="Doplnit chybějící termíny" pendingLabel="Doplňuji…" confirm={keepEdits} variant={props.drafts.length ? undefined : "primary"} />
              <TemplateDialog slots={props.template} />
            </div>
            {/* Smazání návrhu je vědomé rozhodnutí, doplnění ho nepřepíše. Vrácení je proto samostatné tlačítko. */}
            {showRestore && (
              <div className="row prepare-restore">
                {props.deletedSlots > 0 && <p className="small muted">Smazané termíny z rozvrhu: {props.deletedSlots}. Doplnění je nevrací.</p>}
                <ActionForm
                  action={generateMonthAction}
                  fields={{ month: props.monthKey, restore: "1" }}
                  label={props.deletedSlots > 0 ? `Obnovit smazané návrhy (${props.deletedSlots})` : "Obnovit smazané návrhy"}
                  pendingLabel="Obnovuji…"
                  small
                  confirm={keepEdits}
                />
              </div>
            )}
            {props.deleted.length > 0 && (
              <details className="prepare-deleted">
                <summary>Obnovit jednotlivě ({props.deleted.length})</summary>
                <ul aria-label="Smazané termíny">
                  {props.deleted.map((slot) => (
                    <li key={slot.key}>
                      <span>
                        {slot.label} · {weekdayShort(slot.dateKey)} {formatDayMonth(slot.dateKey)} · {slot.startTime}–{slot.endTime}
                      </span>
                      <ActionForm action={generateMonthAction} fields={{ month: props.monthKey, key: slot.key }} label="Obnovit" pendingLabel="Obnovuji…" small confirm={keepEdits} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
          <MonthDraftsForm key={draftsKey} {...props} action={action} pending={pending} state={state} onCancel={() => setOpen(false)} trackUnsaved={trackUnsaved} onDirtyChange={setDirty} />
        </div>
      </Modal>
    </>
  );
}

type FormProps = Props & {
  action: (formData: FormData) => void;
  pending: boolean;
  state: ActionResult | null;
  onCancel: () => void;
  /** Předá oknu kontrolu rozepsaných změn vůči stavu, se kterým se formulář založil. */
  trackUnsaved: (check: () => boolean) => void;
  /** Hlásí oknu, zda jsou v řádcích rozepsané úpravy (Doplnit a Obnovit se pak nejdřív zeptají). */
  onDirtyChange: (dirty: boolean) => void;
};

/**
 * Návrhy měsíce. Předvybraný ke zveřejnění je základ ze šablony, návrhy přidané navíc si správce zaškrtne
 * sám. „Uložit změny“ uloží úpravy všech řádků a nic neodešle, „Zveřejnit“ vydá jen vybrané.
 */
function MonthDraftsForm({ monthKey, todayKey, drafts, changeDrafts, people, topics, recipients, inviteMode, action, pending, state, onCancel, trackUnsaved, onDirtyChange }: FormProps) {
  const lock = lockedProps(usePreviewLock());
  const [picked, setPicked] = useState<Set<string>>(() => new Set(drafts.filter((d) => d.fromTemplate).map((d) => d.id)));
  const toggle = (id: string, on: boolean) =>
    setPicked((before) => {
      const next = new Set(before);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const setGroup = (ids: string[], on: boolean) =>
    setPicked((before) => {
      const next = new Set(before);
      for (const id of ids) if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // Nabídka témat je pro všechny řádky stejná (stejně jako dřív jeden <datalist>).
  const topicOptions = useMemo(() => topics.map((value) => ({ value })), [topics]);
  // Pole řádků jsou neřízená, mezery a publikum se proto čtou z formuláře.
  type Filled = { topic: boolean; topicText: string; lead: boolean; audience: Group };
  const [filled, setFilled] = useState<Record<string, Filled>>({});
  const baseline = useRef<string | null>(null);
  const readFilled = (form: HTMLFormElement) => {
    if (baseline.current !== null) onDirtyChange(fieldsFingerprint(form) !== baseline.current);
    const data = new FormData(form);
    setFilled(
      Object.fromEntries(
        drafts.map((d) => [
          d.id,
          {
            topic: Boolean(String(data.get(`topic-${d.id}`) ?? "").trim()),
            topicText: String(data.get(`topic-${d.id}`) ?? "").trim(),
            lead: Boolean(data.get(`lead-${d.id}`)),
            audience: (data.get(`aud-${d.id}`) as Group | null) ?? d.audience,
          },
        ]),
      ),
    );
  };
  // Výběr v <select> pošle v prohlížeči `input` a `change` jako dvě samostatné události. Překreslení už na
  // `input` vrátilo řízený výběr (hromadný vedoucí) na starou hodnotu dřív, než `change` uložil novou,
  // a volba osoby se neuchytila. U výběrů proto stačí `change`, psaní v polích dál přepočítá přehled hned.
  const readOnInput = (event: React.FormEvent<HTMLFormElement>) => {
    if (!(event.target instanceof HTMLSelectElement)) readFilled(event.currentTarget);
  };
  const current = (d: MonthDraft): Filled =>
    filled[d.id] ?? { topic: Boolean(d.topicTitle), topicText: d.topicTitle ?? "", lead: Boolean(d.leadId), audience: d.audience };
  // Doporučení systému platí, dokud správce téma v poli nepřepsal. Pak jde o jeho vlastní volbu.
  const suggested = (d: MonthDraft) => d.suggestion !== null && current(d).topicText === (d.topicTitle ?? "");
  const changeTopic = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    const form = event.currentTarget.form;
    const input = form?.elements.namedItem(`topic-${id}`);
    if (!form || !(input instanceof HTMLInputElement)) return;
    input.value = "";
    input.focus();
    readFilled(form);
  };
  const rowState = (d: MonthDraft): DraftRowState => {
    const f = current(d);
    return { id: d.id, holiday: d.type === "holiday", topic: f.topic, lead: f.lead, clash: Boolean(d.clash), picked: picked.has(d.id) };
  };
  const missing = (d: MonthDraft) => draftGaps(rowState(d));

  const chosen = drafts.filter((d) => picked.has(d.id));
  const incomplete = chosen.filter((d) => missing(d).length > 0).length;
  // Řádky v pořadí, v jakém jsou v okně: přehled skáče vždy na první dotčený řádek shora.
  const templateDrafts = drafts.filter((d) => d.fromTemplate);
  const extraDrafts = drafts.filter((d) => !d.fromTemplate);
  const rows = [...templateDrafts, ...extraDrafts].map(rowState);
  const overview = prepareOverview(rows);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    onDirtyChange(false);
    if (!form) {
      trackUnsaved(() => false);
      return;
    }
    const start = fieldsFingerprint(form);
    baseline.current = start;
    trackUnsaved(() => fieldsFingerprint(form) !== start);
  }, [trackUnsaved, onDirtyChange]);
  // Klik na štítek přehledu zúží řádky na danou kategorii (F08), druhý klik filtr zruší. Skryté řádky zůstávají
  // ve formuláři, takže se jejich úpravy uloží i odešlou stejně jako dřív.
  const [rowFilter, setRowFilter] = useState<OverviewKey | null>(null);
  const shown = (d: MonthDraft) => !rowFilter || matchesOverview(rowFilter, rowState(d));
  const pickFilter = (key: OverviewKey, id: string) => {
    if (rowFilter === key) {
      setRowFilter(null);
      return;
    }
    setRowFilter(key);
    // Fokus až po překreslení: řádek, na který se skáče, musí být vidět.
    requestAnimationFrame(() => jump(key, id));
  };
  const jump = (key: OverviewKey, id: string) => {
    const form = formRef.current;
    if (!form) return;
    const name = key === "missingLead" ? `lead-${id}` : key === "missingTopic" ? `topic-${id}` : null;
    const target = name
      ? form.elements.namedItem(name)
      : form.querySelector(`input[name="pick"][value="${CSS.escape(id)}"]`);
    if (!(target instanceof HTMLElement)) return;
    target.scrollIntoView({ block: "center" });
    target.focus({ preventScroll: true });
  };

  // Hromadné doplnění vedoucího jen do prázdných polí. Zapisuje do formuláře, uloží se až Uložit změny
  // nebo Zveřejnit (server vedoucího ověří stejně jako při ruční volbě).
  const [bulkLead, setBulkLead] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const leadTargets = rowsMissingLead(rows).length;
  const fillLeads = () => {
    const form = formRef.current;
    if (!form || !bulkLead) return;
    const field = (id: string) => form.elements.namedItem(`lead-${id}`);
    const leads = Object.fromEntries(drafts.map((d) => [d.id, (field(d.id) as HTMLSelectElement | null)?.value ?? ""]));
    const holidays = new Set(drafts.filter((d) => d.type === "holiday").map((d) => d.id));
    const { filled } = fillEmptyLeads(leads, bulkLead, holidays);
    for (const id of filled) {
      const select = field(id);
      if (select instanceof HTMLSelectElement) select.value = bulkLead;
    }
    readFilled(form);
    const who = people.find((p) => p.id === bulkLead)?.name ?? "";
    setBulkNote(
      filled.length
        ? `Vedoucí ${who} doplněn do ${plural(filled.length, "řádku", "řádků", "řádků")}. Zatím neuloženo, ulož změny.`
        : "Všechny řádky už vedoucího mají, nic se nezměnilo.",
    );
  };
  // Hromadné doplnění tématu (F08): stejné pravidlo jako u vedoucího, jen do prázdných polí.
  const [bulkTopic, setBulkTopic] = useState("");
  const topicTargets = rowsMissingTopic(rows).length;
  const fillTopics = () => {
    const form = formRef.current;
    if (!form || !bulkTopic) return;
    const field = (id: string) => form.elements.namedItem(`topic-${id}`);
    const values = Object.fromEntries(drafts.map((d) => [d.id, (field(d.id) as HTMLInputElement | null)?.value ?? ""]));
    const holidays = new Set(drafts.filter((d) => d.type === "holiday").map((d) => d.id));
    const { filled } = fillEmptyTopics(values, bulkTopic, holidays);
    for (const id of filled) {
      const input = field(id);
      if (input instanceof HTMLInputElement) input.value = bulkTopic;
    }
    readFilled(form);
    setBulkNote(
      filled.length
        ? `Téma ${bulkTopic} doplněno do ${plural(filled.length, "řádku", "řádků", "řádků")}. Zatím neuloženo, ulož změny.`
        : "Všechny řádky už téma mají, nic se nezměnilo.",
    );
  };
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const blockedReason = publishBlockedReason(rows, allowIncomplete);
  const audiences = [...new Set(chosen.map((d) => current(d).audience))];

  // Ruční datum zůstává v připravovaném měsíci a ne v minulosti (server to hlídá znovu).
  const monthStart = `${monthKey}-01`;
  const minDate = todayKey > monthStart ? todayKey : monthStart;
  const maxDate = addDays(`${shiftMonth(monthKey, 1)}-01`, -1);

  const group = (title: string, list: MonthDraft[]) => {
    const visible = list.filter(shown);
    if (!visible.length) return null;
    // Vybrat vše platí pro řádky, které správce právě vidí (i ve filtru přehledu).
    const ids = visible.map((d) => d.id);
    const all = ids.every((id) => picked.has(id));
    return (
      <fieldset className="publish-group">
        <legend className="publish-group-head">
          <span className="item-title">
            {title} <span className="muted">({visible.length < list.length ? `${visible.length} z ${list.length}` : list.length})</span>
          </span>
          <button type="button" className="btn btn-small" onClick={() => setGroup(ids, !all)}>
            {all ? "Zrušit výběr" : "Vybrat vše"}
          </button>
        </legend>
        {/* Záhlaví sloupců jen pro oko; každé pole má vlastní přístupný popisek (Datum: …, Pro koho: …). */}
        <div className="publish-head" aria-hidden="true">
          <span>Návrh</span>
          <span>Datum</span>
          <span>Pro koho</span>
          <span>Téma</span>
          <span>Vedoucí</span>
        </div>
        <ul className="publish-list">
          {list.map((d) => {
            const start = new Date(d.startsAt);
            const dateKey = toDateKey(start);
            const name = `${d.label} ${formatDayMonth(dateKey)}`;
            return (
              <li key={d.id} className="publish-row" data-picked={picked.has(d.id)} data-draft={d.id} hidden={!shown(d)}>
                <label className="publish-pick">
                  <input type="checkbox" name="pick" value={d.id} checked={picked.has(d.id)} onChange={(e) => toggle(d.id, e.target.checked)} />
                  <span className="publish-main">
                    <span className="item-title">{d.label}</span>
                    <span className="item-meta">
                      {weekdayShort(dateKey)} {formatDayMonth(dateKey)} · {formatEventTime(start, new Date(d.endsAt), false)}
                    </span>
                    {missing(d).length > 0 && <span className="publish-gap">Chybí {missing(d).join(" a ")}</span>}
                    {d.clash && (
                      <span className="publish-clash">
                        <ClashText kind={d.clash} other={d.clashWith} />
                      </span>
                    )}
                  </span>
                </label>
                <input type="hidden" name="row" value={d.id} />
                <input type="hidden" name={`rev-${d.id}`} value={d.revision} />
                <input className="input" type="date" name={`date-${d.id}`} defaultValue={dateKey} min={minDate} max={maxDate} aria-label={`Datum: ${name}`} required />
                <select className="select" name={`aud-${d.id}`} defaultValue={d.audience} aria-label={`Pro koho: ${name}`}>
                  {audienceOptions(d.audience).map((g) => (
                    <option key={g} value={g}>
                      {GROUP_LABELS[g]}
                    </option>
                  ))}
                </select>
                <Combobox
                  name={`topic-${d.id}`}
                  defaultValue={d.topicTitle ?? ""}
                  options={topicOptions}
                  listLabel="Témata"
                  placeholder="Téma"
                  maxLength={120}
                  inputProps={{
                    "aria-label": `Téma: ${name}`,
                    "aria-describedby": suggested(d) ? `suggest-${d.id}` : undefined,
                    "data-suggested": suggested(d) || undefined,
                  }}
                />
                <select className="select" name={`lead-${d.id}`} defaultValue={d.leadId ?? ""} aria-label={`Vedoucí: ${name}`}>
                  <option value="">Bez vedoucího</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {suggested(d) && (
                  <div className="topic-suggestion" id={`suggest-${d.id}`}>
                    <span className="topic-suggestion-text">
                      <span className="topic-suggestion-tag">✦ Doporučeno</span> {d.topicTitle}
                      <span className="small muted"> · {d.suggestion}</span>
                    </span>
                    <span className="topic-suggestion-actions">
                      <button type="submit" name="topicDecision" value={`accept:${d.id}`} className="btn btn-small btn-primary" disabled={pending} {...lock} aria-label={`Přijmout doporučené téma: ${name}`}>
                        Přijmout
                      </button>
                      <button type="button" className="btn btn-small btn-quiet" onClick={(e) => changeTopic(e, d.id)} aria-label={`Změnit téma: ${name}`}>
                        Změnit
                      </button>
                      <button type="submit" name="topicDecision" value={`reject:${d.id}`} className="btn btn-small btn-quiet" disabled={pending} {...lock} aria-label={`Odmítnout doporučené téma: ${name}`}>
                        Odmítnout
                      </button>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>
    );
  };

  // Bez návrhů průvodce ukáže i další kroky dopředu (F07), zatím jako náhled. Zavírá se jen tlačítkem v záhlaví.
  if (!drafts.length) {
    return (
      <>
        <section className="prepare-step" aria-labelledby="prepare-gaps" data-upcoming>
          <h3 id="prepare-gaps">
            <span className="step-no">2</span> Zkontrolovat
          </h3>
          <p className="hint">Po doplnění termínů tu u každého návrhu nastavíš pro koho, téma a vedoucího, i hromadně.</p>
          {changeDrafts > 0 && <ChangeDraftsNote count={changeDrafts} />}
        </section>
        <section className="prepare-step" aria-labelledby="prepare-publish" data-upcoming>
          <h3 id="prepare-publish">
            <span className="step-no">3</span> Zveřejnit
          </h3>
          <p className="hint">Vybrané návrhy zveřejníš najednou. Kolegové je uvidí až potom.</p>
        </section>
        {state && <ActionMessage state={state} />}
      </>
    );
  }

  return (
    <form ref={formRef} action={action} onSubmit={submitKeepingValues(action)} onKeyDown={ignoreEnter} onInput={readOnInput} onChange={(e) => readFilled(e.currentTarget)} className="stack">
      <input type="hidden" name="month" value={monthKey} />
      <section className="prepare-step" aria-labelledby="prepare-gaps">
        <h3 id="prepare-gaps">
          <span className="step-no">2</span> Zkontrolovat
        </h3>
        <PrepareOverview items={overview} active={rowFilter} onPick={pickFilter} />
        {rowFilter && (
          <p className="small prepare-filter-note" role="status">
            Zobrazeny jen řádky: {OVERVIEW_LABELS[rowFilter]}.{" "}
            <button type="button" className="link-button" onClick={() => setRowFilter(null)}>
              Zobrazit všechny řádky
            </button>
          </p>
        )}
        <div className="prepare-bulk" role="group" aria-labelledby="prepare-bulk-title">
          <span className="prepare-tool-title" id="prepare-bulk-title">
            Hromadně doplnit téma a vedoucího
          </span>
          <label className="field">
            <span className="field-label">Téma do prázdných polí</span>
            {/* Stejně jako volba vedoucího: neodesílá se a sama o sobě není rozepsaná změna. */}
            <select className="select" value={bulkTopic} onChange={(e) => setBulkTopic(e.target.value)} data-unsaved-ignore aria-describedby="prepare-bulk-hint">
              <option value="">Vyber téma</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={fillTopics} disabled={!bulkTopic || topicTargets === 0}>
            {topicTargets ? `Doplnit téma do ${plural(topicTargets, "řádku", "řádků", "řádků")}` : "Doplnit téma"}
          </button>
          <label className="field">
            <span className="field-label">Vedoucí do prázdných polí</span>
            {/* Pomocná volba bez jména: neodesílá se a sama o sobě není rozepsaná změna (Modal). */}
            <select className="select" value={bulkLead} onChange={(e) => setBulkLead(e.target.value)} data-unsaved-ignore aria-describedby="prepare-bulk-hint">
              <option value="">Vyber vedoucího</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={fillLeads} disabled={!bulkLead || leadTargets === 0}>
            {leadTargets ? `Doplnit do ${plural(leadTargets, "řádku", "řádků", "řádků")}` : "Doplnit"}
          </button>
          <p className="field-hint field-hint-key" id="prepare-bulk-hint">
            {leadTargets
              ? `Doplní se jen ${plural(leadTargets, "řádek", "řádky", "řádků")} bez vedoucího, vyplněné vedoucí se nepřepíšou.`
              : "Všechny návrhy už vedoucího mají."}{" "}
            {topicTargets ? `Téma se doplní jen do ${plural(topicTargets, "prázdného pole", "prázdných polí", "prázdných polí")}.` : "Všechny návrhy už téma mají."}
          </p>
          <p className="small prepare-bulk-note" role="status">
            {bulkNote}
          </p>
        </div>
        {group("Pravidelné termíny", templateDrafts)}
        {group("Další návrhy", extraDrafts)}
        {changeDrafts > 0 && <ChangeDraftsNote count={changeDrafts} />}
      </section>
      <section className="prepare-step" aria-labelledby="prepare-publish">
        <h3 id="prepare-publish">
          <span className="step-no">3</span> Zveřejnit
        </h3>
        {/* Počet vybraných a připravenost jsou dvě různé informace: výběr říká co, stav říká, zda to jde hned. */}
        <div className="publish-impact" role="status" data-empty={chosen.length === 0 || undefined}>
          {chosen.length ? (
            <>
              <span className="publish-impact-count">
                Vybráno ke zveřejnění: <strong>{chosen.length}</strong> z {plural(drafts.length, "návrhu", "návrhů", "návrhů")}
              </span>
              <span className="publish-impact-state" data-state={incomplete ? "incomplete" : "ready"}>
                {incomplete ? `${plural(incomplete, "termín je neúplný", "termíny jsou neúplné", "termínů je neúplných")} (chybí téma nebo vedoucí)` : "Vše vybrané je připravené"}
              </span>
              <span className="small muted">{publishInviteNote(inviteMode, audiences, recipients)}</span>
            </>
          ) : (
            "Ke zveřejnění není vybraný žádný návrh."
          )}
        </div>
        {incomplete > 0 && (
          <label className="check">
            {/* Hodnota je počet, který správce potvrzuje. Server zveřejnění odmítne, když nesedí. */}
            <input type="checkbox" name="allowIncomplete" value={incomplete} checked={allowIncomplete} onChange={(e) => setAllowIncomplete(e.target.checked)} />
            <span>
              Zveřejnit i {plural(incomplete, "termín", "termíny", "termínů")} bez tématu nebo vedoucího.
            </span>
          </label>
        )}
      </section>
      {state && <ActionMessage state={state} />}
      <div className="dialog-actions">
        {/* Šedé Zveřejnit vždy říká proč (F09), přímo nad tlačítky, ať je to vidět i v posunutém okně. */}
        {blockedReason && (
          <p className="field-hint prepare-publish-why" id="prepare-publish-why">
            {blockedReason}
          </p>
        )}
        <button
          type="submit"
          name="intent"
          value="publish"
          className="btn btn-primary"
          disabled={pending || blockedReason !== null}
          {...lock}
          aria-describedby={blockedReason ? "prepare-publish-why" : undefined}
        >
          {chosen.length ? `Zveřejnit ${plural(chosen.length, "akci", "akce", "akcí")}` : "Zveřejnit"}
        </button>
        <button type="submit" name="intent" value="save" className="btn" disabled={pending} {...lock}>
          Uložit změny
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Zrušit úpravy
        </button>
      </div>
    </form>
  );
}

/** Enter v poli formulář neodešle: první tlačítko je Zveřejnit a to musí být vždy vědomá volba. */
function ignoreEnter(event: React.KeyboardEvent<HTMLFormElement>) {
  const target = event.target as HTMLElement;
  if (event.key === "Enter" && target instanceof HTMLInputElement) event.preventDefault();
}

const OVERVIEW_LABELS: Record<OverviewKey, string> = {
  ready: "Připraveno",
  missingLead: "Chybí vedoucí",
  missingTopic: "Chybí téma",
  clash: "Kolize",
  picked: "Vybráno",
};

/**
 * Přehled stavu návrhů nad řádky. Každá kategorie s aspoň jedním řádkem je přepínač: zúží řádky na tuto
 * kategorii a dá fokus na pole prvního z nich, které je potřeba doplnit. Druhý klik filtr zruší.
 */
function PrepareOverview({
  items,
  active,
  onPick,
}: {
  items: Array<{ key: OverviewKey; count: number; firstId: string | null }>;
  active: OverviewKey | null;
  onPick: (key: OverviewKey, id: string) => void;
}) {
  return (
    <ul className="prepare-overview" aria-label="Stav návrhů">
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            className="btn btn-small prepare-overview-item"
            data-kind={item.key}
            // Aktivní filtr jde zrušit i ve chvíli, kdy v kategorii už nic nezbylo (třeba po doplnění).
            disabled={!item.firstId && active !== item.key}
            aria-pressed={active === item.key}
            onClick={() => onPick(item.key, item.firstId ?? "")}
            aria-label={`${OVERVIEW_LABELS[item.key]}: ${item.count}${item.firstId ? ", zobrazit jen tyto řádky" : ""}`}
          >
            {OVERVIEW_LABELS[item.key]} <strong>{item.count}</strong>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Vysvětlení kolize: s jakou akcí a kdy se návrh kryje a co s tím. Zveřejnění kolize neblokuje
 * (paralelní akce můžou být záměr), správce ale musí vědět, kterou akci zkontrolovat.
 */
function ClashText({ kind, other }: { kind: "group" | "shared"; other: MonthDraft["clashWith"] }) {
  const what = other ? (
    <>
      {" "}
      „{other.label}“ ({weekdayShort(toDateKey(new Date(other.startsAt)))} {formatDayMonth(toDateKey(new Date(other.startsAt)))} ·{" "}
      {formatEventTime(new Date(other.startsAt), new Date(other.endsAt), false)})
    </>
  ) : (
    " jinou akci"
  );
  return kind === "group" ? (
    <>Kolize: stejná skupina má ve stejný čas{what}. Posuň datum nebo změň skupinu, jinak proběhnou obě akce souběžně.</>
  ) : (
    <>Ke kontrole: stejní lidé mají ve stejný den nebo čas{what}. Zveřejnit jde, jen ověř, že se akce nevylučují.</>
  );
}

function ChangeDraftsNote({ count }: { count: number }) {
  return (
    <p className="hint">
      Návrhy změn zveřejněných akcí ({count}) se zveřejňují přímo u akce.
    </p>
  );
}
