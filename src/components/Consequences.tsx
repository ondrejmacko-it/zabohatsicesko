import { Icon } from "./Icon";

/**
 * Blok „Co se stane po kliknutí“ před krokem, který se propíše dál (pozvánky, e-maily, přístupy).
 * Každý bod je jedna věta bez technických pojmů. Vzhled sdílí s blokem hostů v dialogu akce.
 */
export function Consequences({ points, title = "Co se stane po kliknutí" }: { points: ReadonlyArray<string | false | null | undefined>; title?: string }) {
  const shown = points.filter((point): point is string => Boolean(point));
  if (!shown.length) return null;
  return (
    <div className="guest-preview consequences" role="note">
      <p className="guest-preview-head">
        <Icon name="info" />
        <strong>{title}</strong>
      </p>
      <ul className="consequence-list">
        {shown.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  );
}
