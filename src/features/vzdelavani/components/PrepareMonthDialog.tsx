"use client";

import { useActionState, useState } from "react";
import { ActionForm, ActionMessage } from "@/components/ActionForm";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import type { InviteMode } from "@/lib/invite-mode";
import { GROUP_LABELS } from "@/lib/labels";
import { addDays, formatDayMonth, formatEventTime, shiftMonth, toDateKey, weekdayShort } from "@/lib/time";
import { GROUPS, type Group } from "@/lib/types";
import type { MonthDraft } from "@/server/services/events";
import { generateMonthAction, publishMonthAction, type ActionResult } from "../actions";
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
  /** Pravidelný týden, ze kterého se termíny doplňují. Upravuje se odsud. */
  template: SlotValue[];
};

const plural = (count: number, one: string, few: string, many: string) => `${count} ${count === 1 ? one : count >= 2 && count <= 4 ? few : many}`;

/**
 * Okno Připravit měsíc: doplnění termínů ze šablony, mezery, úprava návrhů (datum, skupina, téma,
 * vedoucí), stav párování zveřejněných akcí a nakonec uložení nebo zveřejnění. Tlačítko vidí správce
 * vždy, i v měsíci bez návrhů.
 */
export function PrepareMonthDialog(props: Props) {
  const [open, setOpen] = useState(false);
  // Výsledek akce drží obal: po uložení se stránka obnoví a formulář s novými verzemi návrhů se založí znovu.
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await publishMonthAction(prev, formData);
    if (result.ok && formData.get("intent") !== "save") setOpen(false);
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
            <h3 id="prepare-fill">1. Doplnit termíny</h3>
            <p className="hint">Přidá návrhy na volná místa podle pravidelného týdne. Nic se nezveřejní.</p>
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

  // Pole řádků jsou neřízená, mezery a publikum se proto čtou z formuláře.
  type Filled = { topic: boolean; lead: boolean; audience: Group };
  const [filled, setFilled] = useState<Record<string, Filled>>({});
  const readFilled = (form: HTMLFormElement) => {
    const data = new FormData(form);
    setFilled(
      Object.fromEntries(
        drafts.map((d) => [
          d.id,
          {
            topic: Boolean(String(data.get(`topic-${d.id}`) ?? "").trim()),
            lead: Boolean(data.get(`lead-${d.id}`)),
            audience: (data.get(`aud-${d.id}`) as Group | null) ?? d.audience,
          },
        ]),
      ),
    );
  };
  const current = (d: MonthDraft): Filled => filled[d.id] ?? { topic: Boolean(d.topicTitle), lead: Boolean(d.leadId), audience: d.audience };
  const missing = (d: MonthDraft) => {
    if (d.type === "holiday") return [];
    const f = current(d);
    return [!f.topic && "téma", !f.lead && "vedoucí"].filter((g): g is string => Boolean(g));
  };

  const chosen = drafts.filter((d) => picked.has(d.id));
  const incomplete = chosen.filter((d) => missing(d).length > 0).length;
  const gapCount = drafts.filter((d) => missing(d).length > 0).length;
  const clashCount = drafts.filter((d) => d.clash).length;
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const audiences = [...new Set(chosen.map((d) => current(d).audience))];
  const invited = new Set(audiences.flatMap((g) => recipients[g].map((r) => r.email)));

  // Ruční datum zůstává v připravovaném měsíci a ne v minulosti (server to hlídá znovu).
  const monthStart = `${monthKey}-01`;
  const minDate = todayKey > monthStart ? todayKey : monthStart;
  const maxDate = addDays(`${shiftMonth(monthKey, 1)}-01`, -1);

  const group = (title: string, hint: string, list: MonthDraft[]) => {
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
        <p className="hint">{hint}</p>
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
                <select className="select" name={`aud-${d.id}`} defaultValue={d.audience} aria-label={`Skupina: ${name}`}>
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {GROUP_LABELS[g]}
                    </option>
                  ))}
                </select>
                <input className="input" name={`topic-${d.id}`} defaultValue={d.topicTitle ?? ""} placeholder="Téma" aria-label={`Téma: ${name}`} list="publish-topics" maxLength={120} />
                <select className="select" name={`lead-${d.id}`} defaultValue={d.leadId ?? ""} aria-label={`Vedoucí: ${name}`}>
                  <option value="">Bez vedoucího</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
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
        <p className="muted">V tomto měsíci nejsou žádné návrhy. Doplňte chybějící termíny, nebo přidejte akci.</p>
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
    <form action={action} onSubmit={submitKeepingValues(action)} onKeyDown={ignoreEnter} onInput={(e) => readFilled(e.currentTarget)} onChange={(e) => readFilled(e.currentTarget)} className="stack">
      <input type="hidden" name="month" value={monthKey} />
      <datalist id="publish-topics">
        {topics.map((topic) => (
          <option key={topic} value={topic} />
        ))}
      </datalist>
      <section className="prepare-step" aria-labelledby="prepare-gaps">
        <h3 id="prepare-gaps">2. Zkontrolovat</h3>
        <p className="small">
          {gapCount === 0
            ? "Všechny návrhy mají téma i vedoucího."
            : `${plural(gapCount, "návrh nemá", "návrhy nemají", "návrhů nemá")} téma nebo vedoucího. Doplňte je u termínu, nebo zveřejněte bez nich.`}
          {clashCount > 0 &&
            ` ${plural(clashCount, "návrh se kryje", "návrhy se kryjí", "návrhů se kryje")} s jinou akcí. Posuňte datum, změňte skupinu, nebo ho nezveřejňujte.`}
        </p>
        {group("Pravidelné termíny", "Předvybrané ke zveřejnění. Datum, skupinu, téma i vedoucího můžete změnit.", drafts.filter((d) => d.fromTemplate))}
        {group("Další návrhy", "Zveřejní se jen ty, které zaškrtnete.", drafts.filter((d) => !d.fromTemplate))}
        {changeDrafts > 0 && <ChangeDraftsNote count={changeDrafts} />}
      </section>
      <section className="prepare-step" aria-labelledby="prepare-publish">
        <h3 id="prepare-publish">3. Zveřejnit</h3>
        <div className="publish-impact" role="status">
          <strong>
            {chosen.length
              ? `Ke zveřejnění ${chosen.length} z ${plural(drafts.length, "návrhu", "návrhů", "návrhů")}${incomplete ? ` · ${plural(incomplete, "neúplný", "neúplné", "neúplných")}` : ""}`
              : "Ke zveřejnění není vybraný žádný návrh"}
          </strong>
          <span className="small">
            Uložení změn nic neodešle.{" "}
            {chosen.length > 0 && inviteMode === "simulation" && "Zveřejnění je simulace, skutečné e-maily se neodesílají."}
            {chosen.length > 0 && inviteMode === "disconnected" && "Zveřejněné akce se vydají ve Wiki, pozvánky čekají na propojení Kalendáře."}
            {chosen.length > 0 && inviteMode === "allowlist" && `Pozvánky půjdou jen na testovací adresu (${[...invited].join(", ") || "žádná"}), kolegům zatím ne.`}
            {chosen.length > 0 &&
              inviteMode === "audience" &&
              `Po zveřejnění dostane e-mail s pozvánkou od Googlu ${plural(invited.size, "člověk", "lidé", "lidí")}: ${audiences.map((g) => `${GROUP_LABELS[g]} (${recipients[g].length})`).join(", ")}.`}
          </span>
        </div>
        {incomplete > 0 && (
          <label className="check">
            {/* Hodnota je počet, který správce potvrzuje. Server zveřejnění odmítne, když nesedí. */}
            <input type="checkbox" name="allowIncomplete" value={incomplete} checked={allowIncomplete} onChange={(e) => setAllowIncomplete(e.target.checked)} />
            <span>
              Zveřejnit i {plural(incomplete, "termín", "termíny", "termínů")} bez tématu nebo vedoucího. Pozvánky se odešlou až po zveřejnění, téma a vedoucího jde
              doplnit později.
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
          Zrušit
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

function ChangeDraftsNote({ count }: { count: number }) {
  return (
    <p className="hint">
      {plural(count, "návrh změny", "návrhy změn", "návrhů změn")} u už zveřejněných akcí tu není. Mění platnou pozvánku, proto se zveřejňují
      jednotlivě u akce.
    </p>
  );
}
