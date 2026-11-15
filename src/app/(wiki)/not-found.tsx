import Link from "next/link";

export default function NotFound() {
  return (
    <section className="stack">
      <h1>Tato stránka není dostupná</h1>
      <p className="row">
        <Link className="btn btn-primary" href="/vzdelavani/harmonogram">
          Zpět na plán
        </Link>
      </p>
    </section>
  );
}
