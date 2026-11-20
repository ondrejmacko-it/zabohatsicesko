"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  /** Jedna krátká věta o důsledku rozhodnutí. */
  description: React.ReactNode;
  /** Esc, klik mimo i bezpečné tlačítko: rozhodnutí se zruší, pracovní okno pod ním zůstane beze změny. */
  onCancel: () => void;
  /** Tlačítka rozhodnutí. Bezpečná volba má `autoFocus`, destruktivní je odlišená (`btn-danger`). */
  children: React.ReactNode;
  /** Kam vrátit fokus po zavření, když tlačítko, které se ptalo, mezitím zablokovala kontrola na serveru. */
  returnFocusTo?: () => HTMLElement | null | undefined;
  /**
   * Varování před ztrátou dat (zahození změn, smazání, nahrazení): role `alertdialog`, čtečka ho ohlásí
   * hned. Běžné rozhodnutí (zveřejnit, vytvořit) zůstává obyčejný `dialog`.
   */
  urgent?: boolean;
  /** Odesílá se: Esc ani klik mimo okno nezavřou, aby výsledek nezůstal bez ohlášení a nešlo odeslat podruhé. */
  busy?: boolean;
};

/** Položka zavřeného menu je skrytá a fokus by nepřijala, fokus se proto vrátí na tlačítko menu. */
function focusable(target: HTMLElement | null | undefined) {
  if (!target?.isConnected) return null;
  return target.closest("[hidden]") ? target.closest(".menu")?.querySelector<HTMLElement>(":scope > button") : target;
}

/**
 * Samostatné potvrzovací okno nad pracovním oknem (neuložené změny, nahrazení, smazání, zveřejnění).
 *
 * Vlastní nativní <dialog> ve vrchní vrstvě prohlížeče: okno pod ním zůstane vidět, je po dobu rozhodnutí
 * neaktivní (fokus z potvrzení neuteče) a nic se v něm neposune. Po zavření se fokus vrátí tam, kde byl.
 * Rozměry, odsazení, pořadí tlačítek (bezpečná volba první s fokusem, potvrzení za ní) a chování Esc a kliku
 * mimo jsou společné pro všechna potvrzení, včetně jednotlačítkových akcí v `ActionForm`.
 */
export function ConfirmDialog({ open, title, description, onCancel, children, returnFocusTo, urgent, busy }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  const titleId = useId();
  const textId = useId();
  const focusTarget = useRef(returnFocusTo);
  const busyRef = useRef(busy);
  useEffect(() => {
    focusTarget.current = returnFocusTo;
    busyRef.current = busy;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const returnFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      focusable(focusTarget.current?.() ?? returnFocus)?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={ref}
      role={urgent ? "alertdialog" : "dialog"}
      className="dialog confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onCancel={(event) => {
        // Esc patří jen tomuto rozhodnutí. Pracovní okno pod ním (React předek přes portál) se nezavírá.
        event.preventDefault();
        event.stopPropagation();
        if (!busyRef.current) onCancel();
      }}
      onMouseDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedOutside.current && !busyRef.current) onCancel();
        pressedOutside.current = false;
      }}
    >
      <div className="dialog-body confirm-body">
        <h2 id={titleId}>{title}</h2>
        <div id={textId} className="confirm-description">
          {description}
        </div>
        <div className="confirm-actions">{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}
