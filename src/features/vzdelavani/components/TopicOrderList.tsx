"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { moveTopicAction } from "../actions";

export type TopicOrderItem = { id: string; name: string; className: string; content: ReactNode };

type Drag = { id: string; pointerId: number; startY: number; moved: boolean; before: string[]; order: string[] };

/** Práh v pixelech, od kterého se pohyb s úchytem bere jako tažení (ne jako ťuknutí). */
const DRAG_THRESHOLD = 4;

/**
 * Seznam témat jedné skupiny (Garantovaná / Ostatní). Správce mění pořadí úchytem: myší i prstem (pointer events,
 * úchyt má `touch-action: none`, stránka se pod prstem neposouvá), nebo šipkami na zaměřeném úchytu. Přesouvá se
 * jen v rámci skupiny. Pořadí se změní hned (optimisticky), server ho ověří proti pořadí, které správce viděl,
 * a při chybě nebo souběhu se vrátí původní stav. Nabídka ⋯ (Posunout výš / níž) zůstává jako další cesta.
 */
export function TopicOrderList({
  items,
  ordered,
  className,
  sortable,
}: {
  items: TopicOrderItem[];
  /** Garantovaná témata mají pořadí 1–3, ukáže se u řádku i ostatním. */
  ordered: boolean;
  className: string;
  /** Jen správce; ostatní vidí stejný seznam bez úchytů. */
  sortable: boolean;
}) {
  const router = useRouter();
  const serverOrder = items.map((i) => i.id).join(",");
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const drag = useRef<Drag | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // Nové pořadí ze serveru (po uložení, obnovení nebo změně jiného správce) přepíše místní stav, když se netáhne.
  useEffect(() => {
    if (!drag.current) setOrder(serverOrder.split(",").filter(Boolean));
  }, [serverOrder]);

  const byId = new Map(items.map((i) => [i.id, i]));
  const visible = order.filter((id) => byId.has(id));
  const nameOf = (id: string) => byId.get(id)?.name ?? "";

  function save(id: string, before: string[], after: string[]) {
    const to = after.indexOf(id);
    if (to === before.indexOf(id)) return;
    setError(null);
    setAnnounce(`Téma ${nameOf(id)} je na ${to + 1}. místě z ${after.length}.`);
    const data = new FormData();
    data.set("topicId", id);
    data.set("to", String(to));
    data.set("expected", before.join(","));
    startTransition(async () => {
      const result = await moveTopicAction(null, data);
      if (!result.ok) {
        // Vrátit, co správce viděl, a načíst aktuální pořadí (mohl ho mezitím změnit někdo jiný).
        setOrder(before);
        setError(result.error ?? "Pořadí se nepodařilo uložit.");
        setAnnounce("Pořadí se nepodařilo uložit, vráceno původní.");
        router.refresh();
      }
    });
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (pending || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, pointerId: event.pointerId, startY: event.clientY, moved: false, before: visible, order: visible };
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    if (!d.moved) {
      if (Math.abs(event.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.moved = true;
      setDragId(d.id);
    }
    // Cíl = první řádek (kromě taženého), jehož střed je pod ukazatelem. Řádky se přeskládají hned.
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>(":scope > [data-topic]") ?? [])];
    const others = rows.filter((row) => row.dataset.topic !== d.id);
    let target = others.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    if (target < 0) target = others.length;
    const rest = d.order.filter((id) => id !== d.id);
    const next = [...rest.slice(0, target), d.id, ...rest.slice(target)];
    if (next.join(",") === d.order.join(",")) return;
    d.order = next;
    setOrder(next);
  }

  function finish(event: PointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragId(null);
    if (!d.moved) return;
    if (cancelled) {
      setOrder(d.before);
      return;
    }
    save(d.id, d.before, d.order);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (event.key === "Escape" && drag.current) {
      setOrder(drag.current.before);
      drag.current = null;
      setDragId(null);
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (pending) return;
    const from = visible.indexOf(id);
    const to = event.key === "ArrowUp" ? from - 1 : from + 1;
    if (to < 0 || to >= visible.length) return;
    const after = visible.filter((x) => x !== id);
    after.splice(to, 0, id);
    setOrder(after);
    save(id, visible, after);
  }

  const List = ordered ? "ol" : "ul";
  return (
    <>
      <List ref={listRef as never} className={dragId ? `${className} topic-dragging` : className}>
        {visible.map((id, index) => {
          const item = byId.get(id)!;
          const classes = [item.className, (sortable || ordered) && "topic-has-lead", dragId === id && "topic-dragged"].filter(Boolean).join(" ");
          return (
            <li key={id} className={classes} data-topic={id}>
              {(sortable || ordered) && (
                <div className="topic-lead">
                  {sortable && (
                    <button
                      type="button"
                      className="topic-handle"
                      aria-label={`Změnit pořadí: ${item.name}`}
                      aria-describedby="tema-poradi-napoveda"
                      title="Přetáhněte, nebo použijte šipky nahoru a dolů"
                      onPointerDown={(e) => onPointerDown(e, id)}
                      onPointerMove={onPointerMove}
                      onPointerUp={(e) => finish(e, false)}
                      onPointerCancel={(e) => finish(e, true)}
                      onLostPointerCapture={(e) => finish(e, false)}
                      onKeyDown={(e) => onKeyDown(e, id)}
                    >
                      <Icon name="grip" size={16} />
                    </button>
                  )}
                  {ordered && (
                    <span className="topic-rank" aria-hidden="true">
                      {index + 1}
                    </span>
                  )}
                </div>
              )}
              {item.content}
            </li>
          );
        })}
      </List>
      {error && (
        <p className="form-error topic-order-error" role="alert">
          {error}
        </p>
      )}
      {sortable && (
        <p className="visually-hidden" aria-live="polite">
          {announce}
        </p>
      )}
    </>
  );
}
