import { RouteModal, UnavailableModal } from "@/components/RouteModal";
import { eventContext, eventTitle } from "@/lib/labels";
import { formatDate, toDateKey } from "@/lib/time";
import type { Viewer } from "@/server/policy";
import { getEventDetail } from "@/server/services/detail";
import type { MissingMinutesItem } from "@/server/services/journey";
import { MissingMinutesList, type MissingRow, type MissingStatus } from "./MissingMinutesList";
import { RecordingSection } from "./RecordingSection";

const STATE_TEXT: Record<MissingMinutesItem["state"], string> = {
  none: "bez zápisu",
  processing: "nahrávka se přepisuje",
  failed: "přepis se nepovedl",
  unsupported: "ukázkový přepis soubor nepřepíše",
  started: "zápis rozpracovaný",
  draft: "návrh čeká na schválení",
};

const STATE_ACTION: Record<MissingMinutesItem["state"], string> = {
  none: "Připravit zápis",
  processing: "Zobrazit stav",
  failed: "Zkusit přepis znovu",
  unsupported: "Vybrat jinou nahrávku",
  started: "Pokračovat v zápisu",
  draft: "Zkontrolovat zápis",
};

function statusOf(item: MissingMinutesItem): MissingStatus {
  if (!item.leadName) return "no-lead";
  if (item.state === "none") return "none";
  return item.state === "draft" ? "draft" : "progress";
}

/**
 * Zápis v okně nad stránkou Zápisy. Čtenář vidí zveřejněný zápis, vedoucí a kontrolor tu rovnou nahrají
 * záznam a zápis zkontrolují. Oprávnění počítá server stejně jako v detailu akce.
 */
export async function MinutesPeek({
  user,
  eventId,
  closeHref,
  previewLabel,
}: {
  user: Viewer;
  eventId: string;
  closeHref: string;
  /** Aktivní náhled: `user` je divák náhledu a okno nesmí nabídnout nahrání ani úpravy. */
  previewLabel?: string;
}) {
  const detail = await getEventDetail(user, eventId);
  if (!detail || detail.recording.access === "none") return <UnavailableModal title="Zápis není dostupný" closeHref={closeHref} backLabel="Zpět na zápisy" />;
  const { card } = detail;
  const day = formatDate(toDateKey(new Date(card.startsAt)));
  const title = eventTitle(card.label, card.topicTitle);
  return (
    <RouteModal title={title} closeHref={closeHref} wide>
      <p className="eyebrow peek-eyebrow">
        {[day, ...eventContext(title, card.type, card.audience), detail.leadName ? `Vede: ${detail.leadName}` : "Vedoucí neurčen"].join(" · ")}
      </p>
      <div className="peek-section">
        {previewLabel && detail.recording.access === "handler" ? (
          <p className="muted">
            {previewLabel} u této akce nahrává záznam a kontroluje zápis. Nahrávka a pracovní přepis se v náhledu nezobrazují.
          </p>
        ) : (
          <RecordingSection eventId={card.id} eventLabel={`${title} · ${day}`} panel={detail.recording} />
        )}
      </div>
    </RouteModal>
  );
}

/**
 * Okno „Zápisy k dokončení“ (správce, všechny) nebo „Moje zápisy k dokončení“ (vedoucí): proběhlé akce,
 * kterým zápis chybí. U každé je odpovědná osoba. Výběr akce otevře její zápis ve stejném okně.
 */
export function AddMinutesPicker({
  title,
  items,
  hrefFor,
  closeHref,
  assignHref,
  othersLabel,
}: {
  title: string;
  items: MissingMinutesItem[];
  hrefFor: (eventId: string) => string;
  closeHref: string;
  /** Jen správce: kam vede přiřazení vedoucího akci, která ho nemá. */
  assignHref?: (item: MissingMinutesItem) => string;
  othersLabel: string;
}) {
  // Adresy a texty se počítají tady na serveru, funkce do klientské komponenty předat nejdou.
  const rows: MissingRow[] = items.map((item) => {
    const status = statusOf(item);
    return {
      eventId: item.eventId,
      title: item.title,
      date: formatDate(toDateKey(new Date(item.startsAt))),
      lead: item.leadName ? `Vede: ${item.leadName}` : "Vedoucí neurčen",
      status,
      detail: status === "progress" || (status === "no-lead" && item.state !== "none") ? STATE_TEXT[item.state] : undefined,
      href: item.canHandle ? hrefFor(item.eventId) : `/vzdelavani/akce/${encodeURIComponent(item.eventId)}?odkud=zapisy`,
      action: item.canHandle ? STATE_ACTION[item.state] : "Otevřít akci",
      primary: item.mine,
      assignHref: !item.leadName && assignHref ? assignHref(item) : undefined,
      mine: item.mine,
    };
  });
  return (
    <RouteModal title={title} closeHref={closeHref} wide>
      {items.length === 0 ? (
        <div className="empty-state">
          <p className="item-title">Všechny proběhlé akce už zápis mají.</p>
          <p className="item-meta">Další se tu objeví po skončení příští akce.</p>
        </div>
      ) : (
        <>
          <MissingMinutesList rows={rows} othersLabel={othersLabel} />
        </>
      )}
    </RouteModal>
  );
}
