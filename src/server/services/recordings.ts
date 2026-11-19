import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { minutesStarted } from "@/lib/minutes";
import type { MinutesContent, MinutesSource, RecordingState } from "@/lib/types";
import { audit, logError, withinRateLimit } from "@/server/audit";
import { config, now } from "@/server/config";
import { getDb, queryRows, type Executor } from "@/server/db/client";
import { calendarLinks, minutes, recordingBlobs, recordings, transcriptionJobs } from "@/server/db/schema";
import type { EventRow } from "@/server/domain/snapshot";
import { minutesDrafter } from "@/server/integrations/minutes-drafter";
import { canApproveMinutes, canHandleRecording, canReadPublishedMinutes, visibleEvent, type Viewer } from "@/server/policy";
import { MAX_UPLOAD_BYTES, displayName, inspectAudio } from "@/server/recordings/audio";
import {
  TranscriptionError,
  detectTemplate,
  expectedTemplate,
  minutesSchema,
  transcriptionProvider,
  validateMinutes,
} from "@/server/recordings/transcription";
import { readPastedText, readTextFile } from "@/server/recordings/text-source";
import { DomainError } from "@/server/services/errors";
import { loadEventRow } from "@/server/services/events";

const JOB_LEASE_SEC = 120;

/** Načte akci a ověří, že uživatel smí pracovat s její nahrávkou. Cizí ID vrací not_found. */
async function requireHandledEvent(db: Executor, viewer: Viewer, eventId: string): Promise<EventRow> {
  const row = await loadEventRow(db, eventId);
  if (!row || !visibleEvent(viewer, row)) throw new DomainError("not_found");
  if (!canHandleRecording(viewer, row)) throw new DomainError("forbidden");
  return row;
}

export async function uploadRecording(viewer: Viewer, eventId: string, file: File): Promise<string> {
  const db = await getDb();
  requirePastPublished(await requireHandledEvent(db, viewer, eventId));
  if (!(await withinRateLimit(db, `upload:${viewer.id}`, 10, 3600))) throw new DomainError("rate_limited");
  if (file.size > MAX_UPLOAD_BYTES) throw new DomainError("file_too_large");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = inspectAudio(bytes, file.name);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const recordingId = randomUUID();
  const jobId = randomUUID();
  const storageKey = randomUUID();

  await db.transaction(async (tx) => {
    // Nahrazení: starý soubor se smaže (minimalizace dat) a jeho úloha už nesmí zapsat výsledek.
    const replaced = await tx
      .update(recordings)
      .set({ supersededAt: new Date() })
      .where(and(eq(recordings.eventId, eventId), isNull(recordings.supersededAt)))
      .returning({ storageKey: recordings.storageKey });
    if (replaced.length) {
      await tx.delete(recordingBlobs).where(inArray(recordingBlobs.storageKey, replaced.map((r) => r.storageKey)));
    }
    await tx.insert(recordingBlobs).values({ storageKey, data: bytes });
    await tx.insert(recordings).values({
      id: recordingId,
      orgId: config.orgId,
      eventId,
      storageKey,
      originalName: displayName(file.name),
      mimeType: info.mimeType,
      sizeBytes: bytes.length,
      sha256,
      durationSec: info.durationSec,
      uploadedBy: viewer.id,
    });
    await tx.insert(transcriptionJobs).values({ id: jobId, orgId: config.orgId, eventId, recordingId, status: "queued", attempts: 0 });
    await audit(tx, viewer.id, replaced.length ? "recording.replace" : "recording.upload", "event", eventId);
  });
  return jobId;
}

/**
 * Zpracuje úlohu přepisu. Opakované doručení je bezpečné: úlohu převezme jen jeden běh (lease),
 * zápis je unikátní k úloze a výsledek se uloží jen k aktuální, nenahrazené nahrávce.
 */
export async function processTranscriptionJob(jobId: string): Promise<void> {
  const db = await getDb();
  const [job] = await db
    .update(transcriptionJobs)
    .set({
      status: "processing",
      attempts: sql`${transcriptionJobs.attempts} + 1`,
      leaseUntil: sql`now() + make_interval(secs => ${JOB_LEASE_SEC})`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transcriptionJobs.id, jobId),
        or(
          eq(transcriptionJobs.status, "queued"),
          and(eq(transcriptionJobs.status, "processing"), lt(transcriptionJobs.leaseUntil, sql`now()`)),
        ),
      ),
    )
    .returning();
  if (!job) return;

  const finish = (status: "done" | "failed", errorCode: string | null = null) =>
    db
      .update(transcriptionJobs)
      .set({ status, errorCode, leaseUntil: null, updatedAt: new Date() })
      .where(eq(transcriptionJobs.id, jobId));

  try {
    const [recording] = await db.select().from(recordings).where(eq(recordings.id, job.recordingId)).limit(1);
    const event = await loadEventRow(db, job.eventId);
    if (!recording || recording.supersededAt || !event?.published) return void (await finish("done"));
    const [blob] = await db.select().from(recordingBlobs).where(eq(recordingBlobs.storageKey, recording.storageKey)).limit(1);
    if (!blob) return void (await finish("done"));

    const provider = transcriptionProvider();
    const transcript = await provider.transcribe(blob.data, recording.sha256);
    const content = validateMinutes(
      await provider.summarize(transcript, { label: event.published.label, topicTitle: event.published.topicTitle }),
    );
    const detected = detectTemplate(transcript.text);

    await db.transaction(async (tx) => {
      // Zápis vznikne jen pro nahrávku, která je pořád aktuální. Starší úloha novější výsledek nepřepíše.
      const current = await queryRows<{ id: string }>(
        tx,
        sql`SELECT id FROM recordings WHERE id = ${recording.id} AND superseded_at IS NULL FOR UPDATE`,
      );
      if (!current.length) return;
      await tx
        .insert(minutes)
        .values({
          id: randomUUID(),
          orgId: config.orgId,
          eventId: job.eventId,
          recordingId: recording.id,
          jobId,
          transcript: transcript.text,
          content,
          detectedTemplate: detected,
          templateMismatch: detected !== "unknown" && detected !== expectedTemplate(event.published!.type),
          status: "draft",
          version: 1,
        })
        .onConflictDoNothing({ target: minutes.jobId });
    });
    await finish("done");
  } catch (error) {
    const code = error instanceof TranscriptionError ? error.code : "transcription_unavailable";
    logError("transcription.job", code, error);
    await finish("failed", code);
  }
}

export async function retryTranscription(viewer: Viewer, eventId: string): Promise<string> {
  const db = await getDb();
  await requireHandledEvent(db, viewer, eventId);
  const [job] = await db
    .update(transcriptionJobs)
    .set({ status: "queued", errorCode: null, updatedAt: new Date() })
    .where(
      and(
        eq(transcriptionJobs.eventId, eventId),
        eq(transcriptionJobs.status, "failed"),
        sql`${transcriptionJobs.recordingId} IN (SELECT id FROM recordings WHERE event_id = ${eventId} AND superseded_at IS NULL)`,
      ),
    )
    .returning();
  if (!job) throw new DomainError("invalid_state");
  await audit(db, viewer.id, "transcription.retry", "event", eventId);
  return job.id;
}

/** Akce, ke které jde přidat zápis: zveřejněná, proběhlá, ne svátek (stejně jako nahrávka). */
function requirePastPublished(row: EventRow) {
  const snapshot = row.published!;
  if (snapshot.status !== "published" || snapshot.type === "holiday" || new Date(snapshot.endsAt) > now()) {
    throw new DomainError("not_past");
  }
  return snapshot;
}

/**
 * Aktuální zápis akce: nejnověji založený zápis, který nepatří k vyměněné nahrávce. Zápisy bez nahrávky
 * (text, soubor, ručně) jsou aktuální, dokud nevznikne novější. Ostatní řádky zůstávají jen jako historie.
 */
async function currentMinutes(db: Executor, eventId: string) {
  const [row] = await db
    .select({ minutes })
    .from(minutes)
    .leftJoin(recordings, eq(recordings.id, minutes.recordingId))
    .where(and(eq(minutes.eventId, eventId), or(isNull(minutes.recordingId), isNull(recordings.supersededAt))))
    .orderBy(desc(minutes.createdAt), desc(minutes.id))
    .limit(1);
  return row?.minutes ?? null;
}

async function requireCurrentMinutes(db: Executor, eventId: string, minutesId: string) {
  const row = await currentMinutes(db, eventId);
  if (!row || row.id !== minutesId) throw new DomainError(row ? "conflict" : "not_found");
  return row;
}

const EMPTY_MINUTES: MinutesContent = { summary: "", keyPoints: [], decisions: [], nextSteps: [] };

/** Prázdný ruční návrh jde nahradit bez potvrzení, nic se tím neztratí. Stejné pravidlo používá UI. */
const hasContent = minutesStarted;

export type MinutesDraftInput =
  | { source: "transcript" | "notes"; text: string }
  | { source: "file"; fileName: string; bytes: Uint8Array }
  | { source: "manual" };

/**
 * Založí upravitelný návrh zápisu bez nahrávky: z vloženého přepisu či poznámek, z textového souboru
 * nebo prázdný ruční. `replaceId` = aktuální zápis, který uživatel viděl (null = žádný). Když se mezitím
 * změnil, návrh nevznikne (souběh dvou založení). Zveřejněný zápis zůstane vidět, dokud vedoucí neschválí nový.
 *
 * Nahrazený návrh se nemaže: zůstane v databázi jako starší verze (obnovitelný), jen přestane být aktuální.
 * Rozepsaný návrh s obsahem jde nahradit jen s výslovným potvrzením (`confirmReplace`), ne jen podle
 * upozornění v prohlížeči.
 */
export async function createMinutesDraft(
  viewer: Viewer,
  eventId: string,
  input: MinutesDraftInput,
  replaceId: string | null,
  confirmReplace = false,
): Promise<string> {
  const db = await getDb();
  const row = await requireHandledEvent(db, viewer, eventId);
  const snapshot = requirePastPublished(row);
  if (!(await withinRateLimit(db, `minutes-draft:${viewer.id}`, 20, 3600))) throw new DomainError("rate_limited");

  const text =
    input.source === "manual" ? "" : input.source === "file" ? readTextFile(input.fileName, input.bytes) : readPastedText(input.text);
  let content = EMPTY_MINUTES;
  if (text) {
    try {
      content = validateMinutes(await minutesDrafter().draft(text, { label: snapshot.label, topicTitle: snapshot.topicTitle }));
    } catch (error) {
      logError("minutes.draft", error instanceof TranscriptionError ? error.code : "drafter_failed", error);
      throw new DomainError("invalid_input");
    }
  }
  const detected = text ? detectTemplate(text) : "unknown";
  const id = randomUUID();

  await db.transaction(async (tx) => {
    // Zámek akce: dvě souběžná založení se seřadí a druhé narazí na změněný aktuální zápis.
    await queryRows(tx, sql`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`);
    const current = await currentMinutes(tx, eventId);
    if ((current?.id ?? null) !== replaceId) throw new DomainError("conflict");
    if (current && current.status === "draft" && hasContent(current.content) && !confirmReplace) throw new DomainError("replace_unconfirmed");
    await tx.insert(minutes).values({
      id,
      orgId: config.orgId,
      eventId,
      source: input.source,
      transcript: text,
      content,
      detectedTemplate: detected,
      templateMismatch: detected !== "unknown" && detected !== expectedTemplate(snapshot.type),
      status: "draft",
      version: 1,
      updatedBy: viewer.id,
    });
    await audit(tx, viewer.id, `minutes.create.${input.source}`, "event", eventId);
  });
  return id;
}

/** Porovnání po polích: jsonb v databázi nedrží pořadí klíčů. */
const sameContent = (a: MinutesContent, b: MinutesContent) =>
  a.summary === b.summary &&
  (["keyPoints", "decisions", "nextSteps"] as const).every((k) => a[k].length === b[k].length && a[k].every((item, i) => item === b[k][i]));

/** Pozvánka dostane nebo ztratí odkaz na zápis a Kalendář o změně informuje pozvané. Odeslání spouští volající. */
async function markCalendarPending(db: Executor, eventId: string) {
  await db
    .update(calendarLinks)
    .set({ syncStatus: "pending", attempts: 0, errorCode: null, updatedAt: new Date() })
    .where(and(eq(calendarLinks.eventId, eventId), eq(calendarLinks.syncStatus, "synced")));
}

/**
 * Úprava aktuálního zápisu (vedoucí, kontrolor, správce), optimisticky proti `expectedVersion`.
 * Každá změna obsahu vytvoří novou verzi. Uložení beze změny obsahu novou verzi nevytvoří.
 *
 * Zveřejněný (schválený) zápis se nepřepisuje: úprava založí nový neveřejný návrh s další verzí a publikum
 * dál čte poslední schválenou verzi, dokud vedoucí nový návrh neschválí (`approveMinutes` starou stáhne).
 * Kopie zápisu z nahrávky nese zdroj „přepis“: úloha přepisu smí patřit jen jednomu zápisu (UNIQUE job_id)
 * a text přepisu se do kopie přenese. Výslovné stažení zápisu dělá jen `withdrawMinutes`.
 */
export async function updateMinutes(
  viewer: Viewer,
  eventId: string,
  minutesId: string,
  expectedVersion: number,
  content: MinutesContent,
): Promise<{ id: string; version: number; newDraft: boolean }> {
  const db = await getDb();
  await requireHandledEvent(db, viewer, eventId);
  const current = await requireCurrentMinutes(db, eventId, minutesId);
  if (current.version !== expectedVersion) throw new DomainError("conflict");
  let next: MinutesContent;
  try {
    next = validateMinutes(content);
  } catch {
    throw new DomainError("minutes_incomplete");
  }
  if (sameContent(next, current.content)) return { id: current.id, version: current.version, newDraft: false };

  if (current.status === "published") {
    const id = randomUUID();
    await db.transaction(async (tx) => {
      // Zámek akce: souběžné úpravy schváleného zápisu založí jen jeden nový návrh, druhá narazí na konflikt.
      await queryRows(tx, sql`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`);
      const latest = await currentMinutes(tx, eventId);
      if (latest?.id !== minutesId || latest.version !== expectedVersion) throw new DomainError("conflict");
      await tx.insert(minutes).values({
        id,
        orgId: config.orgId,
        eventId,
        source: current.source === "recording" ? "transcript" : current.source,
        transcript: current.transcript,
        content: next,
        detectedTemplate: current.detectedTemplate,
        templateMismatch: current.templateMismatch,
        status: "draft",
        version: expectedVersion + 1,
        updatedBy: viewer.id,
        approvedVersion: current.approvedVersion,
        approvedBy: current.approvedBy,
        approvedAt: current.approvedAt,
        // Nový návrh musí být novější než schválený i při stejném čase (aktuální = nejnověji založený).
        createdAt: new Date(Math.max(Date.now(), current.createdAt.getTime() + 1)),
      });
      await audit(tx, viewer.id, "minutes.edit_published", "event", eventId);
    });
    return { id, version: expectedVersion + 1, newDraft: true };
  }

  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(minutes)
      .set({ content: next, version: sql`${minutes.version} + 1`, updatedBy: viewer.id })
      .where(and(eq(minutes.id, minutesId), eq(minutes.version, expectedVersion), eq(minutes.status, "draft")))
      .returning({ id: minutes.id });
    if (!row) throw new DomainError("conflict");
    await audit(tx, viewer.id, "minutes.edit", "event", eventId);
  });
  return { id: minutesId, version: expectedVersion + 1, newDraft: false };
}

/**
 * Schválení konkrétní verze aktuálního zápisu = zveřejnění pro publikum akce. Smí jen vedoucí akce
 * (`canApproveMinutes`) a jen verzi, kterou viděl: novější verze od jiného uživatele vrátí `conflict`.
 * Dříve zveřejněný zápis akce (z vyměněné nahrávky nebo nahrazeného zdroje) se tím stáhne.
 */
export async function approveMinutes(viewer: Viewer, eventId: string, minutesId: string, expectedVersion: number): Promise<void> {
  const db = await getDb();
  const event = await requireHandledEvent(db, viewer, eventId);
  if (!event.published!.leadId) throw new DomainError("no_lead");
  if (!canApproveMinutes(viewer, event)) throw new DomainError("not_lead");
  const current = await requireCurrentMinutes(db, eventId, minutesId);
  if (current.version !== expectedVersion) throw new DomainError("conflict");
  if (current.status === "published") throw new DomainError("invalid_state");
  if (!minutesSchema.safeParse(current.content).success) throw new DomainError("minutes_incomplete");

  await db.transaction(async (tx) => {
    const at = new Date();
    const [row] = await tx
      .update(minutes)
      .set({ status: "published", publishedBy: viewer.id, publishedAt: at, approvedVersion: expectedVersion, approvedBy: viewer.id, approvedAt: at })
      .where(and(eq(minutes.id, minutesId), eq(minutes.version, expectedVersion), eq(minutes.status, "draft")))
      .returning({ id: minutes.id });
    if (!row) throw new DomainError("conflict");
    await tx
      .update(minutes)
      .set({ status: "draft", publishedBy: null, publishedAt: null })
      .where(and(eq(minutes.eventId, eventId), eq(minutes.status, "published"), ne(minutes.id, minutesId)));
    await audit(tx, viewer.id, "minutes.approve", "event", eventId);
    await markCalendarPending(tx, eventId);
  });
}

/**
 * Stáhne zveřejněný zápis akce z očí publika. Vrátí se do návrhu u vedoucího, který ho může opravit
 * a zveřejnit znovu. Týká se všech zveřejněných zápisů akce, i toho z dříve vyměněné nahrávky.
 */
export async function withdrawMinutes(viewer: Viewer, eventId: string): Promise<void> {
  const db = await getDb();
  await requireHandledEvent(db, viewer, eventId);
  const rows = await db
    .update(minutes)
    .set({ status: "draft", publishedBy: null, publishedAt: null, version: sql`${minutes.version} + 1`, updatedBy: viewer.id })
    .where(and(eq(minutes.eventId, eventId), eq(minutes.status, "published")))
    .returning({ id: minutes.id });
  if (!rows.length) throw new DomainError("invalid_state");
  await audit(db, viewer.id, "minutes.withdraw", "event", eventId);
  // Pozvánka přijde o odkaz na zápis.
  await markCalendarPending(db, eventId);
}

export type HandlerMinutes = {
  id: string;
  version: number;
  status: "draft" | "published";
  source: MinutesSource;
  content: MinutesContent;
  transcript: string;
  detectedTemplate: string;
  templateMismatch: boolean;
  publishedAt: string | null;
  /** Poslední schválená verze. U návrhu po změně schváleného zápisu zůstává jako historie. */
  approvedVersion: number | null;
  approvedAt: string | null;
};

export type RecordingPanel =
  | { access: "none" }
  | { access: "reader"; state: RecordingState; minutes: MinutesContent | null; publishedAt: string | null }
  | {
      access: "handler";
      state: RecordingState;
      recording: { name: string; sizeBytes: number; durationSec: number; uploadedAt: string } | null;
      errorCode: string | null;
      /** Publikum právě vidí nějaký zveřejněný zápis akce (i z dříve vyměněné nahrávky). */
      publicMinutes: boolean;
      /** Akce má vedoucího. Bez něj zápis nejde schválit ani zveřejnit. */
      hasLead: boolean;
      /** Uživatel je vedoucí akce a smí aktuální verzi schválit. */
      canApprove: boolean;
      minutes: HandlerMinutes | null;
    };

/** Sekce nahrávky a zápisu v detailu akce, podle oprávnění uživatele. */
export async function recordingPanel(viewer: Viewer, row: EventRow): Promise<RecordingPanel> {
  const snapshot = row.published;
  const isPast = snapshot !== null && new Date(snapshot.endsAt) <= now();
  if (!snapshot || snapshot.status !== "published" || snapshot.type === "holiday" || !isPast) return { access: "none" };

  const db = await getDb();
  const [recording] = await db
    .select()
    .from(recordings)
    .where(and(eq(recordings.eventId, row.id), isNull(recordings.supersededAt)))
    .orderBy(desc(recordings.createdAt))
    .limit(1);
  const [job] = recording
    ? await db.select().from(transcriptionJobs).where(eq(transcriptionJobs.recordingId, recording.id)).limit(1)
    : [];

  if (canHandleRecording(viewer, row)) {
    const [draft, [visible]] = await Promise.all([
      currentMinutes(db, row.id),
      db
        .select({ id: minutes.id })
        .from(minutes)
        .where(and(eq(minutes.eventId, row.id), eq(minutes.status, "published")))
        .limit(1),
    ]);
    // Nově nahraná nahrávka se zpracovává: dokud z ní nevznikne zápis, platí stav přepisu.
    const jobRunning = job !== undefined && (job.status === "queued" || job.status === "processing");
    let state: RecordingState = "awaiting";
    if (jobRunning && (!draft || draft.createdAt < job.createdAt)) state = "processing";
    // Prázdná šablona ručního zápisu ještě nic ke schválení nemá.
    else if (draft) state = draft.status === "published" ? "available" : minutesStarted(draft.content) ? "review" : "awaiting";
    else if (job?.status === "failed") state = "failed";
    else if (job) state = "processing";
    return {
      access: "handler",
      state,
      publicMinutes: visible !== undefined,
      hasLead: snapshot.leadId !== null,
      canApprove: canApproveMinutes(viewer, row),
      recording: recording
        ? { name: recording.originalName, sizeBytes: recording.sizeBytes, durationSec: recording.durationSec, uploadedAt: recording.createdAt.toISOString() }
        : null,
      errorCode: job?.status === "failed" ? job.errorCode : null,
      minutes: draft
        ? {
            id: draft.id,
            version: draft.version,
            status: draft.status,
            source: draft.source,
            content: draft.content,
            transcript: draft.transcript,
            detectedTemplate: draft.detectedTemplate,
            templateMismatch: draft.templateMismatch,
            publishedAt: draft.publishedAt?.toISOString() ?? null,
            approvedVersion: draft.approvedVersion,
            approvedAt: draft.approvedAt?.toISOString() ?? null,
          }
        : null,
    };
  }
  if (!canReadPublishedMinutes(viewer, row)) return { access: "none" };
  // Výměna zdroje zveřejněný zápis neschová: publikum ho čte dál, dokud vedoucí neschválí nový.
  const [published] = await db
    .select()
    .from(minutes)
    .where(and(eq(minutes.eventId, row.id), eq(minutes.status, "published")))
    .orderBy(desc(minutes.publishedAt))
    .limit(1);
  return {
    access: "reader",
    state: published ? "available" : recording ? "processing" : "awaiting",
    minutes: published?.content ?? null,
    publishedAt: published?.publishedAt?.toISOString() ?? null,
  };
}

/** Autorizované stažení aktuální nahrávky. Ověřuje se při každém požadavku, žádný veřejný odkaz. */
export async function readRecording(viewer: Viewer, eventId: string) {
  const db = await getDb();
  await requireHandledEvent(db, viewer, eventId);
  const [recording] = await db
    .select()
    .from(recordings)
    .where(and(eq(recordings.eventId, eventId), isNull(recordings.supersededAt)))
    .limit(1);
  if (!recording) throw new DomainError("not_found");
  const [blob] = await db.select().from(recordingBlobs).where(eq(recordingBlobs.storageKey, recording.storageKey)).limit(1);
  if (!blob) throw new DomainError("not_found");
  await audit(db, viewer.id, "recording.download", "event", eventId);
  return { data: blob.data, mimeType: recording.mimeType };
}
