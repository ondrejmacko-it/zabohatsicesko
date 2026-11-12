"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { cancelEventAction, deleteDraftAction, type ActionResult } from "../actions";

/** Kontextové možnosti detailu akce: zrušení zveřejněné akce a smazání návrhu. */
export function EventMenu({ id, revision, canCancel, canDelete }: { id: string; revision: number; canCancel: boolean; canDelete: boolean }) {
  const [dialog, setDialog] = useState<"cancel" | "delete" | null>(null);
  if (!canCancel && !canDelete) return null;
  return (
    <>
      <details className="menu">
        <summary className="btn" aria-label="Další možnosti">
          <Icon name="more" /> Další možnosti
        </summary>
        <div className="menu-list">
          {canCancel && (
            <button type="button" className="btn" onClick={() => setDialog("cancel")}>
              Zrušit akci…
            </button>
          )}
          {canDelete && (
            <button type="button" className="btn" onClick={() => setDialog("delete")}>
              Smazat návrh…
            </button>
          )}
        </div>
      </details>
      {dialog === "cancel" && <CancelDialog id={id} revision={revision} onClose={() => setDialog(null)} />}
      {dialog === "delete" && <DeleteDialog id={id} revision={revision} onClose={() => setDialog(null)} />}
    </>
  );
}

function CancelDialog({ id, revision, onClose }: { id: string; revision: number; onClose: () => void }) {
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await cancelEventAction(prev, formData);
    if (result.ok) onClose();
    return result;
  }, null);
  return (
    <Modal open title="Zrušit akci" onRequestClose={onClose}>
      <form action={action} className="stack">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="revision" value={revision} />
        <p>
          Akce zůstane v harmonogramu se stavem Zrušeno. Pozvaní dostanou z Kalendáře zprávu o zrušení. Ostatní
          termíny se nemění.
        </p>
        <label className="field">
          <span className="field-label">Důvod zrušení (uvidí ho kolegové ve Wiki)</span>
          <textarea className="textarea" name="reason" required minLength={3} maxLength={300} />
        </label>
        <ActionMessage state={state} />
        <div className="row">
          <button type="submit" className="btn btn-danger" disabled={pending}>
            Zrušit akci a informovat pozvané
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Zpět
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ id, revision, onClose }: { id: string; revision: number; onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteDraftAction, null);
  useEffect(() => {
    if (state?.ok) router.push("/vzdelavani/harmonogram");
  }, [state, router]);
  return (
    <Modal open title="Smazat návrh" onRequestClose={onClose}>
      <form action={action} className="stack">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="revision" value={revision} />
        <p>Návrh se smaže. Pokud vznikl ze šablony, další doplnění měsíce ho už znovu nevytvoří.</p>
        <ActionMessage state={state} />
        <div className="row">
          <button type="submit" className="btn btn-danger" disabled={pending}>
            Smazat návrh
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Zpět
          </button>
        </div>
      </form>
    </Modal>
  );
}
