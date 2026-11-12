import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { resetDemoAction, setSimulationAction } from "@/features/vzdelavani/actions";
import { requireUser } from "@/server/auth/session";
import { config, integrationModes } from "@/server/config";
import { getDb } from "@/server/db/client";
import { isOrganizer } from "@/server/policy";
import { readSwitches, type SimulationSwitch } from "@/server/settings";

export const metadata: Metadata = { title: "Integrace" };

const SWITCH_LABELS: Record<SimulationSwitch, { title: string; on: string; off: string }> = {
  "calendar.outage": { title: "Výpadek Google Kalendáře", on: "Kalendář simuluje dočasnou chybu.", off: "Kalendář odpovídá." },
  "calendar.revoked": { title: "Odvolaný přístup ke Kalendáři", on: "Integrace je odpojená.", off: "Integrace je připojená." },
  "transcription.outage": { title: "Výpadek služby přepisu", on: "Přepis simuluje chybu.", off: "Přepis odpovídá." },
};

export default async function IntegrationsPage() {
  const user = await requireUser();
  if (!isOrganizer(user)) notFound();
  const switches = await readSwitches(await getDb());

  return (
    <>
      <section className="section">
        <h2>Režimy integrací</h2>
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
              <td>{integrationModes.calendar === "simulation" ? "Simulace" : "Ověřený test"}</td>
              <td>
                Identita pozvánky, hosté a RSVP, oznámení, opakování bez duplicit, pořadí revizí a chyby. Ověřeno proti
                simulaci, ne proti skutečnému Google účtu.
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

      <section className="section">
        <h2>Ukázka chyb</h2>
        <p className="small muted">Přepínače slouží k předvedení chybových stavů a opakování. V produkci neexistují.</p>
        <div className="stack">
          {(Object.keys(SWITCH_LABELS) as SimulationSwitch[]).map((key) => (
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
        <div className="section-actions">
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
