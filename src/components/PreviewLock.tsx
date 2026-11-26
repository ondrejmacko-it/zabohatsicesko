"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PREVIEW_READ_ONLY } from "@/lib/labels";
import { previewApplies } from "./PreviewSwitch";

/** Zda je stránka v náhledu jen ke čtení. Čtou ho akční tlačítka, aby zůstala na místě, jen zamčená. */
export const PreviewLockContext = createContext(false);

/** Zamkne akční tlačítka na stránkách, kde aktivní náhled platí. Jinde (Správa, Integrace…) jde o vlastní účet. */
export function PreviewLockProvider({ active, children }: { active: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  return <PreviewLockContext.Provider value={active && previewApplies(pathname ?? "")}>{children}</PreviewLockContext.Provider>;
}

export function usePreviewLock(): boolean {
  return useContext(PreviewLockContext);
}

/** Atributy zamčeného akčního tlačítka. Server mutaci v náhledu odmítne i bez nich (`preview_read_only`). */
export function lockedProps(locked: boolean) {
  return locked ? ({ disabled: true, "aria-disabled": true, title: PREVIEW_READ_ONLY } as const) : {};
}

/** Odkaz, který spouští akci (např. „Zveřejnit změny…“). V náhledu zůstane na místě jako zamčené tlačítko. */
export function LockedLink({ href, className, scroll, children }: { href: string; className?: string; scroll?: boolean; children: React.ReactNode }) {
  const locked = usePreviewLock();
  if (locked)
    return (
      <button type="button" className={className} {...lockedProps(true)}>
        {children}
      </button>
    );
  return (
    <Link className={className} href={href} scroll={scroll}>
      {children}
    </Link>
  );
}
