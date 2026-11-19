import { ActionForm } from "@/components/ActionForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Menu } from "@/components/Menu";
import { ERROR_LABELS, MINUTES_SOURCE_LABELS, RECORDING_STATE_LABELS, TEMPLATE_LABELS } from "@/lib/labels";
import { formatDate, toDateKey } from "@/lib/time";
import type { MinutesContent, RecordingState } from "@/lib/types";
import type { HandlerMinutes, RecordingPanel } from "@/server/services/recordings";
import { retryTranscriptionAction, withdrawMinutesAction } from "../actions";
import { MinutesEditor } from "./MinutesEditor";
import { MinutesSourceForm } from "./MinutesSourceForm";

const STATE_BADGE: Record<RecordingState, string> = {
  awaiting: "badge badge-outline",
  processing: "badge badge-ochre",
  review: "badge badge-ochre",
  available: "badge badge-ok",
  failed: "badge badge-danger",
};

export function MinutesView({ content }: { content: MinutesContent }) {
  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <h3>{title}</h3>
        <ul className="prose-list">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="stack minutes">
      <div>
        <h3>Shrnutí</h3>
        <p>{content.summary}</p>
      </div>
      {list("Hlavní body", content.keyPoints)}
      {list("Rozhodnutí", content.decisions)}
      {list("Další kroky", content.nextSteps)}
    </div>
  );
}

function versionLabel(minutes: HandlerMinutes): string {
  const date = (iso: string | null) => (iso ? ` · ${formatDate(toDateKey(new Date(iso)))}` : "");
  if (minutes.status === "published") return `Schváleno: verze ${minutes.version}${date(minutes.approvedAt)}`;
  if (minutes.approvedVersion !== null) {
    return `Verze ${minutes.version} čeká na nové schválení (schválena byla verze ${minutes.approvedVersion})`;
  }
  return `Návrh, verze ${minutes.version}, čeká na schválení vedoucím`;
}

function draftHint(minutes: HandlerMinutes): string {
  if (minutes.source === "recording") {
    return `Návrh z ukázkového přepisu (šablona ${TEMPLATE_LABELS[minutes.detectedTemplate]}). Přepis je zatím jen demonstrace nad ukázkovou nahrávkou, ne přepis skutečné schůzky. Zkontrolujte návrh a uložte.`;
  }
  if (minutes.source === "manual") return "Ruční zápis. Vyplňte šablonu a uložte.";
  return "Návrh vznikl rozdělením textu do šablony zápisu, nic se nedomýšlí. Zkontrolujte ho a uložte.";
}

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} MB`;
const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/** Nahrávka a zápis u proběhlé akce. Obsah se liší podle oprávnění, rozhoduje server. */
export function RecordingSection({ eventId, eventLabel, panel }: { eventId: string; eventLabel: string; panel: RecordingPanel }) {
  if (panel.access === "none") return null;

  if (panel.access === "reader") {
    return (
      <section className="section" id="zapis" aria-labelledby="zapis-title">
        <h2 id="zapis-title">Zápis</h2>
        {/* Čtenáři se nevysvětluje, proč zápis chybí (nahrávka, přepis), to řeší vedoucí. */}
        {panel.minutes ? <MinutesView content={panel.minutes} /> : <p className="muted">Zápis zatím není zveřejněný.</p>}
      </section>
    );
  }

  const { state, recording, minutes, errorCode } = panel;
  const withdraw = (
    <ActionForm
      action={withdrawMinutesAction}
      fields={{ id: eventId }}
      label="Vrátit zápis do návrhu…"
      pendingLabel="Vracím…"
      variant="danger"
      confirm={{
        title: "Vrátit zápis do návrhu",
        text: "Kolegové zápis přestanou vidět a z pozvánky v Kalendáři zmizí odkaz na něj. Zápis zůstane u vás jako návrh, který můžete opravit a zveřejnit znovu.",
        confirmLabel: "Vrátit do návrhu",
      }}
    />
  );
  const published = Boolean(panel.publicMinutes) || minutes?.status === "published";
  const wrongFile = state === "failed" && errorCode === "unsupported_fixture";
  const fromRecording = minutes?.source === "recording";
  return (
    <section className="section" id="nahravka" aria-labelledby="nahravka-title">
      <AutoRefresh active={state === "processing"} />
      <div className="spread">
        <h2 id="nahravka-title">Nahrávka a zápis</h2>
        <span className="row">
          <span className={STATE_BADGE[state]} role="status">
            {RECORDING_STATE_LABELS[state]}
          </span>
          {/* Vrácení do návrhu je méně častý a citlivý krok, proto je v nabídce, ne vedle hlavních akcí. */}
          {published && (
            <Menu label="Další možnosti zápisu" small iconOnly>
              {withdraw}
            </Menu>
          )}
        </span>
      </div>
      <p className="small muted">
        Kolegové uvidí až zápis schválený vedoucím akce.
      </p>

      {recording && (
        <div className="stack recording">
          <p className="small">
            {recording.name} · {formatSize(recording.sizeBytes)} · {formatDuration(recording.durationSec)}
          </p>
          <audio controls preload="none" src={`/api/nahravky/${encodeURIComponent(eventId)}`}>
            Prohlížeč nepodporuje přehrávání zvuku.
          </audio>
        </div>
      )}

      {state === "failed" && !minutes && (
        <div className="stack">
          <p className="notice notice-danger">{ERROR_LABELS[errorCode ?? ""] ?? "Přepis se nepovedl."}</p>
          {/* Špatný soubor nový pokus nespraví, pomůže jen jiná nahrávka nebo jiný zdroj (formulář níže). */}
          {wrongFile ? (
            <p className="small">Vyberte jinou nahrávku nebo jiný zdroj zápisu níže.</p>
          ) : (
            <ActionForm action={retryTranscriptionAction} fields={{ id: eventId }} label="Zkusit přepis znovu" variant="primary" />
          )}
        </div>
      )}

      {minutes && (
        <div className="stack">
          <p className="small minutes-version" data-testid="stav-verze">
            <strong>{versionLabel(minutes)}</strong> · Zdroj: {MINUTES_SOURCE_LABELS[minutes.source]}
          </p>
          {minutes.templateMismatch && (
            <p className="notice">
              Podle obsahu {fromRecording ? "nahrávky" : "textu"} to vypadá na typ „{TEMPLATE_LABELS[minutes.detectedTemplate]}“, což nesedí s typem
              akce. Zkontrolujte, že je zápis u správného termínu. Nic se automaticky nepřesouvá.
            </p>
          )}
          {minutes.status === "draft" ? (
            <>
              {panel.publicMinutes && (
                <p className="notice">Kolegové zatím vidí dříve zveřejněný zápis, dokud vedoucí neschválí tento.</p>
              )}
              <p className="notice">{draftHint(minutes)}</p>
              <MinutesEditor
                eventId={eventId}
                minutesId={minutes.id}
                version={minutes.version}
                content={minutes.content}
                canApprove={panel.canApprove}
                hasLead={panel.hasLead}
              />
            </>
          ) : (
            <>
              <p className="notice notice-ok">Zveřejněno pro publikum akce.</p>
              <MinutesView content={minutes.content} />
              <details className="fold">
                <summary>Upravit zápis</summary>
                <MinutesEditor
                  eventId={eventId}
                  minutesId={minutes.id}
                  version={minutes.version}
                  content={minutes.content}
                  canApprove={panel.canApprove}
                  hasLead={panel.hasLead}
                  published
                />
              </details>
            </>
          )}
          {minutes.transcript && (
            <details>
              <summary>{fromRecording ? "Pracovní přepis (ukázka)" : "Pracovní text zdroje"}</summary>
              <p className="transcript">{minutes.transcript}</p>
            </details>
          )}
        </div>
      )}

      {/* Když už je zápis rozpracovaný, je hlavní krok úprava. Jiný zdroj je sbalený. */}
      {state !== "processing" &&
        (minutes ? (
          <details className="fold">
            <summary>Připravit zápis z jiného zdroje</summary>
            <MinutesSourceForm
              eventId={eventId}
              eventLabel={eventLabel}
              hasRecording={recording !== null}
              replaceId={minutes.id}
              replacingDraft={minutes.status === "draft"}
            />
          </details>
        ) : (
          <MinutesSourceForm eventId={eventId} eventLabel={eventLabel} hasRecording={recording !== null} replaceId={null} replacingDraft={false} />
        ))}
    </section>
  );
}
