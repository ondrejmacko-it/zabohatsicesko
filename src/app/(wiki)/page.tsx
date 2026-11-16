import { isLiveWiki } from "@/server/config";
import Link from "next/link";
import { after } from "next/server";
import { Icon, type IconName } from "@/components/Icon";
import { PersonalCalendarStatus } from "@/features/vzdelavani/components/PersonalCalendarStatus";
import { NextEventsList } from "@/features/vzdelavani/components/Schedule";
import { toDateKey } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { personalSyncNeeded, syncPersonalCalendars } from "@/server/calendar/personal";
import { now } from "@/server/config";
import { getDb } from "@/server/db/client";
import { canManageUsers } from "@/server/policy";
import { loadPersonalCalendar } from "@/server/services/calendar-status";
import { nextEventsFor } from "@/server/services/events";

/** Kolik nejbližších akcí úvod ukáže. Celý měsíc je v Plánu. */
const NEXT_ROWS = 3;

type ModuleCard = { href: string; icon: IconName; title: string; text: string };

export default async function HomePage() {
  const user = await requireUser();
  const [upcoming, personal] = await Promise.all([nextEventsFor(user, NEXT_ROWS), loadPersonalCalendar(user)]);
  // Osobní kalendáře doženou zmeškaný zápis (přechodná chyba Googlu, nový účet) při otevření Úvodu.
  // Zjištění je jeden dotaz do databáze, Google se volá až na pozadí po odeslání stránky.
  if (personal) {
    const db = await getDb();
    if (await personalSyncNeeded(db)) after(() => syncPersonalCalendars(db));
  }
  // Správa je jen pro toho, kdo smí spravovat lidi. Ostatním karta nic neříká, proto ji nevidí.
  const modules: ModuleCard[] = [
    { href: "/vzdelavani/harmonogram", icon: "education", title: "Vzdělávání", text: "Plán akcí, zápisy z proběhlých akcí a témata." },
    ...(canManageUsers(user)
      ? [{ href: "/sprava", icon: "settings" as const, title: "Správa systému", text: "Lidé, přístupy, zařízení a propojení Kalendáře." }]
      : []),
  ];
  return (
    <>
      <h1>Vítejte, {user.name}.</h1>
      {personal && <PersonalCalendarStatus state={personal} />}
      {/* Hledání je kulisa ukázky, ostrá Wiki neaktivní pole neukazuje. */}
      {!isLiveWiki() && (
        <input
          className="search-field"
          placeholder="Vyhledávání ve Wiki je mimo rozsah ukázky."
          aria-label="Vyhledávání ve Wiki je mimo rozsah ukázky"
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
        <div className="spread section-head">
          <h2 id="nejblizsi">Nejbližší akce</h2>
          <Link className="btn btn-small" href="/vzdelavani/harmonogram">
            Celý plán
          </Link>
        </div>
        <NextEventsList cards={upcoming} todayKey={toDateKey(now())} />
      </section>
    </>
  );
}
