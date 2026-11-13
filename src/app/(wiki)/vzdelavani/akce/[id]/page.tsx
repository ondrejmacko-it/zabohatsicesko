import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icon";
import { EventDialog } from "@/features/vzdelavani/components/EventDialog";
import { EventMenu } from "@/features/vzdelavani/components/EventMenu";
import { RecordingSection } from "@/features/vzdelavani/components/RecordingSection";
import { SyncPanelView } from "@/features/vzdelavani/components/SyncPanelView";
import { badgeClass, primaryStatus } from "@/features/vzdelavani/status";
import { GROUP_LABELS, PLAN_STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { safeDecode } from "@/lib/params";
import { formatDate, formatEventTime, monthOf, toDateKey } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { isOrganizer } from "@/server/policy";
import { getEventDetail } from "@/server/services/detail";
import { listPeople } from "@/server/services/events";
import { listTopics } from "@/server/services/topics";

export const metadata: Metadata = { title: "Detail akce" };

/** Odkud uživatel přišel. Zpět ho vracíme tam, ne vždy na harmonogram. Jiná hodnota se ignoruje. */
const ORIGINS: Record<string, { href: string; label: string }> = {
  zapisy: { href: "/vzdelavani/zapisy", label: "Zpět na zápisy" },
  "moje-cesta": { href: "/vzdelavani/moje-cesta", label: "Zpět na Moje cesta" },
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ odkud?: string }> };

export default async function EventDetailPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const { id } = await params;
  // Neviditelná i neexistující akce vrací stejnou odpověď, aby ID neprozradilo, že akce existuje.
  const eventId = safeDecode(id);
  const detail = eventId ? await getEventDetail(user, eventId) : null;
  if (!detail) notFound();

  const { card } = detail;
  const organizer = isOrganizer(user);
  const start = new Date(card.startsAt);
  const dayKey = toDateKey(start);
  const title = card.topicTitle ? `${card.label}: ${card.topicTitle}` : card.label;
  const status = primaryStatus(card);
  const [people, topics] = organizer ? await Promise.all([listPeople(user), listTopics(user)]) : [[], []];
  const handler = detail.recording.access === "handler";
  const back = ORIGINS[(await searchParams).odkud ?? ""] ?? { href: `/vzdelavani/harmonogram?mesic=${monthOf(dayKey)}`, label: "Zpět na harmonogram" };

  return (
    <>
      <AutoRefresh active={detail.sync?.status === "pending"} />
      <p className="small back-link">
        <Link href={back.href}>← {back.label}</Link>
      </p>

      <div className="page-head detail-head">
        <div>
          <p className="eyebrow">
            {TYPE_LABELS[card.type]} · {GROUP_LABELS[card.audience]}
          </p>
          <h2 className="detail-title">{title}</h2>
          <div className="row detail-badges">
            <span className={card.planStatus === "published" ? "badge badge-ok" : card.planStatus === "cancelled" ? "badge badge-danger" : "badge badge-outline"}>
              {PLAN_STATUS_LABELS[card.planStatus]}
            </span>
            {status && status.label !== PLAN_STATUS_LABELS[card.planStatus] && <span className={badgeClass(status.tone)}>{status.label}</span>}
            {card.past && card.planStatus === "published" && <span className="badge">Proběhlo</span>}
          </div>
        </div>
        <div className="row">
          {organizer && detail.form && card.planStatus !== "cancelled" && (
            <EventDialog
              mode="edit"
              id={card.id}
              revision={detail.revision}
              initial={detail.form}
              published={detail.publishedForm}
              people={people}
              topics={topics}
              inviteeCount={detail.sync?.inviteeCount ?? 0}
            />
          )}
          {handler && card.past && (
            <a className="btn btn-primary" href="#nahravka">
              Nahrávka a zápis
            </a>
          )}
          {!organizer && !handler && detail.recording.access === "reader" && detail.recording.minutes && (
            <a className="btn btn-primary" href="#zapis">
              Zobrazit zápis
            </a>
          )}
          {organizer && <EventMenu id={card.id} revision={detail.revision} canCancel={detail.canCancel} canDelete={detail.canDelete} />}
        </div>
      </div>

      {card.unpublishedChanges && (
        <p className="notice">Máte uložené, ale nezveřejněné změny. Kolegové a Kalendář zatím vidí zveřejněnou verzi.</p>
      )}

      <section className="section" aria-label="Údaje o akci">
        {/* Kdy a kdo: to hlavní, co kolega z akce potřebuje, je nahoře a výrazně. Typ a publikum nese nadpis. */}
        <dl className="key-facts">
          <div>
            <dt>Kdy</dt>
            <dd>
              <Icon name="calendar" /> {formatDate(dayKey)} · {formatEventTime(start, new Date(card.endsAt), card.allDay)}
            </dd>
          </div>
          {card.type !== "holiday" && (
            <div>
              <dt>Vede</dt>
              <dd>{detail.leadName ?? <span className="muted">zatím nedoplněno</span>}</dd>
            </div>
          )}
          <div>
            <dt>Pro koho</dt>
            <dd>{GROUP_LABELS[card.audience]}</dd>
          </div>
        </dl>
        <dl className="dl">
          {card.type !== "holiday" && !card.topicTitle && (
            <>
              <dt>Téma</dt>
              <dd className="muted">zatím nedoplněno</dd>
            </>
          )}
          {detail.reviewerName && (
            <>
              <dt>Kontrolor zápisu</dt>
              <dd>{detail.reviewerName}</dd>
            </>
          )}
          {detail.cancelReason && card.planStatus === "cancelled" && (
            <>
              <dt>Důvod zrušení</dt>
              <dd>{detail.cancelReason}</dd>
            </>
          )}
        </dl>
        {card.type === "holiday" && <p className="small muted section-actions">Svátek je v plánu jen pro přehled, do Kalendáře se neposílá.</p>}
      </section>

      {detail.sync && <SyncPanelView eventId={card.id} sync={detail.sync} />}
      <RecordingSection eventId={card.id} eventLabel={`${title} · ${formatDate(dayKey)}`} panel={detail.recording} />
    </>
  );
}
