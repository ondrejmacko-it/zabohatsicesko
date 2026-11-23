"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ActionMessage } from "@/components/ActionForm";
import { Modal } from "@/components/Modal";
import { formatDayMonth, monthOf, weekdayLong, weekdayShort } from "@/lib/time";
import type { ChangeImpact } from "@/server/services/impact";
import { moveEventAction, previewMoveAction, type ActionResult } from "../actions";
import { dayNumber, MonthDays } from "./MonthDays";

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
          Nepřesouvat
        </button>
      </div>
    </div>
  );
}

/** Přesun bez tažení z jiného ovládání (menu ⋯ karty): otevře výběr dne a pak stejné potvrzení. Mimo zónu null. */
const MoveRequestContext = createContext<((target: MoveTarget) => void) | null>(null);
export const useMoveRequest = () => useContext(MoveRequestContext);

const DRAG_TYPE = "application/x-zbc-akce";
/** Jak dlouho podržet úchyt prstem, než se karta zvedne. Kratší dotyk je ťuknutí, pohyb dřív je posun stránky. */
const LONG_PRESS_MS = 350;
/** Pohyb prstu (px), který ještě nezruší podržení. Prohlížeč posun stránky začíná až o něco dál. */
const TOUCH_SLOP = 8;
/** Pás u okraje (px), kde tažení posouvá stránku. */
const EDGE_ZONE = 64;

/** Dny, na které jde akci přesunout: stejný měsíc, od `movableFrom` dál a jiný než původní. Server ověří znovu. */
const allowedDay = (target: MoveTarget, day: string, movableFrom: string) => day !== target.from && monthOf(day) === monthOf(target.from) && day >= movableFrom;

function handleTarget(handle: HTMLElement): MoveTarget {
  const { moveHandle, handleRevision, handleLabel, handleFrom } = handle.dataset;
  return { id: moveHandle!, revision: Number(handleRevision), label: handleLabel!, from: handleFrom! };
}

/** Výběr cílového dne bez tažení (ťuknutí na úchyt nebo klávesnice). Pak stejné potvrzení jako po puštění. */
function MovePicker({ target, movableFrom, onPick }: { target: MoveTarget; movableFrom: string; onPick: (day: string) => void }) {
  return (
    <div className="stack">
      <p>
        Na který den přesunout akci <strong>{target.label}</strong>? Teď je {dayLabel(target.from)}.
      </p>
      <MonthDays
        monthKey={monthOf(target.from)}
        fromDay={movableFrom}
        label="Nový den akce"
        renderDay={(day) => (
          <button
            type="button"
            className="month-day"
            disabled={!allowedDay(target, day, movableFrom)}
            aria-current={day === target.from ? "date" : undefined}
            aria-label={`${weekdayLong(day)} ${formatDayMonth(day)}`}
            onClick={() => onPick(day)}
          >
            {dayNumber(day)}
          </button>
        )}
      />
      <p className="small muted">Jen dny od dneška do konce měsíce akce. Nic se neuloží, dokud přesun nepotvrdíš.</p>
    </div>
  );
}

type TouchDrag = {
  target: MoveTarget;
  pointerId: number;
  handle: HTMLElement;
  card: HTMLElement;
  ghost: HTMLElement | null;
  offset: { x: number; y: number };
  point: { x: number; y: number };
  start: { x: number; y: number };
  active: boolean;
  timer: number;
  frame: number;
};

/**
 * Přesun akce v měsíčním Plánu (jen správce). Jediná cesta k zápisu je potvrzení `MoveConfirm`, tažení samo nic neukládá.
 * - Mřížka (myš): bloky akcí s `data-move-id` jdou táhnout, buňky dne s `data-drop-day` je přijmou.
 * - Agenda (telefon): úchyt `data-move-handle`. Podržení úchytu kartu zvedne, tažení ji nese nad dny seznamu
 *   (`data-drop-day`) a dočasný měsíční přehled dole přijme i den bez akcí. U okraje se stránka posouvá.
 *   Puštění mimo cíl nic nezmění. Ťuknutí na úchyt (i Enter) otevře výběr dne v okně.
 * Bez myši i nadále slouží úprava data v okně akce. V režimu hromadného výběru je přesun vypnutý.
 */
export function MoveDropZone({ children, movableFrom }: { children: React.ReactNode; movableFrom: string }) {
  const [dialog, setDialog] = useState<{ target: MoveTarget; to: string | null } | null>(null);
  const [dragging, setDragging] = useState<MoveTarget | null>(null);
  const dragged = useRef<MoveTarget | null>(null);
  const over = useRef<HTMLElement | null>(null);
  const touch = useRef<TouchDrag | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const suppressClickUntil = useRef(0);
  const stopTouch = useRef<() => void>(() => {});

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

  // Cíl pod prstem: den v seznamu nebo v dočasném přehledu. Zvednutá karta (kopie) události nepřijímá.
  const touchCell = (drag: TouchDrag) => {
    const cell = document.elementFromPoint(drag.point.x, drag.point.y)?.closest<HTMLElement>("[data-drop-day]") ?? null;
    return cell && allowedDay(drag.target, cell.dataset.dropDay!, movableFrom) ? cell : null;
  };

  const placeGhost = (drag: TouchDrag) => {
    if (drag.ghost) drag.ghost.style.transform = `translate(${drag.point.x - drag.offset.x}px, ${drag.point.y - drag.offset.y}px)`;
  };

  // Posun stránky u horního okraje a nad dočasným přehledem dole. Rychlost roste s blízkostí okraje.
  const autoScroll = () => {
    const drag = touch.current;
    if (!drag?.active) return;
    const bottom = panel.current?.getBoundingClientRect().top ?? window.innerHeight;
    const { y } = drag.point;
    let speed = 0;
    if (y < EDGE_ZONE) speed = -Math.ceil((EDGE_ZONE - y) / 4);
    else if (y > bottom - EDGE_ZONE && y < bottom) speed = Math.ceil((y - (bottom - EDGE_ZONE)) / 4);
    if (speed) {
      window.scrollBy(0, speed);
      highlight(touchCell(drag));
    }
    drag.frame = requestAnimationFrame(autoScroll);
  };

  const activate = (drag: TouchDrag) => {
    if (drag.handle.closest("[data-selecting]")) return stopTouch.current();
    const link = drag.card.querySelector<HTMLElement>("a");
    const rect = (link ?? drag.card).getBoundingClientRect();
    const ghost = (link ?? drag.card).cloneNode(true) as HTMLElement;
    ghost.removeAttribute("href");
    ghost.removeAttribute("id");
    ghost.setAttribute("aria-hidden", "true");
    ghost.classList.add("move-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.left = "0";
    ghost.style.top = "0";
    document.body.append(ghost);
    drag.ghost = ghost;
    drag.offset = { x: drag.point.x - rect.left, y: drag.point.y - rect.top };
    drag.active = true;
    placeGhost(drag);
    drag.card.setAttribute("data-lifted", "");
    document.body.setAttribute("data-moving", "");
    // Dočasný přehled dnů se vykreslí hned, aby šel změřit pro posun u spodního okraje.
    flushSync(() => setDragging(drag.target));
    drag.frame = requestAnimationFrame(autoScroll);
  };

  // Posluchače na dokumentu po dobu jednoho dotyku úchytu. Neaktivní podržení zruší pohyb nebo konec dotyku.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = touch.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.point = { x: event.clientX, y: event.clientY };
      if (!drag.active) {
        const moved = Math.hypot(drag.point.x - drag.start.x, drag.point.y - drag.start.y);
        // Myš nic neposouvá: tažení začne hned pohybem. Prst musí nejdřív podržet, pohyb dřív je posun stránky.
        if (event.pointerType === "mouse" && moved > 4) activate(drag);
        else if (event.pointerType !== "mouse" && moved > TOUCH_SLOP) stopTouch.current();
        return;
      }
      event.preventDefault();
      placeGhost(drag);
      highlight(touchCell(drag));
    };
    const onUp = (event: PointerEvent) => {
      const drag = touch.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.active) {
        drag.point = { x: event.clientX, y: event.clientY };
        const cell = touchCell(drag);
        // Kliknutí, které prohlížeč pošle po puštění, nesmí otevřít detail akce ani výběr dne.
        suppressClickUntil.current = Date.now() + 600;
        if (cell) setDialog({ target: drag.target, to: cell.dataset.dropDay! });
      }
      stopTouch.current();
    };
    const onCancel = (event: PointerEvent) => {
      if (touch.current && event.pointerId === touch.current.pointerId) stopTouch.current();
    };
    // Zvednutá karta drží prst: stránka se pod ním neposouvá (posouvá ji jen pás u okraje).
    const onTouchMove = (event: TouchEvent) => {
      if (touch.current?.active) event.preventDefault();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && touch.current?.active) stopTouch.current();
    };
    const onClick = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickUntil.current = 0;
      }
    };
    const onContextMenu = (event: Event) => {
      if (touch.current) event.preventDefault();
    };
    stopTouch.current = () => {
      const drag = touch.current;
      touch.current = null;
      if (!drag) return;
      clearTimeout(drag.timer);
      cancelAnimationFrame(drag.frame);
      drag.ghost?.remove();
      drag.card.removeAttribute("data-lifted");
      document.body.removeAttribute("data-moving");
      highlight(null);
      setDragging(null);
    };
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick, true);
    document.addEventListener("contextmenu", onContextMenu);
    return () => {
      stopTouch.current();
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("contextmenu", onContextMenu);
    };
    // Posluchače čtou aktuální stav přes reference, stačí je přidat jednou (movableFrom je pro stránku pevné).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MoveRequestContext.Provider value={(target) => setDialog({ target, to: null })}>
    <div
      onPointerDown={(event) => {
        // Nový dotyk: případné kliknutí z minulého puštění už nepřijde, nic dalšího se nepotlačí.
        suppressClickUntil.current = 0;
        const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-move-handle]");
        if (!handle || touch.current || (event.pointerType === "mouse" && event.button !== 0)) return;
        if (handle.closest("[data-selecting]")) return;
        const point = { x: event.clientX, y: event.clientY };
        const drag: TouchDrag = {
          target: handleTarget(handle),
          pointerId: event.pointerId,
          handle,
          card: handle.parentElement!,
          ghost: null,
          offset: { x: 0, y: 0 },
          point,
          start: point,
          active: false,
          timer: 0,
          frame: 0,
        };
        touch.current = drag;
        if (event.pointerType !== "mouse") drag.timer = window.setTimeout(() => touch.current === drag && activate(drag), LONG_PRESS_MS);
      }}
      onClick={(event) => {
        // Ťuknutí na úchyt nebo Enter: výběr dne v okně. Po tažení kliknutí zachytí posluchač výše.
        const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-move-handle]");
        if (!handle || handle.closest("[data-selecting]")) return;
        setDialog({ target: handleTarget(handle), to: null });
      }}
      onDragStart={(event) => {
        const block = (event.target as HTMLElement).closest<HTMLElement>("[data-move-id]");
        if (!block) return;
        // V režimu hromadného výběru se karty jen označují, přesun tažením je vypnutý.
        if (block.closest("[data-selecting]")) return event.preventDefault();
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
        setDialog({ target: dragged.current, to: cell.dataset.dropDay! });
      }}
      onDragEnd={() => {
        highlight(null);
        dragged.current = null;
      }}
    >
      {children}
      {dragging && (
        // Jen po dobu tažení prstem: den bez akcí nebo vzdálený den. Ovládá se jen tažením, čtečce nic nepřidává.
        <div ref={panel} className="move-panel" aria-hidden="true">
          <p className="move-panel-text">
            Pusť na den v seznamu nebo tady. <span className="muted">Jinam = zrušit.</span>
          </p>
          <MonthDays
            monthKey={monthOf(dragging.from)}
            fromDay={movableFrom}
            label="Cílový den"
            renderDay={(day) => (
              <span
                className="month-day"
                data-drop-day={allowedDay(dragging, day, movableFrom) ? day : undefined}
                data-disabled={allowedDay(dragging, day, movableFrom) ? undefined : ""}
                data-current={day === dragging.from ? "" : undefined}
              >
                {dayNumber(day)}
              </span>
            )}
          />
        </div>
      )}
      {dialog && (
        <Modal open title="Přesunout akci" onRequestClose={() => setDialog(null)}>
          {dialog.to ? (
            <MoveConfirm target={dialog.target} to={dialog.to} onClose={() => setDialog(null)} />
          ) : (
            <MovePicker target={dialog.target} movableFrom={movableFrom} onPick={(day) => setDialog({ target: dialog.target, to: day })} />
          )}
        </Modal>
      )}
    </div>
    </MoveRequestContext.Provider>
  );
}
