import Link from "next/link";

export const metadata = { title: "Moje cesta" };

export default function MyJourneyPage() {
  return (
    <section className="section">
      <h2>Moje cesta</h2>
      <p>
        Onboarding nováčků s milníky a potvrzováním kroků zůstává ve firemní Wiki beze změny. Ukázka ho
        nekopíruje, zachovává jen jeho místo v navigaci vedle nových částí Harmonogram a Témata.
      </p>
      <p className="row section-actions">
        <Link className="btn btn-primary" href="/vzdelavani/harmonogram">
          Otevřít harmonogram
        </Link>
      </p>
    </section>
  );
}
