"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = {
  open: boolean;
  title: string;
  /** Zavření křížkem, Esc, klikem mimo nebo tlačítkem. Komponenta rodiče může zavření odmítnout (neuložené změny). */
  onRequestClose: () => void;
  children: React.ReactNode;
  /** „extra“: okno se seznamem řádků (Připravit měsíc), na desktopu se vejde řádek s více poli vedle sebe. */
  wide?: boolean | "extra";
  /** Rodič si rozepsané změny hlídá sám (dialog akce), okno se proto na nic neptá. */
  selfGuarded?: boolean;
  /**
   * Rodič porovnává hodnoty formuláře sám (okno akce). Když je zadané, okno se při zavření ptá jen podle
   * něj, ne podle otisku polí: rozbalení dalších polí nebo změna a vrácení hodnoty se za změnu nepočítá.
   * Funkce, ne hodnota: čte se až v okamžiku zavření, takže nezávisí na tom, jestli se rodič už překreslil.
   */
  hasUnsavedChanges?: () => boolean;
};

const subscribeNever = () => () => {};

/**
 * Otisk všech polí v okně. Rozepsané změny se poznají podle toho, že se otisk od otevření změnil. Pomocná
 * pole bez vlastních dat (`data-unsaved-ignore`, např. volba pro hromadné doplnění) se nepočítají.
 */
function fieldsFingerprint(root: HTMLElement): string {
  const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input:not([type='hidden']):not([data-unsaved-ignore]), textarea:not([data-unsaved-ignore]), select:not([data-unsaved-ignore])",
  );
  return [...fields].map((field) => (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio") ? String(field.checked) : field.value)).join("\u0001");
}

/**
 * Vrátí fokus tam, odkud se okno otevřelo. Položka zavřeného menu je skrytá a fokus by nepřijala,
 * proto se fokus vrátí na tlačítko menu.
 */
function focusBack(origin: HTMLElement | null) {
  if (!origin?.isConnected) return;
  const target = origin.closest("[hidden]") ? origin.closest(".menu")?.querySelector<HTMLElement>(":scope > button") : origin;
  target?.focus();
}

/**
 * Přístupný modální dialog nad nativním <dialog>: past fokusu, Esc, klik mimo, návrat fokusu po zavření.
 *
 * Okno se vykresluje přímo do <body>, ne do místa, kde je v kódu. Druhé okno otevřené z prvního tak není
 * uvnitř jeho rolované části a první okno po dobu práce v druhém schová (pravidlo v globals.css).
 * Zavření s rozepsaným formulářem se nejdřív zeptá.
 */
export function Modal({ open, title, onRequestClose, children, wide, selfGuarded, hasUnsavedChanges }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  const initialFields = useRef("");
  const titleId = useId();
  const [confirming, setConfirming] = useState(false);
  const [save, setSave] = useState<HTMLButtonElement | null>(null);
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
      focusBack(returnFocus);
    };
  }, [shown]);

  if (!shown) return null;

  // Bezpečné uložení nabídne potvrzení jen tehdy, když ho okno má (`data-confirm-save`) a formulář je platný.
  const saveButton = () => {
    const button = ref.current?.querySelector<HTMLButtonElement>("button[data-confirm-save]");
    return button && !button.disabled && button.form?.checkValidity() ? button : null;
  };

  const requestClose = () => {
    const unsaved = hasUnsavedChanges ? hasUnsavedChanges() : ref.current !== null && fieldsFingerprint(ref.current) !== initialFields.current;
    if (!selfGuarded && unsaved) {
      setSave(saveButton());
      setConfirming(true);
    }
    else onRequestClose();
  };

  return createPortal(
    <dialog
      ref={ref}
      className={wide === "extra" ? "dialog dialog-wide dialog-extra" : wide ? "dialog dialog-wide" : "dialog"}
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
      <div
        className="dialog-body"
        // Tlačítko „Zavřít“ dole ve formuláři (`data-modal-close`) se chová stejně jako to v záhlaví: s rozepsanými
        // změnami se nejdřív zeptá. „Zrušit úpravy“ naopak změny zahodí bez dotazu, říká to samo.
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[data-modal-close]")) requestClose();
        }}
      >
        <div className="spread dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-small" onClick={requestClose}>
            Zavřít
          </button>
        </div>
        {children}
      </div>
      <ConfirmDialog
        open={confirming}
        title="Neuložené změny"
        description={<p>Změny ještě nejsou uložené.</p>}
        onCancel={() => setConfirming(false)}
      >
        <button type="button" className="btn btn-primary" onClick={() => setConfirming(false)} autoFocus>
          Pokračovat v úpravách
        </button>
        {save && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setConfirming(false);
              save.form?.requestSubmit(save);
            }}
          >
            {save.dataset.confirmSave}
          </button>
        )}
        <button type="button" className="btn btn-danger confirm-destructive" onClick={onRequestClose}>
          Zahodit změny
        </button>
      </ConfirmDialog>
    </dialog>,
    document.body,
  );
}
