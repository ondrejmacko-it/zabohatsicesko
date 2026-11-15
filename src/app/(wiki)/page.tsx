import { isLiveWiki } from "@/server/config";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { NextEventsList } from "@/features/vzdelavani/components/Schedule";
import { toDateKey } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { now } from "@/server/config";
import { canManageUsers } from "@/server/policy";
import { nextEventsFor } from "@/server/services/events";
import { ROLE_LABELS } from "@/lib/labels";

/** Kolik nejbližších akcí úvod ukáže. Celý měsíc je v Plánu. */
const NEXT_ROWS = 3;

type ModuleCard = { href: string; icon: IconName; title: string; text: string };

export default async function HomePage() {
  const user = await requireUser();
  const upcoming = await nextEventsFor(user, NEXT_ROWS);
  // Správa je jen pro toho, kdo smí spravovat lidi. Ostatním karta nic neříká, proto ji nevidí.
  const modules: ModuleCard[] = [
    { href: "/vzdelavani/harmonogram", icon: "education", title: "Vzdělávání", text: "Plán akcí, zápisy z proběhlých akcí a témata." },
    ...(canManageUsers(user)
      ? [{ href: "/sprava", icon: "settings" as const, title: "Správa systému", text: "Lidé, přístupy, zařízení a propojení Kalendáře." }]
      : []),
  ];
  return (
    <>
      <h1>Dobrý den</h1>
      <p className="page-sub">
        {user.name} · {ROLE_LABELS[user.role]}
      </p>
      {/* Hledání je kulisa ukázky, ostrá Wiki neaktivní pole neukazuje. */}
      {!isLiveWiki() && (
        <input
          className="search-field"
          placeholder="Co dnes potřebujete vyřešit? Hledejte napříč znalostmi i postupy…"
          aria-label="Vyhledávání (v ukázce není k dispozici)"
          disabled
        />
      )}
      <nav className="section" aria-labelledby="moduly">
        <h2 id="moduly">Moduly</h2>
        <ul className="module-cards">
          {modules.map((m) => (
            <li key={m.href}>
              <Link className="item-card module-card" href={m.href}>
                <Icon name={m.icon} />
                <span>
                  <span className="item-title">{m.title}</span>
                  <span className="item-meta">{m.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <section className="section" aria-labelledby="nejblizsi">
        <h2 id="nejblizsi">Nejbližší akce</h2>
        <NextEventsList cards={upcoming} todayKey={toDateKey(now())} />
        <p className="hint">
          <Link href="/vzdelavani/harmonogram">Celý plán</Link>
        </p>
      </section>
    </>
  );
}
