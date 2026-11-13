import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { disconnectCalendarAction, resetDemoAction, setSimulationAction } from "@/features/vzdelavani/actions";
import { ModeStrip } from "@/features/vzdelavani/components/ModeStrip";
import { requireUser } from "@/server/auth/session";
import { connectionStatus } from "@/server/calendar/google-auth";
import {
  calendarMode,
  config,
  googleCalendarConfig,
  googleCalendarConfigProblems,
  googleLoginConfig,
  googleLoginConfigProblems,
  integrationModes,
  loginMode,
  attendeeSource,
} from "@/server/config";
import { formatDayMonth, toDateKey } from "@/lib/time";
import { getDb } from "@/server/db/client";
import { isOrganizer } from "@/server/policy";
import { readSwitches, type SimulationSwitch } from "@/server/settings";

export const metadata: Metadata = { title: "Integrace" };

const SWITCH_LABELS: Record<SimulationSwitch, { title: string; on: string; off: string }> = {
  "calendar.outage": { title: "Výpadek Google Kalendáře", on: "Kalendář simuluje dočasnou chybu.", off: "Kalendář odpovídá." },
  "calendar.revoked": { title: "Odvolaný přístup ke Kalendáři", on: "Integrace je odpojená.", off: "Integrace je připojená." },
  "transcription.outage": { title: "Výpadek služby přepisu", on: "Přepis simuluje chybu.", off: "Přepis odpovídá." },
};

const CONNECT_RESULTS: Record<string, { text: string; ok: boolean }> = {
  pripojeno: { text: "Google Kalendář je připojený.", ok: true },
  zamitnuto: { text: "Souhlas u Googlu nebyl udělen. Nic se nezměnilo.", ok: false },
  "chybi-opravneni": { text: "Chybí oprávnění k událostem Kalendáře. Při souhlasu ho nechte zaškrtnuté.", ok: false },
  "neplatny-stav": { text: "Připojení vypršelo nebo nezačalo v tomto prohlížeči. Zkuste to znovu.", ok: false },
  nepripojeno: { text: "Připojení se nepodařilo dokončit. Zkuste to znovu.", ok: false },
};

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const user = await requireUser();
  if (!isOrganizer(user)) notFound();
  const db = await getDb();
  const switches = await readSwitches(db);
  const googleTest = calendarMode() === "google-test";
  const googleConfig = googleCalendarConfig();
  const connection = googleTest ? await connectionStatus(db) : null;
  const connectResult = CONNECT_RESULTS[(await searchParams).google ?? ""];
  const switchKeys = (Object.keys(SWITCH_LABELS) as SimulationSwitch[]).filter((key) => !googleTest || !key.startsWith("calendar."));

  return (
    <>
      <section className="section">
        <h2>Režimy integrací</h2>
        {/* Na telefonu se pruh režimů v záhlaví modulu skrývá, tady je vidět vždy. */}
        <ModeStrip className="status-strip mode-strip" />
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Integrace</th>
              <th scope="col">Režim</th>
              <th scope="col">Co je ověřeno</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Google Kalendář</td>
              <td>{integrationModes.calendar === "simulation" ? "Simulace" : "Testovací režim Google · živý test 12. 11. 2026"}</td>
              <td>
                {googleTest
                  ? `Živý test se skutečným účtem prošel 12. 11. 2026: spárování, změna tématu a času, výskyt série, nová pozvánka, ruční změna v Kalendáři i odvolání přístupu. ${attendeeSource() === "audience" ? "Pozvánky jdou skupině, pro kterou je akce určená." : "Pozvánky jdou jen testovacím příjemcům."}`
                  : "Identita pozvánky, hosté a RSVP, oznámení, opakování bez duplicit, pořadí revizí a chyby. Ověřeno proti simulaci, ne proti skutečnému Google účtu."}
              </td>
            </tr>
            <tr>
              <td>Přihlášení</td>
              <td>{loginMode() === "google-test" ? "Fiktivní role + účet Google · neověřeno proti Googlu" : "Fiktivní role"}</td>
              <td>
                {loginMode() !== "google-test"
                  ? "Vstup přístupovým kódem a výběrem fiktivní role. Oprávnění ověřuje server podle role v databázi."
                  : googleLoginConfig()
                    ? "Ověření ID tokenu (podpis, vydavatel, příjemce, platnost, ověřený e-mail) a vazba na stabilní identifikátor prošly testy s napodobeným Googlem. Živé přihlášení zatím neproběhlo."
                    : `Přihlášení účtem Google je vypnuté, konfigurace není úplná: ${googleLoginConfigProblems().join(", ")}.`}
              </td>
            </tr>
            <tr>
              <td>Přepis a zápis</td>
              <td>{integrationModes.transcription === "fixture" ? "Ukázkový (testovací nahrávka)" : "Skutečný test"}</td>
              <td>Celá cesta od nahrání po zveřejněný zápis s testovací nahrávkou. Jiný soubor skončí čitelnou chybou.</td>
            </tr>
            <tr>
              <td>Úložiště nahrávek</td>
              <td>Soukromé v databázi</td>
              <td>Soubor je dostupný jen přes autorizovanou serverovou cestu, nikdy přes veřejný odkaz.</td>
            </tr>
          </tbody>
        </table>
        <p className="small muted section-actions">
          Hodnoty tajemství se v aplikaci nezobrazují. Prostředí: {config.databaseUrl ? "hostovaná databáze" : "lokální databáze"}.
        </p>
      </section>

      {googleTest && (
        <section className="section" aria-labelledby="google-kalendar">
          <h2 id="google-kalendar">Připojení Google Kalendáře</h2>
          {connectResult && <p className={connectResult.ok ? "notice" : "notice notice-danger"}>{connectResult.text}</p>}
          {!googleConfig ? (
            <>
              <p className="notice notice-danger">
                Testovací režim je zapnutý, ale konfigurace na serveru není úplná. Do Kalendáře se nic nezapisuje.
              </p>
              <ul className="small">
                {googleCalendarConfigProblems().map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <dl className="dl">
                <dt>Účet</dt>
                <dd>
                  {connection
                    ? `${connection.accountEmail} · připojeno ${formatDayMonth(toDateKey(connection.connectedAt))}`
                    : "nepřipojeno"}
                </dd>
                <dt>Kalendář</dt>
                <dd>{googleConfig.calendarId}</dd>
                <dt>Povolené kalendáře</dt>
                <dd>{googleConfig.allowedCalendarIds.length}</dd>
                <dt>Hosté pozvánek</dt>
                <dd>
                  {attendeeSource() === "audience"
                    ? "publikum akce: aktivní uživatelé skupiny, pro kterou je akce určená"
                    : `jen testovací příjemci: ${googleConfig.allowedAttendees.length ? googleConfig.allowedAttendees.join(", ") : "žádní, pozvánky vzniknou bez hostů"}`}
                </dd>
              </dl>
              <p className="small muted">
                Organizátora nebo správce, který se přihlásí účtem Google, pošle Wiki na souhlas sama a vrátí ho na Plán. Tato
                stránka slouží ke kontrole, ručnímu připojení jiným účtem a odpojení. Jedno připojení platí pro celou Wiki.
              </p>
              <p className="small muted">
                Wiki žádá jen o oprávnění k událostem. Obnovovací token je uložený šifrovaně na serveru, v aplikaci ani v logu
                se nezobrazuje. Komu pozvánky jdou, určuje nastavení serveru a ověřuje se před každým zápisem. Wiki přidává a odebírá jen své hosty.
              </p>
              <div className="section-actions row">
                <a className="btn btn-primary" href="/api/google/kalendar/pripojit">
                  {connection ? "Připojit znovu" : "Připojit Google Kalendář"}
                </a>
                {connection && (
                  <ActionForm
                    action={disconnectCalendarAction}
                    label="Odpojit"
                    variant="danger"
                    confirm={{
                      title: "Odpojit Google Kalendář",
                      text: "Přístup se u Googlu zneplatní a uložený token se smaže. Změny akcí zůstanou ve Wiki a po novém připojení se dají odeslat.",
                      confirmLabel: "Odpojit",
                    }}
                  />
                )}
              </div>
            </>
          )}
        </section>
      )}

      <section className="section">
        <h2>Ukázka chyb</h2>
        <p className="small muted">Přepínače slouží k předvedení chybových stavů a opakování. V produkci neexistují.</p>
        <div className="stack section-actions">
          {switchKeys.map((key) => (
            <div key={key} className="spread candidate">
              <span>
                <strong>{SWITCH_LABELS[key].title}</strong>
                <span className="small muted"> · {switches[key] ? SWITCH_LABELS[key].on : SWITCH_LABELS[key].off}</span>
              </span>
              <ActionForm
                action={setSimulationAction}
                fields={{ key, value: String(!switches[key]) }}
                label={switches[key] ? "Vypnout" : "Zapnout"}
                small
              />
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Ukázková data</h2>
        <p className="small muted">Obnoví všechna fiktivní data do výchozího stavu ze seedu. Akce se zapíše do auditu.</p>
        <div className="section-actions row">
          <ActionForm
            action={resetDemoAction}
            label="Obnovit ukázková data"
            variant="danger"
            confirm={{
              title: "Obnovit ukázková data",
              text: "Všechny změny v ukázce, nahrávky i zápisy se smažou a data se vrátí do výchozího stavu.",
              confirmLabel: "Obnovit",
            }}
          />
        </div>
      </section>
    </>
  );
}
