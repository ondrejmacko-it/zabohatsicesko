import type { Metadata } from "next";
import { InterestButton, ProposeTopicDialog } from "@/features/vzdelavani/components/TopicActions";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDayMonth } from "@/lib/time";
import { GROUPS, type Group } from "@/lib/types";
import { requireUser } from "@/server/auth/session";
import { interestedLabel } from "@/server/domain/topics";
import { isOrganizer } from "@/server/policy";
import { listTopics } from "@/server/services/topics";

export const metadata: Metadata = { title: "Témata" };

export default async function TopicsPage() {
  const user = await requireUser();
  const topics = await listTopics(user);
  const recommended = topics.filter((t) => t.nextPlanned === null).slice(0, 3);
  const groups = GROUPS.filter((g) => isOrganizer(user) || user.groups.includes(g)) as Group[];
  const label = (g: string) => GROUP_LABELS[g as Group] ?? g;

  return (
    <>
      <section className="section">
        <div className="spread">
          <h2>Doporučená témata</h2>
          <ProposeTopicDialog groups={groups} />
        </div>
        <p className="small muted">
          Řazeno podle počtu zájemců a toho, kdy téma naposledy proběhlo. Naplánovaná témata jsou až na konci.
          O zařazení vždy rozhoduje organizátor.
        </p>
        {recommended.length ? (
          <ol className="stack recommended">
            {recommended.map((t) => (
              <li key={t.id} className="item-card">
                <p className="eyebrow">{label(t.audience)}</p>
                <p className="item-title">{t.name}</p>
                <p className="item-meta">{t.reason}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Zatím tu nejsou žádná témata k doporučení.</p>
        )}
      </section>

      <section className="section" aria-labelledby="vsechna-temata">
        <h2 id="vsechna-temata">Všechna témata</h2>
        <table className="table topics-table">
          <thead>
            <tr>
              <th scope="col">Téma</th>
              <th scope="col">Skupina</th>
              <th scope="col">Zájemci</th>
              <th scope="col">Naposledy</th>
              <th scope="col">
                <span className="visually-hidden">Akce</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.id}>
                <td data-label="Téma">
                  <strong>{t.name}</strong>
                  {t.nextPlanned && <span className="small muted"> · naplánováno na {formatDayMonth(t.nextPlanned)}</span>}
                </td>
                <td data-label="Skupina">{label(t.audience)}</td>
                <td data-label="Zájemci">{interestedLabel(t.interestCount)}</td>
                <td data-label="Naposledy">{t.lastHeld ? formatDayMonth(t.lastHeld) : "zatím neproběhlo"}</td>
                <td>
                  <InterestButton topicId={t.id} interested={t.interestedByViewer} topicName={t.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
