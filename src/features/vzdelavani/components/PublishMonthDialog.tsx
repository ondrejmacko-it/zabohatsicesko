"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDayMonth, formatEventTime, toDateKey, weekdayShort } from "@/lib/time";
import type { Group } from "@/lib/types";
import type { MonthDraft } from "@/server/services/events";
import { publishMonthAction, type ActionResult } from "../actions";

/** Jak se zveřejnění propíše do Kalendáře. Určuje jen text přehledu dopadu. */
export type InviteMode = "simulation" | "allowlist" | "audience" | "disconnected";

type Props = {
  monthKey: string;
  monthName: string;
  drafts: MonthDraft[];
  /** Návrhy změn už zveřejněných akcí. Hromadně se nezveřejňují. */
  changeDrafts: number;
  people: Array<{ id: string; name: string }>;
  topics: string[];
  recipients: Record<Group, Array<{ email: string; name: string }>>;
  inviteMode: InviteMode;
};

const plural = (count: number, one: string, few: string, many: string) => `${count} ${count === 1 ? one : count >= 2 && count <= 4 ? few : many}`;

/**
 * Zveřejnění návrhů měsíce najednou. Předvybraný je základ ze šablony, návrhy přidané navíc si správce
 * zaškrtne sám. Téma a vedoucího jde doplnit přímo v řádku, takže není nutné otevírat každý návrh zvlášť.
 */
export function PublishMonthDialog({ monthKey, monthName, drafts, changeDrafts, people, topics, recipients, inviteMode }: Props) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(drafts.filter((d) => d.fromTemplate).map((d) => d.id)));
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await publishMonthAction(prev, formData);
    if (result.ok) setOpen(false);
    return result;
  }, null);

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

  const chosen = drafts.filter((d) => picked.has(d.id));
  const audiences = [...new Set(chosen.map((d) => d.audience))];
  const invited = new Set(audiences.flatMap((g) => recipients[g].map((r) => r.email)));

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
            return (
              <li key={d.id} className="publish-row" data-picked={picked.has(d.id)}>
                <label className="publish-pick">
                  <input type="checkbox" name="pick" value={d.id} checked={picked.has(d.id)} onChange={(e) => toggle(d.id, e.target.checked)} />
                  <span className="publish-main">
                    <span className="item-title">{d.label}</span>
                    <span className="item-meta">
                      {weekdayShort(dateKey)} {formatDayMonth(dateKey)} · {formatEventTime(start, new Date(d.endsAt), false)} · {GROUP_LABELS[d.audience]}
                    </span>
                  </span>
                </label>
                <input type="hidden" name={`rev-${d.id}`} value={d.revision} />
                <input
                  className="input"
                  name={`topic-${d.id}`}
                  defaultValue={d.topicTitle ?? ""}
                  placeholder="Téma (nepovinné)"
                  aria-label={`Téma: ${d.label} ${formatDayMonth(dateKey)}`}
                  list="publish-topics"
                  maxLength={120}
                />
                <select className="select" name={`lead-${d.id}`} defaultValue={d.leadId ?? ""} aria-label={`Vedoucí: ${d.label} ${formatDayMonth(dateKey)}`}>
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

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Zveřejnit návrhy <span className="count-badge">{drafts.length}</span>
      </button>
      {state?.ok && <ActionMessage state={state} />}
      <Modal open={open} title={`Zveřejnit návrhy: ${monthName}`} onRequestClose={() => setOpen(false)} wide>
        <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
          <input type="hidden" name="month" value={monthKey} />
          <datalist id="publish-topics">
            {topics.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="publish-impact" role="status">
            <strong>{chosen.length ? `Zveřejníte ${plural(chosen.length, "akci", "akce", "akcí")}` : "Není vybraný žádný návrh"}</strong>
            {chosen.length > 0 && (
              <span className="small">
                {inviteMode === "simulation" && "Ukázkový režim: žádné e-maily se neposílají, pozvánky dostanou jen fiktivní role."}
                {inviteMode === "disconnected" && "Kalendář není propojený. Akce budou vidět ve Wiki, pozvánky odejdou po propojení."}
                {inviteMode === "allowlist" && `Pozvánky půjdou jen na testovací adresu (${[...invited].join(", ") || "žádná"}), kolegům zatím ne.`}
                {inviteMode === "audience" &&
                  `E-mail s pozvánkou od Googlu dostane ${plural(invited.size, "člověk", "lidé", "lidí")}: ${audiences.map((g) => `${GROUP_LABELS[g]} (${recipients[g].length})`).join(", ")}.`}
              </span>
            )}
          </div>
          {group("Základ měsíce ze šablony", "Pravidelné termíny. Jsou předvybrané, téma a vedoucího můžete doplnit hned tady nebo později.", drafts.filter((d) => d.fromTemplate))}
          {group("Návrhy přidané navíc", "Akce mimo šablonu. Zveřejní se jen ty, které zaškrtnete.", drafts.filter((d) => !d.fromTemplate))}
          {changeDrafts > 0 && (
            <p className="hint">
              {plural(changeDrafts, "návrh změny", "návrhy změn", "návrhů změn")} u už zveřejněných akcí tu není. Mění platnou pozvánku, proto se
              zveřejňují jednotlivě u akce.
            </p>
          )}
          {state && !state.ok && <ActionMessage state={state} />}
          <div className="dialog-actions">
            <button type="submit" className="btn btn-primary" disabled={pending || chosen.length === 0}>
              {pending ? "Zveřejňuji…" : chosen.length ? `Zveřejnit ${plural(chosen.length, "akci", "akce", "akcí")}` : "Zveřejnit"}
            </button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Zrušit
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
