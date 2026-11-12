"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  /** Zavření křížkem, Esc nebo tlačítkem. Komponenta rodiče může zavření odmítnout (neuložené změny). */
  onRequestClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
};

/** Přístupný modální dialog nad nativním <dialog>: past fokusu, Esc, návrat fokusu po zavření. */
export function Modal({ open, title, onRequestClose, children, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocus.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={wide ? "dialog dialog-wide" : "dialog"}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
    >
      {open && (
        <div className="dialog-body">
          <div className="spread">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="btn btn-small" onClick={onRequestClose}>
              Zavřít
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
