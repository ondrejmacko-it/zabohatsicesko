import type { Metadata } from "next";
import { connection } from "next/server";
import { listPersonas } from "@/server/auth/personas";
import { config } from "@/server/config";
import { GateForm } from "./GateForm";

export const metadata: Metadata = { title: "Vstup do ukázky" };

export default async function GatePage() {
  await connection(); // vždy za běhu, nikdy při buildu
  const personas = await listPersonas();
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Firemní Wiki</span>
          <span className="brand-tagline">Za bohatší Česko – znalosti a procesy na jednom místě</span>
        </div>
      </header>
      <main className="gate">
        <div className="panel gate-panel">
          <h1>Ukázka modulu Vzdělávání</h1>
          <p className="page-sub">
            Prototyp pracuje výhradně s fiktivními daty. Kalendář a přepis běží v označeném ukázkovém režimu.
          </p>
          <GateForm personas={personas} needsCode={config.accessCode !== null} />
        </div>
      </main>
    </>
  );
}
