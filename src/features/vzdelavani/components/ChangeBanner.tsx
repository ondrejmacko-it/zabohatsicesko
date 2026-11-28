import { ActionForm } from "@/components/ActionForm";
import { LockedLink } from "@/components/PreviewLock";
import { GROUP_LABELS, changeSummary, eventTitle } from "@/lib/labels";
import { formatEventWhen } from "@/lib/time";
import type { EventOriginal } from "@/server/services/events";
import { discardChangesAction } from "../actions";

/**
 * Návrh změny zveřejněné akce (jen správce): okrový panel nad údaji akce, co se mění, rozbalitelný originál,
 * který dál vidí kolegové i Kalendář, a dvě rozhodnutí. Zveřejnění jde přes formulář akce s potvrzením dopadu,
 * proto je tu tlačítko jen tam, kde formulář není (`publishHref`).
 */
export function ChangeBanner({
  eventId,
  revision,
  original,
  publishHref,
}: {
  eventId: string;
  revision: number;
  original: EventOriginal;
  publishHref?: string;
}) {
  const summary = changeSummary(original.changes);
  const changes = summary ? `${summary}.` : "Obsah se liší od zveřejněné verze.";
  return (
    <section className="change-banner" aria-label="Návrh změny zveřejněné akce">
      <div className="change-banner-head">
        <p className="change-banner-title">
          <strong>Návrh změny zveřejněné akce.</strong> {changes} Kolegové a Kalendář zatím vidí zveřejněnou verzi.
        </p>
        <div className="change-banner-actions">
          {publishHref && (
            <LockedLink className="btn btn-primary btn-small" href={publishHref} scroll={false}>
              Zveřejnit změny…
            </LockedLink>
          )}
          <ActionForm
            action={discardChangesAction}
            fields={{ id: eventId, revision: String(revision) }}
            label="Zrušit návrh"
            pendingLabel="Ruším…"
            small
            confirm={{
              title: "Zrušit návrh změny?",
              text: "Uložené, ale nezveřejněné úpravy akce se smažou. Kolegové i Kalendář dál uvidí zveřejněnou verzi.",
              confirmLabel: "Zrušit návrh",
            }}
          />
        </div>
      </div>
      <details className="change-original">
        <summary>Zveřejněná verze</summary>
        <dl className="change-original-facts">
          <div>
            <dt>Akce</dt>
            <dd>{eventTitle(original.label, original.topicTitle)}</dd>
          </div>
          <div>
            <dt>Kdy</dt>
            <dd>{formatEventWhen(new Date(original.startsAt), new Date(original.endsAt), original.allDay)}</dd>
          </div>
          <div>
            <dt>Vede</dt>
            <dd>{original.leadName ?? "—"}</dd>
          </div>
          <div>
            <dt>Pro koho</dt>
            <dd>{GROUP_LABELS[original.audience]}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
