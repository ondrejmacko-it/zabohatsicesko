import type { Metadata } from "next";
import Link from "next/link";
import { NextEventCard } from "@/features/vzdelavani/components/Schedule";
import { GROUP_LABELS, TYPE_LABELS } from "@/lib/labels";
import { formatDate, formatEventTime, toDateKey } from "@/lib/time";
import type { Group } from "@/lib/types";
import { requireUser } from "@/server/auth/session";
import { now } from "@/server/config";
import { listEvents } from "@/server/services/events";
import { listPublishedMinutes, listTasks } from "@/server/services/journey";

export const metadata: Metadata = { title: "Moje cesta" };

const UPCOMING_DAYS = 60;
const UPCOMING_LIMIT = 5;

export default async function MyJourneyPage() {
  const user = await requireUser();
  const from = now();
  const [cards, tasks, minutes] = await Promise.all([
    listEvents(user, from, new Date(from.getTime() + UPCOMING_DAYS * 86_400_000)),
    listTasks(user),
    listPublishedMinutes(user),
  ]);
  const upcoming = cards.filter((c) => c.planStatus === "published" && c.type !== "holiday" && new Date(c.startsAt) >= from);
  const [next, ...later] = upcoming;
  const groups = user.groups.map((g) => GROUP_LABELS[g as Group]).filter(Boolean);

  return (
    <>
      <section className="section" aria-labelledby="ceka">
        <h2 id="ceka">Čeká na vás</h2>
        {tasks.length === 0 ? (
          <p className="muted">Teď po vás nic nechceme. Úkoly se tu objeví, když povedete akci nebo budete kontrolovat zápis.</p>
        ) : (
          <ul className="card-list">
            {tasks.map((task) => (
              <li key={task.key} className="task-card">
                <div>
                  <p className="item-title">{task.title}</p>
                  <p className="item-meta">{task.detail}</p>
                </div>
                <Link className="btn btn-primary" href={task.href}>
                  {task.action}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="nejblizsi">
        <div className="spread">
          <h2 id="nejblizsi">Nejbližší akce</h2>
          <Link className="btn btn-small" href="/vzdelavani/harmonogram">
            Celý harmonogram →
          </Link>
        </div>
        {next ? (
          <NextEventCard card={next} />
        ) : (
          <div className="empty-state">
            <p className="item-title">V příštích týdnech pro vás není zveřejněná žádná akce.</p>
            <p className="item-meta">
              {groups.length
                ? `Vidíte akce pro skupiny: ${groups.join(", ")}. Nové termíny přijdou i jako pozvánka do Kalendáře.`
                : "Zatím nejste v žádné skupině. Skupiny vám přidělí správce ZBC, potom tu uvidíte své akce."}
            </p>
          </div>
        )}
        {later.length > 0 && (
          <ul className="plain-list">
            {later.slice(0, UPCOMING_LIMIT).map((c) => (
              <li key={c.id}>
                <Link href={`/vzdelavani/akce/${c.id}?odkud=moje-cesta`}>
                  <strong>{formatDate(toDateKey(new Date(c.startsAt)))}</strong> · {formatEventTime(new Date(c.startsAt), new Date(c.endsAt), c.allDay)} ·{" "}
                  {c.topicTitle ? `${c.label}: ${c.topicTitle}` : c.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="nove-zapisy">
        <div className="spread">
          <h2 id="nove-zapisy">Poslední zápisy</h2>
          {minutes.length > 0 && (
            <Link className="btn btn-small" href="/vzdelavani/zapisy">
              Všechny zápisy ({minutes.length}) →
            </Link>
          )}
        </div>
        {minutes.length === 0 ? (
          <p className="muted">Zatím tu není žádný zveřejněný zápis z akcí pro vaše skupiny.</p>
        ) : (
          <ul className="card-list">
            {minutes.slice(0, 3).map((m) => (
              <li key={m.eventId}>
                <Link className="item-card" href={`/vzdelavani/akce/${m.eventId}?odkud=moje-cesta#zapis`}>
                  <p className="eyebrow">
                    {formatDate(toDateKey(new Date(m.startsAt)))} · {TYPE_LABELS[m.type]}
                  </p>
                  <p className="item-title">{m.title}</p>
                  <p className="item-meta clamp">{m.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="small muted">
        Onboarding nováčků s milníky zůstává ve firemní Wiki beze změny, ukázka ho nekopíruje.
      </p>
    </>
  );
}
