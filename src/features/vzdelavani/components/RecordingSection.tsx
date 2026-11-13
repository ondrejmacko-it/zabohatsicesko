import { ActionForm } from "@/components/ActionForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ERROR_LABELS, RECORDING_STATE_LABELS, TEMPLATE_LABELS } from "@/lib/labels";
import type { MinutesContent, RecordingState } from "@/lib/types";
import type { RecordingPanel } from "@/server/services/recordings";
import { retryTranscriptionAction } from "../actions";
import { MinutesEditor } from "./MinutesEditor";
import { UploadForm } from "./UploadForm";

const STATE_BADGE: Record<RecordingState, string> = {
  awaiting: "badge badge-outline",
  processing: "badge badge-ochre",
  review: "badge badge-ochre",
  available: "badge badge-ok",
  failed: "badge badge-danger",
};

function MinutesView({ content }: { content: MinutesContent }) {
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

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} MB`;
const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/** Nahrávka a zápis u proběhlé akce. Obsah se liší podle oprávnění, rozhoduje server. */
export function RecordingSection({ eventId, eventLabel, panel }: { eventId: string; eventLabel: string; panel: RecordingPanel }) {
  if (panel.access === "none") return null;

  if (panel.access === "reader") {
    return (
      <section className="section" id="zapis" aria-labelledby="zapis-title">
        <h2 id="zapis-title">Zápis</h2>
        {panel.minutes ? <MinutesView content={panel.minutes} /> : <p className="muted">
            {panel.state === "processing"
              ? "Zápis se připravuje. Objeví se tady, až ho vedoucí zkontroluje a zveřejní."
              : "Zápis zatím není k dispozici, vedoucí ještě nenahrál záznam."}
          </p>}
      </section>
    );
  }

  const { state, recording, minutes, errorCode } = panel;
  return (
    <section className="section" id="nahravka" aria-labelledby="nahravka-title">
      <AutoRefresh active={state === "processing"} />
      <div className="spread">
        <h2 id="nahravka-title">Nahrávka a zápis</h2>
        <span className={STATE_BADGE[state]} role="status">
          {RECORDING_STATE_LABELS[state]}
        </span>
      </div>
      <p className="small muted">
        Nahrávku a pracovní přepis vidí jen vedoucí akce a pověřený kontrolor. Kolegové uvidí až zveřejněný zápis.
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

      {state === "failed" && (
        <div className="stack">
          <p className="notice notice-danger">{ERROR_LABELS[errorCode ?? ""] ?? "Zpracování se nepovedlo."}</p>
          <ActionForm action={retryTranscriptionAction} fields={{ id: eventId }} label="Zkusit zpracování znovu" variant="primary" />
        </div>
      )}

      {minutes && (
        <div className="stack">
          {minutes.templateMismatch && (
            <p className="notice">
              Podle obsahu nahrávky to vypadá na typ „{TEMPLATE_LABELS[minutes.detectedTemplate]}“, což nesedí s typem
              akce. Zkontrolujte, že je nahrávka u správného termínu. Nic se automaticky nepřesouvá.
            </p>
          )}
          {minutes.status === "draft" ? (
            <>
              <p className="notice">
                Návrh zápisu vytvořený z přepisu. Doporučená šablona: {TEMPLATE_LABELS[minutes.detectedTemplate]}.
                Zkontrolujte jej, opravte a zveřejněte.
              </p>
              <MinutesEditor eventId={eventId} minutesId={minutes.id} version={minutes.version} content={minutes.content} />
            </>
          ) : (
            <>
              <p className="notice notice-ok">Zápis je zveřejněný pro publikum akce.</p>
              <MinutesView content={minutes.content} />
            </>
          )}
          <details>
            <summary>Pracovní přepis</summary>
            <p className="transcript">{minutes.transcript}</p>
          </details>
        </div>
      )}

      {state !== "processing" && <UploadForm eventId={eventId} eventLabel={eventLabel} replacing={recording !== null} />}
    </section>
  );
}
