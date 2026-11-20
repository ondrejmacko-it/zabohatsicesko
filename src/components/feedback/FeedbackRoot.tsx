"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { submitFeedback } from "@/app/(wiki)/feedback-actions";
import { DEFAULT_BUG_DOCK, type BugDock } from "@/lib/bug-dock";
import {
  FEEDBACK_ERROR_MESSAGE,
  FEEDBACK_EXPECTED_MAX,
  FEEDBACK_TEXT_MAX,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_TYPES,
  screenshotAllowed,
  type FeedbackDraft,
  type FeedbackMark,
  type FeedbackType,
} from "@/lib/feedback";
import { Modal } from "../Modal";
import { BugButton, readBugDock, writeBugDock } from "./BugButton";
import { MarkingLayer } from "./MarkingLayer";
import { collectContext } from "./page-context";
import { captureScreenshot, type CapturedScreenshot } from "./screenshot";

/** Událost, kterou položka „Zpětná vazba“ v levém menu otevře okno (a vrátí skrytého broučka). */
export const FEEDBACK_OPEN_EVENT = "zbc:zpetna-vazba";

const TYPE_HINT: Record<FeedbackType, string> = {
  bug: "Něco nefunguje, jak má.",
  ui: "Špatně se to čte, hledá nebo ovládá.",
  idea: "Co by vám práci usnadnilo.",
  other: "Cokoli dalšího.",
};

type Step = "type" | "text" | "review" | "sent";

type Draft = { submissionId: string; type: FeedbackType | null; text: string; expected: string; marks: FeedbackMark[]; screenshot: CapturedScreenshot | null };

const emptyDraft = (): Draft => ({ submissionId: crypto.randomUUID(), type: null, text: "", expected: "", marks: [], screenshot: null });

/**
 * Zpětná vazba (brouček): plovoucí tlačítko, okno ve třech krocích (typ, popis, kontrola) a označení místa.
 * Rozepsané hlášení drží tato komponenta, takže se neztratí ani při označování, kdy je okno zavřené.
 * Úspěch se ukáže, až když server potvrdí doručení. Při chybě data zůstanou a jde to zkusit znovu.
 */
export function FeedbackRoot() {
  // Poloha z localStorage hned při prvním vykreslení v prohlížeči. Hydrataci to nevadí: brouček se ukáže až po
  // ověření, že jde o počítač s myší, a okno je při načtení zavřené.
  const [dock, setDock] = useState<BugDock>(() => (typeof window === "undefined" ? DEFAULT_BUG_DOCK : readBugDock()));
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [step, setStep] = useState<Step>("type");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [path, setPath] = useState("/");
  const [capturing, setCapturing] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const ids = useId();

  const changeDock = useCallback((next: BugDock) => {
    setDock(next);
    writeBugDock(next);
  }, []);

  const openWindow = useCallback(() => {
    setPath(collectContext().path);
    setError(null);
    setStep((current) => (current === "sent" ? "type" : current));
    setOpen(true);
  }, []);

  useEffect(() => {
    const onOpen = () => {
      setDock((current) => {
        if (current.mode !== "hidden") return current;
        const next = { ...current, mode: "shown" as const };
        writeBugDock(next);
        return next;
      });
      openWindow();
    };
    window.addEventListener(FEEDBACK_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(FEEDBACK_OPEN_EVENT, onOpen);
  }, [openWindow]);

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const dirty = () => step !== "sent" && (draft.text.trim() !== "" || draft.expected.trim() !== "" || draft.marks.length > 0 || draft.screenshot !== null);

  const close = () => {
    setOpen(false);
    if (step === "sent") {
      setDraft(emptyDraft());
      setStep("type");
    }
  };

  // Zavření s rozepsaným hlášením potvrdí uživatel v okně „Neuložené změny“. Zahozením začne nový koncept.
  const requestClose = () => {
    if (dirty()) {
      setDraft(emptyDraft());
      setStep("type");
      setCaptureFailed(false);
    }
    close();
  };

  const takeScreenshot = async () => {
    setCapturing(true);
    setCaptureFailed(false);
    const shot = await captureScreenshot(draft.marks);
    setCapturing(false);
    if (shot) update({ screenshot: shot });
    else setCaptureFailed(true);
  };

  const send = async () => {
    if (sendingRef.current || !draft.type) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    const context = collectContext();
    const shot = screenshotAllowed(context.path) ? draft.screenshot : null;
    const payload: FeedbackDraft = {
      submissionId: draft.submissionId,
      type: draft.type,
      text: draft.text,
      expected: draft.type === "bug" ? draft.expected : null,
      marks: draft.marks,
      screenshot: shot && { mime: shot.mime, width: shot.width, height: shot.height },
      context,
    };
    const form = new FormData();
    form.set("draft", JSON.stringify(payload));
    if (shot) form.set("screenshot", shot.blob, "snimek");
    try {
      const result = await submitFeedback(form);
      if (result.ok) setStep("sent");
      else setError(FEEDBACK_ERROR_MESSAGE[result.reason]);
    } catch {
      setError(FEEDBACK_ERROR_MESSAGE.failed);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const type = draft.type;
  const canShoot = screenshotAllowed(path);

  return (
    <>
      <BugButton dock={dock} onDockChange={changeDock} onOpen={openWindow} busy={open || marking} />
      {marking && (
        <MarkingLayer
          marks={draft.marks}
          onChange={(marks) => update({ marks, screenshot: null })}
          onDone={() => {
            setMarking(false);
            setOpen(true);
          }}
        />
      )}
      <Modal open={open && !marking} title="Zpětná vazba" onRequestClose={requestClose} hasUnsavedChanges={dirty}>
        {step === "type" && (
          <div className="stack feedback-step">
            <fieldset className="feedback-types">
              <legend>Co chcete nahlásit?</legend>
              {FEEDBACK_TYPES.map((value) => (
                <label key={value} className="feedback-type">
                  <input type="radio" name="feedback-type" value={value} checked={type === value} onChange={() => update({ type: value, expected: value === "bug" ? draft.expected : "" })} />
                  <span>
                    <strong>{FEEDBACK_TYPE_LABEL[value]}</strong>
                    <span className="small muted">{TYPE_HINT[value]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="spread feedback-actions">
              {dock.mode === "hidden" ? (
                <span />
              ) : (
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    changeDock({ ...dock, mode: "hidden" });
                    setOpen(false);
                  }}
                >
                  Skrýt broučka
                </button>
              )}
              <button type="button" className="btn btn-primary" disabled={!type} onClick={() => setStep("text")}>
                Pokračovat
              </button>
            </div>
            {dock.mode !== "hidden" && <p className="small muted">Skrytého broučka vrátí položka „Zpětná vazba“ v levém menu.</p>}
          </div>
        )}

        {step === "text" && type && (
          <div className="stack feedback-step">
            <p className="small muted">
              Typ: <strong>{FEEDBACK_TYPE_LABEL[type]}</strong>
            </p>
            <label className="field" htmlFor={`${ids}-text`}>
              <span className="field-label">{type === "bug" ? "Co se stalo?" : "Popis"}</span>
              <textarea id={`${ids}-text`} className="textarea" rows={5} maxLength={FEEDBACK_TEXT_MAX} value={draft.text} onChange={(event) => update({ text: event.target.value })} required />
            </label>
            {type === "bug" && (
              <label className="field" htmlFor={`${ids}-expected`}>
                <span className="field-label">Co by mělo fungovat jinak? (nepovinné)</span>
                <textarea id={`${ids}-expected`} className="textarea" rows={3} maxLength={FEEDBACK_EXPECTED_MAX} value={draft.expected} onChange={(event) => update({ expected: event.target.value })} />
              </label>
            )}
            <div className="feedback-marks">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  setOpen(false);
                  setMarking(true);
                }}
              >
                Označit místo
              </button>
              <span className="small muted" aria-live="polite">
                {draft.marks.length === 0 ? "Nepovinné: ukažte, kde na stránce to je." : `Označeno míst: ${draft.marks.length}`}
              </span>
            </div>
            <p className="small muted">Nepište sem osobní údaje klientů ani hesla.</p>
            <div className="spread feedback-actions">
              <button type="button" className="btn" onClick={() => setStep("type")}>
                Zpět
              </button>
              <button type="button" className="btn btn-primary" disabled={draft.text.trim() === ""} onClick={() => setStep("review")}>
                Pokračovat
              </button>
            </div>
          </div>
        )}

        {step === "review" && type && (
          <div className="stack feedback-step">
            <dl className="feedback-summary">
              <dt>Typ</dt>
              <dd>{FEEDBACK_TYPE_LABEL[type]}</dd>
              <dt>Popis</dt>
              <dd className="feedback-summary-text">{draft.text.trim()}</dd>
              {type === "bug" && draft.expected.trim() && (
                <>
                  <dt>Mělo by</dt>
                  <dd className="feedback-summary-text">{draft.expected.trim()}</dd>
                </>
              )}
              <dt>Stránka</dt>
              <dd>{path}</dd>
              <dt>Označená místa</dt>
              <dd>{draft.marks.length === 0 ? "žádná" : draft.marks.map((mark, index) => `${index + 1}. ${mark.description}`).join("; ")}</dd>
            </dl>
            <p className="small muted">Přidáme i technické údaje: velikost okna, prohlížeč, verzi Wiki a vaši roli. Jméno ani e-mail se neposílají.</p>

            <section className="feedback-shot" aria-label="Snímek obrazovky">
              {!canShoot ? (
                <p className="small muted">Na této stránce se snímek obrazovky nepořizuje.</p>
              ) : draft.screenshot ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- náhled z data: URL, next/image ho neoptimalizuje */}
                  <img className="feedback-shot-preview" src={draft.screenshot.dataUrl} alt="Náhled snímku, který se odešle" />
                  <button type="button" className="btn btn-small" onClick={() => update({ screenshot: null })}>
                    Odebrat snímek
                  </button>
                </>
              ) : (
                <>
                  <p className="small muted">Snímek je nepovinný. Zachytí viditelnou část stránky, pole formulářů, zápisy a údaje účtu začerníme. Před odesláním ho uvidíte.</p>
                  <button type="button" className="btn btn-small" onClick={takeScreenshot} disabled={capturing}>
                    {capturing ? "Pořizuji snímek…" : "Pořídit snímek"}
                  </button>
                  {captureFailed && (
                    <p className="small" role="status">
                      Snímek se nepodařilo pořídit. Hlášení můžete odeslat i bez něj.
                    </p>
                  )}
                </>
              )}
            </section>

            {error && (
              <p className="feedback-error" role="alert">
                {error}
              </p>
            )}
            <div className="spread feedback-actions">
              <button type="button" className="btn" onClick={() => setStep("text")} disabled={sending}>
                Zpět
              </button>
              <button type="button" className="btn btn-primary" onClick={send} disabled={sending}>
                {sending ? "Odesílám…" : "Odeslat"}
              </button>
            </div>
          </div>
        )}

        {step === "sent" && (
          <div className="stack feedback-step" role="status">
            <p>Děkujeme, hlášení jsme přijali.</p>
            <div className="spread feedback-actions">
              <span />
              <button type="button" className="btn btn-primary" onClick={close}>
                Hotovo
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
