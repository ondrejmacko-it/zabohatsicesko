"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ActionMessage } from "@/components/ActionForm";
import { FilePicker } from "@/components/FilePicker";
import { createMinutesDraftAction } from "../actions";
import { UploadForm } from "./UploadForm";
import { lockedProps, usePreviewLock } from "@/components/PreviewLock";

const MAX_TEXT_BYTES = 1024 * 1024;

/** Formulář, ze kterého vznikne návrh zápisu bez nahrávky. Server zdroj znovu ověří (přípona, velikost, UTF-8). */
function DraftForm({ eventId, source, replaceId, replacingDraft, children, submitLabel, disabled, secondary }: {
  eventId: string;
  /** `pasted` = vložený text, nebo soubor (server rozhodne podle toho, co přišlo). */
  source: "pasted" | "manual";
  replaceId: string | null;
  /** Aktuální rozepsaný návrh má obsah: nahrazení se potvrdí v samostatném okně (server ho bez potvrzení odmítne). */
  replacingDraft?: boolean;
  children?: ReactNode;
  submitLabel: string;
  disabled?: boolean;
  /** Vedlejší cesta (ruční zápis): tlačítko bez zvýraznění. */
  secondary?: boolean;
}) {
  const lock = lockedProps(usePreviewLock());
  const [state, action, pending] = useActionState(createMinutesDraftAction, null);
  const [asking, setAsking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);
  return (
    <form
      ref={formRef}
      action={action}
      className="stack"
      onSubmit={(event) => {
        if (replacingDraft && !confirmedRef.current) {
          event.preventDefault();
          setAsking(true);
        }
        confirmedRef.current = false;
      }}
    >
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="replaceId" value={replaceId ?? ""} />
      <input type="hidden" name="confirmReplace" value={replacingDraft ? "on" : ""} />
      <input type="hidden" name="source" value={source} />
      {children}
      <ActionMessage state={state} />
      <div className="row">
        <button type="submit" className={secondary ? "btn" : "btn btn-primary"} disabled={pending || disabled} {...lock}>
          {pending ? "Připravuji…" : submitLabel}
        </button>
      </div>
      <ConfirmDialog
        open={asking}
        title="Nahradit rozepsaný zápis?"
        urgent
        description={<p>Nový návrh nahradí rozepsaný zápis. Starší verze zůstane uložená v historii, v okně už ji neuvidíš.</p>}
        onCancel={() => setAsking(false)}
      >
        <button type="button" className="btn btn-primary" onClick={() => setAsking(false)} autoFocus>
          Ponechat rozepsaný zápis
        </button>
        <button
          type="button"
          className="btn btn-danger confirm-destructive"
          onClick={() => {
            setAsking(false);
            confirmedRef.current = true;
            formRef.current?.requestSubmit();
          }}
        >
          Nahradit zápis
        </button>
      </ConfirmDialog>
    </form>
  );
}

/**
 * Zdroj zápisu (F14): jedno pole pro přepis nebo poznámky a vedle něj nahrání textového souboru. Ruční zápis
 * je vedlejší tlačítko. Nahrávka se nabídne, jen když je ukázka přepisu zapnutá (`canUpload`, rozhoduje server).
 * Z každého zdroje vznikne upravitelný návrh. `replaceId` = aktuální zápis, který nový návrh nahradí.
 */
export function MinutesSourceForm({ eventId, eventLabel, hasRecording, canUpload, replaceId, replacingDraft }: {
  eventId: string;
  eventLabel: string;
  hasRecording: boolean;
  /** Nahrávání nahrávky je zapnuté (`RECORDING_DEMO`). Jinak se volba vůbec neukáže. */
  canUpload: boolean;
  replaceId: string | null;
  /** Aktuální zápis je rozpracovaný návrh s obsahem: nahrazení se potvrdí (prázdnou šablonu ne, nic se neztratí). */
  replacingDraft: boolean;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const textTooLarge = new Blob([text]).size > MAX_TEXT_BYTES;
  const fileTooLarge = file !== null && file.size > MAX_TEXT_BYTES;
  const both = file !== null && text.trim() !== "";

  return (
    <div className="stack">
      <DraftForm
        eventId={eventId}
        source="pasted"
        replaceId={replaceId}
        replacingDraft={replacingDraft}
        submitLabel="Připravit návrh zápisu"
        disabled={(!text.trim() && !file) || textTooLarge || fileTooLarge || both}
      >
        {/* F15: pravidla pro citlivá data říká formulář dřív, než vedoucí text vloží. Krátce nahoře, podrobnosti rozbalovací. */}
        <div className="notice" data-testid="citliva-data">
          <p>Nevkládej jména, kontakty ani čísla smluv klientů. Návrh vždy zkontroluj.</p>
          <details className="small">
            <summary>Jak Wiki s textem zachází</summary>
            <p>
              Návrh skládá lokální šablona přímo ve Wiki: rozdělí text podle nadpisů, nejde o AI shrnutí a text se nikam neposílá. Jména a kontakty klientů Wiki z návrhu i z uloženého textu vynechá podle pravidel, která nepoznají každé jméno, takže nejde o zaručenou anonymizaci a návrh vždy zkontroluj.
            </p>
          </details>
        </div>
        <label className="field">
          <span className="field-label">Vlož přepis nebo poznámky</span>
          <textarea className="textarea" name="text" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          <span className="field-hint">Nadpisy Shrnutí, Hlavní body, Rozhodnutí a Další kroky se převezmou. Nejvýš 1 MB.</span>
        </label>
        {textTooLarge && <p className="notice notice-danger">Text je větší než 1 MB. Zkrať ho prosím.</p>}
        <FilePicker
          name="file"
          label="nebo nahraj soubor"
          accept=".txt,.md,.vtt,.srt,text/plain,text/markdown,text/vtt"
          hint="TXT, MD, VTT nebo SRT v UTF-8, nejvýš 1 MB. Časy z titulků se odstraní. Text z PDF nebo Wordu vlož do pole."
          maxBytes={MAX_TEXT_BYTES}
          tooLargeText="Soubor je větší než 1 MB. Vyber prosím menší."
          onChange={setFile}
          optional
        />
        {both && <p className="notice">Vlož text, nebo nahraj soubor. Obojí najednou nejde, jedno z toho odeber.</p>}
      </DraftForm>
      <div className="row">
        <DraftForm eventId={eventId} source="manual" replaceId={replaceId} replacingDraft={replacingDraft} submitLabel="Napsat zápis ručně" secondary />
        {canUpload && (
          <button type="button" className="btn" aria-expanded={uploading} onClick={() => setUploading((value) => !value)}>
            Nahrávka (ukázka)
          </button>
        )}
      </div>
      {canUpload && uploading && <UploadForm eventId={eventId} eventLabel={eventLabel} replacing={hasRecording} />}
    </div>
  );
}
