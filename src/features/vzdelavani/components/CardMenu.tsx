"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Menu } from "@/components/Menu";
import { lockedProps, usePreviewLock } from "@/components/PreviewLock";
import type { CardAction, CardActionKind } from "../status";
import { CancelDialog, DeleteDialog } from "./EventMenu";
import { useMoveRequest, type MoveTarget } from "./MoveEvent";
import { useSelection } from "./PlanSelection";

/** Položka menu karty: akce z `cardActions` a u odkazů adresa, kterou připravil server (zachová měsíc a filtry). */
export type CardMenuItem = CardAction & { href?: string };

const ICONS: Record<CardActionKind, IconName> = {
  edit: "pencil",
  move: "move",
  duplicate: "copy",
  publish: "send",
  details: "open",
  minutes: "file",
  recording: "file",
  cancel: "ban",
  delete: "trash",
};

/**
 * Menu ⋯ v rohu karty v Plánu (mřížka, seznam, agenda). Je sourozencem odkazu karty, nikdy uvnitř něj, takže klik
 * na ⋯ neotevře okno akce ani nezačne tažení. Přesun, zveřejnění, zrušení a smazání otevřou stávající potvrzení,
 * každou akci server ověří znovu. V režimu hromadného výběru se menu schová.
 */
export function CardMenu({ target, items, className }: { target: MoveTarget; items: CardMenuItem[]; className?: string }) {
  const [dialog, setDialog] = useState<"cancel" | "delete" | null>(null);
  const requestMove = useMoveRequest();
  const selection = useSelection();
  const locked = usePreviewLock();
  // V náhledu zůstanou akční položky na místě, jen zamčené. Podrobnosti a zápis jsou čtení, fungují dál.
  const isLocked = (item: CardMenuItem) => locked && !READ_ONLY.has(item.kind);
  const shown = items.filter(
    (item) =>
      isLocked(item) ||
      ((item.kind !== "move" || requestMove) && (item.kind !== "publish" || selection?.canPublishOne(target.id)) && (item.href || !LINKS.has(item.kind))),
  );
  if (selection?.active || shown.length === 0) return null;
  const run = (kind: CardActionKind) => {
    if (kind === "move") requestMove?.(target);
    else if (kind === "publish") selection?.publishOne(target.id);
    else if (kind === "cancel" || kind === "delete") setDialog(kind);
  };
  return (
    <>
      <Menu label={`Možnosti akce ${target.label}`} variant="card" className={className}>
        {shown.map((item, index) => {
          const content = (
            <>
              <Icon name={ICONS[item.kind]} />
              {item.label}
            </>
          );
          const divider = item.danger && index > 0 ? <hr className="menu-divider" /> : null;
          return (
            <Fragment key={item.kind}>
              {divider}
              {isLocked(item) ? (
                <button type="button" className={`btn${item.danger ? " menu-danger" : ""}`} {...lockedProps(true)}>
                  {content}
                </button>
              ) : item.href ? (
                // Okno akce a kopie se otevřou nad Plánem bez posunu, celá stránka akce začne nahoře.
                <Link className="btn" href={item.href} scroll={!item.href.startsWith("/vzdelavani/harmonogram")}>
                  {content}
                </Link>
              ) : (
                <button type="button" className={`btn${item.danger ? " menu-danger" : ""}`} onClick={() => run(item.kind)}>
                  {content}
                </button>
              )}
            </Fragment>
          );
        })}
      </Menu>
      {dialog === "cancel" && <CancelDialog id={target.id} revision={target.revision} onClose={() => setDialog(null)} />}
      {dialog === "delete" && <DeleteDialog id={target.id} revision={target.revision} stay onClose={() => setDialog(null)} />}
    </>
  );
}

/** Položky, které jsou odkazem: bez adresy od serveru se nevykreslí. */
const LINKS = new Set<CardActionKind>(["edit", "duplicate", "details", "minutes", "recording"]);
/** Položky, které nic nemění, a proto fungují i v náhledu. */
const READ_ONLY = new Set<CardActionKind>(["details", "minutes"]);
