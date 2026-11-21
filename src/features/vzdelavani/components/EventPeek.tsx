import Link from "next/link";
import { Icon } from "@/components/Icon";
import { RouteModal, UnavailableModal } from "@/components/RouteModal";
import { Todo, missingText } from "@/components/Todo";
import { GROUP_LABELS, PLAN_STATUS_LABELS } from "@/lib/labels";
import { formatEventWhen, toDateKey } from "@/lib/time";
import type { Viewer } from "@/server/policy";
import { isOrganizer } from "@/server/policy";
import { getEventDetail } from "@/server/services/detail";
import { listPeople, loadTemplate } from "@/server/services/events";
import type { PlanPreview } from "@/server/services/preview";
import { listTopics } from "@/server/services/topics";
import { loadInviteRecipients } from "@/server/services/calendar-status";
import { cardTone, primaryStatus, statusAdvice } from "../status";
import { ChangeBanner } from "./ChangeBanner";
import { EventWindow } from "./EventDialog";
import { EventMenu } from "./EventMenu";
import { minutesSectionLabel } from "@/lib/minutes";
import { ownParticipationDetail } from "@/server/services/participation";
import { ParticipationPanel } from "./ParticipationPanel";

type Props = {
  user: Viewer;
  eventId: string;
  preview: PlanPreview | null;
  closeHref: string;
  /** Naplánovat téma u zveřejněné akce: téma je ve formuláři předvyplněné, uloží se až běžným uložením. */
  presetTopicId?: string;
};

/**
 * Okno akce nad Plánem nebo Úvodem. Správce v něm akci rovnou upravuje a ukládá (jediné místo úprav),
 * ostatní vidí údaje a odkaz na zápis. Nahrávka a stav v Kalendáři zůstávají na celé stránce akce.
 * Neviditelná nebo neexistující akce ukáže neutrální „Akce není dostupná“.
 */
export async function EventPeek({ user, eventId, preview, closeHref, presetTopicId }: Props) {
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
  const fullHref = `/vzdelavani/akce/${encodeURIComponent(card.id)}`;
  const minutesReady = detail.recording.access === "reader" && Boolean(detail.recording.minutes);
  const handlesRecording = detail.recording.access === "handler" && !preview && card.past;
  const minutesLabel = detail.recording.access === "handler" ? minutesSectionLabel(detail.recording) : "Zápis";

  const statusBand = (
    // Tón pásu se řídí hlavním stavem: chyba Kalendáře nikdy nesmí vypadat jako úspěch (S-01).
    <div className={`status-band status-${status?.tone === "danger" ? "danger" : status?.tone === "ochre" && card.planStatus === "published" ? "attention" : cardTone(card)}`} role="status">
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
    // Předvyplněné téma jen u budoucí akce bez tématu. Nic se neukládá, dokud správce změnu neuloží či nezveřejní.
    const preset = presetTopicId && !card.past && !detail.form!.topicTitle ? topics.find((t) => t.id === presetTopicId) : undefined;
    const intro = (
      <>
        {statusBand}
        {preset && (
          // Jen tichý řádek (A-12): hodnota je vidět v poli Téma, banner by přebil skutečné problémy akce.
          <p className="small muted" role="status">
            Téma „{preset.name}“ je předvyplněné, zatím nic není uložené ani zveřejněné.
          </p>
        )}
        {card.original && <ChangeBanner eventId={card.id} revision={detail.revision} original={card.original} />}
      </>
    );
    // Funkční Kalendář se v okně neukazuje. Oprava je odkaz jen při chybě, technické informace jsou v nabídce.
    const links = card.past
      ? [{ href: `${fullHref}#nahravka`, label: minutesLabel, icon: "file" as const }]
      : card.syncStatus === "attention"
        ? [{ href: `${fullHref}#kalendar`, label: "Opravit v Kalendáři", icon: "calendar" as const }]
        : [{ href: fullHref, label: "Technické informace", icon: "settings" as const }];
    return (
      <EventWindow
        // Nová revize (zahození, uložení jinde) = čerstvý formulář, jinak by okno drželo staré hodnoty.
        key={detail.revision}
        title={card.label}
        closeHref={closeHref}
        intro={intro}
        menu={
          <EventMenu
            id={card.id}
            revision={detail.revision}
            canCancel={detail.canCancel}
            canDelete={detail.canDelete}
            links={links}
            copyHref={`/vzdelavani/harmonogram?mesic=${toDateKey(new Date(card.startsAt)).slice(0, 7)}&kopie=${encodeURIComponent(card.id)}`}
          />
        }
        id={card.id}
        revision={detail.revision}
        initial={preset ? { ...detail.form!, topicTitle: preset.name } : detail.form!}
        saved={preset ? detail.form! : undefined}
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
    ...(handlesRecording ? [{ href: `${fullHref}#nahravka`, label: minutesLabel }] : []),
    // Zrušení do Kalendáře nedošlo: správce dostane opravu. Jinak se technický stav v okně neukazuje.
    ...(managing && !holiday && card.syncStatus === "attention" ? [{ href: `${fullHref}#kalendar`, label: "Opravit v Kalendáři" }] : []),
  ];
  // Vlastní účast (jen PARTICIPATION=on): stav a akce přímo v okně, potvrzení v samostatném okně.
  const participation = holiday ? null : await ownParticipationDetail(user, preview, card.id);
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
      {holiday && <p className="hint">Jen pro přehled, do Kalendáře se neposílá.</p>}
      {participation && (
        <ParticipationPanel
          eventId={card.id}
          state={participation.state}
          label={participation.label}
          actions={participation.actions}
          excuse={participation.excuse}
          preview={Boolean(preview)}
        />
      )}
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
