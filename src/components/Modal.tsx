"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  /** Zavření křížkem, Esc, klikem mimo nebo tlačítkem. Komponenta rodiče může zavření odmítnout (neuložené změny). */
  onRequestClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  /** Rodič si rozepsané změny hlídá sám (dialog akce), okno se proto na nic neptá. */
  selfGuarded?: boolean;
};

const subscribeNever = () => () => {};

/** Otisk všech polí v okně. Rozepsané změny se poznají podle toho, že se otisk od otevření změnil. */
function fieldsFingerprint(root: HTMLElement): string {
  const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input:not([type='hidden']), textarea, select");
  return [...fields].map((field) => (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio") ? String(field.checked) : field.value)).join("\u0001");
}

/**
 * Přístupný modální dialog nad nativním <dialog>: past fokusu, Esc, klik mimo, návrat fokusu po zavření.
 *
 * Okno se vykresluje přímo do <body>, ne do místa, kde je v kódu. Druhé okno otevřené z prvního tak není
 * uvnitř jeho rolované části a první okno po dobu práce v druhém schová (pravidlo v globals.css).
 * Zavření s rozepsaným formulářem se nejdřív zeptá.
 */
export function Modal({ open, title, onRequestClose, children, wide, selfGuarded }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  const initialFields = useRef("");
  const titleId = useId();
  const [confirming, setConfirming] = useState(false);
  const inBrowser = useSyncExternalStore(subscribeNever, () => true, () => false);
  const shown = open && inBrowser;

  useEffect(() => {
    const dialog = ref.current;
    if (!shown || !dialog) return;
    const returnFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    initialFields.current = fieldsFingerprint(dialog);
    return () => {
      dialog.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [shown]);

  if (!shown) return null;

  const requestClose = () => {
    if (!selfGuarded && ref.current && fieldsFingerprint(ref.current) !== initialFields.current) setConfirming(true);
    else onRequestClose();
  };

  return createPortal(
    <dialog
      ref={ref}
      className={wide ? "dialog dialog-wide" : "dialog"}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc v okně otevřeném z tohoto okna patří jen tomu vnořenému.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        requestClose();
      }}
      // Klik mimo okno dopadne na samotný <dialog> (jeho pozadí). Tah myší začatý uvnitř okna se nepočítá.
      onMouseDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedOutside.current) requestClose();
        pressedOutside.current = false;
      }}
    >
      <div className="dialog-body">
        <div className="spread dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-small" onClick={requestClose}>
            Zavřít
          </button>
        </div>
        {confirming && (
          <div className="notice dialog-confirm" role="alertdialog" aria-label="Zavřít bez uložení">
            <p>
              <strong>Máte rozepsané změny.</strong> Zavřením o ně přijdete.
            </p>
            <div className="row">
              <button type="button" className="btn btn-danger btn-small" onClick={onRequestClose}>
                Zavřít bez uložení
              </button>
              <button type="button" className="btn btn-small" onClick={() => setConfirming(false)} autoFocus>
                Pokračovat v úpravách
              </button>
            </div>
          </div>
        )}
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
