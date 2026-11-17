"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Modal } from "@/components/Modal";
import { formatDayMonth, isValidDateKey, monthOf, weekdayShort } from "@/lib/time";
import type { ChangeImpact } from "@/server/services/impact";
import { moveEventAction, previewMoveAction, type ActionResult } from "../actions";

export type MoveTarget = { id: string; revision: number; label: string; from: string };
type Preview = { publish: boolean; impact: ChangeImpact | null };

const dayLabel = (day: string) => `${weekdayShort(day)} ${formatDayMonth(day)}`;

function moveForm(target: MoveTarget, to: string, token?: string) {
  const data = new FormData();
  data.set("id", target.id);
  data.set("revision", String(target.revision));
  data.set("date", to);
  if (token) data.set("confirmToken", token);
  return data;
}

/**
 * Potvrzení přesunu: server nejdřív spočítá, jestli se změna rovnou zveřejní a koho zasáhne, teprve
 * potom správce přesun potvrdí. Zápis, oprávnění i kontrolu souběhu dělá serverová akce.
 */
function MoveConfirm({ target, to, onClose }: { target: MoveTarget; to: string; onClose: () => void }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void previewMoveAction(moveForm(target, to)).then((res) => {
      if (!active) return;
      if (res.ok) setPreview({ publish: Boolean(res.publish), impact: res.impact ?? null });
      else setResult(res);
    });
    return () => {
      active = false;
    };
  }, [target, to]);

  const confirm = async () => {
    setPending(true);
    const res = await moveEventAction(null, moveForm(target, to, preview?.impact?.token));
    setPending(false);
    if (!res.ok) return setResult(res);
    onClose();
    router.refresh();
  };

  return (
    <div className="stack">
      <p>
        Přesunout akci <strong>{target.label}</strong> z {dayLabel(target.from)} na {dayLabel(to)}?
      </p>
      <p className="small muted">Čas, téma, vedoucí i publikum zůstanou stejné.</p>
      {!preview && !result && (
        <p className="small muted" role="status">
          Ověřuji dopad přesunu…
        </p>
      )}
      {preview && !preview.publish && (
        <p className="notice">Přesun se uloží jako návrh. Kolegové a Kalendář uvidí nový den až po zveřejnění.</p>
      )}
      {preview?.publish && (
        <div className="notice" role="status">
          <p>
            <strong>Změna se rovnou zveřejní.</strong> Pozvaní dostanou nový termín v Kalendáři.
          </p>
          {preview.impact && (
            <ul className="prose-list">
              {preview.impact.guests.add.length > 0 && <li>Wiki do pozvánky přidá: {preview.impact.guests.add.join(", ")}</li>}
              {preview.impact.guests.remove.length > 0 && <li>Wiki z pozvánky odebere: {preview.impact.guests.remove.join(", ")}</li>}
              {preview.impact.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ActionMessage state={result} />
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={confirm} disabled={!preview || pending}>
          {pending ? "Přesouvám…" : "Potvrdit"}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Zrušit
        </button>
      </div>
    </div>
  );
}

const DRAG_TYPE = "application/x-zbc-akce";

/**
 * Přesun tažením v měsíčním Plánu (jen správce). Bloky akcí s `data-move-id` jdou táhnout, buňky dne
 * s `data-drop-day` je přijmou. Puštění otevře potvrzení. Bez myši slouží „Přesunout na jiný den“ v detailu.
 */
export function MoveDropZone({ children }: { children: React.ReactNode }) {
  const [move, setMove] = useState<{ target: MoveTarget; to: string } | null>(null);
  const dragged = useRef<MoveTarget | null>(null);
  const over = useRef<HTMLElement | null>(null);

  const highlight = (cell: HTMLElement | null) => {
    if (over.current === cell) return;
    over.current?.removeAttribute("data-drop-over");
    cell?.setAttribute("data-drop-over", "");
    over.current = cell;
  };
  const dropCell = (event: React.DragEvent) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-drop-day]");
    const target = dragged.current;
    // Den akce sám a dny mimo měsíc akce přesun nepřijmou, server by je stejně odmítl.
    if (!cell || !target || cell.dataset.dropDay === target.from || monthOf(cell.dataset.dropDay!) !== monthOf(target.from)) return null;
    return cell;
  };

  return (
    <div
      onDragStart={(event) => {
        const block = (event.target as HTMLElement).closest<HTMLElement>("[data-move-id]");
        if (!block) return;
        const { moveId, moveRevision, moveLabel, moveFrom } = block.dataset;
        dragged.current = { id: moveId!, revision: Number(moveRevision), label: moveLabel!, from: moveFrom! };
        event.dataTransfer.setData(DRAG_TYPE, moveId!);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        const cell = dropCell(event);
        highlight(cell);
        if (!cell) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={(event) => {
        if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) highlight(null);
      }}
      onDrop={(event) => {
        const cell = dropCell(event);
        highlight(null);
        if (!cell || !dragged.current) return;
        event.preventDefault();
        setMove({ target: dragged.current, to: cell.dataset.dropDay! });
      }}
      onDragEnd={() => {
        highlight(null);
        dragged.current = null;
      }}
    >
      {children}
      {move && (
        <Modal open title="Přesunout akci" onRequestClose={() => setMove(null)}>
          <MoveConfirm target={move.target} to={move.to} onClose={() => setMove(null)} />
        </Modal>
      )}
    </div>
  );
}

/** „Přesunout na jiný den“ v detailu akce: cesta bez myši a na dotyku. Nabízí dny stejného měsíce. */
export function MoveEventButton({ target, minDate }: { target: MoveTarget; minDate: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [to, setTo] = useState<string | null>(null);
  const month = monthOf(target.from);
  const lastDay = `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()}`;
  const close = () => {
    setOpen(false);
    setTo(null);
    setDate("");
  };
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Přesunout na jiný den
      </button>
      {open && (
        <Modal open title="Přesunout akci" onRequestClose={close}>
          {to ? (
            <MoveConfirm target={target} to={to} onClose={close} />
          ) : (
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                setTo(date);
              }}
            >
              <label className="field">
                <span className="field-label">Nový den</span>
                <input
                  className="input"
                  type="date"
                  name="date"
                  required
                  value={date}
                  min={minDate > `${month}-01` ? minDate : `${month}-01`}
                  max={lastDay}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <p className="hint">
                Nyní {dayLabel(target.from)}. Přesunout jde na budoucí den ve stejném měsíci, čas zůstane stejný.
              </p>
              <div className="dialog-actions">
                <button type="submit" className="btn btn-primary" disabled={!isValidDateKey(date) || date === target.from}>
                  Pokračovat
                </button>
                <button type="button" className="btn" onClick={close}>
                  Zrušit
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
