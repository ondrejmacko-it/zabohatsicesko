"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { createMinutesDraftAction } from "../actions";
import { UploadForm } from "./UploadForm";

const MAX_TEXT_BYTES = 1024 * 1024;

type Choice = "recording" | "text" | "file" | "manual";

const CHOICES: Array<{ id: Choice; title: string; detail: string }> = [
  { id: "recording", title: "Nahrávka", detail: "Zápis se připraví z přepisu nahrávky." },
  { id: "text", title: "Vložit přepis nebo poznámky", detail: "Text z jiného nástroje nebo vlastní poznámky." },
  { id: "file", title: "Nahrát textový soubor", detail: "TXT, MD nebo titulky VTT a SRT." },
  { id: "manual", title: "Napsat ručně", detail: "Prázdná šablona zápisu." },
];

/** Formulář, ze kterého vznikne návrh zápisu bez nahrávky. Server zdroj znovu ověří (přípona, velikost, UTF-8). */
function DraftForm({ eventId, source, replaceId, children, submitLabel, disabled }: {
  eventId: string;
  /** Bez hodnoty vybírá zdroj pole formuláře (přepis / poznámky). */
  source?: "file" | "manual";
  replaceId: string | null;
  children?: ReactNode;
  submitLabel: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(createMinutesDraftAction, null);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="replaceId" value={replaceId ?? ""} />
      {source && <input type="hidden" name="source" value={source} />}
      {children}
      <ActionMessage state={state} />
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={pending || disabled}>
          {pending ? "Připravuji…" : submitLabel}
        </button>
      </div>
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
  /** Aktuální zápis je rozpracovaný návrh, nový zdroj ho nahradí. */
  replacingDraft: boolean;
}) {
  const [choice, setChoice] = useState<Choice>("recording");
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
      {replacingDraft && (
        <p className="notice">Nový návrh nahradí rozpracovaný návrh zápisu. Úpravy v něm se nezachovají.</p>
      )}

      {choice === "recording" && <UploadForm eventId={eventId} eventLabel={eventLabel} replacing={hasRecording} />}

      {choice === "text" && (
        <DraftForm eventId={eventId} replaceId={replaceId} submitLabel="Připravit návrh zápisu" disabled={!text.trim() || textTooLarge}>
          <label className="field">
            <span className="field-label">Druh textu</span>
            <select className="select" name="source" defaultValue="transcript">
              <option value="transcript">Přepis schůzky</option>
              <option value="notes">Poznámky</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Text přepisu nebo poznámek</span>
            <textarea className="textarea" name="text" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
            <span className="field-hint">
              Nadpisy Shrnutí, Hlavní body, Rozhodnutí a Další kroky se převezmou. Ostatní text se rozdělí podle obsahu, návrh pak upravíte.
            </span>
          </label>
          {textTooLarge && <p className="notice notice-danger">Text je větší než 1 MB. Zkraťte ho prosím.</p>}
        </DraftForm>
      )}

      {choice === "file" && (
        <DraftForm eventId={eventId} source="file" replaceId={replaceId} submitLabel="Připravit návrh ze souboru" disabled={!file || fileTooLarge}>
          <label className="field">
            <span className="field-label">Textový soubor</span>
            <input
              className="input"
              type="file"
              name="file"
              accept=".txt,.md,.vtt,.srt,text/plain,text/markdown,text/vtt"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="field-hint">TXT, MD, VTT nebo SRT v kódování UTF-8, nejvýš 1 MB. U titulků se časové značky odstraní.</span>
          </label>
          {file && (
            <p className={fileTooLarge ? "notice notice-danger" : "notice"}>
              {fileTooLarge ? "Soubor je větší než 1 MB. Vyberte prosím menší." : `Soubor „${file.name}“ se použije pro zápis akce: ${eventLabel}.`}
            </p>
          )}
        </DraftForm>
      )}

      {choice === "manual" && (
        <DraftForm eventId={eventId} source="manual" replaceId={replaceId} submitLabel="Napsat zápis ručně">
          <p className="small muted">Otevře se prázdná šablona zápisu: Shrnutí, Hlavní body, Rozhodnutí a Další kroky.</p>
        </DraftForm>
      )}
    </div>
  );
}
