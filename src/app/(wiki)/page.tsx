import Link from "next/link";
import { NextEventCard } from "@/features/vzdelavani/components/Schedule";
import { requireUser } from "@/server/auth/session";
import { nextEventFor } from "@/server/services/events";

export default async function HomePage() {
  const user = await requireUser();
  const next = await nextEventFor(user);
  return (
    <>
      <h1>Dobrý den</h1>
      <p className="page-sub">
        {user.name} · {user.role === "organizer" ? "Organizátor" : "Kolega"}
      </p>
      <input
        className="search-field"
        placeholder="Co dnes potřebuješ vyřešit? Hledej napříč znalostmi i postupy…"
        aria-label="Vyhledávání (v ukázce není k dispozici)"
        disabled
      />
      <section className="section">
        <h2>Co tě čeká</h2>
        <div className="stack">
          <NextEventCard card={next} />
          <div>
            <Link className="btn btn-primary" href="/vzdelavani/harmonogram">
              Otevřít harmonogram
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
