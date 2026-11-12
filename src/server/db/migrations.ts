// Migrace jsou čisté SQL v kódu, aby běžely stejně lokálně (PGlite) i na hostingu
// (Neon) bez přístupu k souborovému systému. Nové změny přidávej jako další položku.
export const migrations: ReadonlyArray<{ id: string; sql: string }> = [
  {
    id: "0001_init",
    sql: `
CREATE TABLE users (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('organizer', 'member')),
  groups text[] NOT NULL
);

CREATE TABLE template_slots (
  org_id text NOT NULL,
  iso_weekday integer NOT NULL CHECK (iso_weekday BETWEEN 1 AND 7),
  start_time text NOT NULL,
  end_time text NOT NULL,
  types text[] NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (org_id, iso_weekday)
);

CREATE TABLE topics (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  name text NOT NULL,
  audience text NOT NULL,
  proposed_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX topics_org_name_uq ON topics (org_id, lower(name));

CREATE TABLE topic_interests (
  topic_id text NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, user_id)
);

CREATE TABLE events (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  generation_key text UNIQUE,
  origin text NOT NULL CHECK (origin IN ('template', 'manual', 'import')),
  calendar_intent text NOT NULL CHECK (calendar_intent IN ('create', 'pair', 'none')),
  type text NOT NULL,
  label text NOT NULL,
  topic_title text,
  topic_id text REFERENCES topics(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  audience text NOT NULL,
  lead_id text REFERENCES users(id),
  reviewer_id text REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('draft', 'published', 'cancelled')),
  cancel_reason text,
  revision integer NOT NULL DEFAULT 1,
  published_revision integer,
  published jsonb,
  updated_by text REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX events_org_start_idx ON events (org_id, starts_at);

CREATE TABLE event_revisions (
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  action text NOT NULL,
  snapshot jsonb NOT NULL,
  actor_id text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, revision)
);

CREATE TABLE generation_exclusions (
  org_id text NOT NULL,
  generation_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, generation_key)
);

CREATE TABLE calendar_links (
  event_id text PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  calendar_id text NOT NULL,
  external_event_id text,
  recurring_event_id text,
  original_start_time timestamptz,
  synced_revision integer NOT NULL DEFAULT 0,
  synced_fields jsonb,
  sync_status text NOT NULL CHECK (sync_status IN ('pending', 'synced', 'attention')),
  error_code text,
  conflict jsonb,
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX calendar_links_external_uq ON calendar_links (calendar_id, external_event_id);

CREATE TABLE integration_settings (
  org_id text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  PRIMARY KEY (org_id, key)
);

-- Simulace Google Kalendáře: hraje roli externí služby, Wiki do ní přistupuje jen přes poskytovatele.
CREATE TABLE sim_calendar_events (
  id text PRIMARY KEY,
  calendar_id text NOT NULL,
  idempotency_key text UNIQUE,
  summary text NOT NULL,
  description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  attendees jsonb NOT NULL,
  meeting_url text,
  sequence integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sim_calendar_notifications (
  id serial PRIMARY KEY,
  external_event_id text NOT NULL REFERENCES sim_calendar_events(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  kind text NOT NULL,
  recipients integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_event_id, sequence)
);

CREATE TABLE recordings (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  sha256 text NOT NULL,
  duration_sec integer NOT NULL,
  uploaded_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);
CREATE UNIQUE INDEX recordings_current_uq ON recordings (event_id) WHERE superseded_at IS NULL;

-- Soukromé úložiště souborů. Obsah se vydává jen přes autorizovanou serverovou cestu.
CREATE TABLE recording_blobs (
  storage_key text PRIMARY KEY,
  data bytea NOT NULL
);

CREATE TABLE transcription_jobs (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  recording_id text NOT NULL UNIQUE REFERENCES recordings(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  error_code text,
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE minutes (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  recording_id text NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  job_id text NOT NULL UNIQUE REFERENCES transcription_jobs(id) ON DELETE CASCADE,
  transcript text NOT NULL,
  content jsonb NOT NULL,
  detected_template text NOT NULL,
  template_mismatch boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  version integer NOT NULL DEFAULT 1,
  updated_by text REFERENCES users(id),
  published_by text REFERENCES users(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id serial PRIMARY KEY,
  org_id text NOT NULL,
  actor_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL
);
`,
  },
];
