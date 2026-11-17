"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { flash } from "@/components/FlashMessage";
import { Modal } from "@/components/Modal";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDayMonth, toDateKey, weekdayShort } from "@/lib/time";
import type { MonthDraft } from "@/server/services/events";
import { deleteDraftsAction, publishMonthAction, type ActionResult } from "../actions";

type Ask = "publish" | "delete" | null;

const countLabel = (n: number) => `${n} ${n === 1 ? "návrh" : n < 5 ? "návrhy" : "návrhů"}`;

/**
 * Hromadná práce s návrhy měsíce v Plánu: výběr, zveřejnění a smazání. Údaje návrhů se tu nemění,
 * úpravy jsou v okně akce nebo v Připravit měsíc. Server každý návrh ověří znovu (verze, stav, měsíc).
 */
export function DraftSelection({ monthKey, monthName, drafts }: { monthKey: string; monthName: string; drafts: MonthDraft[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [ask, setAsk] = useState<Ask>(null);
  const selected = drafts.filter((d) => picked.has(d.id));
  const incomplete = selected.filter((d) => !d.topicTitle || !d.leadId).length;

  const finish = (result: ActionResult) => {
    if (!result.ok) return result;
    flash(result.message);
    setOpen(false);
    setPicked(new Set());
    setAsk(null);
    router.refresh();
    return result;
  };
  const [publishState, publish, publishing] = useActionState(async (prev: ActionResult | null, fd: FormData) => finish(await publishMonthAction(prev, fd)), null);
  const [deleteState, remove, deleting] = useActionState(async (prev: ActionResult | null, fd: FormData) => finish(await deleteDraftsAction(prev, fd)), null);
  const busy = publishing || deleting;

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allPicked = drafts.length > 0 && picked.size === drafts.length;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value as Ask;
    if (!intent || selected.length === 0) return;
    if (ask !== intent) return setAsk(intent);
    const fd = new FormData();
    fd.set("month", monthKey);
    for (const d of selected) {
      fd.append("pick", d.id);
      fd.set(`rev-${d.id}`, String(d.revision));
      // Zveřejnění beze změny údajů: posíláme hodnoty návrhu, jak je server poslal.
      fd.set(`topic-${d.id}`, d.topicTitle ?? "");
      fd.set(`lead-${d.id}`, d.leadId ?? "");
    }
    if (intent === "publish" && incomplete > 0) fd.set("allowIncomplete", String(incomplete));
    startTransition(() => (intent === "publish" ? publish(fd) : remove(fd)));
  };

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Vybrat návrhy
      </button>
      {open && (
        <Modal open title={`Návrhy: ${monthName}`} onRequestClose={() => setOpen(false)} wide>
          <form className="stack" onSubmit={submit}>
            <p className="small muted">Vyberte návrhy, které chcete zveřejnit nebo smazat. Údaje upravíte v okně akce.</p>
            <label className="check">
              <input
                type="checkbox"
                checked={allPicked}
                onChange={() => {
                  setAsk(null);
                  setPicked(allPicked ? new Set() : new Set(drafts.map((d) => d.id)));
                }}
              />
              <span>Vybrat vše ({drafts.length})</span>
            </label>
            <ul className="draft-pick-list">
              {drafts.map((d) => {
                const day = toDateKey(new Date(d.startsAt));
                const missing = [!d.topicTitle && "téma", !d.leadId && "vedoucí"].filter(Boolean).join(" a ");
                return (
                  <li key={d.id}>
                    <label className="check draft-pick">
                      <input
                        type="checkbox"
                        checked={picked.has(d.id)}
                        onChange={() => {
                          setAsk(null);
                          toggle(d.id);
                        }}
                      />
                      <span>
                        <strong>
                          {weekdayShort(day)} {formatDayMonth(day)} · {d.label}
                        </strong>
                        <span className="small muted">
                          {" "}
                          {d.topicTitle ?? ""}
                          {d.topicTitle ? " · " : ""}
                          {GROUP_LABELS[d.audience]}
                          {missing && ` · chybí ${missing}`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <ActionMessage state={deleteState ?? publishState} />
            {ask === "publish" ? (
              <div className="dialog-actions confirm-bar" role="alertdialog" aria-labelledby="potvrdit-zverejneni">
                <p id="potvrdit-zverejneni" className="confirm-text">
                  <strong>Zveřejnit {countLabel(selected.length)}?</strong> Kolegové je uvidí a pozvánky se odešlou podle režimu Kalendáře.
                  {incomplete > 0 && ` ${incomplete} z nich nemá téma nebo vedoucího.`}
                </p>
                <button type="button" className="btn" onClick={() => setAsk(null)}>
                  Zpět
                </button>
                <button type="submit" value="publish" className="btn btn-primary" disabled={busy} autoFocus>
                  {publishing ? "Zveřejňuji…" : "Potvrdit zveřejnění"}
                </button>
              </div>
            ) : ask === "delete" ? (
              <div className="dialog-actions confirm-bar" role="alertdialog" aria-labelledby="potvrdit-smazani">
                <p id="potvrdit-smazani" className="confirm-text">
                  <strong>Smazat {countLabel(selected.length)}?</strong> Nic se neodešle. Pravidelné termíny už další doplnění měsíce znovu nevytvoří.
                </p>
                <button type="button" className="btn" onClick={() => setAsk(null)}>
                  Zpět
                </button>
                <button type="submit" value="delete" className="btn btn-danger" disabled={busy} autoFocus>
                  {deleting ? "Mažu…" : "Potvrdit smazání"}
                </button>
              </div>
            ) : (
              <div className="dialog-actions event-actions">
                <span className="small muted event-actions-menu">Vybráno: {selected.length}</span>
                <button type="submit" value="delete" className="btn btn-danger" disabled={busy || selected.length === 0}>
                  Smazat vybrané
                </button>
                <button type="submit" value="publish" className="btn btn-primary" disabled={busy || selected.length === 0}>
                  Zveřejnit vybrané
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
