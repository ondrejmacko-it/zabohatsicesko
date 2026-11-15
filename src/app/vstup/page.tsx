import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { listPersonas } from "@/server/auth/personas";
import { hasGatePass } from "@/server/auth/gate";
import { calendarMode, config, googleLoginConfig, isLiveWiki } from "@/server/config";
import { GateForm } from "./GateForm";

export const metadata: Metadata = { title: "Vstup" };

const GOOGLE_RESULTS: Record<string, string> = {
  "ucet-neni-povoleny": "Tento účet Google nemá do Wiki přístup. Zkuste jiný účet, nebo se obraťte na správce.",
  "ceka-na-schvaleni":
    "Žádost o přístup je odeslaná. Jakmile vám správce přidělí roli a skupiny, přihlaste se znovu stejným účtem.",
  "neplatny-stav": "Přihlášení vypršelo nebo začalo v jiném okně. Zkuste to prosím znovu.",
  zruseno: "Přihlášení účtem Google bylo zrušeno.",
  "zruseno-kalendar": "Přihlášení se souhlasem ke Kalendáři bylo zrušeno. Můžete to zkusit znovu, nebo se přihlásit bez Kalendáře a propojit ho později z Plánu.",
  "nepodarilo-se": "Přihlášení účtem Google se nepodařilo dokončit. Zkuste to prosím znovu.",
};

const LINK_RESULTS: Record<string, string> = {
  neplatny: "Odkaz s pozvánkou neplatí. Zadejte přístupový kód, nebo si vyžádejte nový odkaz.",
  limit: "Příliš mnoho pokusů. Zkuste to prosím za 15 minut.",
};

type SearchParams = { google?: string; pozvanka?: string; odkaz?: string };

export default async function GatePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection(); // vždy za běhu, nikdy při buildu
  const params = await searchParams;
  // Zvací odkaz ukázky: kód ověří a cookie brány uloží obsluha trasy, sem se vrátí už bez kódu v adrese.
  if (params.pozvanka && !isLiveWiki()) redirect(`/vstup/pozvanka?kod=${encodeURIComponent(params.pozvanka.slice(0, 200))}`);
  return isLiveWiki() ? <LiveGate googleResult={params.google ?? ""} /> : <DemoGate linkResult={params.odkaz ?? ""} />;
}

function GateShell({ title, children }: { title: string; children: React.ReactNode }) {
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
          <h1>{title}</h1>
          {children}
        </div>
      </main>
    </>
  );
}

/** Ostrá Wiki: jen přihlášení účtem Google, bez fiktivních rolí a bez textů ukázky. */
function LiveGate({ googleResult }: { googleResult: string }) {
  const googleError = GOOGLE_RESULTS[googleResult];
  const isPending = googleResult === "ceka-na-schvaleni";
  return (
    <GateShell title="Přihlášení do Wiki">
      {googleLoginConfig() ? (
        <section className="stack gate-google" aria-label="Přihlášení účtem Google">
          <p className="page-sub">
            Google jen ověří, kdo jste. Roli a skupiny přiděluje správce ve Wiki, nový účet nejdřív počká na
            schválení. Správce Google požádá i o zápis do Kalendáře, účastníci pozvánky jen dostávají.
          </p>
          {googleError && (
            <p className={isPending ? "notice" : "form-error"} role={isPending ? "status" : "alert"}>
              {googleError}
            </p>
          )}
          <div className="row">
            {/* Odkaz, ne formulář: navigaci na Google nesmí blokovat CSP form-action. */}
            <a className="btn btn-primary" href="/api/google/prihlaseni">
              Přihlásit se účtem Google
            </a>
            {googleResult === "zruseno-kalendar" ? (
              <a className="btn" href="/api/google/prihlaseni?kalendar=ne">
                Přihlásit se bez Kalendáře
              </a>
            ) : (
              <a className="small" href="/api/google/prihlaseni?jiny=1">
                Použít jiný účet
              </a>
            )}
          </div>
        </section>
      ) : (
        <p className="form-error" role="alert">
          Přihlášení zatím není nastavené. Obraťte se na správce Wiki.
        </p>
      )}
    </GateShell>
  );
}

/** Ukázka: fiktivní role. Na hostingu za branou (zvací odkaz nebo ruční kód), Google se nenabízí. */
async function DemoGate({ linkResult }: { linkResult: string }) {
  const personas = await listPersonas();
  const gate = config.accessCode === null ? "local" : (await hasGatePass()) ? "invited" : "code";
  const linkError = LINK_RESULTS[linkResult];
  return (
    <GateShell title="Ukázka modulu Vzdělávání">
      <p className="page-sub">
        Ukázka pracuje výhradně s fiktivními daty.{" "}
        {calendarMode() === "google-test"
          ? "Kalendář běží v testovacím režimu Googlu jen s testovacími příjemci, přepis v ukázkovém režimu."
          : "Kalendář a přepis běží v označeném ukázkovém režimu."}
      </p>
      {linkError && gate === "code" && (
        <p className="form-error" role="alert">
          {linkError}
        </p>
      )}
      <GateForm personas={personas} gate={gate} />
    </GateShell>
  );
}
