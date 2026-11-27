import type { ParticipationState } from "@/lib/types";
import { badgeClass, type Tone } from "../status";

type Props = { label: string; title?: string } & ({ tone: Tone; ucast?: never } | { ucast: ParticipationState; tone?: never });

/**
 * Jediný stavový štítek Wiki. `tone` = životní stav akce (Zveřejněno, Návrh, Zrušeno, Proběhlo…, mapa v `status.ts`),
 * `ucast` = osobní účast (Povinné pro tebe, Můžeš se přihlásit, Přihlášeno, Omluven/a…, barvy z tokenů `--ucast-*`
 * v globals.css). Stejný vzhled v Plánu, na Úvodu, v detailu i v náhledu; význam nese vždy text, barva jen doplňuje.
 */
export function StatusBadge({ label, title, tone, ucast }: Props) {
  if (ucast)
    return (
      <span className="badge badge-ucast" data-ucast={ucast} title={title}>
        {label}
      </span>
    );
  return (
    <span className={badgeClass(tone ?? "neutral")} title={title}>
      {label}
    </span>
  );
}
