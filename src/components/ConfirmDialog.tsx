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
};

/**
 * Samostatné potvrzovací okno nad pracovním oknem (neuložené změny, nahrazení, smazání, zveřejnění).
 *
 * Vlastní nativní <dialog> ve vrchní vrstvě prohlížeče: okno pod ním zůstane vidět, je po dobu rozhodnutí
 * neaktivní (fokus z potvrzení neuteče) a nic se v něm neposune. Po zavření se fokus vrátí tam, kde byl.
 * `alertdialog` je správná role: jde vždy o rozhodnutí, které čeká na odpověď.
 */
export function ConfirmDialog({ open, title, description, onCancel, children, returnFocusTo }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  const titleId = useId();
  const textId = useId();
  const focusTarget = useRef(returnFocusTo);
  useEffect(() => {
    focusTarget.current = returnFocusTo;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const returnFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      const target = focusTarget.current?.() ?? returnFocus;
      if (target?.isConnected) target.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={ref}
      role="alertdialog"
      className="dialog confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onCancel={(event) => {
        // Esc patří jen tomuto rozhodnutí. Pracovní okno pod ním (React předek přes portál) se nezavírá.
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
      onMouseDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedOutside.current) onCancel();
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
