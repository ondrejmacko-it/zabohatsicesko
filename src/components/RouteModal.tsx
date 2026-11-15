"use client";

import { useRouter } from "next/navigation";
import { Modal } from "./Modal";

/** Okno řízené adresou: zavření vrátí uživatele na `closeHref` a nechá stránku pod oknem tam, kde byla. */
export function RouteModal({ title, closeHref, children, wide }: { title: string; closeHref: string; children: React.ReactNode; wide?: boolean }) {
  const router = useRouter();
  return (
    <Modal open title={title} wide={wide} onRequestClose={() => router.replace(closeHref, { scroll: false })}>
      {children}
    </Modal>
  );
}

/**
 * Okno pro neplatný nebo cizí odkaz (`?akce=`, `?zapis=`). Neříká, jestli záznam existuje, a vrací na stejnou
 * stránku se zachovaným měsícem a filtrem.
 */
export function UnavailableModal({ title, closeHref, backLabel }: { title: string; closeHref: string; backLabel: string }) {
  const router = useRouter();
  const close = () => router.replace(closeHref, { scroll: false });
  return (
    <Modal open title={title} onRequestClose={close}>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={close}>
          {backLabel}
        </button>
      </div>
    </Modal>
  );
}
