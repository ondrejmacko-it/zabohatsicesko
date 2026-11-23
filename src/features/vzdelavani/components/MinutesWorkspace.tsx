"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Rozpracovaný nebo zveřejněný zápis s volbou „Změnit zdroj“ u hlavičky. Volba zdroje nahradí v okně editor,
 * místo aby se skládala pod něj. Editor zůstává připojený (jen skrytý), takže neuložené úpravy se návratem
 * neztratí. Nahrazení rozepsaného návrhu potvrzuje samostatné okno ve formuláři zdroje.
 */
export function MinutesWorkspace({ header, sourceForm, children }: { header: ReactNode; sourceForm: ReactNode | null; children: ReactNode }) {
  const [changing, setChanging] = useState(false);
  const sourceRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current) return;
    if (changing) sourceRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    else toggleRef.current?.focus();
  }, [changing]);

  return (
    <div className="stack">
      <div className="minutes-head">
        {header}
        {sourceForm && (
          <button
            ref={toggleRef}
            type="button"
            className="btn btn-small"
            aria-expanded={changing}
            onClick={() => {
              moved.current = true;
              setChanging((value) => !value);
            }}
          >
            {changing ? "Zpět k zápisu" : "Změnit zdroj"}
          </button>
        )}
      </div>
      <div className="stack" hidden={changing}>
        {children}
      </div>
      {changing && (
        <div className="stack" ref={sourceRef}>
          {sourceForm}
        </div>
      )}
    </div>
  );
}
