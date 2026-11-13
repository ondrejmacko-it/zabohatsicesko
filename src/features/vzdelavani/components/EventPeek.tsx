import Link from "next/link";
import { Icon } from "@/components/Icon";
import { RouteModal } from "@/components/RouteModal";
import { Todo, missingText } from "@/components/Todo";
import { EXTRAORDINARY_TYPES, GROUP_LABELS, PLAN_STATUS_LABELS } from "@/lib/labels";
import { formatDate, formatEventTime, toDateKey } from "@/lib/time";
import type { Viewer } from "@/server/policy";
import { isOrganizer } from "@/server/policy";
import { getEventDetail } from "@/server/services/detail";
import { listPeople, loadTemplate } from "@/server/services/events";
import type { PlanPreview } from "@/server/services/preview";
import { listTopics } from "@/server/services/topics";
import { cardTone, primaryStatus, statusAdvice } from "../status";
import { EventDialog } from "./EventDialog";
import { EventMenu } from "./EventMenu";

type Props = { user: Viewer; eventId: string; preview: PlanPreview | null; previewKey?: string; closeHref: string };

/**
 * Rychlý náhled akce v okně nad Plánem: stav, základní údaje a hlavní krok. Zápis, nahrávka a Kalendář
 * zůstávají na celé stránce detailu. Neviditelná nebo neexistující akce okno neotevře.
 */
export async function EventPeek({ user, eventId, preview, previewKey, closeHref }: Props) {
  const detail = await getEventDetail(preview?.viewer ?? user, eventId);
  if (!detail) return null;
  const { card } = detail;
  const managing = isOrganizer(user) && !preview;
  const editable = managing && detail.form && card.planStatus !== "cancelled";
  const [people, topics, template] = editable ? await Promise.all([listPeople(user), listTopics(user), loadTemplate()]) : [[], [], []];
  const start = new Date(card.startsAt);
  const status = primaryStatus(card);
  const advice = managing ? statusAdvice(card) : null;
  const holiday = card.type === "holiday";
  const fullHref = `/vzdelavani/akce/${encodeURIComponent(card.id)}${previewKey ? `?jako=${encodeURIComponent(previewKey)}` : ""}`;
  const minutesReady = detail.recording.access === "reader" && Boolean(detail.recording.minutes);
  const links = [...(minutesReady ? [{ href: `${fullHref}#zapis`, label: "Zobrazit zápis" }] : []), { href: fullHref, label: "Otevřít celý detail" }];
  const replaceable = editable && detail.fromTemplate && !EXTRAORDINARY_TYPES.has(card.type) && !card.past;
  const dialogProps = editable
    ? {
        mode: "edit" as const,
        id: card.id,
        revision: detail.revision,
        initial: detail.form!,
        published: detail.publishedForm,
        people,
        topics,
        inviteeCount: detail.sync?.inviteeCount ?? 0,
        planDays: template.filter((slot) => slot.active).map((slot) => slot.isoWeekday),
      }
    : null;

  return (
    <RouteModal title={card.label} closeHref={closeHref}>
      <div className={`status-band status-${cardTone(card)}`} role="status">
        <strong>
          {card.planStatus === "draft" ? "Návrh · kolegové ho zatím nevidí" : (status?.label ?? PLAN_STATUS_LABELS[card.planStatus])}
          {card.past && card.planStatus === "published" ? " · proběhlo" : ""}
        </strong>
        {advice && <span>{advice}</span>}
        {preview && <span>Díváte se jako {preview.label}, okno je jen ke čtení.</span>}
        {card.planStatus === "cancelled" && detail.cancelReason && <span>Důvod: {detail.cancelReason}</span>}
      </div>
      <dl className="fact-list">
        <div>
          <dt>Kdy</dt>
          <dd>
            <Icon name="calendar" /> {formatDate(toDateKey(start))} · {formatEventTime(start, new Date(card.endsAt), card.allDay)}
          </dd>
        </div>
        {!holiday && (
          <>
            <div>
              <dt>Téma</dt>
              <dd>{card.topicTitle ?? <Todo>{missingText(managing, "téma")}</Todo>}</dd>
            </div>
            <div>
              <dt>Vede</dt>
              <dd>{detail.leadName ?? <Todo>{missingText(managing, "vedoucího")}</Todo>}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Pro koho</dt>
          <dd>{GROUP_LABELS[card.audience]}</dd>
        </div>
      </dl>
      {holiday && <p className="hint">Svátek je v plánu jen pro přehled, do Kalendáře se neposílá.</p>}
      {!holiday && <p className="hint">Kalendář, nahrávku a zápis najdete v celém detailu{managing ? " (Další možnosti)" : ""}.</p>}
      <div className="dialog-actions peek-actions">
        {managing ? (
          <EventMenu id={card.id} revision={detail.revision} canCancel={detail.canCancel} canDelete={detail.canDelete} links={links}>
            {replaceable && <EventDialog {...dialogProps!} replace />}
          </EventMenu>
        ) : (
          links.map((link, index) => (
            <Link key={link.href} className={index === 0 ? "btn btn-primary" : "btn"} href={link.href}>
              {link.label}
            </Link>
          ))
        )}
        {editable && <EventDialog {...dialogProps!} primary />}
      </div>
    </RouteModal>
  );
}
