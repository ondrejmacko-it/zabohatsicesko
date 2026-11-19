import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { discardChangesAction } from "@/features/vzdelavani/actions";
import { Icon } from "@/components/Icon";
import { Todo, missingText } from "@/components/Todo";
import { RecordingSection } from "@/features/vzdelavani/components/RecordingSection";
import { SyncPanelView } from "@/features/vzdelavani/components/SyncPanelView";
import { badgeClass, detailBadges, statusAdvice } from "@/features/vzdelavani/status";
import { GROUP_LABELS, eventContext, eventTitle } from "@/lib/labels";
import { safeDecode } from "@/lib/params";
import { formatDate, formatEventWhen, monthOf, toDateKey } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { isOrganizer } from "@/server/policy";
import { getEventDetail } from "@/server/services/detail";
import { resolvePreview } from "@/server/services/preview";
import { minutesSectionLabel } from "@/lib/minutes";

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
  const title = eventTitle(card.label, card.topicTitle);
  const advice = statusAdvice(card);
  // Úpravy akce jsou jen v okně akce v Plánu. Tahle stránka nese nahrávku, zápis a stav v Kalendáři.
  const editable = organizer && detail.form && card.planStatus !== "cancelled" && card.type !== "holiday";
  // Zrušenou akci už nikdo nedoplňuje: chybějící údaj je jen „zatím neurčeno“, ne výzva.
  const fillable = organizer && card.planStatus !== "cancelled";
  // Nástroje vedoucího (nahrání, úprava zápisu) by v náhledu běžely pod správcem, proto se nenabízejí.
  const handlerPreview = Boolean(preview) && detail.recording.access === "handler";
  const handler = detail.recording.access === "handler" && !preview;
  const planHref = `/vzdelavani/harmonogram?mesic=${monthOf(dayKey)}`;
  const back = preview
    ? { href: `${planHref}&jako=${encodeURIComponent(query.jako!)}`, label: "Zpět na plán (v náhledu)" }
    : (ORIGINS[query.odkud ?? ""] ?? { href: planHref, label: "Zpět na plán" });

  return (
    <>
      <AutoRefresh active={detail.sync?.status === "pending"} />
      <p className="small back-link">
        <Link href={back.href}>← {back.label}</Link>
      </p>

      {preview && (
        <p className="notice" role="status">
          Pohled: <strong>{preview.label}</strong> · jen ke čtení.{" "}
          <Link href={`/vzdelavani/akce/${encodeURIComponent(card.id)}`}>Otevřít v pohledu správce</Link>
        </p>
      )}

      <div className="page-head detail-head">
        <div>
          {/* Typ nad nadpisem jen tehdy, když ho název akce neopakuje. Skupinu ukazuje „Pro koho“. */}
          {eventContext(title, card.type).map((part) => (
            <p key={part} className="eyebrow">
              {part}
            </p>
          ))}
          <h2 className="detail-title">{title}</h2>
          <div className="row detail-badges">
            {detailBadges(card).map((badge) => (
              <span key={badge.label} className={badgeClass(badge.tone)}>
                {badge.label}
              </span>
            ))}
          </div>
          {organizer && advice && <p className="small muted status-advice">{advice}</p>}
        </div>
        <div className="row">
          {handler && card.past && (
            <a className="btn btn-primary" href="#nahravka">
              {detail.recording.access === "handler" ? minutesSectionLabel(detail.recording) : "Zápis"}
            </a>
          )}
          {!organizer && detail.recording.access === "reader" && detail.recording.minutes && (
            <a className="btn btn-primary" href="#zapis">
              Zobrazit zápis
            </a>
          )}
          {/* U proběhlé akce, kterou správce sám vede, je hlavní krok nahrávka. Úprava zůstává vedle jako vedlejší. */}
          {editable && (
            <Link className={handler && card.past ? "btn" : "btn btn-primary"} href={`${planHref}&akce=${encodeURIComponent(card.id)}`}>
              Upravit akci
            </Link>
          )}
        </div>
      </div>

      {/* Zrušení a jeho důvod patří nahoru: je to to hlavní, co kolega o akci potřebuje vědět. */}
      {card.planStatus === "cancelled" && (
        <p className="notice notice-danger cancel-notice">
          <strong>Akce je zrušená.</strong> {detail.cancelReason ? `Důvod: ${detail.cancelReason}` : "Důvod nebyl uveden."}
        </p>
      )}

      {organizer && card.unpublishedChanges && (
        <div className="notice spread">
          <p>Kolegové a Kalendář zatím vidí zveřejněnou verzi.</p>
          <ActionForm action={discardChangesAction} fields={{ id: card.id, revision: String(detail.revision) }} label="Zahodit návrh změny" pendingLabel="Zahazuji…" small />
        </div>
      )}

      <section className="section facts-section" aria-label="Údaje o akci">
        {/* Kdy, kdo a pro koho: to hlavní, co kolega z akce potřebuje, je nahoře a výrazně. Typ nese nadpis. */}
        <dl className="key-facts">
          <div>
            <dt>Kdy</dt>
            <dd>
              <Icon name="calendar" /> {formatEventWhen(start, new Date(card.endsAt), card.allDay)}
            </dd>
          </div>
          {card.type !== "holiday" && (
            <div>
              <dt>Vede</dt>
              <dd>{detail.leadName ?? <Todo>{missingText(fillable, "vedoucího")}</Todo>}</dd>
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
                <Todo>{missingText(fillable, "téma")}</Todo>
              </dd>
            </>
          )}
          {detail.reviewerName && (
            <>
              <dt>Kdo zkontroluje zápis</dt>
              <dd>{detail.reviewerName}</dd>
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
