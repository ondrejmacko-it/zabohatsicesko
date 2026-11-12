import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { EventSnapshot, MinutesContent, SimAttendee } from "@/lib/types";

// Typy tabulek odpovídají SQL v migrations.ts. Při změně uprav obojí.
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").$type<"organizer" | "member">().notNull(),
  groups: text("groups").array().notNull(),
});

export const templateSlots = pgTable(
  "template_slots",
  {
    orgId: text("org_id").notNull(),
    isoWeekday: integer("iso_weekday").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    types: text("types").array().notNull(),
    active: boolean("active").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.isoWeekday] })],
);

export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  audience: text("audience").notNull(),
  proposedBy: text("proposed_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const topicInterests = pgTable(
  "topic_interests",
  {
    topicId: text("topic_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.userId] })],
);

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  generationKey: text("generation_key"),
  origin: text("origin").$type<"template" | "manual" | "import">().notNull(),
  calendarIntent: text("calendar_intent").$type<"create" | "pair" | "none">().notNull(),
  type: text("type").notNull(),
  label: text("label").notNull(),
  topicTitle: text("topic_title"),
  topicId: text("topic_id"),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  allDay: boolean("all_day").notNull(),
  audience: text("audience").notNull(),
  leadId: text("lead_id"),
  reviewerId: text("reviewer_id"),
  status: text("status").$type<"draft" | "published" | "cancelled">().notNull(),
  cancelReason: text("cancel_reason"),
  revision: integer("revision").notNull(),
  publishedRevision: integer("published_revision"),
  published: jsonb("published").$type<EventSnapshot>(),
  updatedBy: text("updated_by"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const eventRevisions = pgTable(
  "event_revisions",
  {
    eventId: text("event_id").notNull(),
    revision: integer("revision").notNull(),
    action: text("action").notNull(),
    snapshot: jsonb("snapshot").$type<EventSnapshot>().notNull(),
    actorId: text("actor_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.revision] })],
);

export const generationExclusions = pgTable(
  "generation_exclusions",
  {
    orgId: text("org_id").notNull(),
    generationKey: text("generation_key").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.generationKey] })],
);

export type ManagedFields = { summary: string; startsAt: string; endsAt: string; cancelled: boolean };

export const calendarLinks = pgTable("calendar_links", {
  eventId: text("event_id").primaryKey(),
  calendarId: text("calendar_id").notNull(),
  externalEventId: text("external_event_id"),
  recurringEventId: text("recurring_event_id"),
  originalStartTime: ts("original_start_time"),
  syncedRevision: integer("synced_revision").notNull(),
  syncedFields: jsonb("synced_fields").$type<ManagedFields>(),
  syncStatus: text("sync_status").$type<"pending" | "synced" | "attention">().notNull(),
  errorCode: text("error_code"),
  conflict: jsonb("conflict").$type<ManagedFields>(),
  attempts: integer("attempts").notNull(),
  leaseUntil: ts("lease_until"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const integrationSettings = pgTable(
  "integration_settings",
  {
    orgId: text("org_id").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").$type<boolean>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.key] })],
);

export const simCalendarEvents = pgTable("sim_calendar_events", {
  id: text("id").primaryKey(),
  calendarId: text("calendar_id").notNull(),
  idempotencyKey: text("idempotency_key"),
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  status: text("status").$type<"confirmed" | "cancelled">().notNull(),
  attendees: jsonb("attendees").$type<SimAttendee[]>().notNull(),
  meetingUrl: text("meeting_url"),
  sequence: integer("sequence").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const simCalendarNotifications = pgTable("sim_calendar_notifications", {
  id: serial("id").primaryKey(),
  externalEventId: text("external_event_id").notNull(),
  sequence: integer("sequence").notNull(),
  kind: text("kind").$type<"created" | "updated" | "cancelled">().notNull(),
  recipients: integer("recipients").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const recordings = pgTable("recordings", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  eventId: text("event_id").notNull(),
  storageKey: text("storage_key").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  durationSec: integer("duration_sec").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  supersededAt: ts("superseded_at"),
});

export const recordingBlobs = pgTable("recording_blobs", {
  storageKey: text("storage_key").primaryKey(),
  data: bytea("data").notNull(),
});

export const transcriptionJobs = pgTable("transcription_jobs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  eventId: text("event_id").notNull(),
  recordingId: text("recording_id").notNull(),
  status: text("status").$type<"queued" | "processing" | "done" | "failed">().notNull(),
  errorCode: text("error_code"),
  attempts: integer("attempts").notNull(),
  leaseUntil: ts("lease_until"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const minutes = pgTable("minutes", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  eventId: text("event_id").notNull(),
  recordingId: text("recording_id").notNull(),
  jobId: text("job_id").notNull(),
  transcript: text("transcript").notNull(),
  content: jsonb("content").$type<MinutesContent>().notNull(),
  detectedTemplate: text("detected_template").notNull(),
  templateMismatch: boolean("template_mismatch").notNull(),
  status: text("status").$type<"draft" | "published">().notNull(),
  version: integer("version").notNull(),
  updatedBy: text("updated_by"),
  publishedBy: text("published_by"),
  publishedAt: ts("published_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  orgId: text("org_id").notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull(),
});
