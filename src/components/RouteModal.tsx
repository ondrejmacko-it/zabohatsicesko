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
