import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { MinutesContent, RecordingState } from "@/lib/types";
import { audit, logError, withinRateLimit } from "@/server/audit";
import { config, now } from "@/server/config";
import { getDb, queryRows, type Executor } from "@/server/db/client";
import { calendarLinks, minutes, recordingBlobs, recordings, transcriptionJobs } from "@/server/db/schema";
import type { EventRow } from "@/server/domain/snapshot";
import { canHandleRecording, canReadPublishedMinutes, visibleEvent, type Viewer } from "@/server/policy";
import { MAX_UPLOAD_BYTES, displayName, inspectAudio } from "@/server/recordings/audio";
import {
  TranscriptionError,
  detectTemplate,
  expectedTemplate,
  transcriptionProvider,
  validateMinutes,
} from "@/server/recordings/transcription";
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
  const row = await requireHandledEvent(db, viewer, eventId);
  const snapshot = row.published!;
  if (snapshot.status !== "published" || snapshot.type === "holiday" || new Date(snapshot.endsAt) > now()) {
    throw new DomainError("not_past");
  }
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

async function requireDraftMinutes(db: Executor, viewer: Viewer, eventId: string, minutesId: string) {
  await requireHandledEvent(db, viewer, eventId);
  const [row] = await db
    .select()
    .from(minutes)
    .where(and(eq(minutes.id, minutesId), eq(minutes.eventId, eventId)))
    .limit(1);
  if (!row) throw new DomainError("not_found");
  if (row.status !== "draft") throw new DomainError("invalid_state");
  return row;
}

export async function updateMinutes(
  viewer: Viewer,
  eventId: string,
  minutesId: string,
  expectedVersion: number,
  content: MinutesContent,
): Promise<void> {
  const db = await getDb();
  await requireDraftMinutes(db, viewer, eventId, minutesId);
  const [row] = await db
    .update(minutes)
    .set({ content: validateMinutes(content), version: sql`${minutes.version} + 1`, updatedBy: viewer.id })
    .where(and(eq(minutes.id, minutesId), eq(minutes.version, expectedVersion), eq(minutes.status, "draft")))
    .returning({ id: minutes.id });
  if (!row) throw new DomainError("conflict");
  await audit(db, viewer.id, "minutes.edit", "event", eventId);
}

export async function publishMinutes(viewer: Viewer, eventId: string, minutesId: string, expectedVersion: number): Promise<void> {
  const db = await getDb();
  await requireDraftMinutes(db, viewer, eventId, minutesId);
  const [row] = await db
    .update(minutes)
    .set({ status: "published", publishedBy: viewer.id, publishedAt: new Date() })
    .where(and(eq(minutes.id, minutesId), eq(minutes.version, expectedVersion), eq(minutes.status, "draft")))
    .returning({ id: minutes.id });
  if (!row) throw new DomainError("conflict");
  await audit(db, viewer.id, "minutes.publish", "event", eventId);
  // Pozvánka dostane odkaz na zápis a Kalendář o změně informuje pozvané. Odeslání spouští volající.
  await db
    .update(calendarLinks)
    .set({ syncStatus: "pending", attempts: 0, errorCode: null, updatedAt: new Date() })
    .where(and(eq(calendarLinks.eventId, eventId), eq(calendarLinks.syncStatus, "synced")));
}

export type RecordingPanel =
  | { access: "none" }
  | { access: "reader"; state: RecordingState; minutes: MinutesContent | null; publishedAt: string | null }
  | {
      access: "handler";
      state: RecordingState;
      recording: { name: string; sizeBytes: number; durationSec: number; uploadedAt: string } | null;
      errorCode: string | null;
      minutes: {
        id: string;
        version: number;
        status: "draft" | "published";
        content: MinutesContent;
        transcript: string;
        detectedTemplate: string;
        templateMismatch: boolean;
        publishedAt: string | null;
      } | null;
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
  const [draft] = recording
    ? await db.select().from(minutes).where(eq(minutes.recordingId, recording.id)).limit(1)
    : [];

  let state: RecordingState = "awaiting";
  if (draft) state = draft.status === "published" ? "available" : "review";
  else if (job?.status === "failed") state = "failed";
  else if (job) state = "processing";

  if (canHandleRecording(viewer, row)) {
    return {
      access: "handler",
      state,
      recording: recording
        ? { name: recording.originalName, sizeBytes: recording.sizeBytes, durationSec: recording.durationSec, uploadedAt: recording.createdAt.toISOString() }
        : null,
      errorCode: job?.status === "failed" ? job.errorCode : null,
      minutes: draft
        ? {
            id: draft.id,
            version: draft.version,
            status: draft.status,
            content: draft.content,
            transcript: draft.transcript,
            detectedTemplate: draft.detectedTemplate,
            templateMismatch: draft.templateMismatch,
            publishedAt: draft.publishedAt?.toISOString() ?? null,
          }
        : null,
    };
  }
  if (!canReadPublishedMinutes(viewer, row)) return { access: "none" };
  const published = draft?.status === "published" ? draft : null;
  return {
    access: "reader",
    state: published ? "available" : "awaiting",
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
