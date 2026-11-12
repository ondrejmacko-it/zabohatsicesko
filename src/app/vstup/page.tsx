import type { Metadata } from "next";
import { connection } from "next/server";
import { listPersonas } from "@/server/auth/personas";
import { calendarMode, config, googleLoginConfig } from "@/server/config";
import { GateForm } from "./GateForm";

export const metadata: Metadata = { title: "Vstup do ukázky" };

const GOOGLE_RESULTS: Record<string, string> = {
  "ucet-neni-povoleny": "Tento účet Google nemá do ukázky přístup. Zkuste jiný účet, nebo požádejte organizátora o přidání.",
  "neplatny-stav": "Přihlášení vypršelo nebo začalo v jiném okně. Zkuste to prosím znovu.",
  zruseno: "Přihlášení účtem Google bylo zrušeno.",
  "nepodarilo-se": "Přihlášení účtem Google se nepodařilo dokončit. Zkuste to prosím znovu.",
};

export default async function GatePage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  await connection(); // vždy za běhu, nikdy při buildu
  const googleError = GOOGLE_RESULTS[(await searchParams).google ?? ""];
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
            Prototyp pracuje výhradně s fiktivními daty.{" "}
            {calendarMode() === "google-test"
              ? "Kalendář běží v testovacím režimu Googlu jen s testovacími příjemci, přepis v ukázkovém režimu."
              : "Kalendář a přepis běží v označeném ukázkovém režimu."}
          </p>
          {googleLoginConfig() && (
            <section className="stack gate-google" aria-labelledby="google-prihlaseni">
              <h2 id="google-prihlaseni">Přihlášení účtem Google</h2>
              <p className="small muted">
                Testovací režim pro povolené účty. Google jen ověří, kdo jste. Roli a skupiny určuje Wiki.
              </p>
              {googleError && (
                <p className="form-error" role="alert">
                  {googleError}
                </p>
              )}
              <div>
                {/* Odkaz, ne formulář: navigaci na Google nesmí blokovat CSP form-action. */}
                <a className="btn btn-primary" href="/api/google/prihlaseni">
                  Přihlásit se účtem Google
                </a>
              </div>
              <h2>Nebo projít ukázku s fiktivní rolí</h2>
            </section>
          )}
          <GateForm personas={personas} needsCode={config.accessCode !== null} />
        </div>
      </main>
    </>
  );
}
