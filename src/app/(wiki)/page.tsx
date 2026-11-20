import Link from "next/link";
import { after } from "next/server";
import { ShotGrant } from "@/components/feedback/ShotGrant";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";
import { EventPeek } from "@/features/vzdelavani/components/EventPeek";
import { PersonalCalendarStatus } from "@/features/vzdelavani/components/PersonalCalendarStatus";
import { NextEventsList } from "@/features/vzdelavani/components/Schedule";
import { TasksCard, orderTasks } from "@/features/vzdelavani/components/TasksCard";
import { invitationTask } from "@/features/vzdelavani/invitations";
import { monthSummary } from "@/features/vzdelavani/status";
import { monthOf, toDateKey } from "@/lib/time";
import { logError } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { personalSyncNeeded, syncPersonalCalendars } from "@/server/calendar/personal";
import { invitationsFor } from "@/server/calendar/rsvp";
import { runWorkerIfDue } from "@/server/calendar/worker";
import { now } from "@/server/config";
import { getDb } from "@/server/db/client";
import { canPlan } from "@/server/policy";
import { loadPersonalCalendar } from "@/server/services/calendar-status";
import { listMonth, nextEventsFor } from "@/server/services/events";
import { listTasks } from "@/server/services/journey";
import { currentPreview } from "@/server/services/preview-context";

/** Kolik nejbližších akcí úvod ukáže. Celý měsíc je v Plánu. */
const NEXT_ROWS = 3;
/** Jak dlouho Úvod čeká na zápis do osobního kalendáře, než stránku pošle se stavem, jaký je. */
const SYNC_WAIT_MS = 2500;

// Úvod odpovídá na dvě otázky: co mě čeká a co mám udělat. Moduly jsou v navigaci, úspěšný stav
// Kalendáře se neukazuje, jen problém, který chce zásah.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ akce?: string }> }) {
  const user = await requireUser();
  // Akce z Nejbližších se otevře v okně přímo nad Úvodem, stejně jako v Plánu.
  const peekId = ((await searchParams).akce ?? "").slice(0, 120);
  const monthKey = monthOf(toDateKey(now()));
  // Globální náhled (lišta Pohled): akce a úkoly očima skupiny nebo kolegy, jen ke čtení. Vlastní Kalendář a
  // pozvánky patří přihlášenému, v náhledu se nenačítají.
  const preview = await currentPreview(user);
  const viewer = preview?.viewer ?? user;
  const planner = canPlan(viewer);
  const [upcoming, initial, own, monthCards, invitations] = await Promise.all([
    nextEventsFor(viewer, NEXT_ROWS),
    preview ? null : loadPersonalCalendar(user),
    listTasks(viewer),
    planner ? listMonth(viewer, monthKey) : null,
    preview ? null : getDb().then((db) => invitationsFor(db, user)),
  ]);
  // Režim organizátora: návštěva dožene frontu a odpovědi (nejvýš jednou za 5 minut), až po odeslání stránky.
  // Plánovač to dělá i bez návštěv, tady jde jen o čerstvější stav.
  after(() => runWorkerIfDue("visit"));
  // Stejné úkoly jako v Plánu bez filtru: pozvánky bez odpovědi, vlastní úkoly a správci krok aktuálního měsíce.
  const summary = monthCards ? monthSummary(monthCards, monthKey) : null;
  const invite = invitationTask(invitations);
  const tasks = orderTasks(invite ? [invite, ...own] : own, summary, monthKey, (stav) => `/vzdelavani/harmonogram?stav=${stav}#mesic`);
  let personal = initial;
  // Osobní kalendáře doženou zmeškaný zápis (přechodná chyba Googlu, nový účet) a jednou za čas ověří, že
  // přístup u Googlu platí. Zjištění je jeden dotaz do databáze. Na výsledek stránka počká nejvýš chvilku,
  // aby hned ukázala skutečný stav (např. „Kalendář odpojen“), zbytek doběhne na pozadí.
  if (personal && !preview) {
    const db = await getDb();
    if (await personalSyncNeeded(db)) {
      const run = syncPersonalCalendars(db).catch(() => logError("calendar.personal", "home_sync_failed"));
      await Promise.race([run, new Promise((resolve) => setTimeout(resolve, SYNC_WAIT_MS))]);
      after(() => run);
      personal = await loadPersonalCalendar(user);
    }
  }
  return (
    <>
      {peekId && <EventPeek key={peekId} user={user} eventId={peekId} preview={preview} closeHref="/" />}
      {/* Jméno přihlášeného se do snímku zpětné vazby nedostane, hlášení jméno záměrně neposílá. */}
      <h1>
        Vítejte, <span data-feedback-redact="">{user.name}</span>.
      </h1>
      <ShotGrant page="/" />
      {personal && <PersonalCalendarStatus state={personal} />}
      {/* Odpověď na pozvánku se dává v Gmailu, po návratu do okna se úkol obnoví. */}
      {invite && <RefreshOnReturn />}
      <div className={tasks.length > 0 ? "home-columns" : undefined}>
        <section className="section" aria-labelledby="nejblizsi">
          <h2 id="nejblizsi">Nejbližší akce</h2>
          <NextEventsList cards={upcoming} todayKey={toDateKey(now())} hrefFor={(card) => `/?akce=${encodeURIComponent(card.id)}`} />
          <p className="section-actions">
            <Link className="btn" href="/vzdelavani/harmonogram">
              Zobrazit celý plán
            </Link>
          </p>
        </section>
        <TasksCard tasks={tasks} title={preview ? "Úkoly v náhledu" : undefined} readOnly={Boolean(preview)} />
      </div>
    </>
  );
}
