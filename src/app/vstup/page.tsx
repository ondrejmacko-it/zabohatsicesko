import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { DEVICE_COOKIE, findDevice, maskEmail } from "@/server/auth/devices";
import { listPersonas } from "@/server/auth/personas";
import { getDb } from "@/server/db/client";
import { InviteClaim } from "./InviteClaim";
import { hasGatePass } from "@/server/auth/gate";
import { attendeeSource, calendarMode, config, googleLoginConfig, isLiveWiki } from "@/server/config";
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
  "jiny-ucet": "Tento účet Google k pozvánce nepatří. Přihlaste se účtem, na který vás správce pozval.",
};

const LINK_RESULTS: Record<string, string> = {
  neplatny: "Odkaz s pozvánkou neplatí. Zadejte přístupový kód, nebo si vyžádejte nový odkaz.",
  limit: "Příliš mnoho pokusů. Zkuste to prosím za 15 minut.",
};

type SearchParams = { google?: string; pozvanka?: string; odkaz?: string; spravce?: string };

/** Pojistka proti zamčení: `/vstup?spravce=1` nabídne Google jen adresám ze zaváděcího seznamu. */

export default async function GatePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection(); // vždy za běhu, nikdy při buildu
  const params = await searchParams;
  // Zvací odkaz ukázky: kód ověří a cookie brány uloží obsluha trasy, sem se vrátí už bez kódu v adrese.
  if (params.pozvanka && !isLiveWiki()) redirect(`/vstup/pozvanka?kod=${encodeURIComponent(params.pozvanka.slice(0, 200))}`);
  return isLiveWiki() ? (
    <LiveGate googleResult={params.google ?? ""} bootstrap={params.spravce === "1"} />
  ) : (
    <DemoGate linkResult={params.odkaz ?? ""} />
  );
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
          <p className="small">
            <a href="/soukromi">Ochrana soukromí</a>
          </p>
        </div>
      </main>
    </>
  );
}

/**
 * Ostrá Wiki: přihlášení Googlem jen z důvěryhodného zařízení (po použití pozvánky). Bez něj neutrální
 * stránka bez tlačítka. Pozvánku z fragmentu adresy zpracuje `InviteClaim`.
 */
async function LiveGate({ googleResult, bootstrap }: { googleResult: string; bootstrap: boolean }) {
  const googleError = GOOGLE_RESULTS[googleResult];
  const isPending = googleResult === "ceka-na-schvaleni";
  const device = await findDevice(await getDb(), (await cookies()).get(DEVICE_COOKIE)?.value);
  if (!device && !bootstrap) {
    return (
      <GateShell title="Firemní Wiki">
        <p className="page-sub">Do Wiki se vstupuje přes osobní pozvánku. Odkaz vám pošle správce.</p>
        <InviteClaim />
      </GateShell>
    );
  }
  return (
    <GateShell title="Přihlášení do Wiki">
      {device && <p className="small muted">Přihlaste se účtem Google {maskEmail(device.email)}.</p>}
      {googleLoginConfig() ? (
        <section className="stack gate-google" aria-label="Přihlášení účtem Google">
          {googleError && (
            <p className={isPending ? "notice" : "form-error"} role={isPending ? "status" : "alert"}>
              {googleError}
            </p>
          )}
          <div className="row">
            {/* Odkaz, ne formulář: navigaci na Google nesmí blokovat CSP form-action. */}
            <a className="btn btn-primary" href={device ? "/api/google/prihlaseni" : "/api/google/prihlaseni?spravce=1"}>
              Přihlásit se účtem Google
            </a>
            {googleResult === "zruseno-kalendar" ? (
              <a className="btn" href={`/api/google/prihlaseni?kalendar=ne${device ? "" : "&spravce=1"}`}>
                Přihlásit se bez Kalendáře
              </a>
            ) : (
              <a className="small" href={`/api/google/prihlaseni?jiny=1${device ? "" : "&spravce=1"}`}>
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
          ? attendeeSource() === "allowlist"
            ? "Kalendář běží v testovacím režimu Googlu jen s testovacími příjemci, přepis v ukázkovém režimu."
            : "Kalendář běží v testovacím režimu Googlu, pozvánky dostanou účty ve skupině akce. Přepis běží v ukázkovém režimu."
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
