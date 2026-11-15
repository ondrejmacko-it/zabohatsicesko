"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Children, useActionState, useEffect, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Menu } from "@/components/Menu";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import type { CancelImpact } from "@/server/services/impact";
import { cancelEventAction, deleteDraftAction, previewCancelAction, type ActionResult } from "../actions";

type Props = {
  id: string;
  revision: number;
  canCancel: boolean;
  canDelete: boolean;
  /** Odkazy nahoře v nabídce (zápis, celý detail). */
  links?: Array<{ href: string; label: string }>;
  /** Další položky připravené serverem, například „Nahradit pravidelný termín“. */
  children?: React.ReactNode;
};

/** Další možnosti akce v jedné nabídce: odkazy, méně časté úpravy a pod čarou zrušení nebo smazání. */
export function EventMenu({ id, revision, canCancel, canDelete, links = [], children }: Props) {
  const [dialog, setDialog] = useState<"cancel" | "delete" | null>(null);
  const hasExtra = Children.toArray(children).length > 0;
  if (!canCancel && !canDelete && links.length === 0 && !hasExtra) return null;
  return (
    <>
      <Menu label="Další možnosti">
        {links.map((link) => (
          <Link key={link.href} className="btn" href={link.href}>
            {link.label}
          </Link>
        ))}
        {children}
        {(canCancel || canDelete) && (links.length > 0 || hasExtra) && <hr className="menu-divider" />}
        {canCancel && (
          <button type="button" className="btn menu-danger" onClick={() => setDialog("cancel")}>
            Zrušit akci…
          </button>
        )}
        {canDelete && (
          <button type="button" className="btn menu-danger" onClick={() => setDialog("delete")}>
            Smazat návrh…
          </button>
        )}
      </Menu>
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
  // Dopad se načte při otevření dialogu. Když ho nejde ověřit, správce může zkusit znovu, nebo vědomě
  // zrušit bez ověřených příjemců (audit A06). Server stejnou podmínku kontroluje znovu.
  const [impact, setImpact] = useState<CancelImpact | "failed" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [acceptUnverified, setAcceptUnverified] = useState(false);
  useEffect(() => {
    let active = true;
    previewCancelAction(id)
      .then((result) => active && setImpact(result.ok && result.impact ? result.impact : "failed"))
      .catch(() => active && setImpact("failed"));
    return () => {
      active = false;
    };
  }, [id, attempt]);
  const unverified = impact === "failed" || (impact !== null && !impact.verified);
  const informs = impact !== null && impact !== "failed" && impact.verified && impact.guests.length > 0;
  return (
    <Modal open title="Zrušit akci" onRequestClose={onClose}>
      <form action={action} onSubmit={submitKeepingValues(action)} className="stack">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="revision" value={revision} />
        <p>Akce zůstane v harmonogramu se stavem Zrušeno. Ostatní termíny se nemění.</p>
        <div className="notice" role="status" aria-live="polite">
          <p>
            <strong>Koho se zrušení dotkne</strong>
          </p>
          {impact === null && <p className="small">Zjišťuji, kdo je v pozvánce…</p>}
          {impact === "failed" && <p className="small">Dopad se nepodařilo načíst. Komu přijde zpráva o zrušení, teď nejde ověřit.</p>}
          {impact && impact !== "failed" && (
            <ul className="prose-list">
              <li>Ve Wiki uvidí stav Zrušeno a důvod skupina {impact.audience}.</li>
              {impact.guests.length > 0 && (
                <li>
                  Zprávu o zrušení z Kalendáře dostane {impact.guests.length === 1 ? "1 host" : `hostů: ${impact.guests.length}`} ({impact.guests.join(", ")}).
                </li>
              )}
              {impact.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
          {unverified && (
            <button type="button" className="btn btn-small" onClick={() => {
              setImpact(null);
              setAttempt((n) => n + 1);
            }}>
              Zkusit znovu
            </button>
          )}
        </div>
        {unverified && (
          <label className="check">
            <input type="checkbox" name="cancelUnverified" checked={acceptUnverified} onChange={(e) => setAcceptUnverified(e.target.checked)} />
            <span>Zrušit i bez ověřených příjemců. Ve Wiki se akce zruší hned, storno v Kalendáři se propíše později.</span>
          </label>
        )}
        <label className="field">
          <span className="field-label">Důvod zrušení (uvidí ho kolegové ve Wiki)</span>
          <textarea className="textarea" name="reason" required minLength={3} maxLength={300} />
        </label>
        <ActionMessage state={state} />
        <div className="row">
          <button type="submit" className="btn btn-danger" disabled={pending || impact === null || (unverified && !acceptUnverified)}>
            {informs ? "Zrušit akci a informovat pozvané" : "Zrušit akci"}
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
