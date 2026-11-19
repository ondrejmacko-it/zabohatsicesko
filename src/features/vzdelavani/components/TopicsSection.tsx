import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { resetTopicOrderAction } from "@/features/vzdelavani/actions";
import { TopicBoard, type TopicOrderItem } from "@/features/vzdelavani/components/TopicBoard";
import { InterestButton, ProposeTopicDialog, RestoreTopicButton, TopicManage } from "@/features/vzdelavani/components/TopicActions";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDayMonth } from "@/lib/time";
import { GROUPS, type Group } from "@/lib/types";
import {
  guaranteedTopics,
  hasManualOrder,
  interestedLabel,
  mostWantedIds,
  otherTopics,
  sortByInterest,
  type RankedTopic,
} from "@/server/domain/topics";
import { isOrganizer, type Viewer } from "@/server/policy";
import { listArchivedTopics, listTopicInterested, listTopics } from "@/server/services/topics";

type RowContext = {
  organizer: boolean;
  groups: Group[];
  mostWanted: Set<string>;
  interested: Map<string, string[]> | null;
  label: (g: string) => string;
};

/** Obsah jednoho řádku tématu pro `TopicOrderList`. Pořadí v seznamu (a tím i posun výš/níž) určuje volající. */
function topicItem(t: RankedTopic, index: number, count: number, ctx: RowContext): TopicOrderItem {
  const names = ctx.interested?.get(t.id) ?? [];
  const wanted = ctx.mostWanted.has(t.id);
  const next = t.nextPlanned && (
    <>
      {" · "}
      {ctx.organizer && t.nextPlannedId ? (
        <Link href={`/vzdelavani/harmonogram?mesic=${t.nextPlanned.slice(0, 7)}&akce=${encodeURIComponent(t.nextPlannedId)}`}>příště {formatDayMonth(t.nextPlanned)}</Link>
      ) : (
        `příště ${formatDayMonth(t.nextPlanned)}`
      )}
    </>
  );
  return {
    id: t.id,
    name: t.name,
    className: wanted ? "topic-row topic-wanted" : "topic-row",
    content: (
    <>
      <div className="topic-main">
        <p className="item-title">
          <span id={`tema-${t.id}`}>{t.name}</span>
          {wanted && <span className="badge badge-ok topic-badge">Nejžádanější</span>}
        </p>
        <p className="item-meta">
          {ctx.label(t.audience)} · {t.lastHeld ? `naposledy ${formatDayMonth(t.lastHeld)}` : "zatím neproběhlo"}
          {next}
          {/* Téma je jen v návrhu akce: kolegové termín ještě nevidí, správce ho má dotáhnout ke zveřejnění. */}
          {ctx.organizer && !t.nextPlanned && t.nextDraft && (
            <>
              {" · "}
              <Link className="topic-in-draft" href={`/vzdelavani/harmonogram?mesic=${t.nextDraft.slice(0, 7)}${t.nextDraftId ? `&akce=${encodeURIComponent(t.nextDraftId)}` : ""}`}>
                v návrhu na {formatDayMonth(t.nextDraft)}
              </Link>
            </>
          )}
          {/* Garantované téma bez budoucího termínu: správce ho uvidí hned v seznamu, datum se nedoplňuje samo. */}
          {ctx.organizer && t.priorityRank != null && !t.nextPlanned && !t.nextDraft && <span className="topic-unscheduled"> · bez termínu</span>}
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
        {ctx.organizer && <TopicManage topic={t} groups={ctx.groups} canMoveUp={index > 0} canMoveDown={index < count - 1} />}
      </div>
    </>
    ),
  };
}

/**
 * Témata: nahoře garantovaná (pořadí určuje správce, počet není omezený), pod nimi ostatní podle zájmu, případně v ručním
 * pořadí správce. Štítek Nejžádanější zůstává vázaný na skutečný počet zájemců v celém seznamu.
 * Správa je v nabídce u každého řádku.
 */
export async function TopicsSection({ user }: { user: Viewer }) {
  const organizer = isOrganizer(user);
  const [ranked, archived, interested] = await Promise.all([
    listTopics(user),
    listArchivedTopics(user),
    // Jména zájemců smí vidět jen správce, ostatním server pošle jen počet.
    organizer ? listTopicInterested(user) : null,
  ]);
  // Server vrací jen témata, která uživatel smí vidět, a bez archivu. Pořadí plánování (`rankTopics`) se tu nepoužívá.
  const topics = sortByInterest(ranked);
  const guaranteed = guaranteedTopics(topics);
  const others = otherTopics(topics);
  const manualOrder = hasManualOrder(topics);
  const groups = GROUPS.filter((g) => organizer || user.groups.includes(g)) as Group[];
  const ctx: RowContext = {
    organizer,
    groups,
    mostWanted: mostWantedIds(topics),
    interested,
    label: (g: string) => GROUP_LABELS[g as Group] ?? g,
  };
  const label = ctx.label;

  return (
    <section className="section" aria-labelledby="temata">
      {/* Název stránky už nese záložka Témata; nadpis zůstává pro čtečky a osnovu stránky. */}
      <h2 id="temata" className="visually-hidden">
        Témata
      </h2>
      <div className="spread topic-intro">
        <p className="lead-text">
          Navrhněte téma nebo podpořte návrh kolegů.{!organizer && " O zařazení do plánu rozhoduje správce."}
        </p>
        <ProposeTopicDialog groups={groups} />
      </div>
      {topics.length === 0 ? (
        <div className="empty-state">
          <p className="item-title">Zatím tu nejsou žádná témata.</p>
          <p className="item-meta">Navrhněte první tlačítkem Navrhnout téma. Kolegové pak mohou dát najevo zájem.</p>
        </div>
      ) : (
        <>
          <TopicBoard
            sortable={organizer}
            guaranteed={guaranteed.map((t, index) => topicItem(t, index, guaranteed.length, ctx))}
            others={others.map((t, index) => topicItem(t, index, others.length, ctx))}
            guaranteedHead={
              <h3 id="temata-garantovana" className="topic-group-title">
                Garantovaná témata
              </h3>
            }
            othersHead={
              <>
                {(organizer || guaranteed.length > 0) && (
                  <h3 id="temata-ostatni" className="topic-group-title">
                    Ostatní témata
                  </h3>
                )}
                {manualOrder && (
                  <div className="topic-order-note">
                    <p className="item-meta">Pořadí upravil správce. Nová témata přibývají na konec.</p>
                    {organizer && <ActionForm action={resetTopicOrderAction} label="Seřadit podle zájmu" pendingLabel="Řadím…" small />}
                  </div>
                )}
              </>
            }
          />
          {organizer && (
            <p id="tema-poradi-napoveda" className="visually-hidden">
              Pořadí změníte přetažením úchytu, i mezi garantovanými a ostatními tématy. Šipkami nahoru a dolů posunete téma o jedno místo, přes okraj skupiny do druhé skupiny.
            </p>
          )}
        </>
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
