"use client";

import { useState } from "react";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDayMonth, formatEventTime, toDateKey, weekdayShort } from "@/lib/time";
import type { Group } from "@/lib/types";
import type { InviteMode } from "@/server/services/calendar-status";
import type { MonthDraft } from "@/server/services/events";

// Společné části oken, která zveřejňují návrhy měsíce: hromadné zveřejnění a průvodce „Připravit další měsíc“.

export type Recipients = Record<Group, Array<{ email: string; name: string }>>;
export type DraftTopicHint = { name: string; interestCount: number };

export const plural = (count: number, one: string, few: string, many: string) => `${count} ${count === 1 ? one : count >= 2 && count <= 4 ? few : many}`;

/** Výběr návrhů. Předvybraný je základ ze šablony, návrhy přidané navíc si správce zaškrtne sám. */
export function usePickedDrafts(drafts: MonthDraft[]) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(drafts.filter((d) => d.fromTemplate).map((d) => d.id)));
  const set = (ids: string[], on: boolean) =>
    setPicked((before) => {
      const next = new Set(before);
      for (const id of ids) if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  return { picked, set, reset: (list: MonthDraft[]) => setPicked(new Set(list.filter((d) => d.fromTemplate).map((d) => d.id))) };
}

type GroupsProps = {
  drafts: MonthDraft[];
  picked: Set<string>;
  onPick: (ids: string[], on: boolean) => void;
  people: Array<{ id: string; name: string }>;
  /** Doporučené téma pro návrh bez tématu (klíč je ID návrhu). Předvyplní pole a ukáže počet zájemců. */
  suggestions?: Record<string, DraftTopicHint>;
  /** Zájem o témata podle názvu, pro poznámku u už vyplněného tématu. */
  interest?: Record<string, number>;
};

const interested = (count: number) => plural(count, "zájemce", "zájemci", "zájemců");

/** Řádky návrhů ve dvou skupinách. Téma a vedoucího jde doplnit přímo v řádku. Pole patří do formuláře rodiče. */
export function DraftGroups({ drafts, picked, onPick, people, suggestions = {}, interest = {} }: GroupsProps) {
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
          <button type="button" className="btn btn-small" onClick={() => onPick(ids, !all)}>
            {all ? "Zrušit výběr" : "Vybrat vše"}
          </button>
        </legend>
        <p className="hint">{hint}</p>
        <ul className="publish-list">
          {list.map((d) => {
            const start = new Date(d.startsAt);
            const dateKey = toDateKey(start);
            const suggestion = d.topicTitle ? null : suggestions[d.id];
            const count = suggestion?.interestCount ?? (d.topicTitle ? interest[d.topicTitle] : 0) ?? 0;
            return (
              <li key={d.id} className="publish-row" data-picked={picked.has(d.id)}>
                <label className="publish-pick">
                  <input type="checkbox" name="pick" value={d.id} checked={picked.has(d.id)} onChange={(e) => onPick([d.id], e.target.checked)} />
                  <span className="publish-main">
                    <span className="item-title">{d.label}</span>
                    <span className="item-meta">
                      {weekdayShort(dateKey)} {formatDayMonth(dateKey)} · {formatEventTime(start, new Date(d.endsAt), false)} · {GROUP_LABELS[d.audience]}
                      {count > 0 && <span className="publish-interest"> · téma chce {interested(count)}</span>}
                    </span>
                  </span>
                </label>
                <input type="hidden" name={`rev-${d.id}`} value={d.revision} />
                <input
                  className="input"
                  name={`topic-${d.id}`}
                  defaultValue={d.topicTitle ?? suggestion?.name ?? ""}
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
      {group("Základ měsíce ze šablony", "Pravidelné termíny. Jsou předvybrané, téma a vedoucího můžete doplnit hned tady nebo později.", drafts.filter((d) => d.fromTemplate))}
      {group("Návrhy přidané navíc", "Akce mimo šablonu. Zveřejní se jen ty, které zaškrtnete.", drafts.filter((d) => !d.fromTemplate))}
    </>
  );
}

/** Kolik akcí se zveřejní a kdo dostane pozvánku, podle režimu Kalendáře. */
export function PublishImpact({ chosen, recipients, inviteMode }: { chosen: MonthDraft[]; recipients: Recipients; inviteMode: InviteMode }) {
  const audiences = [...new Set(chosen.map((d) => d.audience))];
  const invited = new Set(audiences.flatMap((g) => recipients[g].map((r) => r.email)));
  return (
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
  );
}

/** Body bloku „Co se stane po kliknutí“ pro zveřejnění návrhů. */
export function publishConsequences(count: number, inviteMode: InviteMode): string[] {
  if (!count) return [];
  return [
    `Akce se objeví v Plánu všem, komu ${count === 1 ? "je určená" : "jsou určené"}.`,
    inviteMode === "audience"
      ? "Google každému pošle e-mail s pozvánkou do kalendáře."
      : inviteMode === "allowlist"
        ? "Pozvánka přijde jen na testovací adresu, kolegům zatím ne."
        : inviteMode === "disconnected"
          ? "Pozvánky neodejdou, dokud nepropojíte Kalendář."
          : "Je to ukázka: žádný skutečný e-mail neodejde.",
    "Termín, téma i vedoucího můžete změnit i potom. Účastníci dostanou upravenou pozvánku.",
  ];
}

export function TopicOptions({ topics }: { topics: string[] }) {
  return (
    <datalist id="publish-topics">
      {topics.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );
}
