"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/ActionForm";
import { FilePicker } from "@/components/FilePicker";
import { uploadRecordingAction } from "../actions";

const MAX_BYTES = 4 * 1024 * 1024;

/** Nahrání nahrávky k akci. Před odesláním ukáže, ke které akci se soubor přiřadí. */
export function UploadForm({ eventId, eventLabel, replacing }: { eventId: string; eventLabel: string; replacing: boolean }) {
  const [state, action, pending] = useActionState(uploadRecordingAction, null);
  const [file, setFile] = useState<File | null>(null);
  const tooLarge = file !== null && file.size > MAX_BYTES;

  return (
    <form action={action} className="stack upload">
      <input type="hidden" name="id" value={eventId} />
      {/* Přepis je v této verzi ukázka: umí jen jednu známou nahrávku. UI to musí říct dřív, než vedoucí něco nahraje. */}
      <p className="notice">
        Automatický přepis zatím umí jen jednu ukázkovou nahrávku. Z nahrávky skutečné schůzky zápis nevznikne, nenahrávejte ji.{" "}
        <a href="/demo/testovaci-nahravka.wav" download>
          Stáhnout ukázkovou nahrávku
        </a>
      </p>
      <FilePicker
        name="file"
        label={replacing ? "Nový soubor s nahrávkou" : "Soubor s nahrávkou"}
        accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
        hint="WAV, MP3 nebo M4A, nejvýš 4 MB a 15 minut. Soubor se uloží soukromě."
        maxBytes={MAX_BYTES}
        tooLargeText="Soubor je větší než 4 MB. Vyberte prosím menší nahrávku."
        onChange={setFile}
      />
      {file && !tooLarge && (
        <p className="small">
          Přiřadí se k akci: {eventLabel}.{replacing && " Stávající nahrávka a její návrh zápisu se nahradí."}
        </p>
      )}
      <ActionMessage state={state} />
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={pending || !file || tooLarge}>
          {pending ? "Nahrávám…" : replacing ? "Nahradit nahrávku" : "Nahrát nahrávku"}
        </button>
      </div>
    </form>
  );
}
