import { InterestButton, ProposeTopicDialog, RestoreTopicButton, TopicManage } from "@/features/vzdelavani/components/TopicActions";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDayMonth } from "@/lib/time";
import { GROUPS, type Group } from "@/lib/types";
import { interestedLabel } from "@/server/domain/topics";
import { isOrganizer, type Viewer } from "@/server/policy";
import { listArchivedTopics, listTopicInterested, listTopics } from "@/server/services/topics";

/** Kolik nenaplánovaných témat z čela pořadí dostane štítek Doporučené. */
const RECOMMENDED_COUNT = 3;

/** Témata jako karty. Doporučená jsou nahoře se štítkem, správa je v nabídce u každé karty. */
export async function TopicsSection({ user }: { user: Viewer }) {
  const organizer = isOrganizer(user);
  const [topics, archived, interested] = await Promise.all([
    listTopics(user),
    listArchivedTopics(user),
    // Jména zájemců smí vidět jen organizátor a správce, ostatním server pošle jen počet.
    organizer ? listTopicInterested(user) : null,
  ]);
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
        a dlouho neproběhla. O zařazení do plánu rozhoduje organizátor.{organizer && " Kdo má o téma zájem, zjistíte kliknutím na počet zájemců."}
      </p>
      {topics.length === 0 ? (
        <p className="muted">Zatím tu nejsou žádná témata. Navrhněte první.</p>
      ) : (
        <ul className="topic-list">
          {topics.map((t) => {
            const names = interested?.get(t.id) ?? [];
            return (
              <li key={t.id} className={recommended.has(t.id) ? "topic-card topic-recommended" : "topic-card"}>
                <div className="topic-main">
                  <p className="item-title">
                    {t.name}
                    {recommended.has(t.id) && <span className="badge badge-ochre topic-badge">Doporučené</span>}
                  </p>
                  <p className="item-meta">
                    {label(t.audience)} · {t.lastHeld ? `naposledy ${formatDayMonth(t.lastHeld)}` : "zatím neproběhlo"}
                    {t.nextPlanned && ` · naplánováno na ${formatDayMonth(t.nextPlanned)}`}
                  </p>
                  {names.length > 0 ? (
                    <details className="topic-people">
                      <summary>{interestedLabel(t.interestCount)}</summary>
                      <ul className="chip-list">
                        {names.map((name) => (
                          <li key={name} className="chip">
                            {name}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <p className="topic-count">{interestedLabel(t.interestCount)}</p>
                  )}
                </div>
                <div className="topic-actions">
                  <InterestButton topicId={t.id} interested={t.interestedByViewer} topicName={t.name} />
                  {organizer && <TopicManage topic={t} groups={groups} />}
                </div>
              </li>
            );
          })}
        </ul>
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
