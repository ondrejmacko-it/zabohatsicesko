import { formatDate, toDateKey, toTimeKey } from "@/lib/time";
import { config, integrationModes, now } from "@/server/config";

/** Režim ukázky: ukázkový čas a režimy integrací. V záhlaví modulu a na stránce Integrace. */
export function ModeStrip({ className = "status-strip" }: { className?: string }) {
  const reference = now();
  return (
    <ul className={className} aria-label="Režim ukázky">
      {!config.useRealClock && (
        <li className="badge badge-outline">
          Ukázkový čas: {formatDate(toDateKey(reference))} {toTimeKey(reference)}
        </li>
      )}
      <li className="badge badge-outline">Google Kalendář · {integrationModes.calendar === "simulation" ? "simulace" : "test Google"}</li>
      <li className="badge badge-outline">Přepis · {integrationModes.transcription === "fixture" ? "ukázkový" : "skutečný test"}</li>
    </ul>
  );
}
