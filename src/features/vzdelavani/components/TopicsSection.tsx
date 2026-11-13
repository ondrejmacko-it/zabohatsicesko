import { InterestButton, ProposeTopicDialog, RestoreTopicButton, TopicManage } from "@/features/vzdelavani/components/TopicActions";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDayMonth } from "@/lib/time";
import { GROUPS, type Group } from "@/lib/types";
import { interestedLabel } from "@/server/domain/topics";
import { isOrganizer, type Viewer } from "@/server/policy";
import { listArchivedTopics, listTopics } from "@/server/services/topics";

/** Kolik nenaplánovaných témat z čela pořadí dostane štítek Doporučené. */
const RECOMMENDED_COUNT = 3;

/** Jeden seznam témat. Doporučená jsou nahoře se štítkem, správa je u každého řádku. */
export async function TopicsSection({ user }: { user: Viewer }) {
  const organizer = isOrganizer(user);
  const [topics, archived] = await Promise.all([listTopics(user), listArchivedTopics(user)]);
  const recommended = new Set(topics.filter((t) => t.nextPlanned === null).slice(0, RECOMMENDED_COUNT).map((t) => t.id));
  const groups = GROUPS.filter((g) => organizer || user.groups.includes(g)) as Group[];
  const label = (g: string) => GROUP_LABELS[g as Group] ?? g;

  return (
    <section className="section" aria-labelledby="temata">
      <div className="spread">
        <h2 id="temata">Témata</h2>
        <ProposeTopicDialog groups={groups} />
      </div>
      <p className="lead-text">
        O čem by vzdělávání mělo být. Dejte najevo zájem nebo navrhněte vlastní téma. Doporučená jsou ta, o která je největší zájem
        a dlouho neproběhla. O zařazení do plánu rozhoduje organizátor.
      </p>
      {topics.length === 0 ? (
        <p className="muted">Zatím tu nejsou žádná témata. Navrhněte první.</p>
      ) : (
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
              <tr key={t.id} className={recommended.has(t.id) ? "topic-recommended" : undefined}>
                <td data-label="Téma">
                  <strong>{t.name}</strong>
                  {recommended.has(t.id) && <span className="badge badge-ochre topic-badge">Doporučené</span>}
                  {t.nextPlanned && <span className="small muted"> · naplánováno na {formatDayMonth(t.nextPlanned)}</span>}
                  {recommended.has(t.id) && <span className="small muted topic-reason">{t.reason}</span>}
                </td>
                <td data-label="Skupina">{label(t.audience)}</td>
                <td data-label="Zájemci">{interestedLabel(t.interestCount)}</td>
                <td data-label="Naposledy">{t.lastHeld ? formatDayMonth(t.lastHeld) : "zatím neproběhlo"}</td>
                <td>
                  <div className="row topic-actions">
                    <InterestButton topicId={t.id} interested={t.interestedByViewer} topicName={t.name} />
                    {organizer && <TopicManage topic={t} groups={groups} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {archived.length > 0 && (
        <details className="archived-block">
          <summary>Archivovaná témata ({archived.length})</summary>
          <p className="small muted">Nenabízí se v doporučení ani v dialogu akce. Minulé akce na ně dál odkazují.</p>
          <ul className="stack archived-topics">
            {archived.map((t) => (
              <li key={t.id} className="spread">
                <span>
                  {t.name} <span className="small muted">· {label(t.audience)}</span>
                </span>
                <RestoreTopicButton topicId={t.id} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
