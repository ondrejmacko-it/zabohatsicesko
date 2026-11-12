import { SubNav } from "@/features/vzdelavani/components/SubNav";
import { formatDate, toDateKey, toTimeKey } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { config, integrationModes, now } from "@/server/config";
import { isOrganizer } from "@/server/policy";

export default async function EducationLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const reference = now();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Vzdělávání</h1>
          <p className="page-sub">Plán vzdělávání týmu, témata a zápisy z proběhlých akcí na jednom místě.</p>
        </div>
        <ul className="status-strip" aria-label="Režim ukázky">
          {!config.useRealClock && (
            <li className="badge badge-outline">
              Ukázkový čas: {formatDate(toDateKey(reference))} {toTimeKey(reference)}
            </li>
          )}
          <li className="badge badge-outline">
            Google Kalendář · {integrationModes.calendar === "simulation" ? "simulace" : "ověřený test"}
          </li>
          <li className="badge badge-outline">
            Přepis · {integrationModes.transcription === "fixture" ? "ukázkový" : "skutečný test"}
          </li>
        </ul>
      </div>
      <SubNav showIntegrations={isOrganizer(user)} />
      <div className="education-content">{children}</div>
    </>
  );
}
