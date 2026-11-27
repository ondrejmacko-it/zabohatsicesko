"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { ActionForm, ActionMessage } from "@/components/ActionForm";
import { flash } from "@/components/FlashMessage";
import { Icon } from "@/components/Icon";
import { Menu } from "@/components/Menu";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import { GROUP_LABELS, PREVIEW_READ_ONLY, eventContext } from "@/lib/labels";
import { formatDayMonth } from "@/lib/time";
import type { Group } from "@/lib/types";
import type { TopicPlanOptions } from "@/server/services/topics";
import {
  archiveTopicAction,
  assignTopicAction,
  moveTopicAction,
  proposeTopicAction,
  setTopicPriorityAction,
  toggleInterestAction,
  topicPlanOptionsAction,
  updateTopicAction,
  type ActionResult,
} from "../actions";
import { lockedProps, usePreviewLock } from "@/components/PreviewLock";

/**
 * Přepínač zájmu. Jeden uživatel = nejvýš jeden zájem o téma (hlídá server). Viditelný text i přístupný název
 * jsou stále „Mám zájem“, stav nese `aria-pressed` (a fajfka), název tématu se čte jako popis z nadpisu karty.
 */
export function InterestButton({ topicId, interested, titleId, locked = false }: { topicId: string; interested: boolean; titleId: string; locked?: boolean }) {
  const [state, action, pending] = useActionState(toggleInterestAction, null);
  const previewLocked = usePreviewLock();
  if (locked || previewLocked) {
    // Náhled: stejné tlačítko a stav zájmu jako u kolegy, jen zamčené (server změnu v náhledu stejně odmítne).
    return (
      <button type="button" className={interested ? "btn btn-small interest-btn interest-on" : "btn btn-small interest-btn"} aria-pressed={interested} aria-describedby={titleId} disabled title={PREVIEW_READ_ONLY}>
        <span className="interest-check" aria-hidden="true">
          <Icon name="check" />
        </span>
        Mám zájem
      </button>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="interested" value={interested ? "false" : "true"} />
      <button
        type="submit"
        className={interested ? "btn btn-small interest-btn interest-on" : "btn btn-small interest-btn"}
        aria-pressed={interested}
        aria-describedby={titleId}
        disabled={pending}
      >
        <span className="interest-check" aria-hidden="true">
          <Icon name="check" />
        </span>
        Mám zájem
      </button>
      {state && !state.ok && <ActionMessage state={state} />}
    </form>
  );
}

export function ProposeTopicDialog({ groups, locked = false }: { groups: Group[]; locked?: boolean }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  if (locked) {
    return (
      <button type="button" className="btn btn-primary" disabled title={PREVIEW_READ_ONLY}>
        Navrhnout téma
      </button>
    );
  }
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
        Navrhnout téma
      </button>
      {open && <ProposeForm key={session} groups={groups} onClose={() => setOpen(false)} />}
    </>
  );
}

function ProposeForm({ groups, onClose }: { groups: Group[]; onClose: () => void }) {
  const lock = lockedProps(usePreviewLock());
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await proposeTopicAction(prev, formData);
    if (result.ok) onClose();
    return result;
  }, null);
  return (
    <Modal open title="Navrhnout téma" onRequestClose={onClose}>
      <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
        <label className="field">
          <span className="field-label">Téma</span>
          <input className="input" name="name" required minLength={3} maxLength={120} autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Pro koho</span>
          <select className="select" name="audience" defaultValue={groups[0]}>
            {groups.map((g) => (
              <option key={g} value={g}>
                {GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </label>
        <ActionMessage state={state} />
        {/* Bez druhého „Zavřít“ dole: okno zavírá záhlaví, které s rozepsaným návrhem stejně zeptá. */}
        <div className="dialog-actions">
          <button type="submit" className="btn btn-primary" disabled={pending} {...lock}>
            {pending ? "Odesílám…" : "Navrhnout téma"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Co správce s tématem v nabídce může udělat. Pořadí a meze spočítá server, ověří je znovu při zápisu. */
export type TopicManageProps = {
  topic: { id: string; name: string; audience: string; priorityRank?: number | null };
  groups: Group[];
  canMoveUp: boolean;
  canMoveDown: boolean;
};

/**
 * Správa tématu v jedné nabídce ⋯: Naplánovat téma, Upravit, Nastavit / Zrušit prioritu, Posunout výš / níž
 * (vedle přetažení úchytem další cesta bez myši) a pod čarou Archivovat s potvrzením.
 */
export function TopicManage({ topic, groups, canMoveUp, canMoveDown }: TopicManageProps) {
  const [dialog, setDialog] = useState<"edit" | "plan" | null>(null);
  const guaranteed = topic.priorityRank != null;
  // Okno Naplánovat téma načítá nabídku akcí přes server, který ji v náhledu odmítne: v náhledu je položka zamčená.
  const lock = lockedProps(usePreviewLock());
  return (
    <>
      <Menu label={`Možnosti tématu ${topic.name}`} variant="card" className="menu-inline">
        <button type="button" className="btn" onClick={() => setDialog("plan")} {...lock}>
          <Icon name="calendar" />
          Naplánovat téma
        </button>
        <button type="button" className="btn" onClick={() => setDialog("edit")}>
          <Icon name="pencil" />
          Upravit téma
        </button>
        <ActionForm
          action={setTopicPriorityAction}
          fields={{ topicId: topic.id, guaranteed: guaranteed ? "false" : "true" }}
          label={guaranteed ? "Zrušit prioritu" : "Nastavit prioritu"}
          pendingLabel="Ukládám…"
          icon="star"
        />
        {canMoveUp && <ActionForm action={moveTopicAction} fields={{ topicId: topic.id, direction: "up" }} label="Posunout výš" pendingLabel="Posouvám…" icon="arrowUp" />}
        {canMoveDown && <ActionForm action={moveTopicAction} fields={{ topicId: topic.id, direction: "down" }} label="Posunout níž" pendingLabel="Posouvám…" icon="arrowDown" />}
        <hr className="menu-divider" />
        <ActionForm
          action={archiveTopicAction}
          fields={{ topicId: topic.id, archived: "true" }}
          label="Archivovat…"
          icon="archive"
          buttonClassName="menu-danger"
          confirm={{
            title: "Archivovat téma",
            text: `Téma „${topic.name}“ zmizí z nabídky a z doporučení${guaranteed ? " a přestane být garantované" : ""}. Akce, které ho už měly, si vazbu nechají a téma můžeš kdykoli obnovit.`,
            confirmLabel: "Archivovat téma",
          }}
        />
      </Menu>
      {dialog === "edit" && <EditTopicForm topic={topic} groups={groups} onClose={() => setDialog(null)} />}
      {dialog === "plan" && <PlanTopicDialog topic={topic} onClose={() => setDialog(null)} />}
    </>
  );
}

/** Kolik vhodných akcí okno Naplánovat téma ukáže hned, zbytek po Zobrazit další. */
const PLAN_TOPIC_FIRST = 3;

/** Návrhy před zveřejněnými; vysvětlení dopadu jednou u skupiny, ne pod každou kartou. */
const PLAN_GROUPS = [
  { draft: true, title: "Návrhy bez tématu", hint: "uloží se jen návrh, nic se neodešle" },
  { draft: false, title: "Zveřejněné akce", hint: "změnu potvrdíš v okně akce" },
] as const;

const harmonogramHref = (dateKey: string, query: Record<string, string>) =>
  `/vzdelavani/harmonogram?${new URLSearchParams({ mesic: dateKey.slice(0, 7), ...query })}`;

/**
 * Okno Naplánovat téma: vhodné budoucí akce bez tématu ve dvou skupinách (návrhy, pak zveřejněné; pořadí určuje
 * server). U návrhu Přiřadit k akci uloží jen návrh, u zveřejněné otevře okno akce s předvyplněným tématem (
 * nic se neuloží bez potvrzení) a Vytvořit novou akci. Má-li téma budoucí termín, je nahoře s hlavním
 * odkazem Otevřít stávající akci a další termín je vedlejší volba. Nejdřív jen tři nejlepší akce.
 */
function PlanTopicDialog({ topic, onClose }: { topic: { id: string; name: string }; onClose: () => void }) {
  const [loaded, setLoaded] = useState<(ActionResult & { options?: TopicPlanOptions }) | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    let active = true;
    void topicPlanOptionsAction(topic.id).then((result) => {
      if (active) setLoaded(result);
    });
    return () => {
      active = false;
    };
  }, [topic.id]);
  const options = loaded?.ok ? loaded.options : undefined;
  const scheduled = options?.scheduled;
  const candidates = options?.candidates ?? [];
  const shown = showAll ? candidates : candidates.slice(0, PLAN_TOPIC_FIRST);
  return (
    <Modal open title="Naplánovat téma" onRequestClose={onClose} wide>
      <div className="stack">
        <p className="small muted">Kam zařadit téma „{topic.name}“. Nic se samo nezveřejní ani neodešle.</p>
        {!loaded && (
          <p className="small" role="status">
            Hledám vhodné termíny…
          </p>
        )}
        {loaded && !loaded.ok && <ActionMessage state={loaded} />}
        {scheduled && (
          // Téma už termín má: hlavní cesta je otevřít tu akci, další termín je jen vedlejší možnost níže.
          <div className="plan-topic-scheduled">
            <p className="item-title">
              {scheduled.draft ? "V návrhu" : "Naplánováno"} na {formatDayMonth(scheduled.dateKey)} · {scheduled.label}
            </p>
            <Link className="btn btn-primary btn-small" href={harmonogramHref(scheduled.dateKey, { akce: scheduled.id })}>
              Otevřít stávající akci
            </Link>
          </div>
        )}
        {options && candidates.length === 0 && (
          <p className="small">Žádná budoucí akce bez tématu se pro skupinu tématu nehodí. Vytvoř novou.</p>
        )}
        {PLAN_GROUPS.map((group) => {
          const items = shown.filter((c) => c.draft === group.draft);
          if (items.length === 0) return null;
          return (
            <section key={group.title} className="plan-topic-group" aria-label={group.title}>
              <h3 className="plan-topic-heading">
                {group.title} <span className="muted plan-topic-hint">· {group.hint}</span>
              </h3>
              <ul className="plan-topic-list">
                {items.map((c) => (
                  <li key={c.id} className="plan-topic-item">
                    <div className="topic-main">
                      <p className="item-title">
                        {c.label} · <span className="nowrap">{formatDayMonth(c.dateKey)}</span>
                      </p>
                      <p className="item-meta">{[...eventContext(c.label, c.type, c.audience as Group), c.reason].filter(Boolean).join(" · ")}</p>
                    </div>
                    {c.draft ? (
                      <AssignToDraft topicId={topic.id} candidate={c} onDone={onClose} />
                    ) : (
                      // Zveřejněná akce: otevře se okno akce s předvyplněným tématem, uloží až správce s kontrolou dopadu.
                      <Link
                        className="btn btn-small"
                        href={harmonogramHref(c.dateKey, { akce: c.id, tema: topic.id })}
                        aria-label={`Přiřadit k akci ${c.label} ${formatDayMonth(c.dateKey)}`}
                      >
                        Přiřadit k akci
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {candidates.length > shown.length && (
          <button type="button" className="btn btn-small plan-topic-more" onClick={() => setShowAll(true)}>
            Zobrazit další ({candidates.length - shown.length})
          </button>
        )}
        <div className="dialog-actions">
          <Link className={scheduled ? "btn" : "btn btn-primary"} href={`/vzdelavani/harmonogram?tema=${encodeURIComponent(topic.id)}`}>
            <Icon name="plus" />
            Vytvořit novou akci
          </Link>
        </div>
      </div>
    </Modal>
  );
}

function AssignToDraft({ topicId, candidate, onDone }: { topicId: string; candidate: TopicPlanOptions["candidates"][number]; onDone: () => void }) {
  const lock = lockedProps(usePreviewLock());
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await assignTopicAction(prev, formData);
    if (result.ok) {
      flash(result.message);
      onDone();
    }
    return result;
  }, null);
  return (
    <form action={action} className="plan-topic-action">
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="eventId" value={candidate.id} />
      <input type="hidden" name="revision" value={String(candidate.revision)} />
      <button type="submit" className="btn btn-small" disabled={pending} {...lock} aria-label={`Přiřadit k akci ${candidate.label} ${formatDayMonth(candidate.dateKey)}`}>
        {pending ? "Ukládám…" : "Přiřadit k akci"}
      </button>
      {state && !state.ok && <ActionMessage state={state} />}
    </form>
  );
}

function EditTopicForm({ topic, groups, onClose }: { topic: { id: string; name: string; audience: string }; groups: Group[]; onClose: () => void }) {
  const [name, setName] = useState(topic.name);
  const [audience, setAudience] = useState(topic.audience);
  const [state, setState] = useState<ActionResult | null>(null);
  const lock = lockedProps(usePreviewLock());
  const [pending, start] = useTransition();
  // Ruční odeslání: po chybě (například duplicitní název) zůstanou hodnoty tak, jak je správce vyplnil.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    start(async () => {
      const result = await updateTopicAction(formData);
      if (result.ok) onClose();
      else setState(result);
    });
  };
  return (
    <Modal open title="Upravit téma" onRequestClose={onClose}>
      <form onSubmit={submit} className="stack">
        <input type="hidden" name="topicId" value={topic.id} />
        <label className="field">
          <span className="field-label">Téma</span>
          <input className="input" name="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={120} />
        </label>
        <label className="field">
          <span className="field-label">Pro koho</span>
          <select className="select" name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {groups.map((g) => (
              <option key={g} value={g}>
                {GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </label>
        <p className="small muted">Akce, které téma už mají v plánu nebo v zápisu, si nechají název, pod kterým byly zveřejněné.</p>
        <ActionMessage state={state} />
        <div className="dialog-actions">
          <button type="submit" className="btn btn-primary" disabled={pending} {...lock}>
            {pending ? "Ukládám…" : "Uložit"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Zrušit úpravy
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function RestoreTopicButton({ topicId }: { topicId: string }) {
  return <ActionForm action={archiveTopicAction} fields={{ topicId, archived: "false" }} label="Obnovit" small />;
}
