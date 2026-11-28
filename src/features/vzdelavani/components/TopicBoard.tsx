"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { lockedProps, usePreviewLock } from "@/components/PreviewLock";
import { placeInSections, type TopicSection } from "@/server/domain/topics";
import { placeTopicAction } from "../actions";

export type TopicOrderItem = { id: string; name: string; className: string; content: ReactNode };

type Order = { guaranteed: string[]; others: string[] };
type Slot = { section: TopicSection; index: number };
/** Obdélník v souřadnicích dokumentu (nezávisí na posunu stránky během tažení). */
type Box = { top: number; bottom: number };

type Drag = {
  id: string;
  pointerId: number;
  startY: number;
  /** Vzdálenost ukazatele od horní hrany řádku, aby náhled „držel“ tam, kde ho správce chytil. */
  grabOffset: number;
  moved: boolean;
  before: Order;
  /** Řádky bez taženého, zachycené při startu. DOM se během tažení nemění, takže zůstávají platné. */
  rows: Array<Box & { section: TopicSection }>;
  zones: Record<TopicSection, Box>;
  clientY: number;
  slot: Slot | null;
};

/** Práh v pixelech, od kterého se pohyb s úchytem bere jako tažení (ne jako ťuknutí). */
const DRAG_THRESHOLD = 4;
/** Pás u horní a dolní hrany okna, ve kterém se stránka při tažení sama posouvá. */
const SCROLL_EDGE = 72;
const SCROLL_MAX_STEP = 18;

const listOf = (order: Order, section: TopicSection) => (section === "guaranteed" ? order.guaranteed : order.others);
const sectionOf = (order: Order, id: string): TopicSection => (order.guaranteed.includes(id) ? "guaranteed" : "other");
const docBox = (el: Element): Box => {
  const rect = el.getBoundingClientRect();
  return { top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY };
};

/**
 * Garantovaná a ostatní témata v jednom kontextu přetahování. Správce chytí úchyt (myš i prst, pointer events,
 * úchyt má `touch-action: none`) a přetáhne téma kamkoli, i do druhé skupiny nebo do prázdné. Během tažení se
 * pořadí v DOM nemění: řádek zůstane na místě jako zástupné místo, ukazatel sleduje náhled a linka ukazuje, kam
 * téma dopadne. Cíl se počítá z rozměrů řádků zachycených při startu, u okraje okna se stránka posouvá sama.
 * Po puštění jedna serverová operace (`placeTopicAction`) s pořadím obou skupin, jak je správce viděl;
 * změna se ukáže hned, při chybě nebo souběhu se vrátí. Esc tažení zruší.
 * Klávesnice: šipky na úchytu posouvají o jedno místo, přes hranu skupiny téma přejde do druhé skupiny.
 */
export function TopicBoard({
  guaranteed,
  others,
  sortable: sortableProp,
  guaranteedHead,
  othersHead,
  filter,
}: {
  guaranteed: TopicOrderItem[];
  others: TopicOrderItem[];
  /** Jen správce; ostatní vidí stejné seznamy bez úchytů. */
  sortable: boolean;
  guaranteedHead: ReactNode;
  othersHead: ReactNode;
  /** Filtr Pro mou roli / Všechna ze serveru; stojí ve stejné liště jako hledání. */
  filter?: ReactNode;
}) {
  const router = useRouter();
  const locked = usePreviewLock();
  const serverKey = `${guaranteed.map((i) => i.id).join(",")}|${others.map((i) => i.id).join(",")}`;
  const [order, setOrder] = useState<Order>(() => ({ guaranteed: guaranteed.map((i) => i.id), others: others.map((i) => i.id) }));
  // Dotaz žije v URL (`hledat`), aby se po návratu z detailu nebo po obnovení stránky neztratil.
  const searchParams = useSearchParams();
  const [query, setQueryState] = useState(() => searchParams.get("hledat") ?? "");
  function setQuery(value: string) {
    setQueryState(value);
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set("hledat", value);
    else url.searchParams.delete("hledat");
    window.history.replaceState(window.history.state, "", url);
  }
  const needle = normalizeName(query.trim());
  // Při hledání se pořadí nemění: posun o jedno místo by přeskočil skrytá témata.
  const sortable = sortableProp && !needle;
  const [dragId, setDragId] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [announce, setAnnounce] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const drag = useRef<Drag | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const focusAfter = useRef<string | null>(null);

  // Nové pořadí ze serveru (po uložení, obnovení nebo změně jiného správce) přepíše místní stav, když se netáhne.
  useEffect(() => {
    if (drag.current) return;
    // Pořadí ze serveru může řádek přesunout do druhého seznamu (nový prvek): fokus na úchytu se nesmí ztratit.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.dataset.handle && boardRef.current?.contains(active)) focusAfter.current = active.dataset.handle;
    const [g = "", o = ""] = serverKey.split("|");
    setOrder({ guaranteed: g.split(",").filter(Boolean), others: o.split(",").filter(Boolean) });
  }, [serverKey]);

  // Klávesnicový přesun do druhé skupiny přesune řádek do jiného seznamu (nový prvek): fokus zůstane na úchytu.
  useLayoutEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    boardRef.current?.querySelector<HTMLElement>(`[data-handle="${CSS.escape(id)}"]`)?.focus();
  });

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Esc patří jen tažení: zruší ho a nezavře okno ani nabídku pod ním. Posluchač žije jen po dobu tažení.
  const endRef = useRef<(commit: boolean) => void>(() => {});
  useEffect(() => {
    if (!dragId) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !drag.current) return;
      event.preventDefault();
      event.stopPropagation();
      endRef.current(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dragId]);

  // Posun stránky (kolečko, autoscroll, zkrácení stránky) mění cíl i bez pohybu ukazatele.
  useEffect(() => {
    if (!dragId) return;
    const onScroll = () => {
      if (drag.current?.moved) update(drag.current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- update čte jen refy a stabilní setter
  }, [dragId]);

  // Linka a náhled vznikají až s prvním překreslením tažení: hned dostanou polohu.
  useLayoutEffect(() => {
    if (drag.current?.moved) update(drag.current);
  });

  const byId = new Map([...guaranteed, ...others].map((i) => [i.id, i]));
  const visible: Order = { guaranteed: order.guaranteed.filter((id) => byId.has(id)), others: order.others.filter((id) => byId.has(id)) };
  const nameOf = (id: string) => byId.get(id)?.name ?? "";

  function describe(id: string, next: Order, from: TopicSection) {
    const section = sectionOf(next, id);
    const list = listOf(next, section);
    const place = `${list.indexOf(id) + 1}. místě z ${list.length}`;
    if (section === from) return `Téma ${nameOf(id)} je na ${place}.`;
    return section === "guaranteed" ? `Téma ${nameOf(id)} je garantované, na ${place}.` : `Téma ${nameOf(id)} už není garantované, je mezi ostatními na ${place}.`;
  }

  /** Jedna serverová operace: přesun na cíl s kontrolou pořadí, které správce viděl. */
  function save(id: string, before: Order, target: Slot) {
    const after = placeInSections(before, id, target.section, target.index);
    if (!after) return;
    setError(null);
    setOrder(after);
    setAnnounce(describe(id, after, sectionOf(before, id)));
    const data = new FormData();
    data.set("topicId", id);
    data.set("section", target.section);
    data.set("to", String(target.index));
    data.set("expectedGuaranteed", before.guaranteed.join(","));
    data.set("expectedOthers", before.others.join(","));
    startTransition(async () => {
      const result = await placeTopicAction(null, data);
      if (!result.ok) {
        // Vrátit, co správce viděl, a načíst aktuální pořadí (mohl ho mezitím změnit někdo jiný).
        setOrder(before);
        setError(result.error ?? "Pořadí se nepodařilo uložit.");
        setAnnounce("Pořadí se nepodařilo uložit, vráceno původní.");
        router.refresh();
      }
    });
  }

  /** Cíl pro svislou polohu ukazatele: skupina podle hranice mezi seznamy, místo podle středů řádků. */
  function slotAt(d: Drag, docY: number): { slot: Slot; lineY: number } {
    const { guaranteed: g, other: o } = d.zones;
    const section: TopicSection = docY < (g.bottom + o.top) / 2 ? "guaranteed" : "other";
    const rows = d.rows.filter((r) => r.section === section);
    const index = rows.filter((r) => (r.top + r.bottom) / 2 < docY).length;
    const zone = d.zones[section];
    const lineY = rows.length === 0 ? (zone.top + zone.bottom) / 2 : index < rows.length ? rows[index]!.top : rows[rows.length - 1]!.bottom;
    return { slot: { section, index }, lineY };
  }

  function update(d: Drag) {
    const board = boardRef.current;
    if (!board) return;
    const docY = d.clientY + window.scrollY;
    const { slot: next, lineY } = slotAt(d, docY);
    const boardTop = board.getBoundingClientRect().top + window.scrollY;
    // Náhled je `fixed`: absolutní prvek pod koncem stránky by ji prodloužil a autoscroll by jel do prázdna.
    const overlay = overlayRef.current;
    if (overlay) {
      const rect = board.getBoundingClientRect();
      overlay.style.left = `${rect.left + 8}px`;
      overlay.style.width = `${rect.width - 16}px`;
      overlay.style.transform = `translateY(${d.clientY - d.grabOffset}px)`;
    }
    if (lineRef.current) lineRef.current.style.transform = `translateY(${lineY - boardTop}px)`;
    if (!d.slot || d.slot.section !== next.section || d.slot.index !== next.index) {
      d.slot = next;
      setSlot(next);
    }
  }

  // Automatické posouvání: dokud je ukazatel u hrany okna, stránka se posouvá i bez pohybu myši.
  function autoscroll() {
    const d = drag.current;
    if (!d || !d.moved) return;
    const y = d.clientY;
    const step =
      y < SCROLL_EDGE ? -Math.ceil(((SCROLL_EDGE - y) / SCROLL_EDGE) * SCROLL_MAX_STEP) : y > window.innerHeight - SCROLL_EDGE ? Math.ceil(((y - window.innerHeight + SCROLL_EDGE) / SCROLL_EDGE) * SCROLL_MAX_STEP) : 0;
    if (step) {
      const beforeScroll = window.scrollY;
      window.scrollBy(0, step);
      if (window.scrollY !== beforeScroll) update(d);
    }
    frame.current = requestAnimationFrame(autoscroll);
  }

  function end(commit: boolean) {
    const d = drag.current;
    drag.current = null;
    cancelAnimationFrame(frame.current);
    setDragId(null);
    setSlot(null);
    if (!d?.moved) return;
    if (!commit || !d.slot) {
      setAnnounce("Přesun zrušen.");
      return;
    }
    save(d.id, d.before, d.slot);
  }

  endRef.current = end;

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (pending || drag.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    const board = boardRef.current;
    const row = event.currentTarget.closest("[data-topic]");
    if (!board || !row) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rows = [...board.querySelectorAll<HTMLElement>("[data-topic]")]
      .filter((el) => el.dataset.topic !== id)
      .map((el) => ({ ...docBox(el), section: (el.dataset.section as TopicSection) ?? "other" }));
    const zone = (section: TopicSection) => board.querySelector(`[data-zone="${section}"]`);
    const g = zone("guaranteed");
    const o = zone("other");
    if (!g || !o) return;
    drag.current = {
      id,
      pointerId: event.pointerId,
      startY: event.clientY,
      grabOffset: event.clientY - row.getBoundingClientRect().top,
      moved: false,
      before: visible,
      rows,
      zones: { guaranteed: docBox(g), other: docBox(o) },
      clientY: event.clientY,
      slot: null,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    d.clientY = event.clientY;
    if (!d.moved) {
      if (Math.abs(event.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.moved = true;
      setDragId(d.id);
      frame.current = requestAnimationFrame(autoscroll);
    }
    update(d);
  }

  function onPointerEnd(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    end(commit);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (pending || drag.current) return;
    const section = sectionOf(visible, id);
    const list = listOf(visible, section);
    const index = list.indexOf(id);
    let target: Slot | null = null;
    if (event.key === "ArrowUp") target = index > 0 ? { section, index: index - 1 } : section === "other" ? { section: "guaranteed", index: visible.guaranteed.length } : null;
    else target = index < list.length - 1 ? { section, index: index + 1 } : section === "guaranteed" ? { section: "other", index: 0 } : null;
    if (!target) return;
    focusAfter.current = id;
    save(id, visible, target);
  }

  function renderList(section: TopicSection) {
    const ids = listOf(visible, section).filter((id) => !needle || normalizeName(byId.get(id)!.name).includes(needle));
    const ordered = section === "guaranteed";
    const target = slot?.section === section;
    if (ids.length === 0) {
      if (!sortable) return null;
      return (
        <div data-zone={section} className={target ? "topic-drop-empty is-target" : "topic-drop-empty"}>
          {ordered ? "Zatím žádné. Přetáhni sem téma, které se má plánovat přednostně." : "Žádná další témata. Přetáhni sem téma, které nemá mít přednost."}
        </div>
      );
    }
    const List = ordered ? "ol" : "ul";
    const classes = ["topic-list", ordered && "topic-guaranteed", target && dragId && "is-target"].filter(Boolean).join(" ");
    return (
      <List data-zone={section} className={classes}>
        {ids.map((id, index) => {
          const item = byId.get(id)!;
          // Úchyt i číslo pořadí jen pro správce (F11). Ostatní vidí čistý seznam, pořadí nese samo řazení.
          const rowClasses = [item.className, sortable && "topic-has-lead", dragId === id && "topic-dragged"].filter(Boolean).join(" ");
          return (
            <li key={id} className={rowClasses} data-topic={id} data-section={section}>
              {sortable && (
                <div className="topic-lead">
                  {locked ? (
                    <button type="button" className="topic-handle" aria-label={`Změnit pořadí: ${item.name}`} {...lockedProps(true)}>
                      <Icon name="grip" size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="topic-handle"
                      data-handle={id}
                    aria-label={`Změnit pořadí: ${item.name}`}
                    aria-describedby="tema-poradi-napoveda"
                    title="Přetáhni, nebo použij šipky nahoru a dolů"
                    onPointerDown={(e) => onPointerDown(e, id)}
                    onPointerMove={onPointerMove}
                    onPointerUp={(e) => onPointerEnd(e, true)}
                    onPointerCancel={(e) => onPointerEnd(e, false)}
                    // Ztráta zachycení bez puštění (např. systémové gesto) přesun neuloží.
                    onLostPointerCapture={(e) => onPointerEnd(e, false)}
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
    );
  }

  const matches = (id: string) => !needle || normalizeName(byId.get(id)!.name).includes(needle);
  const showGuaranteed = visible.guaranteed.some(matches) || sortable;
  const showOthers = visible.others.some(matches) || (sortable && visible.guaranteed.length > 0);
  const total = visible.guaranteed.length + visible.others.length;
  return (
    <div ref={boardRef} className={dragId ? "topic-board topic-dragging" : "topic-board"} aria-busy={pending || undefined}>
      {(filter || total > 1) && (
        <div className="topic-toolbar">
          {filter}
          {total > 1 && (
            <label className="field topic-search">
              <span className="visually-hidden">Hledat téma</span>
              <Icon name="search" size={16} />
              <input className="input" type="search" placeholder="Hledat téma" value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && (
                <button type="button" className="topic-search-clear" aria-label="Vymazat hledání" onClick={() => setQuery("")}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </label>
          )}
        </div>
      )}
      {needle && !showGuaranteed && !showOthers && (
        <div className="empty-state topic-search-empty" role="status">
          <p className="item-title">Žádné téma neodpovídá hledání „{query.trim()}“.</p>
          <button type="button" className="btn btn-small" onClick={() => setQuery("")}>
            Zrušit hledání
          </button>
        </div>
      )}
      {sortableProp && needle && (showGuaranteed || showOthers) && (
        <p className="item-meta topic-filter-note">
          Při hledání nejde měnit pořadí.{" "}
          <button type="button" className="link-button" onClick={() => setQuery("")}>
            Zrušit hledání
          </button>
        </p>
      )}
      {showGuaranteed && (
        <div className="topic-group topic-group-guaranteed" aria-labelledby="temata-garantovana">
          {guaranteedHead}
          {renderList("guaranteed")}
        </div>
      )}
      {showOthers && (
        <div className="topic-group" aria-labelledby={showGuaranteed ? "temata-ostatni" : undefined}>
          {othersHead}
          {renderList("other")}
        </div>
      )}
      {dragId && (
        <>
          {/* Linka místa vložení (u prázdné skupiny se místo ní zvýrazní celá plocha) a náhled taženého tématu. */}
          {slot && listOf(visible, slot.section).length > 0 && <div ref={lineRef} className="topic-drop-line" aria-hidden="true" />}
          <div ref={overlayRef} className="topic-drag-overlay" aria-hidden="true">
            <Icon name="grip" size={16} />
            <span>{nameOf(dragId)}</span>
          </div>
        </>
      )}
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
    </div>
  );
}

/** Hledání bez ohledu na velikost písmen a diakritiku („navaznost“ najde „Návaznost“). */
export function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
