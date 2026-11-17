import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { RouteModal, UnavailableModal } from "@/components/RouteModal";
import { Todo, missingText } from "@/components/Todo";
import { GROUP_LABELS, PLAN_STATUS_LABELS } from "@/lib/labels";
import { formatEventWhen } from "@/lib/time";
import type { Viewer } from "@/server/policy";
import { isOrganizer } from "@/server/policy";
import { getEventDetail } from "@/server/services/detail";
import { listPeople, loadTemplate } from "@/server/services/events";
import type { PlanPreview } from "@/server/services/preview";
import { listTopics } from "@/server/services/topics";
import { loadInviteRecipients } from "@/server/services/calendar-status";
import { discardChangesAction } from "../actions";
import { cardTone, primaryStatus, statusAdvice } from "../status";
import { EventWindow } from "./EventDialog";
import { EventMenu } from "./EventMenu";

type Props = { user: Viewer; eventId: string; preview: PlanPreview | null; previewKey?: string; closeHref: string };

/**
 * Okno akce nad Plánem nebo Úvodem. Správce v něm akci rovnou upravuje a ukládá (jediné místo úprav),
 * ostatní vidí údaje a odkaz na zápis. Nahrávka a stav v Kalendáři zůstávají na celé stránce akce.
 * Neviditelná nebo neexistující akce ukáže neutrální „Akce není dostupná“.
 */
export async function EventPeek({ user, eventId, preview, previewKey, closeHref }: Props) {
  const detail = await getEventDetail(preview?.viewer ?? user, eventId);
  if (!detail) return <UnavailableModal title="Akce není dostupná" closeHref={closeHref} backLabel="Zpět na plán" />;
  const { card } = detail;
  const holiday = card.type === "holiday";
  const managing = isOrganizer(user) && !preview;
  const editable = managing && !holiday && detail.form && card.planStatus !== "cancelled";
  // Zrušenou akci už nikdo nedoplňuje: chybějící údaj je jen „zatím neurčeno“, ne výzva.
  const fillable = managing && card.planStatus !== "cancelled";
  const status = primaryStatus(card);
  // Návrh: pás už říká, že ho kolegové nevidí, a chybějící údaje jsou vidět přímo v prázdných polích.
  const advice = managing && card.planStatus !== "draft" ? statusAdvice(card) : null;
  const fullHref = `/vzdelavani/akce/${encodeURIComponent(card.id)}${previewKey ? `?jako=${encodeURIComponent(previewKey)}` : ""}`;
  const minutesReady = detail.recording.access === "reader" && Boolean(detail.recording.minutes);
  const handlesRecording = detail.recording.access === "handler" && !preview && card.past;

  const statusBand = (
    <div className={`status-band status-${cardTone(card)}`} role="status">
      <strong>
        {card.planStatus === "draft" ? "Návrh · kolegové ho zatím nevidí" : (status?.label ?? PLAN_STATUS_LABELS[card.planStatus])}
        {card.past && card.planStatus === "published" ? " · proběhlo" : ""}
      </strong>
      {advice && <span>{advice}</span>}
      {preview && <span>Pohled: {preview.label} · jen ke čtení.</span>}
      {card.planStatus === "cancelled" && detail.cancelReason && <span>Důvod: {detail.cancelReason}</span>}
    </div>
  );

  if (editable) {
    const [people, topics, template, invite] = await Promise.all([
      listPeople(user),
      listTopics(user),
      loadTemplate(),
      // U proběhlé akce už příjemci pozvánky nic neřeší.
      card.past ? null : loadInviteRecipients(user).catch(() => null),
    ]);
    const intro = (
      <>
        {statusBand}
        {card.unpublishedChanges && (
          <div className="notice spread">
            <p className="small">Kolegové a Kalendář zatím vidí zveřejněnou verzi.</p>
            <ActionForm action={discardChangesAction} fields={{ id: card.id, revision: String(detail.revision) }} label="Zahodit změny" pendingLabel="Zahazuji…" small />
          </div>
        )}
      </>
    );
    // Funkční Kalendář se v okně neukazuje. Oprava je odkaz jen při chybě, technické informace jsou v nabídce.
    const links = card.past
      ? [{ href: `${fullHref}#nahravka`, label: "Nahrávka a zápis" }]
      : card.syncStatus === "attention"
        ? [{ href: `${fullHref}#kalendar`, label: "Opravit v Kalendáři" }]
        : [{ href: fullHref, label: "Technické informace" }];
    return (
      <EventWindow
        title={card.label}
        closeHref={closeHref}
        intro={intro}
        menu={<EventMenu id={card.id} revision={detail.revision} canCancel={detail.canCancel} canDelete={detail.canDelete} links={links} />}
        id={card.id}
        revision={detail.revision}
        initial={detail.form!}
        published={detail.publishedForm}
        people={people}
        topics={topics}
        invite={invite}
        planDays={template.filter((slot) => slot.active).map((slot) => slot.isoWeekday)}
        termLocked={card.past}
      />
    );
  }

  const links = [
    ...(minutesReady ? [{ href: `/vzdelavani/zapisy?zapis=${encodeURIComponent(card.id)}`, label: "Zobrazit zápis" }] : []),
    ...(handlesRecording ? [{ href: `${fullHref}#nahravka`, label: "Nahrávka a zápis" }] : []),
    // Zrušení do Kalendáře nedošlo: správce dostane opravu. Jinak se technický stav v okně neukazuje.
    ...(managing && !holiday && card.syncStatus === "attention" ? [{ href: `${fullHref}#kalendar`, label: "Opravit v Kalendáři" }] : []),
  ];
  // Technické informace jsou pro správce jen tichý odkaz, nikdy hlavní tlačítko okna.
  const technical = managing && !holiday && links.length === 0;

  return (
    <RouteModal title={card.label} closeHref={closeHref}>
      {!holiday && statusBand}
      <dl className="fact-list">
        <div>
          <dt>Kdy</dt>
          <dd>
            <Icon name="calendar" /> {formatEventWhen(new Date(card.startsAt), new Date(card.endsAt), card.allDay)}
          </dd>
        </div>
        {!holiday && (
          <>
            <div>
              <dt>Téma</dt>
              <dd>{card.topicTitle ?? <Todo>{missingText(fillable, "téma")}</Todo>}</dd>
            </div>
            <div>
              <dt>Vede</dt>
              <dd>{detail.leadName ?? <Todo>{missingText(fillable, "vedoucího")}</Todo>}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Pro koho</dt>
          <dd>{GROUP_LABELS[card.audience]}</dd>
        </div>
      </dl>
      {holiday && <p className="hint">Svátek je v plánu jen pro přehled. Nedá se přesunout ani upravit a do Kalendáře se neposílá.</p>}
      {technical && (
        <p className="small peek-tech">
          <Link href={fullHref}>Technické informace</Link>
        </p>
      )}
      {links.length > 0 && (
        <div className="dialog-actions peek-actions">
          {links.map((link, index) => (
            <Link key={link.href} className={index === 0 ? "btn btn-primary" : "btn"} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </RouteModal>
  );
}
