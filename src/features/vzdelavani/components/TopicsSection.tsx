import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { resetTopicOrderAction } from "@/features/vzdelavani/actions";
import { TopicOrderList, type TopicOrderItem } from "@/features/vzdelavani/components/TopicOrderList";
import { InterestButton, ProposeTopicDialog, RestoreTopicButton, TopicManage } from "@/features/vzdelavani/components/TopicActions";
import { GROUP_LABELS } from "@/lib/labels";
import { formatDayMonth } from "@/lib/time";
import { GROUPS, type Group } from "@/lib/types";
import {
  guaranteedTopics,
  hasManualOrder,
  interestedLabel,
  mostWantedIds,
  nextFreePriority,
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
  canGuarantee: boolean;
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
        {ctx.organizer && <TopicManage topic={t} groups={ctx.groups} canGuarantee={ctx.canGuarantee} canMoveUp={index > 0} canMoveDown={index < count - 1} />}
      </div>
    </>
    ),
  };
}

/**
 * Témata: nahoře garantovaná (pořadí 1–3 určuje správce), pod nimi ostatní podle zájmu, případně v ručním
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
    // Volné pořadí počítá z nearchivovaných témat celé organizace: správce vidí všechna.
    canGuarantee: nextFreePriority(topics) !== null,
    label: (g: string) => GROUP_LABELS[g as Group] ?? g,
  };
  const label = ctx.label;

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
        <>
          {guaranteed.length > 0 && (
            <div className="topic-group" aria-labelledby="temata-garantovana">
              <h3 id="temata-garantovana" className="topic-group-title">
                Garantovaná témata
              </h3>
              <p className="item-meta">Při plánování se nabízejí jako první, v tomto pořadí a bez ohledu na počet zájemců.</p>
              <TopicOrderList
                ordered
                sortable={organizer && guaranteed.length > 1}
                className="topic-list topic-guaranteed"
                items={guaranteed.map((t, index) => topicItem(t, index, guaranteed.length, ctx))}
              />
            </div>
          )}
          {organizer && guaranteed.length === 0 && (
            <p className="notice topic-priority-hint">
              Zatím nejsou nastavená garantovaná témata. Vyberte až tři, která se mají probrat přednostně: v nabídce tématu zvolte Nastavit prioritu.
            </p>
          )}
          {others.length > 0 && (
            <div className="topic-group" aria-labelledby={guaranteed.length > 0 ? "temata-ostatni" : undefined}>
              {guaranteed.length > 0 && (
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
              <TopicOrderList
                ordered={false}
                sortable={organizer && others.length > 1}
                className="topic-list"
                items={others.map((t, index) => topicItem(t, index, others.length, ctx))}
              />
            </div>
          )}
          {organizer && (
            <p id="tema-poradi-napoveda" className="visually-hidden">
              Pořadí změníte přetažením úchytu, nebo šipkami nahoru a dolů. Přesouvá se jen v rámci skupiny.
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
