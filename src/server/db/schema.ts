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
import type { EventSnapshot, MinutesContent, MinutesSource, Role, SimAttendee, UserOrigin, UserStatus } from "@/lib/types";

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
  role: text("role").$type<Role>().notNull(),
  groups: text("groups").array().notNull(),
  status: text("status").$type<UserStatus>().notNull().default("active"),
  origin: text("origin").$type<UserOrigin>().notNull().default("demo"),
  createdAt: ts("created_at").notNull().defaultNow(),
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
  archivedAt: ts("archived_at"),
  /** Garantované téma: pořadí 1–3, unikátní mezi nearchivovanými (index v migraci 0013). */
  priorityRank: integer("priority_rank"),
  /** Ruční pořadí ostatních témat. Null = řadí se podle zájmu. */
  manualRank: integer("manual_rank"),
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
  /** Adresy hostů, které do pozvánky přidala Wiki. Jen ty smí později odebrat. */
  managedAttendees: text("managed_attendees").array(),
  attempts: integer("attempts").notNull(),
  leaseUntil: ts("lease_until"),
  /** Přechodná chyba: nejdřívější čas dalšího pokusu fronty. */
  nextAttemptAt: ts("next_attempt_at"),
  /** Od kdy se vazbu nedaří propsat. Po úspěchu prázdné. */
  failingSince: ts("failing_since"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type ResponseStatus = "needsAction" | "accepted" | "tentative" | "declined";

/** Odpovědi pozvaných přečtené z kalendáře organizátora. Wiki je jen čte. */
export const calendarResponses = pgTable(
  "calendar_responses",
  {
    eventId: text("event_id").notNull(),
    email: text("email").notNull(),
    response: text("response").$type<ResponseStatus>().notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.email] })],
);

export const calendarSyncState = pgTable(
  "calendar_sync_state",
  {
    orgId: text("org_id").notNull(),
    calendarId: text("calendar_id").notNull(),
    syncToken: text("sync_token"),
    fullSyncAt: ts("full_sync_at"),
    syncedAt: ts("synced_at"),
    errorCode: text("error_code"),
    failingSince: ts("failing_since"),
    leaseUntil: ts("lease_until"),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.calendarId] })],
);

export type WorkerSource = "github" | "vercel-cron" | "visit" | "publish";

export const calendarWorkerRuns = pgTable(
  "calendar_worker_runs",
  {
    orgId: text("org_id").notNull(),
    source: text("source").$type<WorkerSource>().notNull(),
    lastStartedAt: ts("last_started_at"),
    lastSuccessAt: ts("last_success_at"),
    lastErrorCode: text("last_error_code"),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.source] })],
);

export const integrationSettings = pgTable(
  "integration_settings",
  {
    orgId: text("org_id").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").$type<boolean>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.key] })],
);

/** Připojení integrace. Obnovovací token je uložený jen šifrovaně (AES-256-GCM), klíč je mimo databázi. */
export const integrationCredentials = pgTable(
  "integration_credentials",
  {
    orgId: text("org_id").notNull(),
    provider: text("provider").$type<"google-calendar">().notNull(),
    accountEmail: text("account_email").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    scopes: text("scopes").notNull(),
    connectedBy: text("connected_by"),
    connectedAt: ts("connected_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.provider] })],
);

/** Účet u poskytovatele identity svázaný s uživatelem Wiki přes stabilní `sub`. E-mail je jen informativní. */
export const userIdentities = pgTable(
  "user_identities",
  {
    provider: text("provider").$type<"google">().notNull(),
    subject: text("subject").notNull(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastLoginAt: ts("last_login_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.subject] })],
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
  /** Jen u zápisu z nahrávky (`source = 'recording'`). */
  recordingId: text("recording_id"),
  jobId: text("job_id"),
  /** Pracovní text zdroje (přepis, vložený text, obsah souboru). Vidí ho jen vedoucí, kontrolor a správce. */
  transcript: text("transcript").notNull().default(""),
  source: text("source").$type<MinutesSource>().notNull().default("recording"),
  content: jsonb("content").$type<MinutesContent>().notNull(),
  detectedTemplate: text("detected_template").notNull(),
  templateMismatch: boolean("template_mismatch").notNull(),
  status: text("status").$type<"draft" | "published">().notNull(),
  version: integer("version").notNull(),
  updatedBy: text("updated_by"),
  publishedBy: text("published_by"),
  publishedAt: ts("published_at"),
  /** Poslední schválení vedoucím akce. Zveřejněný zápis má `approvedVersion = version`, po změně obsahu zůstane jako historie. */
  approvedVersion: integer("approved_version"),
  approvedBy: text("approved_by"),
  approvedAt: ts("approved_at"),
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

/** Zařízení, ze kterého se uživatel ostré Wiki smí přihlásit. V DB jen otisk tajemství z cookie. */
export const trustedDevices = pgTable("trusted_devices", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
  secretHash: text("secret_hash").notNull(),
  label: text("label").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  revokedAt: ts("revoked_at"),
});

/** Jednorázový zvací odkaz. V DB jen otisk tokenu, token zná jen správce, který odkaz vytvořil. */
export const loginInvites = pgTable("login_invites", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  createdBy: text("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  revokedAt: ts("revoked_at"),
  deviceId: text("device_id"),
});

/** `removal_failed` = Google odmítl smazat kalendář odebraného účtu, token zůstal kvůli dalšímu pokusu. */
export type PersonalCalendarStatus = "active" | "declined" | "revoked" | "calendar_deleted" | "removal_failed";

/**
 * Vlastní kalendář „Vzdělávání ZBC“ v účtu Google uživatele (`CALENDAR_DELIVERY=personal`). Bez cizího
 * klíče na `users`: po smazání účtu musí řádek přežít, aby Wiki stihla kalendář smazat a token zneplatnit.
 */
export const personalCalendars = pgTable("personal_calendars", {
  userId: text("user_id").primaryKey(),
  orgId: text("org_id").notNull(),
  accountEmail: text("account_email").notNull(),
  /** Prázdné po odvolání nebo odmítnutí. Jinak AES-256-GCM s kontextem `org:google-personal:<userId>`. */
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  scopes: text("scopes").notNull(),
  calendarId: text("calendar_id"),
  status: text("status").$type<PersonalCalendarStatus>().notNull(),
  errorCode: text("error_code"),
  syncRequestedAt: ts("sync_requested_at"),
  syncedAt: ts("synced_at"),
  leaseUntil: ts("lease_until"),
  /** Verze podoby akcí (`EVENT_FORMAT`), se kterou byl kalendář naposledy srovnán. */
  eventFormat: integer("event_format").notNull().default(0),
  /** Výsledek nastavení kalendáře, strojový kód pro diagnostiku (`basic|full:403_forbidden`). */
  setupCode: text("setup_code"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Událost akce Wiki v osobním kalendáři. Otisk dat pozná, jestli je potřeba ji v Googlu měnit. */
export const personalCalendarEntries = pgTable(
  "personal_calendar_entries",
  {
    userId: text("user_id").notNull(),
    eventId: text("event_id").notNull(),
    externalEventId: text("external_event_id").notNull(),
    dataHash: text("data_hash").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);
