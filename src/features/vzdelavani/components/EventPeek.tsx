import Link from "next/link";
import { Icon } from "@/components/Icon";
import { RouteModal, UnavailableModal } from "@/components/RouteModal";
import { Todo, missingText } from "@/components/Todo";
import { GROUP_LABELS } from "@/lib/labels";
import { formatEventWhen, toDateKey } from "@/lib/time";
import type { Viewer } from "@/server/policy";
import { isOrganizer } from "@/server/policy";
import { getEventDetail } from "@/server/services/detail";
import { listPeople, loadTemplate } from "@/server/services/events";
import type { PlanPreview } from "@/server/services/preview";
import { listTopics } from "@/server/services/topics";
import { loadInviteRecipients } from "@/server/services/calendar-status";
import { cardTone, detailBadges, primaryStatus, statusAdvice } from "../status";
import { StatusBadge } from "./StatusBadge";
import { ChangeBanner } from "./ChangeBanner";
import { EventWindow } from "./EventDialog";
import { EventMenu } from "./EventMenu";
import { minutesSectionLabel } from "@/lib/minutes";
import { ownParticipationDetail } from "@/server/services/participation";
import { ParticipationPanel } from "./ParticipationPanel";
import { managedExcusesAt } from "@/server/services/excuse-managers";
import { ManagedExcuses } from "./ManagedExcuses";

type Props = {
  user: Viewer;
  eventId: string;
  preview: PlanPreview | null;
  closeHref: string;
  /** Naplánovat téma u zveřejněné akce: téma je ve formuláři předvyplněné, uloží se až běžným uložením. */
  presetTopicId?: string;
  /** Rovnou editace (volba Upravit z nabídky, deeplink `upravit=1`). Jinak i správce dostane nejdřív čtecí detail. */
  edit?: boolean;
  /** Adresa editace se zachovaným měsícem a filtry. Bez ní vede „Upravit akci“ do Plánu na měsíc akce. */
  editHref?: string;
};

/**
 * Okno akce nad Plánem nebo Úvodem. Všichni nejdřív vidí kompaktní čtecí detail; správce z něj přejde
 * do úprav („Upravit akci“, jediné místo úprav). Volba Upravit z nabídky otevře rovnou formulář. Nahrávka a stav v Kalendáři zůstávají na celé stránce akce.
 * Neviditelná nebo neexistující akce ukáže neutrální „Akce není dostupná“.
 */
export async function EventPeek({ user, eventId, preview, closeHref, presetTopicId, edit = false, editHref }: Props) {
  const detail = await getEventDetail(preview?.viewer ?? user, eventId);
  if (!detail) return <UnavailableModal title="Akce není dostupná" closeHref={closeHref} backLabel="Zpět na plán" />;
  const { card } = detail;
  const holiday = card.type === "holiday";
  const managing = isOrganizer(user) && !preview;
  // Náhled očima kolegy-správce: stav, rady a chybějící údaje jako u něj, ale bez formuláře a oprav.
  const planView = isOrganizer(preview?.viewer ?? user);
  const editable = managing && !holiday && detail.form && card.planStatus !== "cancelled";
  // Zrušenou akci už nikdo nedoplňuje: chybějící údaj je jen „zatím neurčeno“, ne výzva.
  const fillable = planView && card.planStatus !== "cancelled";
  const status = primaryStatus(card);
  // Návrh: pás už říká, že ho kolegové nevidí, a chybějící údaje jsou vidět přímo v prázdných polích.
  const advice = planView && card.planStatus !== "draft" ? statusAdvice(card) : null;
  const fullHref = `/vzdelavani/akce/${encodeURIComponent(card.id)}`;
  const minutesReady = detail.recording.access === "reader" && Boolean(detail.recording.minutes);
  const handlesRecording = detail.recording.access === "handler" && !preview && card.past;
  const minutesLabel = detail.recording.access === "handler" ? minutesSectionLabel(detail.recording) : "Zápis";

  const statusBand = (
    // Tón pásu se řídí hlavním stavem: chyba Kalendáře nikdy nesmí vypadat jako úspěch (S-01).
    <div className={`status-band status-${status?.tone === "danger" ? "danger" : status?.tone === "ochre" && card.planStatus === "published" ? "attention" : cardTone(card)}`} role="status">
      {/* Stejné štítky jako v hlavičce stránky detailu: životní stav akce a nejvýš jeden doplněk. Osobní účast
          má vlastní štítek jen v kartě „Tvoje účast“. */}
      <div className="row">
        {detailBadges(card).map((badge) => (
          <StatusBadge key={badge.label} tone={badge.tone} label={badge.label} />
        ))}
      </div>
      {card.planStatus === "draft" && <span>Kolegové ho zatím nevidí.</span>}
      {advice && <span>{advice}</span>}
      {card.planStatus === "cancelled" && detail.cancelReason && <span>Důvod: {detail.cancelReason}</span>}
    </div>
  );

  // Vlastní účast (jen PARTICIPATION=on): stav a akce přímo v okně, potvrzení v samostatném okně. Správce ji vidí
  // i nad formulářem úprav, aby se ke své účasti dostal bez technických informací.
  const participation = holiday ? null : await ownParticipationDetail(user, preview, card.id);
  const participationPanel = participation && (
    <ParticipationPanel
      eventId={card.id}
      state={participation.state}
      label={participation.label}
      actions={participation.actions}
      excuse={participation.excuse}
      calendar={participation.calendar}
      enrollment={participation.enrollment}
      preview={preview ? (preview.personName ? "person" : "group") : undefined}
    />
  );

  // Důvody omluv jen výslovně určenému nadřízenému, nikdy v náhledu (F03/D01).
  const managed = holiday ? [] : await managedExcusesAt(user, card.id, Boolean(preview));
  const managedPanel = <ManagedExcuses excuses={managed} />;

  const monthKey = toDateKey(new Date(card.startsAt)).slice(0, 7);
  const copyHref = `/vzdelavani/harmonogram?mesic=${monthKey}&kopie=${encodeURIComponent(card.id)}`;
  // Diagnostika (stav v Kalendáři, nahrávka) je na celé stránce akce: v okně jen jako položka nabídky ⋯.
  const menuLinks = card.past
    ? [{ href: `${fullHref}#nahravka`, label: minutesLabel, icon: "file" as const }]
    : card.syncStatus === "attention"
      ? [{ href: `${fullHref}#kalendar`, label: "Opravit v Kalendáři", icon: "calendar" as const }]
      : [{ href: fullHref, label: "Otevřít podrobnosti", icon: "file" as const }];
  const eventMenu = (
    <EventMenu id={card.id} revision={detail.revision} canCancel={detail.canCancel} canDelete={detail.canDelete} links={menuLinks} copyHref={copyHref} />
  );

  if (editable && (edit || presetTopicId)) {
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
    // Vlastní účast a správa omluv až po údajích akce (pořadí okna: stav, obsah, účast, správa, další možnosti).
    const afterFields = (participationPanel || managedPanel) && (
      <>
        {participationPanel}
        {managedPanel}
      </>
    );
    return (
      <EventWindow
        // Nová revize (zahození, uložení jinde) = čerstvý formulář, jinak by okno drželo staré hodnoty.
        key={detail.revision}
        title={card.label}
        closeHref={closeHref}
        intro={intro}
        afterFields={afterFields}
        menu={eventMenu}
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
    // Nahrávku a opravu v Kalendáři má správce v nabídce ⋯, hlavní akcí jeho okna je Upravit akci.
    ...(handlesRecording && !editable ? [{ href: `${fullHref}#nahravka`, label: minutesLabel }] : []),
    ...(managing && !editable && !holiday && card.syncStatus === "attention" ? [{ href: `${fullHref}#kalendar`, label: "Opravit v Kalendáři" }] : []),
  ];
  const editLink = editable ? (editHref ?? `/vzdelavani/harmonogram?mesic=${monthKey}&akce=${encodeURIComponent(card.id)}&upravit=1`) : null;

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
      {participationPanel}
      {managedPanel}
      {(links.length > 0 || editLink) && (
        <div className="dialog-actions peek-actions">
          {links.map((link, index) => (
            <Link key={link.href} className={index === 0 && !editLink ? "btn btn-primary" : "btn"} href={link.href}>
              {link.label}
            </Link>
          ))}
          {editLink && (
            <Link className="btn btn-primary" href={editLink} scroll={false}>
              Upravit akci
            </Link>
          )}
          {editLink && eventMenu}
        </div>
      )}
    </RouteModal>
  );
}
