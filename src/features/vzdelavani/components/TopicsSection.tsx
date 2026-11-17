import { InterestButton, ProposeTopicDialog, RestoreTopicButton, TopicManage } from "@/features/vzdelavani/components/TopicActions";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDayMonth } from "@/lib/time";
import { GROUPS, type Group } from "@/lib/types";
import { interestedLabel, isRecommendable } from "@/server/domain/topics";
import { isOrganizer, type Viewer } from "@/server/policy";
import { listArchivedTopics, listTopicInterested, listTopics } from "@/server/services/topics";

/** Kolik nenaplánovaných témat z čela pořadí dostane štítek Doporučené. */
const RECOMMENDED_COUNT = 3;

/** Témata jako jeden přehledný seznam řádků. Doporučená jsou nahoře se štítkem, správa je v nabídce u každého řádku. */
export async function TopicsSection({ user }: { user: Viewer }) {
  const organizer = isOrganizer(user);
  const [topics, archived, interested] = await Promise.all([
    listTopics(user),
    listArchivedTopics(user),
    // Jména zájemců smí vidět jen správce, ostatním server pošle jen počet.
    organizer ? listTopicInterested(user) : null,
  ]);
  const recommended = new Set(topics.filter(isRecommendable).slice(0, RECOMMENDED_COUNT).map((t) => t.id));
  const groups = GROUPS.filter((g) => organizer || user.groups.includes(g)) as Group[];
  const label = (g: string) => GROUP_LABELS[g as Group] ?? g;

  return (
    <section className="section" aria-labelledby="temata">
      <div className="spread">
        <h2 id="temata">Témata</h2>
        <ProposeTopicDialog groups={groups} />
      </div>
      <p className="lead-text">
        Navrhněte téma nebo podpořte návrh kolegů.{!organizer && " O zařazení do plánu rozhoduje správce."}
      </p>
      {topics.length === 0 ? (
        <div className="empty-state">
          <p className="item-title">Zatím tu nejsou žádná témata.</p>
          <p className="item-meta">Navrhněte první tlačítkem Navrhnout téma. Kolegové pak mohou dát najevo zájem.</p>
        </div>
      ) : (
        <ul className="topic-list">
          {topics.map((t) => {
            const names = interested?.get(t.id) ?? [];
            return (
              <li key={t.id} className={recommended.has(t.id) ? "topic-row topic-recommended" : "topic-row"}>
                <div className="topic-main">
                  <p className="item-title">
                    <span id={`tema-${t.id}`}>{t.name}</span>
                    {recommended.has(t.id) && <span className="badge badge-ochre topic-badge">Doporučené</span>}
                  </p>
                  <p className="item-meta">
                    {label(t.audience)} · {t.lastHeld ? `naposledy ${formatDayMonth(t.lastHeld)}` : "zatím neproběhlo"}
                    {t.nextPlanned && ` · příště ${formatDayMonth(t.nextPlanned)}`}
                  </p>
                </div>
                <div className="topic-interest">
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
                  <InterestButton topicId={t.id} interested={t.interestedByViewer} titleId={`tema-${t.id}`} />
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
          <ul className="topic-list archived-topics">
            {archived.map((t) => (
              <li key={t.id} className="topic-row topic-archived">
                <div className="topic-main">
                  <p className="item-title">{t.name}</p>
                  <p className="item-meta">{label(t.audience)}</p>
                </div>
                <div className="topic-interest" />
                <div className="topic-actions">
                  <RestoreTopicButton topicId={t.id} />
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
