"use client";

import { useRouter } from "next/navigation";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { flash } from "@/components/FlashMessage";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { publishInviteNote, type InviteMode } from "@/lib/invite-mode";
import { formatEventTime, formatDayMonth, toDateKey, weekdayShort } from "@/lib/time";
import type { Group } from "@/lib/types";
import type { MonthDraft } from "@/server/services/events";
import { deleteDraftsAction, publishMonthAction, type ActionResult } from "../actions";

/** Návrh, který jde v Plánu označit. Smazat jde každý nikdy nezveřejněný návrh, zveřejnit jen budoucí (`MonthDraft`). */
export type PickItem = { id: string; revision: number };

type Ask = "publish" | "delete" | null;
type Selection = {
  active: boolean;
  picked: Set<string>;
  toggle: (id: string) => void;
  start: () => void;
  stop: () => void;
  available: boolean;
  /** Návrh jde zveřejnit samostatně (budoucí, nikdy nezveřejněný, v tomto měsíci). */
  canPublishOne: (id: string) => boolean;
  /** Otevře potvrzení zveřejnění jednoho návrhu (menu ⋯ na kartě). */
  publishOne: (id: string) => void;
};

/** Komu jde pozvánka podle skupiny a jak (režim pozvánek). Bez Kalendáře null. */
export type PublishInvite = { recipients: Record<Group, Array<{ email: string; name: string }>>; mode: InviteMode };

const SelectionContext = createContext<Selection | null>(null);

const drafts = (n: number) => `${n} ${n === 1 ? "návrh" : n >= 2 && n <= 4 ? "návrhy" : "návrhů"}`;
const events = (n: number) => `${n} ${n >= 1 && n <= 4 ? "akce" : "akcí"}`;

/**
 * Hromadný výběr návrhů přímo v měsíčním Plánu i v seznamu. Karty s `data-pick-id` dostanou checkbox,
 * klik na kartu ji v režimu výběru označí místo otevření okna a přesun tažením je vypnutý (`data-selecting`).
 * Zveřejnění a smazání dělají stávající serverové akce: každý návrh ověří znovu (verze, stav, měsíc).
 * Proběhlé návrhy server zveřejnit nedovolí, proto se při zveřejnění jen vynechají a potvrzení to řekne.
 */
export function SelectionZone({
  monthKey,
  items,
  publishable,
  changeDrafts,
  invite = null,
  children,
}: {
  monthKey: string;
  invite?: PublishInvite | null;
  items: PickItem[];
  publishable: MonthDraft[];
  /** Počet návrhů změn zveřejněných akcí v měsíci. Ty mají vlastní potvrzení dopadu v okně akce. */
  changeDrafts: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [ask, setAsk] = useState<Ask>(null);
  const [single, setSingle] = useState<MonthDraft | null>(null);
  // Proč naposledy kliknutou kartu vybrat nejde. Ukáže se v liště místo otevření okna akce.
  const [hint, setHint] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  const byId = new Map(items.map((i) => [i.id, i]));
  const publishableById = new Map(publishable.map((d) => [d.id, d]));
  const selected = items.filter((i) => picked.has(i.id));
  const toPublish = selected.flatMap((i) => publishableById.get(i.id) ?? []);
  const pastPicked = selected.length - toPublish.length;
  const incomplete = toPublish.filter((d) => !d.topicTitle || !d.leadId).length;

  const stop = () => {
    setActive(false);
    setPicked(new Set());
    setAsk(null);
    setHint(null);
  };
  const toggle = (id: string) => {
    if (!byId.has(id)) return;
    setAsk(null);
    setHint(null);
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Potvrzení je samostatné okno (`ConfirmDialog`), po „Zpět“ vrátí fokus na tlačítko, které se ptalo.
  const back = () => setAsk(null);

  // Esc ukončí výběr (když se zrovna na nic neptáme, jinak vrátí z potvrzení).
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      stop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const finish = (result: ActionResult) => {
    // Chyba se ukáže v liště výběru. Potvrzovací okno se zavře, aby ji nezakrylo.
    if (!result.ok) {
      setAsk(null);
      return result;
    }
    flash(result.message);
    stop();
    router.refresh();
    return result;
  };
  const [publishState, publish, publishing] = useActionState(async (prev: ActionResult | null, fd: FormData) => finish(await publishMonthAction(prev, fd)), null);
  const [deleteState, remove, deleting] = useActionState(async (prev: ActionResult | null, fd: FormData) => finish(await deleteDraftsAction(prev, fd)), null);
  const busy = publishing || deleting;

  const submit = (intent: "publish" | "delete") => {
    const fd = new FormData();
    fd.set("month", monthKey);
    if (intent === "publish") {
      for (const d of toPublish) {
        fd.append("pick", d.id);
        fd.set(`rev-${d.id}`, String(d.revision));
        // Zveřejnění beze změny údajů: posíláme hodnoty návrhu, jak je server poslal.
        fd.set(`topic-${d.id}`, d.topicTitle ?? "");
        fd.set(`lead-${d.id}`, d.leadId ?? "");
      }
      if (incomplete > 0) fd.set("allowIncomplete", String(incomplete));
      startTransition(() => publish(fd));
    } else {
      for (const i of selected) {
        fd.append("pick", i.id);
        fd.set(`rev-${i.id}`, String(i.revision));
      }
      startTransition(() => remove(fd));
    }
  };

  // V režimu výběru dělá klik na kartu (myš, Enter, dotyk) právě jednu věc: návrh označí, nebo u karty,
  // kterou vybrat nejde, jen řekne proč. Okno akce se během výběru neotevře. Ostatní odkazy fungují dál.
  const onClickCapture = (event: React.MouseEvent) => {
    if (!active) return;
    const card = (event.target as HTMLElement).closest<HTMLElement>("a[data-pick-id], a[data-pick-reason]");
    if (!card) return;
    event.preventDefault();
    if (card.dataset.pickId) toggle(card.dataset.pickId);
    else setHint(card.dataset.pickReason || "Tuto akci vybrat nejde.");
  };

  const value: Selection = {
    active,
    picked,
    toggle,
    start: () => setActive(true),
    stop,
    available: items.length > 0,
    canPublishOne: (id) => publishableById.has(id),
    publishOne: (id) => setSingle(publishableById.get(id) ?? null),
  };
  return (
    <SelectionContext.Provider value={value}>
      <div className="plan-zone" data-selecting={active || undefined} onClickCapture={onClickCapture}>
        {children}
        {single && <PublishOneDialog key={single.id} draft={single} monthKey={monthKey} invite={invite} onClose={() => setSingle(null)} />}
        {active && (
          <div ref={bar} className="select-bar" role="region" aria-label="Hromadný výběr návrhů">
            <ActionMessage state={deleteState ?? publishState} />
            <ConfirmDialog
              open={ask === "publish"}
              title={`Zveřejnit ${events(toPublish.length)}?`}
              busy={busy}
              description={
                <p>
                  Kolegové je uvidí a dostanou pozvánky.
                  {pastPicked > 0 && ` ${drafts(pastPicked)} v minulosti se nezveřejní.`}
                  {incomplete > 0 && ` ${incomplete} bez tématu nebo vedoucího.`}
                </p>
              }
              onCancel={back}
            >
              <button type="button" className="btn" onClick={back} autoFocus>
                Zpět
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => submit("publish")}>
                {publishing ? "Zveřejňuji…" : "Potvrdit zveřejnění"}
              </button>
            </ConfirmDialog>
            <ConfirmDialog
              open={ask === "delete"}
              title={`Smazat ${drafts(selected.length)}?`}
              urgent
              busy={busy}
              description={<p>{pastPicked > 0 && `Z toho ${pastPicked} v minulosti. `}Nic se neodešle. Ručně přidané návrhy nejde vrátit, termíny z rozvrhu obnoví Připravit měsíc.</p>}
              onCancel={back}
            >
              <button type="button" className="btn" onClick={back} autoFocus>
                Zpět
              </button>
              <button type="button" className="btn btn-danger confirm-destructive" disabled={busy} onClick={() => submit("delete")}>
                {deleting ? "Mažu…" : "Potvrdit smazání"}
              </button>
            </ConfirmDialog>
            <div className="select-bar-row">
              <p className="select-bar-text" aria-live="polite">
                <strong>Vybráno {selected.length} z {items.length}</strong>
                {selected.length < items.length && (
                  <button type="button" className="link-button" onClick={() => setPicked(new Set(items.map((i) => i.id)))}>
                    Vybrat všechny dostupné
                  </button>
                )}
                {hint ? (
                  <span className="small select-bar-hint" data-testid="duvod-vyberu">{hint}</span>
                ) : (
                  changeDrafts > 0 && <span className="small muted select-bar-hint">Návrhy změn se zveřejňují v okně akce.</span>
                )}
              </p>
              <div className="select-bar-actions">
                <button type="button" className="btn btn-quiet" onClick={stop}>
                  Zrušit výběr
                </button>
                <button type="button" data-intent="delete" className="btn btn-danger" disabled={busy || selected.length === 0} onClick={() => setAsk("delete")}>
                  Smazat vybrané
                </button>
                <button
                  type="button"
                  data-intent="publish"
                  className="btn btn-primary"
                  disabled={busy || toPublish.length === 0}
                  title={selected.length > 0 && toPublish.length === 0 ? "Návrhy v minulosti nejde zveřejnit" : undefined}
                  onClick={() => setAsk("publish")}
                >
                  Zveřejnit vybrané
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SelectionContext.Provider>
  );
}

/** Stav hromadného výběru pro řádek filtrů a rychlé ovládání. Mimo `SelectionZone` je null. */
export const useSelection = () => useContext(SelectionContext);

/** Tlačítko „Vybrat návrhy“ v řádku filtrů. Bez návrhů v měsíci (nebo mimo Plán správce) se nevykreslí. */
export function SelectToggle({ wide }: { wide?: boolean }) {
  const selection = useContext(SelectionContext);
  if (!selection?.available) return null;
  return (
    <button
      type="button"
      className="btn btn-small btn-quiet filter-button"
      data-wide={wide || undefined}
      aria-pressed={selection.active}
      onClick={selection.active ? selection.stop : selection.start}
    >
      <Icon name="select" />
      {selection.active ? "Ukončit výběr" : "Vybrat návrhy"}
    </button>
  );
}

/** Checkbox na kartě návrhu. Mimo režim výběru se nevykreslí. */
export function PickBox({ id, label }: { id: string; label: string }) {
  const selection = useContext(SelectionContext);
  if (!selection?.active) return null;
  return (
    <input
      type="checkbox"
      className="pick-box"
      checked={selection.picked.has(id)}
      onChange={() => selection.toggle(id)}
      aria-label={`Vybrat: ${label}`}
    />
  );
}

/**
 * Zveřejnění jednoho návrhu z menu karty. Stejná serverová cesta jako hromadné zveřejnění (`publishMonthAction`):
 * server znovu ověří verzi, stav a měsíc a neúplný návrh pustí jen s výslovným potvrzením. Okno předem řekne,
 * co chybí a komu půjde pozvánka.
 */
function PublishOneDialog({ draft, monthKey, invite, onClose }: { draft: MonthDraft; monthKey: string; invite: PublishInvite | null; onClose: () => void }) {
  const router = useRouter();
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const missing = [!draft.topicTitle && "téma", !draft.leadId && "vedoucí"].filter((m): m is string => Boolean(m));
  const [state, publish, pending] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const result = await publishMonthAction(prev, fd);
    if (result.ok) {
      flash(result.message);
      onClose();
      router.refresh();
    }
    return result;
  }, null);
  const submit = () => {
    const fd = new FormData();
    fd.set("month", monthKey);
    fd.append("pick", draft.id);
    fd.set(`rev-${draft.id}`, String(draft.revision));
    // Zveřejnění beze změny údajů: posíláme hodnoty návrhu, jak je server poslal.
    fd.set(`topic-${draft.id}`, draft.topicTitle ?? "");
    fd.set(`lead-${draft.id}`, draft.leadId ?? "");
    if (missing.length && allowIncomplete) fd.set("allowIncomplete", "1");
    startTransition(() => publish(fd));
  };
  const day = toDateKey(new Date(draft.startsAt));
  return (
    <Modal open title="Zveřejnit návrh" onRequestClose={onClose}>
      <div className="stack">
        <p>
          <strong>{draft.label}</strong> · {weekdayShort(day)} {formatDayMonth(day)}, {formatEventTime(new Date(draft.startsAt), new Date(draft.endsAt), false)}
        </p>
        <div className="notice" role="status">
          <p>Kolegové akci uvidí ve Wiki a dostanou pozvánku do Kalendáře.</p>
          {invite && <p className="small">{publishInviteNote(invite.mode, [draft.audience], invite.recipients)}</p>}
        </div>
        {missing.length > 0 && (
          <>
            <p className="notice notice-danger">
              <strong>Chybí {missing.join(" a ")}.</strong> Doplň ho v okně akce, nebo zveřejni bez něj.
            </p>
            <label className="check">
              <input type="checkbox" checked={allowIncomplete} onChange={(e) => setAllowIncomplete(e.target.checked)} />
              <span>Zveřejnit i bez {missing.length === 2 ? "tématu a vedoucího" : missing[0] === "téma" ? "tématu" : "vedoucího"}.</span>
            </label>
          </>
        )}
        <ActionMessage state={state} />
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" disabled={pending || (missing.length > 0 && !allowIncomplete)} onClick={submit}>
            {pending ? "Zveřejňuji…" : "Zveřejnit"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Zpět
          </button>
        </div>
      </div>
    </Modal>
  );
}
