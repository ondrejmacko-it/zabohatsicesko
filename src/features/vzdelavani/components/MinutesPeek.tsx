import Link from "next/link";
import { RouteModal, UnavailableModal } from "@/components/RouteModal";
import { GROUP_LABELS, TYPE_LABELS } from "@/lib/labels";
import { formatDate, toDateKey } from "@/lib/time";
import type { Viewer } from "@/server/policy";
import { getEventDetail } from "@/server/services/detail";
import type { MissingMinutesItem } from "@/server/services/journey";
import { RecordingSection } from "./RecordingSection";

const STATE_TEXT: Record<MissingMinutesItem["state"], string> = {
  none: "bez nahrávky",
  processing: "nahrávka se přepisuje",
  failed: "přepis se nepovedl",
  unsupported: "ukázkový přepis soubor nepřepíše",
  draft: "návrh čeká na kontrolu",
};

const STATE_ACTION: Record<MissingMinutesItem["state"], string> = {
  none: "Nahrát nahrávku",
  processing: "Zobrazit stav",
  failed: "Zkusit přepis znovu",
  unsupported: "Vybrat jinou nahrávku",
  draft: "Zkontrolovat",
};

/**
 * Zápis v okně nad stránkou Zápisy. Čtenář vidí zveřejněný zápis, vedoucí a kontrolor tu rovnou nahrají
 * záznam a zápis zkontrolují. Oprávnění počítá server stejně jako v detailu akce.
 */
export async function MinutesPeek({ user, eventId, closeHref }: { user: Viewer; eventId: string; closeHref: string }) {
  const detail = await getEventDetail(user, eventId);
  if (!detail || detail.recording.access === "none") return <UnavailableModal title="Zápis není dostupný" closeHref={closeHref} backLabel="Zpět na zápisy" />;
  const { card } = detail;
  const day = formatDate(toDateKey(new Date(card.startsAt)));
  const title = card.topicTitle ? `${card.label}: ${card.topicTitle}` : card.label;
  return (
    <RouteModal title={title} closeHref={closeHref} wide>
      <p className="eyebrow peek-eyebrow">
        {day} · {TYPE_LABELS[card.type]} · {GROUP_LABELS[card.audience]}
        {` · ${detail.leadName ? `Vede: ${detail.leadName}` : "Vedoucí neurčen"}`}
      </p>
      <div className="peek-section">
        <RecordingSection eventId={card.id} eventLabel={`${title} · ${day}`} panel={detail.recording} />
      </div>
    </RouteModal>
  );
}

/**
 * Okno „Nedokončené zápisy“ (správce, všechny) nebo „Moje zápisy k dokončení“ (vedoucí): proběhlé akce,
 * kterým zápis chybí. U každé je odpovědná osoba. Výběr akce otevře její zápis ve stejném okně.
 */
export function AddMinutesPicker({
  title,
  items,
  hrefFor,
  closeHref,
  assignHref,
}: {
  title: string;
  items: MissingMinutesItem[];
  hrefFor: (eventId: string) => string;
  closeHref: string;
  /** Jen správce: kam vede přiřazení vedoucího akci, která ho nemá. */
  assignHref?: (item: MissingMinutesItem) => string;
}) {
  return (
    <RouteModal title={title} closeHref={closeHref}>
      {items.length === 0 ? (
        <div className="empty-state">
          <p className="item-title">Všechny proběhlé akce už zápis mají.</p>
          <p className="item-meta">Další se tu objeví po skončení příští akce.</p>
        </div>
      ) : (
        <>
          <p className="hint">Vyberte akci a dokončete její zápis.</p>
          <ul className="brief-list picker-list">
            {items.map((item) => {
              const body = (
                <>
                  <span className="brief-main">
                    <span className="item-title">{item.title}</span>
                    <span className="item-meta">
                      {formatDate(toDateKey(new Date(item.startsAt)))} · {STATE_TEXT[item.state]} · {item.leadName ? `Vede: ${item.leadName}` : "Vedoucí neurčen"}
                    </span>
                  </span>
                  <span className={item.canHandle ? "btn btn-small btn-primary" : "btn btn-small"} aria-hidden="true">
                    {item.canHandle ? STATE_ACTION[item.state] : "Otevřít akci"}
                  </span>
                </>
              );
              return (
                <li key={item.eventId}>
                  <Link
                    className="brief-row brief-link"
                    href={item.canHandle ? hrefFor(item.eventId) : `/vzdelavani/akce/${encodeURIComponent(item.eventId)}?odkud=zapisy`}
                    scroll={false}
                  >
                    {body}
                  </Link>
                  {!item.leadName && assignHref && (
                    <Link className="small picker-assign" href={assignHref(item)}>
                      Přiřadit vedoucího
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </RouteModal>
  );
}
