import type { Metadata } from "next";
import { connection } from "next/server";
import { listPersonas } from "@/server/auth/personas";
import { calendarMode, config, googleLoginConfig } from "@/server/config";
import { GateForm } from "./GateForm";

export const metadata: Metadata = { title: "Vstup do ukázky" };

const GOOGLE_RESULTS: Record<string, string> = {
  "ucet-neni-povoleny": "Tento účet Google nemá do Wiki přístup. Zkuste jiný účet, nebo se obraťte na správce ZBC.",
  "ceka-na-schvaleni":
    "Žádost o přístup je odeslaná. Jakmile vám správce ZBC přidělí roli a skupiny, přihlaste se znovu stejným účtem.",
  "neplatny-stav": "Přihlášení vypršelo nebo začalo v jiném okně. Zkuste to prosím znovu.",
  zruseno: "Přihlášení účtem Google bylo zrušeno.",
  "nepodarilo-se": "Přihlášení účtem Google se nepodařilo dokončit. Zkuste to prosím znovu.",
};

export default async function GatePage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  await connection(); // vždy za běhu, nikdy při buildu
  const googleResult = (await searchParams).google ?? "";
  const googleError = GOOGLE_RESULTS[googleResult];
  const isPending = googleResult === "ceka-na-schvaleni";
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
                Google jen ověří, kdo jste. Roli a skupiny přiděluje správce ZBC ve Wiki. Nový účet nejdřív
                počká na schválení.
              </p>
              {googleError && (
                <p className={isPending ? "notice" : "form-error"} role={isPending ? "status" : "alert"}>
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
