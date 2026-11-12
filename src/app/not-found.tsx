import Link from "next/link";

export default function NotFound() {
  return (
    <main className="gate">
      <div className="panel stack">
        <h1>Stránka nenalezena</h1>
        <p>Stránka neexistuje nebo k ní nemáte přístup.</p>
        <p>
          <Link className="btn" href="/">
            Na úvod
          </Link>
        </p>
      </div>
    </main>
  );
}
