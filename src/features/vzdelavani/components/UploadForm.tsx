"use client";

import { useActionState, useRef, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { uploadRecordingAction } from "../actions";

const MAX_BYTES = 4 * 1024 * 1024;

/** Nahrání nahrávky k akci. Před odesláním ukáže, ke které akci se soubor přiřadí. */
export function UploadForm({ eventId, eventLabel, replacing }: { eventId: string; eventLabel: string; replacing: boolean }) {
  const [state, action, pending] = useActionState(uploadRecordingAction, null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tooLarge = file !== null && file.size > MAX_BYTES;

  return (
    <form action={action} className="stack upload">
      <input type="hidden" name="id" value={eventId} />
      <label className="field">
        <span className="field-label">{replacing ? "Nahradit nahrávku" : "Nahrát nahrávku"}</span>
        <input
          ref={inputRef}
          className="input"
          type="file"
          name="file"
          accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <span className="field-hint">WAV, MP3 nebo M4A, nejvýš 4 MB a 15 minut. Soubor se uloží soukromě.</span>
      </label>
      {file && (
        <p className={tooLarge ? "notice notice-danger" : "notice"}>
          {tooLarge
            ? "Soubor je větší než 4 MB. Vyberte prosím menší nahrávku."
            : `Soubor „${file.name}“ se přiřadí k akci: ${eventLabel}.`}
          {replacing && !tooLarge && " Stávající nahrávka a její návrh zápisu se nahradí."}
        </p>
      )}
      <ActionMessage state={state} />
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={pending || !file || tooLarge}>
          {pending ? "Nahrávám…" : "Potvrdit a nahrát"}
        </button>
        <a className="btn btn-small" href="/demo/testovaci-nahravka.wav" download>
          Stáhnout testovací nahrávku
        </a>
      </div>
    </form>
  );
}
