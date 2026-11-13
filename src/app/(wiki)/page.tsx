import Link from "next/link";
import { NextEventCard } from "@/features/vzdelavani/components/Schedule";
import { requireUser } from "@/server/auth/session";
import { nextEventFor } from "@/server/services/events";
import { ROLE_LABELS } from "@/lib/labels";

export default async function HomePage() {
  const user = await requireUser();
  const next = await nextEventFor(user);
  return (
    <>
      <h1>Dobrý den</h1>
      <p className="page-sub">
        {user.name} · {ROLE_LABELS[user.role]}
      </p>
      <input
        className="search-field"
        placeholder="Co dnes potřebujete vyřešit? Hledejte napříč znalostmi i postupy…"
        aria-label="Vyhledávání (v ukázce není k dispozici)"
        disabled
      />
      <section className="section">
        <h2>Co vás čeká</h2>
        <div className="stack">
          <NextEventCard card={next} />
          <div>
            {next ? (
              <Link className="btn btn-primary" href={`/vzdelavani/akce/${encodeURIComponent(next.id)}`}>
                Otevřít akci
              </Link>
            ) : (
              <Link className="btn btn-primary" href="/vzdelavani/harmonogram">
                Otevřít harmonogram
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
