"use client";

import { useRouter } from "next/navigation";
import { Modal } from "./Modal";

/** Okno řízené adresou: zavření vrátí uživatele na `closeHref` a nechá stránku pod oknem tam, kde byla. */
export function RouteModal({ title, closeHref, children }: { title: string; closeHref: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Modal open title={title} onRequestClose={() => router.replace(closeHref, { scroll: false })}>
      {children}
    </Modal>
  );
}
