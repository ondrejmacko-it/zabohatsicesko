"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ActionMessage } from "@/components/ActionForm";
import { FilePicker } from "@/components/FilePicker";
import { createMinutesDraftAction } from "../actions";
import { UploadForm } from "./UploadForm";

const MAX_TEXT_BYTES = 1024 * 1024;

type Choice = "recording" | "text" | "file" | "manual";

// Jedna věta u každé volby, formát a limit se ukážou až u zvolené. Ukázková nahrávka je poslední a není
// výchozí: dokud přepis neumí skutečné schůzky, nemá se tvářit jako hlavní cesta.
const CHOICES: Array<{ id: Choice; title: string; detail: string }> = [
  { id: "text", title: "Vložit text", detail: "Přepis nebo poznámky." },
  { id: "file", title: "Textový soubor", detail: "Přepis nebo titulky ze souboru." },
  { id: "manual", title: "Napsat ručně", detail: "Prázdná šablona zápisu." },
  { id: "recording", title: "Nahrávka (ukázka)", detail: "Přepis umí jen ukázkovou nahrávku." },
];

/** Formulář, ze kterého vznikne návrh zápisu bez nahrávky. Server zdroj znovu ověří (přípona, velikost, UTF-8). */
function DraftForm({ eventId, source, replaceId, replacingDraft, children, submitLabel, disabled }: {
  eventId: string;
  /** Bez hodnoty vybírá zdroj pole formuláře (přepis / poznámky). */
  source?: "file" | "manual";
  replaceId: string | null;
  /** Aktuální rozepsaný návrh má obsah: nahrazení se potvrdí v samostatném okně (server ho bez potvrzení odmítne). */
  replacingDraft?: boolean;
  children?: ReactNode;
  submitLabel: string;
  disabled?: boolean;
}) {
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
      {source && <input type="hidden" name="source" value={source} />}
      {children}
      <ActionMessage state={state} />
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={pending || disabled}>
          {pending ? "Připravuji…" : submitLabel}
        </button>
      </div>
      <ConfirmDialog
        open={asking}
        title="Nahradit rozepsaný zápis?"
        description={<p>Nový návrh nahradí rozepsaný zápis. Starší verze zůstane uložená v historii, v okně už ji neuvidíte.</p>}
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
 * Volba zdroje zápisu: nahrávka (stávající tok), vložený text, textový soubor nebo ruční zápis.
 * Z každého zdroje vznikne upravitelný návrh. `replaceId` = aktuální zápis, který nový návrh nahradí.
 */
export function MinutesSourceForm({ eventId, eventLabel, hasRecording, replaceId, replacingDraft }: {
  eventId: string;
  eventLabel: string;
  hasRecording: boolean;
  replaceId: string | null;
  /** Aktuální zápis je rozpracovaný návrh s obsahem: nahrazení se potvrdí (prázdnou šablonu ne, nic se neztratí). */
  replacingDraft: boolean;
}) {
  const [choice, setChoice] = useState<Choice>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const textTooLarge = new Blob([text]).size > MAX_TEXT_BYTES;
  const fileTooLarge = file !== null && file.size > MAX_TEXT_BYTES;

  return (
    <div className="stack">
      <fieldset className="persona-list source-list">
        <legend className="field-label">Z čeho zápis připravit</legend>
        {CHOICES.map((c) => (
          <label key={c.id} className="persona">
            <input type="radio" name="minutes-source" value={c.id} checked={choice === c.id} onChange={() => setChoice(c.id)} />
            <span>
              <span className="item-title">{c.title}</span>
              <span className="item-meta">{c.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {choice === "recording" && <UploadForm eventId={eventId} eventLabel={eventLabel} replacing={hasRecording} />}

      {choice === "text" && (
        <DraftForm eventId={eventId} replaceId={replaceId} replacingDraft={replacingDraft} submitLabel="Připravit návrh zápisu" disabled={!text.trim() || textTooLarge}>
          <label className="field">
            <span className="field-label">Co vkládáte</span>
            <select className="select" name="source" defaultValue="transcript">
              <option value="transcript">Přepis schůzky</option>
              <option value="notes">Poznámky</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Text přepisu nebo poznámek</span>
            <textarea className="textarea" name="text" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
            <span className="field-hint">Nadpisy Shrnutí, Hlavní body, Rozhodnutí a Další kroky se převezmou, návrh pak upravíte. Nejvýš 1 MB.</span>
          </label>
          {textTooLarge && <p className="notice notice-danger">Text je větší než 1 MB. Zkraťte ho prosím.</p>}
        </DraftForm>
      )}

      {choice === "file" && (
        <DraftForm eventId={eventId} source="file" replaceId={replaceId} replacingDraft={replacingDraft} submitLabel="Připravit návrh ze souboru" disabled={!file || fileTooLarge}>
          <FilePicker
            name="file"
            label="Textový soubor"
            accept=".txt,.md,.vtt,.srt,text/plain,text/markdown,text/vtt"
            hint="Jen TXT, MD, VTT nebo SRT v kódování UTF-8, nejvýš 1 MB. U titulků se časové značky odstraní. PDF ani Word zatím nejdou, vložte z nich text."
            maxBytes={MAX_TEXT_BYTES}
            tooLargeText="Soubor je větší než 1 MB. Vyberte prosím menší."
            onChange={setFile}
          />
          {file && !fileTooLarge && <p className="small">Použije se pro zápis akce: {eventLabel}.</p>}
        </DraftForm>
      )}

      {choice === "manual" && (
        <DraftForm eventId={eventId} source="manual" replaceId={replaceId} replacingDraft={replacingDraft} submitLabel="Napsat zápis ručně">
          <p className="small muted">Otevře se prázdná šablona zápisu: Shrnutí, Hlavní body, Rozhodnutí a Další kroky.</p>
        </DraftForm>
      )}
    </div>
  );
}
