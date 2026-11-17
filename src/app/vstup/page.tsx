import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { DEVICE_COOKIE, INVITE_COOKIE, checkInvite, findDevice, maskEmail } from "@/server/auth/devices";
import { listPersonas } from "@/server/auth/personas";
import { getDb } from "@/server/db/client";
import { InviteClaim } from "./InviteClaim";
import { hasGatePass } from "@/server/auth/gate";
import { attendeeSource, calendarMode, config, googleLoginConfig, isLiveWiki } from "@/server/config";
import { GateForm } from "./GateForm";
import { GateShell } from "@/components/GateShell";

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

/** Hlášky pro stránku bez platné pozvánky, kde tlačítko Google chybí. Ostatní platí beze změny. */
const NO_INVITE_RESULTS: Record<string, string> = {
  "ucet-neni-povoleny":
    "Tento účet Google nemá do Wiki přístup. Otevřete znovu odkaz z pozvánky a přihlaste se účtem, na který přišla, nebo se obraťte na správce.",
  "neplatny-stav": "Přihlášení vypršelo. Otevřete znovu odkaz z pozvánky.",
  "nepodarilo-se": "Přihlášení se nepodařilo dokončit. Otevřete znovu odkaz z pozvánky.",
  "jiny-ucet": "Tento účet Google k pozvánce nepatří. Otevřete znovu odkaz z pozvánky a přihlaste se účtem, na který přišla.",
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

/** Oficiální barevné „G“ pro tlačítko přihlášení Googlem (podle pravidel značky Google). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Ostrá Wiki: přihlášení Googlem jen z důvěryhodného zařízení, nebo s otevřenou platnou pozvánkou. Jinak neutrální
 * stránka bez tlačítka. Pozvánku z fragmentu adresy zpracuje `InviteClaim`.
 */
async function LiveGate({ googleResult, bootstrap }: { googleResult: string; bootstrap: boolean }) {
  const googleError = GOOGLE_RESULTS[googleResult];
  const isPending = googleResult === "ceka-na-schvaleni";
  const db = await getDb();
  const jar = await cookies();
  const known = await findDevice(db, jar.get(DEVICE_COOKIE)?.value);
  // Otevřená, ještě nepoužitá pozvánka: tlačítko Google se ukáže, pozvánku spotřebuje až přihlášení.
  const invite = known ? null : await checkInvite(db, jar.get(INVITE_COOKIE)?.value);
  const device = known ?? invite;
  if (!device && !bootstrap) {
    return (
      <GateShell title="Vstup do Wiki">
        <p className="gate-lead">Do Wiki se vstupuje přes osobní pozvánku. Odkaz vám pošle správce.</p>
        {/* Bez pozvánky tu tlačítko Google není, hláška proto nesmí radit „zkuste jiný účet“. */}
        {googleError && (
          <p className={isPending ? "notice" : "form-error"} role={isPending ? "status" : "alert"}>
            {NO_INVITE_RESULTS[googleResult] ?? googleError}
          </p>
        )}
        <InviteClaim />
      </GateShell>
    );
  }
  const spravce = device ? "" : "&spravce=1";
  return (
    <GateShell title={known ? "Vítejte zpět" : "Vítejte ve Wiki"}>
      <p className="gate-lead">Přihlaste se svým účtem Google. Plán vzdělávání, zápisy a témata na vás čekají na jednom místě.</p>
      {googleLoginConfig() ? (
        <section className="gate-google" aria-label="Přihlášení účtem Google">
          {googleError && (
            <p className={isPending ? "notice" : "form-error"} role={isPending ? "status" : "alert"}>
              {googleError}
            </p>
          )}
          {device && (
            <p className="gate-account">
              <span className="gate-avatar" aria-hidden="true">
                {device.email.charAt(0).toUpperCase()}
              </span>
              <span>
                {known ? "Toto zařízení zná účet" : "Pozvánka je pro účet"} <strong>{maskEmail(device.email)}</strong>
              </span>
            </p>
          )}
          {/* Odkaz, ne formulář: navigaci na Google nesmí blokovat CSP form-action. */}
          <a className="btn btn-google" href={device ? "/api/google/prihlaseni" : "/api/google/prihlaseni?spravce=1"}>
            <GoogleMark />
            <span>Přihlásit se účtem Google</span>
          </a>
          {/* Jiný účet se vybírá přímo v okně Googlu, druhý odkaz by dělal totéž co hlavní tlačítko. */}
          {googleResult === "zruseno-kalendar" && (
            <div className="gate-alt">
              <a href={`/api/google/prihlaseni?kalendar=ne${spravce}`}>Přihlásit se bez Kalendáře</a>
            </div>
          )}
        </section>
      ) : (
        <p className="form-error" role="alert">
          Přihlášení zatím není nastavené. Obraťte se na správce Wiki.
        </p>
      )}
      <p className="gate-note">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </svg>
        <span>Vstup mají jen účty, které schválil správce Wiki. Heslo k účtu Google Wiki nikdy nevidí.</span>
      </p>
    </GateShell>
  );
}

/** Ukázka: fiktivní role. Na hostingu za branou (zvací odkaz nebo ruční kód), Google se nenabízí. */
async function DemoGate({ linkResult }: { linkResult: string }) {
  const personas = await listPersonas();
  const gate = config.accessCode === null ? "local" : (await hasGatePass()) ? "invited" : "code";
  const linkError = LINK_RESULTS[linkResult];
  return (
    <GateShell title="Ukázka modulu Vzdělávání" wide>
      <p className="gate-lead">
        Prohlížíte ukázku s fiktivními daty.{" "}
        {calendarMode() === "google-test"
          ? attendeeSource() === "allowlist"
            ? "Google pošle pozvánky jen testovacím adresám."
            : "Google posílá pozvánky podle skupiny akce."
          : "Kalendář v ukázce e-maily neodesílá."}
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
