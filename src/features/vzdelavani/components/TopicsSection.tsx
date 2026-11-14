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
export async function TopicsSection({ user, highlightId = null }: { user: Viewer; highlightId?: string | null }) {
  const organizer = isOrganizer(user);
  const [ranked, archived, interested] = await Promise.all([
    listTopics(user),
    listArchivedTopics(user),
    // Jména zájemců smí vidět jen správce, ostatním server pošle jen počet.
    organizer ? listTopicInterested(user) : null,
  ]);
  // Téma z odkazu v pozvánce je první a zvýrazněné, pořadí ostatních se nemění.
  const highlighted = highlightId ? ranked.find((t) => t.id === highlightId) : undefined;
  const topics = highlighted ? [highlighted, ...ranked.filter((t) => t !== highlighted)] : ranked;
  const recommended = new Set(ranked.filter((t) => t.nextPlanned === null).slice(0, RECOMMENDED_COUNT).map((t) => t.id));
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
        a dlouho neproběhla. O zařazení do plánu rozhoduje správce.{organizer && " Kdo má o téma zájem, zjistíte kliknutím na počet zájemců."}
      </p>
      {highlightId && (
        <p className="topic-from-invite" role="status">
          {highlighted
            ? highlighted.interestedByViewer
              ? `Zájem o téma „${highlighted.name}“ už u vás evidujeme. Není potřeba nic dalšího.`
              : `Přišli jste z pozvánky. Zájem o téma „${highlighted.name}“ potvrdíte tlačítkem Mám zájem.`
            : "Téma z pozvánky tu nevidíte. Je archivované nebo určené jiné skupině."}
        </p>
      )}
      {topics.length === 0 ? (
        <p className="muted">Zatím tu nejsou žádná témata. Navrhněte první.</p>
      ) : (
        <ul className="topic-list">
          {topics.map((t) => {
            const names = interested?.get(t.id) ?? [];
            return (
              <li
                key={t.id}
                className={["topic-card", recommended.has(t.id) && "topic-recommended", t === highlighted && "topic-highlight"].filter(Boolean).join(" ")}
              >
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
                  <InterestButton topicId={t.id} interested={t.interestedByViewer} topicName={t.name} primary={t === highlighted} />
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
