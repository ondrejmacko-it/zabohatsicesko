"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex='-1'])";

/**
 * Menu Účet. Na počítači kompaktní panel pod tlačítkem, na telefonu (≤640 px) samostatné okno přes celou
 * obrazovku; rozdíl je jen v CSS (`.account-panel`). Na rozdíl od obecného `Menu` se panel nepozicuje výpočtem
 * při otevření: drží ho CSS, takže rozbalení oslovení ho nevytlačí z okna. Nezavírá ho změna velikosti okna ani
 * posun, protože na telefonu obojí vyvolá vysunutá klávesnice při psaní oslovení. Zavírá Esc, křížek a klik mimo.
 * Obsah zůstává v dokumentu i po zavření, rozepsané oslovení se tak neztratí.
 */
export function AccountMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) trigger.current?.focus();
    };
    // Fokus do panelu: první pole nebo tlačítko za hlavičkou, aby čtečka začala obsahem.
    panel.current?.querySelector(".account-panel-body")?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    const phone = window.matchMedia("(max-width: 640px)");
    // Na telefonu je panel okno: stránka pod ním se neposouvá a Tab z něj neuteče.
    const lockScroll = () => document.documentElement.classList.toggle("account-panel-open", phone.matches);
    lockScroll();
    phone.addEventListener("change", lockScroll);
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab" || !phone.matches || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    // Na počítači Tab za poslední položku panel zavře (jako ostatní menu), fokus pokračuje dál stránkou.
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (!phone.matches && next && !root.current?.contains(next)) close(false);
    };
    const element = root.current;
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    element?.addEventListener("focusout", onFocusOut);
    return () => {
      document.documentElement.classList.remove("account-panel-open");
      phone.removeEventListener("change", lockScroll);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
      element?.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  return (
    <div className="menu account-menu" ref={root} data-open={open || undefined}>
      <button ref={trigger} type="button" className="btn btn-small" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <Icon name="more" size={16} />
        Účet
      </button>
      <div ref={panel} id={panelId} className="menu-list account-panel" hidden={!open} role="region" aria-labelledby={titleId}>
        <div className="account-panel-head">
          <h2 id={titleId}>Účet</h2>
          <button type="button" className="btn btn-small btn-icon" aria-label="Zavřít" title="Zavřít" onClick={() => { setOpen(false); trigger.current?.focus(); }}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="account-panel-body">{children}</div>
      </div>
    </div>
  );
}
