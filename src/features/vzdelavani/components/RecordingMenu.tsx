"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Menu } from "@/components/Menu";
import { Modal } from "@/components/Modal";
import { withdrawMinutesAction } from "../actions";
import { UploadForm } from "./UploadForm";

/**
 * Méně časté kroky u nahrávky v jedné nabídce: nahrazení nahrávky (v okně) a stažení zveřejněného zápisu.
 * Hlavní práce, kontrola a zveřejnění zápisu, zůstává přímo v sekci.
 */
export function RecordingMenu({ eventId, eventLabel, canWithdraw }: { eventId: string; eventLabel: string; canWithdraw: boolean }) {
  const [replacing, setReplacing] = useState(false);
  return (
    <>
      <Menu label="Další možnosti nahrávky" small iconOnly>
        <button type="button" className="btn" onClick={() => setReplacing(true)}>
          Nahradit nahrávku…
        </button>
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
      <Modal open={replacing} title="Nahradit nahrávku" onRequestClose={() => setReplacing(false)}>
        <UploadForm eventId={eventId} eventLabel={eventLabel} replacing />
      </Modal>
    </>
  );
}
