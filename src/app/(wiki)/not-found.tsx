import Link from "next/link";

export default function NotFound() {
  return (
    <section className="stack">
      <h1>Záznam není dostupný</h1>
      <p>Záznam neexistuje nebo k němu nemáte přístup.</p>
      <p>
        <Link className="btn" href="/vzdelavani/harmonogram">
          Zpět na harmonogram
        </Link>
      </p>
    </section>
  );
}
