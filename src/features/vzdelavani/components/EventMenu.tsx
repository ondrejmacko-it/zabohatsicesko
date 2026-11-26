"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Children, useActionState, useEffect, useRef, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { Icon, type IconName } from "@/components/Icon";
import { Menu } from "@/components/Menu";
import { flash } from "@/components/FlashMessage";
import { Modal } from "@/components/Modal";
import { submitKeepingValues } from "@/features/shared/keep-values";
import type { CancelImpact } from "@/server/services/impact";
import { cancelEventAction, deleteDraftAction, previewCancelAction, type ActionResult } from "../actions";
import { lockedProps, usePreviewLock } from "@/components/PreviewLock";

type Props = {
  id: string;
  revision: number;
  canCancel: boolean;
  canDelete: boolean;
  /** Odkazy nahoře v nabídce (zápis, celý detail). Ikona drží položky nabídky jednotné (A-09). */
  links?: Array<{ href: string; label: string; icon: IconName }>;
  /** Odkaz na Přidat akci předvyplněnou podle této akce (`?kopie=`). */
  copyHref?: string;
  /** Další položky připravené serverem, například „Nahradit pravidelný termín“. */
  children?: React.ReactNode;
};

/** Další možnosti akce v jedné nabídce: odkazy, méně časté úpravy a pod čarou zrušení nebo smazání. */
export function EventMenu({ id, revision, canCancel, canDelete, links = [], copyHref, children }: Props) {
  const [dialog, setDialog] = useState<"cancel" | "delete" | null>(null);
  const hasExtra = Children.toArray(children).length > 0 || Boolean(copyHref);
  if (!canCancel && !canDelete && links.length === 0 && !hasExtra) return null;
  return (
    <>
      <Menu label="Další možnosti">
        {links.map((link) => (
          <Link key={link.href} className="btn" href={link.href}>
            <Icon name={link.icon} />
            {link.label}
          </Link>
        ))}
        {copyHref && (
          <Link className="btn" href={copyHref} scroll={false}>
            <Icon name="copy" />
            Duplikovat akci
          </Link>
        )}
        {children}
        {(canCancel || canDelete) && (links.length > 0 || hasExtra) && <hr className="menu-divider" />}
        {canCancel && (
          <button type="button" className="btn menu-danger" onClick={() => setDialog("cancel")}>
            <Icon name="ban" />
            Zrušit akci…
          </button>
        )}
        {canDelete && (
          <button type="button" className="btn menu-danger" onClick={() => setDialog("delete")}>
            <Icon name="trash" />
            Smazat návrh…
          </button>
        )}
      </Menu>
      {dialog === "cancel" && <CancelDialog id={id} revision={revision} onClose={() => setDialog(null)} />}
      {dialog === "delete" && <DeleteDialog id={id} revision={revision} onClose={() => setDialog(null)} />}
    </>
  );
}

export function CancelDialog({ id, revision, onClose }: { id: string; revision: number; onClose: () => void }) {
  const lock = lockedProps(usePreviewLock());
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
          {impact === "failed" && <p className="small">Příjemce oznámení se nepodařilo ověřit.</p>}
          {impact && impact !== "failed" && (
            <ul className="prose-list">
              <li>Zrušení a důvod uvidí ve Wiki skupina {impact.audience}.</li>
              {impact.guests.length > 0 && (
                <li>
                  Kalendář odešle oznámení {impact.guests.length === 1 ? "1 hostovi" : `${impact.guests.length} hostům`} ({impact.guests.join(", ")}).
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
              Ověřit znovu
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
          <button type="submit" className="btn btn-danger" disabled={pending || impact === null || (unverified && !acceptUnverified)} {...lock}>
            Zrušit akci
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Zpět
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Potvrzení smazání návrhu. Z okna akce vede po smazání na Plán, z menu karty (`stay`) zůstane na aktuální
 * adrese Plánu (měsíc, pohled, filtry) a jen ji obnoví.
 */
export function DeleteDialog({ id, revision, onClose, stay = false }: { id: string; revision: number; onClose: () => void; stay?: boolean }) {
  const router = useRouter();
  const lock = lockedProps(usePreviewLock());
  const [state, action, pending] = useActionState(deleteDraftAction, null);
  const handled = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (!state?.ok || handled.current === state) return;
    handled.current = state;
    if (stay) {
      flash(state.message);
      onClose();
      router.refresh();
    } else router.push("/vzdelavani/harmonogram");
  }, [state, router, stay, onClose]);
  return (
    <Modal open title="Smazat návrh" onRequestClose={onClose}>
      <form action={action} className="stack">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="revision" value={revision} />
        <p>Návrh se smaže. Pokud vznikl z Pravidelného týdne, doplnění měsíce ho znovu nevytvoří. Vrátit ho jde v Připravit měsíc tlačítkem Obnovit smazané návrhy.</p>
        <ActionMessage state={state} />
        <div className="row">
          <button type="submit" className="btn btn-danger" disabled={pending} {...lock}>
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
