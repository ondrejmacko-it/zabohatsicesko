import { EXCUSE_REASON_LABELS } from "@/lib/labels";
import type { ManagedExcuse } from "@/server/services/excuse-managers";

/** Omluvení z lidí, u kterých je přihlášený výslovně určený nadřízený (F03/D01). Jiní kolegové sekci nevidí. */
export function ManagedExcuses({ excuses }: { excuses: ManagedExcuse[] }) {
  if (excuses.length === 0) return null;
  return (
    <section className="section managed-excuses" aria-labelledby="omluveni-tvoji-lide" data-testid="omluvy-nadrizeny">
      <h2 id="omluveni-tvoji-lide">Omluvení z tvých lidí</h2>
      <ul className="list-plain">
        {excuses.map((excuse) => (
          <li key={excuse.name}>
            <strong>{excuse.name}</strong> · {EXCUSE_REASON_LABELS[excuse.reason]}
            {excuse.note ? ` · ${excuse.note}` : ""}
          </li>
        ))}
      </ul>
      <p className="small muted">Důvod vidíš jako nadřízený. Kolegům, do Kalendáře ani v náhledu se neukazuje.</p>
    </section>
  );
}
