import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { discardChangesAction } from "@/features/vzdelavani/actions";
import { Icon } from "@/components/Icon";
import { Todo, missingText } from "@/components/Todo";
import { EventDialog } from "@/features/vzdelavani/components/EventDialog";
import { EventMenu } from "@/features/vzdelavani/components/EventMenu";
import { RecordingSection } from "@/features/vzdelavani/components/RecordingSection";
import { SyncPanelView } from "@/features/vzdelavani/components/SyncPanelView";
import { badgeClass, primaryStatus, statusAdvice } from "@/features/vzdelavani/status";
import { EXTRAORDINARY_TYPES, GROUP_LABELS, PLAN_STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { safeDecode } from "@/lib/params";
import { formatDate, formatEventTime, monthOf, toDateKey } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { isOrganizer } from "@/server/policy";
import { loadInvitePreview } from "@/server/services/calendar-status";
import { getEventDetail } from "@/server/services/detail";
import { listPeople, loadTemplate } from "@/server/services/events";
import { resolvePreview } from "@/server/services/preview";
import { listTopics } from "@/server/services/topics";

export const metadata: Metadata = { title: "Detail akce" };

/** Odkud uživatel přišel. Zpět ho vracíme tam, ne vždy na harmonogram. Jiná hodnota se ignoruje. */
const ORIGINS: Record<string, { href: string; label: string }> = {
  zapisy: { href: "/vzdelavani/zapisy", label: "Zpět na zápisy" },
  prehled: { href: "/vzdelavani/harmonogram", label: "Zpět na Plán" },
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ odkud?: string; jako?: string }> };

export default async function EventDetailPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  // Náhled „Zobrazit jako“ z harmonogramu: detail se počítá pro vybranou skupinu nebo kolegu a je jen ke čtení.
  const preview = await resolvePreview(user, query.jako);
  // Neviditelná i neexistující akce vrací stejnou odpověď, aby ID neprozradilo, že akce existuje.
  const eventId = safeDecode(id);
  const detail = eventId ? await getEventDetail(preview?.viewer ?? user, eventId) : null;
  if (!detail) notFound();

  const { card } = detail;
  const organizer = isOrganizer(user) && !preview;
  const start = new Date(card.startsAt);
  const dayKey = toDateKey(start);
  const title = card.topicTitle ? `${card.label}: ${card.topicTitle}` : card.label;
  const status = primaryStatus(card);
  const [people, topics] = organizer ? await Promise.all([listPeople(user), listTopics(user)]) : [[], []];
  const planDays = organizer ? (await loadTemplate()).filter((slot) => slot.active).map((slot) => slot.isoWeekday) : [];
  const editable = organizer && detail.form && card.planStatus !== "cancelled";
  const replaceable = editable && detail.fromTemplate && !EXTRAORDINARY_TYPES.has(card.type) && !card.past;
  const dialogProps = editable
    ? { mode: "edit" as const, id: card.id, revision: detail.revision, initial: detail.form!, published: detail.publishedForm, people, topics, invite: await loadInvitePreview(user), planDays }
    : null;
  // Nástroje vedoucího (nahrání, úprava zápisu) by v náhledu běžely pod správcem, proto se nenabízejí.
  const handlerPreview = Boolean(preview) && detail.recording.access === "handler";
  const handler = detail.recording.access === "handler" && !preview;
  const planHref = `/vzdelavani/harmonogram?mesic=${monthOf(dayKey)}`;
  const back = preview
    ? { href: `${planHref}&jako=${encodeURIComponent(query.jako!)}`, label: "Zpět na harmonogram v náhledu" }
    : (ORIGINS[query.odkud ?? ""] ?? { href: planHref, label: "Zpět na harmonogram" });

  return (
    <>
      <AutoRefresh active={detail.sync?.status === "pending"} />
      <p className="small back-link">
        <Link href={back.href}>← {back.label}</Link>
      </p>

      {preview && (
        <p className="notice" role="status">
          Díváte se jako <strong>{preview.label}</strong>. Akci vidíte tak, jak ji vidí tento pohled, bez nástrojů správce.{" "}
          <Link href={`/vzdelavani/akce/${encodeURIComponent(card.id)}`}>Otevřít v pohledu správce</Link>
        </p>
      )}

      <div className="page-head detail-head">
        <div>
          <p className="eyebrow">
            {TYPE_LABELS[card.type]} · {GROUP_LABELS[card.audience]}
          </p>
          <h2 className="detail-title">{title}</h2>
          <div className="row detail-badges">
            {(!status || !status.label.startsWith(PLAN_STATUS_LABELS[card.planStatus])) && (
              <span className={card.planStatus === "published" ? "badge badge-ok" : card.planStatus === "cancelled" ? "badge badge-danger" : "badge badge-outline"}>
                {PLAN_STATUS_LABELS[card.planStatus]}
              </span>
            )}
            {status && status.label !== PLAN_STATUS_LABELS[card.planStatus] && <span className={badgeClass(status.tone)}>{status.label}</span>}
            {card.past && card.planStatus === "published" && <span className="badge">Proběhlo</span>}
          </div>
          {organizer && statusAdvice(card) && <p className="small muted status-advice">{statusAdvice(card)}</p>}
        </div>
        <div className="row">
          {handler && card.past && (
            <a className="btn btn-primary" href="#nahravka">
              Nahrávka a zápis
            </a>
          )}
          {!organizer && detail.recording.access === "reader" && detail.recording.minutes && (
            <a className="btn btn-primary" href="#zapis">
              Zobrazit zápis
            </a>
          )}
          {organizer && (
            <EventMenu id={card.id} revision={detail.revision} canCancel={detail.canCancel} canDelete={detail.canDelete}>
              {replaceable && <EventDialog {...dialogProps!} replace />}
            </EventMenu>
          )}
          {editable && <EventDialog {...dialogProps!} primary />}
        </div>
      </div>

      {organizer && card.unpublishedChanges && (
        <div className="notice spread">
          <p>Máte uložený návrh změny. Kolegové a Kalendář zatím vidí zveřejněnou verzi. Návrh zveřejněte přes Upravit, nebo ho zahoďte.</p>
          <ActionForm action={discardChangesAction} fields={{ id: card.id, revision: String(detail.revision) }} label="Zahodit návrh změny" pendingLabel="Zahazuji…" small />
        </div>
      )}

      <section className="section facts-section" aria-label="Údaje o akci">
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
              <dd>{detail.leadName ?? <Todo>{missingText(organizer, "vedoucího")}</Todo>}</dd>
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
              <dd>
                <Todo>{missingText(organizer, "téma")}</Todo>
              </dd>
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
      {handlerPreview ? (
        <section className="section" aria-labelledby="nahravka-nahled">
          <h2 id="nahravka-nahled">Nahrávka a zápis</h2>
          <p className="muted">
            {preview!.label} u této akce nahrává záznam a kontroluje zápis. Nahrávka a pracovní přepis se v náhledu nezobrazují.
          </p>
        </section>
      ) : (
        <RecordingSection eventId={card.id} eventLabel={`${title} · ${formatDate(dayKey)}`} panel={detail.recording} />
      )}
    </>
  );
}
