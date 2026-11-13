import Link from "next/link";
import { RouteModal } from "@/components/RouteModal";
import { GROUP_LABELS, TYPE_LABELS } from "@/lib/labels";
import { formatDate, toDateKey } from "@/lib/time";
import type { Viewer } from "@/server/policy";
import { getEventDetail } from "@/server/services/detail";
import type { MissingMinutesItem } from "@/server/services/journey";
import { RecordingSection } from "./RecordingSection";

const STATE_TEXT: Record<MissingMinutesItem["state"], string> = {
  none: "bez nahrávky",
  processing: "nahrávka se zpracovává",
  draft: "návrh čeká na kontrolu",
};

/**
 * Zápis v okně nad stránkou Zápisy. Čtenář vidí zveřejněný zápis, vedoucí a kontrolor tu rovnou nahrají
 * záznam a zápis zkontrolují. Oprávnění počítá server stejně jako v detailu akce.
 */
export async function MinutesPeek({ user, eventId, closeHref }: { user: Viewer; eventId: string; closeHref: string }) {
  const detail = await getEventDetail(user, eventId);
  if (!detail || detail.recording.access === "none") return null;
  const { card } = detail;
  const day = formatDate(toDateKey(new Date(card.startsAt)));
  const title = card.topicTitle ? `${card.label}: ${card.topicTitle}` : card.label;
  return (
    <RouteModal title={title} closeHref={closeHref} wide>
      <p className="eyebrow peek-eyebrow">
        {day} · {TYPE_LABELS[card.type]} · {GROUP_LABELS[card.audience]}
        {detail.leadName ? ` · Vede: ${detail.leadName}` : ""}
      </p>
      <div className="peek-section">
        <RecordingSection eventId={card.id} eventLabel={`${title} · ${day}`} panel={detail.recording} />
      </div>
      <div className="dialog-actions peek-actions">
        <Link className="btn" href={`/vzdelavani/akce/${encodeURIComponent(card.id)}?odkud=zapisy`}>
          Otevřít celou akci
        </Link>
      </div>
    </RouteModal>
  );
}

/** Okno „Přidat zápis“: proběhlé akce, kterým zápis chybí. Výběr akce otevře její zápis ve stejném okně. */
export function AddMinutesPicker({ items, hrefFor, closeHref }: { items: MissingMinutesItem[]; hrefFor: (eventId: string) => string; closeHref: string }) {
  return (
    <RouteModal title="Přidat zápis" closeHref={closeHref}>
      {items.length === 0 ? (
        <div className="empty-state">
          <p className="item-title">Všechny proběhlé akce už zápis mají.</p>
          <p className="item-meta">Další se tu objeví po skončení příští akce.</p>
        </div>
      ) : (
        <>
          <p className="hint">Vyberte proběhlou akci. Nahrajete k ní záznam, zápis se z něj připraví sám a vy ho zkontrolujete a zveřejníte.</p>
          <ul className="brief-list picker-list">
            {items.map((item) => {
              const body = (
                <>
                  <span className="brief-main">
                    <span className="item-title">{item.title}</span>
                    <span className="item-meta">
                      {formatDate(toDateKey(new Date(item.startsAt)))} · {STATE_TEXT[item.state]}
                      {!item.canHandle && ` · zápis připravuje ${item.leadName ?? "vedoucí akce"}`}
                    </span>
                  </span>
                  <span className={item.canHandle ? "btn btn-small btn-primary" : "btn btn-small"} aria-hidden="true">
                    {!item.canHandle ? "Otevřít akci" : item.state === "draft" ? "Zkontrolovat" : item.state === "processing" ? "Zobrazit stav" : "Nahrát záznam"}
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
                </li>
              );
            })}
          </ul>
        </>
      )}
    </RouteModal>
  );
}
