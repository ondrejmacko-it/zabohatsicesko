"use client";

import { useId, useState } from "react";

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("cs-CZ")} kB`
    : `${(bytes / 1024 / 1024).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} MB`;

/**
 * Výběr jednoho souboru ve vzhledu Wiki: skutečný `<input type="file">` zůstává (klávesnice, čtečka, formulář),
 * jen je vizuálně skrytý za tlačítkem. Pod ním je název a velikost vybraného souboru, případně chyba.
 * Server soubor ověřuje znovu, `maxBytes` je jen včasné upozornění.
 */
export function FilePicker({
  name,
  label,
  accept,
  hint,
  maxBytes,
  tooLargeText,
  onChange,
}: {
  name: string;
  label: string;
  accept: string;
  hint: string;
  maxBytes: number;
  tooLargeText: string;
  onChange: (file: File | null) => void;
}) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const tooLarge = file !== null && file.size > maxBytes;
  return (
    <div className="field">
      <span className="field-label" id={`${id}-label`}>
        {label}
      </span>
      <div className="file-pick">
        <label className="btn">
          <input
            className="visually-hidden"
            type="file"
            name={name}
            accept={accept}
            required
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-state ${id}-hint`}
            aria-invalid={tooLarge || undefined}
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setFile(next);
              onChange(next);
            }}
          />
          {file ? "Vybrat jiný soubor" : "Vybrat soubor"}
        </label>
        <span className={file ? "small file-pick-name" : "small muted"} id={`${id}-state`}>
          {file ? `${file.name} · ${formatSize(file.size)}` : "Soubor není vybraný."}
        </span>
      </div>
      <span className="field-hint field-hint-key" id={`${id}-hint`}>
        {hint}
      </span>
      {tooLarge && <p className="notice notice-danger">{tooLargeText}</p>}
    </div>
  );
}
