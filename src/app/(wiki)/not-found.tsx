import Link from "next/link";

export default function NotFound() {
  return (
    <section className="stack">
      <h1>Záznam není dostupný</h1>
      <p>Záznam neexistuje nebo k němu nemáte přístup.</p>
      <p className="row">
        <Link className="btn btn-primary" href="/vzdelavani/harmonogram">
          Otevřít Plán vzdělávání
        </Link>
      </p>
    </section>
  );
}
