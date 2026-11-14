import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { DEVICE_COOKIE, trustedDevice } from "@/server/auth/access-links";
import { listPersonas } from "@/server/auth/personas";
import { RETURN_COOKIE, safeReturnPath } from "@/server/auth/return-path";
import { calendarMode, config, gateMode, googleLoginConfig } from "@/server/config";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { CodeForm } from "./CodeForm";
import { GateForm } from "./GateForm";

export const metadata: Metadata = { title: "Přihlášení" };

const GOOGLE_RESULTS: Record<string, string> = {
  "ucet-neni-povoleny": "Tento účet Google nemá do Wiki přístup. Zkuste jiný účet, nebo se obraťte na správce.",
  "ceka-na-schvaleni":
    "Žádost o přístup je odeslaná. Jakmile vám správce přidělí roli a skupiny, přihlaste se znovu stejným účtem.",
  "neplatny-stav": "Přihlášení vypršelo nebo začalo v jiném okně. Zkuste to prosím znovu.",
  zruseno: "Přihlášení účtem Google bylo zrušeno.",
  "zruseno-kalendar": "Přihlášení se souhlasem ke Kalendáři bylo zrušeno. Můžete to zkusit znovu, nebo se přihlásit bez Kalendáře a propojit ho později z Plánu.",
  "nepodarilo-se": "Přihlášení účtem Google se nepodařilo dokončit. Zkuste to prosím znovu.",
  "jiny-ucet": "Tento odkaz patří jinému účtu. Přihlaste se účtem, pro který jste pozvánku dostali, nebo požádejte správce o nový odkaz.",
};

const Brand = () => (
  <header className="topbar">
    <div className="brand">
      <span className="brand-name">Firemní Wiki</span>
      <span className="brand-tagline">Za bohatší Česko – znalosti a procesy na jednom místě</span>
    </div>
  </header>
);

/** Vstup jen na pozvánku: bez osobního odkazu se přihlášení vůbec nenabídne. */
async function InviteGate({ googleResult }: { googleResult: string }) {
  const jar = await cookies();
  const db = await getDb();
  const device = await trustedDevice(db, jar.get(DEVICE_COOKIE)?.value);
  if (!device) {
    return (
      <>
        <Brand />
        <main className="gate">
          <div className="panel gate-panel">
            <h1>Přístup jen na pozvánku</h1>
            <p className="page-sub">
              Přihlášení se otevírá osobním odkazem od správce. Pokud jste odkaz dostali a nefunguje, už byl použit
              nebo vypršel. Požádejte správce o nový.
            </p>
          </div>
        </main>
      </>
    );
  }
  const [person] = await db.select({ name: users.name }).from(users).where(eq(users.id, device.userId)).limit(1);
  const returning = safeReturnPath(jar.get(RETURN_COOKIE)?.value) !== null;
  const googleError = GOOGLE_RESULTS[googleResult];
  const google = googleLoginConfig() !== null;
  return (
    <>
      <Brand />
      <main className="gate">
        <div className="panel gate-panel">
          <h1>Přihlášení</h1>
          <p className="page-sub">Pozvánka pro: {person?.name}</p>
          {returning && (
            <p className="topic-from-invite" role="status">
              Po přihlášení vás Wiki vrátí k tématu z pozvánky.
            </p>
          )}
          {google && (
            <section className="stack gate-google" aria-labelledby="google-prihlaseni">
              <h2 id="google-prihlaseni">Účtem Google</h2>
              {googleError && (
                <p className="form-error" role="alert">
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
              <h2>Nemáte účet Google?</h2>
            </section>
          )}
          <CodeForm />
        </div>
      </main>
    </>
  );
}

export default async function GatePage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  await connection(); // vždy za běhu, nikdy při buildu
  const googleResult = (await searchParams).google ?? "";
  if (gateMode() === "invite") return <InviteGate googleResult={googleResult} />;
  const googleError = GOOGLE_RESULTS[googleResult];
  const isPending = googleResult === "ceka-na-schvaleni";
  const personas = await listPersonas();
  const returning = safeReturnPath((await cookies()).get(RETURN_COOKIE)?.value) !== null;
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
            Ukázka pracuje výhradně s fiktivními daty.{" "}
            {calendarMode() === "google-test"
              ? "Kalendář běží v testovacím režimu Googlu jen s testovacími příjemci, přepis v ukázkovém režimu."
              : "Kalendář a přepis běží v označeném ukázkovém režimu."}
          </p>
          {returning && (
            <p className="topic-from-invite" role="status">
              Po přihlášení vás Wiki vrátí k tématu z pozvánky.
            </p>
          )}
          {googleLoginConfig() && (
            <section className="stack gate-google" aria-labelledby="google-prihlaseni">
              <h2 id="google-prihlaseni">Přihlášení účtem Google</h2>
              <p className="small muted">
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
              <h2>Nebo projít ukázku s fiktivní rolí</h2>
            </section>
          )}
          <GateForm personas={personas} needsCode={config.accessCode !== null} />
        </div>
      </main>
    </>
  );
}
