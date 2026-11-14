"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Menu } from "@/components/Menu";
import { Modal } from "@/components/Modal";
import { withdrawMinutesAction } from "../actions";
import { UploadForm } from "./UploadForm";

type Props = { eventId: string; eventLabel: string; canReplace: boolean; canWithdraw: boolean };

/**
 * Méně časté kroky u nahrávky a zápisu: nahrazení nahrávky a stažení zveřejněného zápisu. Hlavní krok
 * (nahrát první záznam, zkontrolovat a zveřejnit zápis) zůstává přímo v sekci.
 */
export function RecordingMenu({ eventId, eventLabel, canReplace, canWithdraw }: Props) {
  const [replacing, setReplacing] = useState(false);
  if (!canReplace && !canWithdraw) return null;
  return (
    <>
      <Menu label="Další možnosti" small>
        {canReplace && (
          <button type="button" className="btn" onClick={() => setReplacing(true)}>
            Nahradit nahrávku…
          </button>
        )}
        {canReplace && canWithdraw && <hr className="menu-divider" />}
        {canWithdraw && (
          <ActionForm
            action={withdrawMinutesAction}
            fields={{ id: eventId }}
            label="Stáhnout zveřejněný zápis…"
            pendingLabel="Stahuji…"
            variant="danger"
            confirm={{
              title: "Stáhnout zveřejněný zápis",
              text: "Kolegové zápis přestanou vidět a z pozvánky v Kalendáři zmizí odkaz na něj. Zápis zůstane u vás jako návrh, který můžete opravit a zveřejnit znovu.",
              confirmLabel: "Stáhnout zápis",
            }}
          />
        )}
      </Menu>
      {replacing && (
        <Modal open title="Nahradit nahrávku" onRequestClose={() => setReplacing(false)}>
          <UploadForm eventId={eventId} eventLabel={eventLabel} replacing onDone={() => setReplacing(false)} />
        </Modal>
      )}
    </>
  );
}
