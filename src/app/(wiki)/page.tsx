import Link from "next/link";
import { after } from "next/server";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";
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

/** Kolik nejbližších akcí úvod ukáže. Celý měsíc je v Plánu. */
const NEXT_ROWS = 3;
/** Jak dlouho Úvod čeká na zápis do osobního kalendáře, než stránku pošle se stavem, jaký je. */
const SYNC_WAIT_MS = 2500;

// Úvod odpovídá na dvě otázky: co mě čeká a co mám udělat. Moduly jsou v navigaci, úspěšný stav
// Kalendáře se neukazuje, jen problém, který chce zásah.
export default async function HomePage() {
  const user = await requireUser();
  const monthKey = monthOf(toDateKey(now()));
  const planner = canPlan(user);
  const [upcoming, initial, own, monthCards, invitations] = await Promise.all([
    nextEventsFor(user, NEXT_ROWS),
    loadPersonalCalendar(user),
    listTasks(user),
    planner ? listMonth(user, monthKey) : null,
    getDb().then((db) => invitationsFor(db, user)),
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
  if (personal) {
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
      <h1>Vítejte, {user.name}.</h1>
      {personal && <PersonalCalendarStatus state={personal} />}
      {/* Odpověď na pozvánku se dává v Gmailu, po návratu do okna se úkol obnoví. */}
      {invite && <RefreshOnReturn />}
      <div className={tasks.length > 0 ? "home-columns" : undefined}>
        <section className="section" aria-labelledby="nejblizsi">
          <div className="spread section-head">
            <h2 id="nejblizsi">Nejbližší akce</h2>
            <Link className="btn btn-small" href="/vzdelavani/harmonogram">
              Celý plán
            </Link>
          </div>
          <NextEventsList cards={upcoming} todayKey={toDateKey(now())} />
        </section>
        <TasksCard tasks={tasks} />
      </div>
    </>
  );
}
