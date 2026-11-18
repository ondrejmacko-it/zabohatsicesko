"use client";

import { useRouter } from "next/navigation";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { flash } from "@/components/FlashMessage";
import { Icon } from "@/components/Icon";
import type { MonthDraft } from "@/server/services/events";
import { deleteDraftsAction, publishMonthAction, type ActionResult } from "../actions";

/** Návrh, který jde v Plánu označit. Smazat jde každý nikdy nezveřejněný návrh, zveřejnit jen budoucí (`MonthDraft`). */
export type PickItem = { id: string; revision: number };

type Ask = "publish" | "delete" | null;
type Selection = { active: boolean; picked: Set<string>; toggle: (id: string) => void; start: () => void; stop: () => void; available: boolean };

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
  children,
}: {
  monthKey: string;
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
  const bar = useRef<HTMLDivElement>(null);
  const backTo = useRef<Ask>(null);

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
  };
  const toggle = (id: string) => {
    if (!byId.has(id)) return;
    setAsk(null);
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Po „Zpět“ vrátí fokus na tlačítko, které se ptalo. Jinak by zůstal na zmizelém tlačítku.
  useEffect(() => {
    if (ask || !backTo.current) return;
    bar.current?.querySelector<HTMLButtonElement>(`button[data-intent="${backTo.current}"]`)?.focus();
    backTo.current = null;
  }, [ask]);
  const back = () => {
    backTo.current = ask;
    setAsk(null);
  };

  // Esc ukončí výběr (když se zrovna na nic neptáme, jinak vrátí z potvrzení).
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      if (ask) back();
      else stop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const finish = (result: ActionResult) => {
    if (!result.ok) return result;
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

  // V režimu výběru klik na kartu (myš i Enter) kartu označí. Ostatní odkazy fungují dál.
  const onClickCapture = (event: React.MouseEvent) => {
    if (!active) return;
    const card = (event.target as HTMLElement).closest<HTMLElement>("a[data-pick-id]");
    if (!card) return;
    event.preventDefault();
    toggle(card.dataset.pickId!);
  };

  const value: Selection = { active, picked, toggle, start: () => setActive(true), stop, available: items.length > 0 };
  return (
    <SelectionContext.Provider value={value}>
      <div className="plan-zone" data-selecting={active || undefined} onClickCapture={onClickCapture}>
        {children}
        {active && (
          <div ref={bar} className="select-bar" role="region" aria-label="Hromadný výběr návrhů">
            <ActionMessage state={deleteState ?? publishState} />
            {ask === "publish" ? (
              <div key="publish" className="select-bar-row" role="alertdialog" aria-labelledby="potvrdit-zverejneni">
                <p id="potvrdit-zverejneni" className="select-bar-text">
                  <strong>Zveřejnit {events(toPublish.length)}?</strong> Kolegové je uvidí a dostanou pozvánky.
                  {pastPicked > 0 && ` ${drafts(pastPicked)} v minulosti se nezveřejní.`}
                  {incomplete > 0 && ` ${incomplete} bez tématu nebo vedoucího.`}
                </p>
                <button type="button" className="btn" onClick={back}>
                  Zpět
                </button>
                <button type="button" className="btn btn-primary" disabled={busy} autoFocus onClick={() => submit("publish")}>
                  {publishing ? "Zveřejňuji…" : "Potvrdit zveřejnění"}
                </button>
              </div>
            ) : ask === "delete" ? (
              <div key="delete" className="select-bar-row" role="alertdialog" aria-labelledby="potvrdit-smazani">
                <p id="potvrdit-smazani" className="select-bar-text">
                  <strong>Smazat {drafts(selected.length)}?</strong>
                  {pastPicked > 0 && ` Z toho ${pastPicked} v minulosti.`} Nic se neodešle a nejde to vrátit.
                </p>
                <button type="button" className="btn" onClick={back}>
                  Zpět
                </button>
                <button type="button" className="btn btn-danger" disabled={busy} autoFocus onClick={() => submit("delete")}>
                  {deleting ? "Mažu…" : "Potvrdit smazání"}
                </button>
              </div>
            ) : (
              // Klíče řádků: React jinak použije tlačítko znovu a fokus i stav by přeskočily jinam.
              <div key="choose" className="select-bar-row">
                <p className="select-bar-text" aria-live="polite">
                  <strong>Vybráno {selected.length}</strong>
                  {selected.length < items.length && (
                    <button type="button" className="link-button" onClick={() => setPicked(new Set(items.map((i) => i.id)))}>
                      Vybrat všechny návrhy ({items.length})
                    </button>
                  )}
                  {changeDrafts > 0 && <span className="small muted"> Návrhy změn se zveřejňují v okně akce.</span>}
                </p>
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
            )}
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
