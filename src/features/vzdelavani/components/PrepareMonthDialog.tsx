"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { ActionForm, ActionMessage } from "@/components/ActionForm";
import { Combobox } from "@/components/Combobox";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import { publishInviteNote, type InviteMode } from "@/lib/invite-mode";
import { GROUP_LABELS } from "@/lib/labels";
import { addDays, formatDayMonth, formatEventTime, shiftMonth, toDateKey, weekdayShort } from "@/lib/time";
import type { Group } from "@/lib/types";
import type { MonthDraft } from "@/server/services/events";
import { generateMonthAction, publishMonthAction, type ActionResult } from "../actions";
import { audienceOptions, draftGaps, fillEmptyLeads, prepareOverview, rowsMissingLead, type DraftRowState, type OverviewKey } from "../prepare-month";
import { TemplateDialog, type SlotValue } from "./TemplateDialog";

/** Jak se zveřejnění propíše do Kalendáře. Určuje jen text přehledu dopadu. */

type Props = {
  monthKey: string;
  monthName: string;
  todayKey: string;
  drafts: MonthDraft[];
  /** Návrhy změn už zveřejněných akcí. Hromadně se nezveřejňují. */
  changeDrafts: number;
  people: Array<{ id: string; name: string }>;
  topics: string[];
  recipients: Record<Group, Array<{ email: string; name: string }>>;
  inviteMode: InviteMode;
  /** Pravidelný rozvrh, ze kterého se termíny doplňují. Upravuje se odsud. */
  template: SlotValue[];
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

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Připravit měsíc
        {props.drafts.length > 0 && (
          <span className="count-badge" aria-label={plural(props.drafts.length, "návrh", "návrhy", "návrhů")}>
            {props.drafts.length}
          </span>
        )}
      </button>
      {!open && state?.ok && <ActionMessage state={state} />}
      <Modal open={open} title={`Připravit měsíc: ${props.monthName}`} onRequestClose={() => setOpen(false)} wide="extra">
        <div className="stack">
          <section className="prepare-step" aria-labelledby="prepare-fill">
            <h3 id="prepare-fill">
              <span className="step-no">1</span> Doplnit termíny
            </h3>
            <p className="hint">Doplní návrhy podle pravidelného rozvrhu, nic nezveřejní.</p>
            <div className="row prepare-fill">
              <ActionForm action={generateMonthAction} fields={{ month: props.monthKey }} label="Doplnit chybějící termíny" pendingLabel="Doplňuji…" />
              <TemplateDialog slots={props.template} />
            </div>
          </section>
          <MonthDraftsForm key={draftsKey} {...props} action={action} pending={pending} state={state} onCancel={() => setOpen(false)} />
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
};

/**
 * Návrhy měsíce. Předvybraný ke zveřejnění je základ ze šablony, návrhy přidané navíc si správce zaškrtne
 * sám. „Uložit změny“ uloží úpravy všech řádků a nic neodešle, „Zveřejnit“ vydá jen vybrané.
 */
function MonthDraftsForm({ monthKey, todayKey, drafts, changeDrafts, people, topics, recipients, inviteMode, action, pending, state, onCancel }: FormProps) {
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
  const readFilled = (form: HTMLFormElement) => {
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
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const audiences = [...new Set(chosen.map((d) => current(d).audience))];

  // Ruční datum zůstává v připravovaném měsíci a ne v minulosti (server to hlídá znovu).
  const monthStart = `${monthKey}-01`;
  const minDate = todayKey > monthStart ? todayKey : monthStart;
  const maxDate = addDays(`${shiftMonth(monthKey, 1)}-01`, -1);

  const group = (title: string, list: MonthDraft[]) => {
    if (!list.length) return null;
    const ids = list.map((d) => d.id);
    const all = ids.every((id) => picked.has(id));
    return (
      <fieldset className="publish-group">
        <legend className="publish-group-head">
          <span className="item-title">
            {title} <span className="muted">({list.length})</span>
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
              <li key={d.id} className="publish-row" data-picked={picked.has(d.id)} data-draft={d.id}>
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
                        {d.clash === "group" ? "Stejná skupina má ve stejný čas jinou akci" : "Stejní lidé mají ve stejný den nebo čas jinou akci"}
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
                      <button type="submit" name="topicDecision" value={`accept:${d.id}`} className="btn btn-small btn-primary" disabled={pending} aria-label={`Přijmout doporučené téma: ${name}`}>
                        Přijmout
                      </button>
                      <button type="button" className="btn btn-small btn-quiet" onClick={(e) => changeTopic(e, d.id)} aria-label={`Změnit téma: ${name}`}>
                        Změnit
                      </button>
                      <button type="submit" name="topicDecision" value={`reject:${d.id}`} className="btn btn-small btn-quiet" disabled={pending} aria-label={`Odmítnout doporučené téma: ${name}`}>
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

  if (!drafts.length) {
    return (
      <>
        <p className="muted">V tomto měsíci nejsou žádné návrhy.</p>
        {changeDrafts > 0 && <ChangeDraftsNote count={changeDrafts} />}
        {state && <ActionMessage state={state} />}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Zavřít
          </button>
        </div>
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
        <PrepareOverview items={overview} onJump={jump} />
        <div className="prepare-bulk" role="group" aria-labelledby="prepare-bulk-title">
          <span className="prepare-tool-title" id="prepare-bulk-title">
            Hromadně doplnit vedoucího
          </span>
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
              : "Všechny návrhy už vedoucího mají."}
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
        <button type="submit" name="intent" value="publish" className="btn btn-primary" disabled={pending || chosen.length === 0 || (incomplete > 0 && !allowIncomplete)}>
          {chosen.length ? `Zveřejnit ${plural(chosen.length, "akci", "akce", "akcí")}` : "Zveřejnit"}
        </button>
        <button type="submit" name="intent" value="save" className="btn" disabled={pending}>
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
 * Přehled stavu návrhů nad řádky. Každá kategorie s aspoň jedním řádkem je tlačítko, které posune okno na
 * první dotčený řádek a dá fokus na pole, které je potřeba doplnit.
 */
function PrepareOverview({ items, onJump }: { items: Array<{ key: OverviewKey; count: number; firstId: string | null }>; onJump: (key: OverviewKey, id: string) => void }) {
  return (
    <ul className="prepare-overview" aria-label="Stav návrhů">
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            className="btn btn-small prepare-overview-item"
            data-kind={item.key}
            disabled={!item.firstId}
            onClick={() => item.firstId && onJump(item.key, item.firstId)}
            aria-label={`${OVERVIEW_LABELS[item.key]}: ${item.count}${item.firstId ? ", přejít na první řádek" : ""}`}
          >
            {OVERVIEW_LABELS[item.key]} <strong>{item.count}</strong>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChangeDraftsNote({ count }: { count: number }) {
  return (
    <p className="hint">
      Návrhy změn zveřejněných akcí ({count}) se zveřejňují přímo u akce.
    </p>
  );
}
