import type { ParticipationState } from "@/lib/types";

/**
 * Štítek osobní účasti (Povinné pro tebe, Můžeš se přihlásit, Přihlášeno, Omluveno, Odhlášeno). Jediné místo
 * vzhledu: barvy jsou tokeny `--ucast-*` v globals.css, stejné v Plánu, na Úvodu, v detailu i v náhledu.
 */
export function ParticipationBadge({ state, label }: { state: ParticipationState; label: string }) {
  return (
    <span className="badge badge-ucast" data-ucast={state}>
      {label}
    </span>
  );
}
