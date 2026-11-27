import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { PageCall } from "@/components/PageCall";
import { resetTopicOrderAction } from "@/features/vzdelavani/actions";
import { TopicBoard, type TopicOrderItem } from "@/features/vzdelavani/components/TopicBoard";
import { InterestButton, ProposeTopicDialog, RestoreTopicButton, TopicManage } from "@/features/vzdelavani/components/TopicActions";
import { GROUP_LABELS, PREVIEW_READ_ONLY } from "@/lib/labels";
import { formatDayMonth } from "@/lib/time";
import { GROUPS, type Group } from "@/lib/types";
import {
  filterTopics,
  guaranteedTopics,
  hasManualOrder,
  interestedLabel,
  mostWantedIds,
  otherTopics,
  parseTopicFilter,
  sortByInterest,
  type RankedTopic,
  type TopicFilter,
} from "@/server/domain/topics";
import { eventVisibility } from "@/server/config";
import { isOrganizer, type Viewer } from "@/server/policy";
import { listArchivedTopics, listTopicInterested, listTopics } from "@/server/services/topics";

type RowContext = {
  organizer: boolean;
  readOnly: boolean;
  /** Pořadí jde měnit jen nad celým seznamem: ve filtru by posun o jedno místo přeskočil skrytá témata. */
  sortable: boolean;
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
          {wanted && (
            <span className="badge badge-ok topic-badge" title="Patří mezi tři témata s největším zájmem kolegů. S garancí nesouvisí.">
              Nejžádanější
            </span>
          )}
        </p>
        <p className="item-meta">
          {/* Bez konání se nic nepíše: „zatím neproběhlo“ se opakovalo skoro u každého tématu (F12). */}
          {ctx.label(t.audience)}
          {t.lastHeld && ` · naposledy ${formatDayMonth(t.lastHeld)}`}
          {next}
          {/* Téma je jen v návrhu akce: kolegové termín ještě nevidí, správce ho má dotáhnout ke zveřejnění. */}
          {ctx.organizer && !t.nextPlanned && t.nextDraft && (
            <>
              {" · "}
              <Link
                className="topic-in-draft"
                href={`/vzdelavani/harmonogram?mesic=${t.nextDraft.slice(0, 7)}${t.nextDraftId ? `&akce=${encodeURIComponent(t.nextDraftId)}&upravit=1` : ""}`}
                title={`Návrh akce ${formatDayMonth(t.nextDraft)}`}
              >
                termín se potvrzuje
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
        {/* Náhled nic nemění: stejné tlačítko a stav zájmu jako u kolegy, jen zamčené. */}
        <InterestButton topicId={t.id} interested={t.interestedByViewer} titleId={`tema-${t.id}`} locked={ctx.readOnly} />
        {/* V náhledu správce stejná nabídka jako u správce, akční položky zamčené (PreviewLock). */}
        {ctx.organizer && (
          <TopicManage topic={t} groups={ctx.groups} canMoveUp={ctx.sortable && index > 0} canMoveDown={ctx.sortable && index < count - 1} />
        )}
      </div>
    </>
    ),
  };
}

/** Přepínač Pro mou roli / Všechna (F10). Odkazy jako u Moje / Všechny v Plánu, stav nese `aria-current`. */
function TopicFilterToggle({ filter }: { filter: TopicFilter }) {
  return (
    <span className="view-toggle topic-filter" role="group" aria-label="Která témata">
      <Link className="pill" href="/vzdelavani/temata?filtr=role" aria-current={filter === "role" ? "page" : undefined}>
        Pro mou roli
      </Link>
      <Link className="pill" href="/vzdelavani/temata?filtr=vse" aria-current={filter === "all" ? "page" : undefined}>
        Všechna
      </Link>
    </span>
  );
}

/**
 * Témata: nahoře garantovaná (pořadí určuje správce, počet není omezený), pod nimi ostatní podle zájmu, případně v ručním
 * pořadí správce. Štítek Nejžádanější zůstává vázaný na skutečný počet zájemců v celém seznamu.
 * Správa je v nabídce u každého řádku.
 */
export async function TopicsSection({ user, readOnly = false, filter: requested }: { user: Viewer; readOnly?: boolean; filter?: string }) {
  const organizer = isOrganizer(user);
  // Filtr má smysl, jen když člověk vidí i témata mimo své role: správce vždy, kolega v režimu všech zveřejněných akcí.
  const filterable = organizer || eventVisibility() === "all-published";
  const filter = filterable ? parseTopicFilter(requested, organizer) : "all";
  const [ranked, archived, interested] = await Promise.all([
    listTopics(user),
    listArchivedTopics(user),
    // Jména zájemců smí vidět jen správce, ostatním server pošle jen počet.
    organizer ? listTopicInterested(user) : null,
  ]);
  // Server vrací jen témata, která uživatel smí vidět, a bez archivu. Pořadí plánování (`rankTopics`) se tu nepoužívá.
  // Pořadí i štítek Nejžádanější se počítají z celého seznamu, filtr jen skryje řádky (pořadí zůstává).
  const all = sortByInterest(ranked);
  const topics = filterTopics(all, user.groups, filter);
  const guaranteed = filterTopics(guaranteedTopics(all), user.groups, filter);
  const others = filterTopics(otherTopics(all), user.groups, filter);
  const manualOrder = hasManualOrder(all);
  const sortable = organizer && filter === "all";
  const groups = GROUPS.filter((g) => organizer || user.groups.includes(g)) as Group[];
  const ctx: RowContext = {
    organizer,
    readOnly,
    sortable,
    groups,
    mostWanted: mostWantedIds(all),
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
      <PageCall text={readOnly ? `${PREVIEW_READ_ONLY}. Tady se navrhují témata a podporují návrhy kolegů.` : "Navrhni téma nebo podpoř návrh kolegů."}>
        <ProposeTopicDialog groups={groups} locked={readOnly} />
      </PageCall>
      {filterable && all.length > 0 && topics.length === 0 && (
        <div className="topic-toolbar">
          <TopicFilterToggle filter={filter} />
        </div>
      )}
      {all.length === 0 ? (
        <div className="empty-state">
          <p className="item-title">Zatím tu nejsou žádná témata.</p>
          <p className="item-meta">
            {readOnly ? "V tomto pohledu není vidět žádné téma." : "Navrhni první tlačítkem Navrhnout téma. Kolegové pak můžou dát najevo zájem."}
          </p>
        </div>
      ) : topics.length === 0 ? (
        <div className="empty-state">
          <p className="item-title">Pro tvou roli tu teď žádné téma není.</p>
          <p className="item-meta">Ostatní najdeš ve Všechna.</p>
        </div>
      ) : (
        <>
          <TopicBoard
            sortable={sortable}
            filter={filterable ? <TopicFilterToggle filter={filter} /> : undefined}
            guaranteed={guaranteed.map((t, index) => topicItem(t, index, guaranteed.length, ctx))}
            others={others.map((t, index) => topicItem(t, index, others.length, ctx))}
            guaranteedHead={
              <>
                <h3 id="temata-garantovana" className="topic-group-title">
                  Garantovaná témata
                </h3>
                {/* F10: krátce, co garantované znamená. Pravidlo plánování je v `recommendTopics`. */}
                <p className="item-meta">Správce je plánuje přednostně.</p>
              </>
            }
            othersHead={
              <>
                {(organizer || guaranteed.length > 0) && (
                  <h3 id="temata-ostatni" className="topic-group-title">
                    Ostatní témata
                  </h3>
                )}
                {/* Správa pořadí jen pro správce (F11), kolega vidí jen výsledný seznam. */}
                {organizer && manualOrder && (
                  <div className="topic-order-note">
                    <p className="item-meta">Pořadí upravil správce. Nová témata přibývají na konec.</p>
                    {sortable && <ActionForm action={resetTopicOrderAction} label="Seřadit podle zájmu" pendingLabel="Řadím…" small />}
                  </div>
                )}
              </>
            }
          />
          {/* Rozhodnutí vlastníka (audit P1): Nejžádanější = zájem kolegů, Garantované = priorita správce. Oddělené. */}
          {ctx.mostWanted.size > 0 && (
            <p className="item-meta" data-testid="nejzadanejsi-vysvetleni">
              Štítek Nejžádanější mají nejvýš tři témata s největším zájmem kolegů. S garancí nesouvisí, může ho mít i garantované téma.
            </p>
          )}
          {sortable && (
            <p id="tema-poradi-napoveda" className="visually-hidden">
              Pořadí změníš přetažením úchytu, i mezi garantovanými a ostatními tématy. Šipkami nahoru a dolů posuneš téma o jedno místo, přes okraj skupiny do druhé skupiny.
            </p>
          )}
          {organizer && !sortable && (
            <p className="item-meta topic-filter-note">
              Ve filtru Pro mou roli nejde měnit pořadí.{" "}
              <Link className="link-button" href="/vzdelavani/temata?filtr=vse">
                Zobrazit všechna
              </Link>
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
