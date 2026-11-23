// Migrace jsou čisté SQL v kódu, aby běžely stejně lokálně (PGlite) i na hostingu
// (Neon) bez přístupu k souborovému systému. Nové změny přidávej jako další položku.
//
// `approval: true`: migrace běží při startu aplikace, takže by ji každý push spustil i na sdílené databázi
// Preview. Taková migrace se na vzdálené databázi (DATABASE_URL) provede, jen když je její ID v proměnné
// `APPROVED_MIGRATIONS` (seznam oddělený čárkou). Lokální PGlite a testy ji provedou vždy. Dokud povolená
// není, zastaví se na ní i všechny další, aby pořadí migrací zůstalo stejné všude.
export type Migration = { id: string; sql: string; approval?: true };

export const migrations: ReadonlyArray<Migration> = [
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
  {
    id: "0002_integration_credentials",
    sql: `
CREATE TABLE integration_credentials (
  org_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('google-calendar')),
  account_email text NOT NULL,
  encrypted_refresh_token text NOT NULL,
  scopes text NOT NULL,
  connected_by text REFERENCES users(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, provider)
);
`,
  },
  {
    id: "0003_user_identities",
    sql: `
-- Vazba účtu Wiki na stabilní identifikátor u poskytovatele identity (\`sub\`), ne na e-mail.
CREATE TABLE user_identities (
  provider text NOT NULL CHECK (provider IN ('google')),
  subject text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);
CREATE UNIQUE INDEX user_identities_user_uq ON user_identities (provider, user_id);
`,
  },
  {
    id: "0004_user_management",
    sql: `
-- Správa uživatelů ve Wiki: role správce, stav účtu a původ (fiktivní role, pozvánka, žádost).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'organizer', 'member'));
ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'disabled'));
ALTER TABLE users ADD COLUMN origin text NOT NULL DEFAULT 'demo' CHECK (origin IN ('demo', 'invite', 'request'));
ALTER TABLE users ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX users_email_uq ON users (org_id, lower(email));
`,
  },
  {
    id: "0005_managed_attendees",
    sql: `
-- Hosté pozvánky, které přidala Wiki. Ručně přidané hosty Wiki nespravuje a neodebírá.
ALTER TABLE calendar_links ADD COLUMN managed_attendees text[];
`,
  },
  {
    id: "0006_topic_archive",
    sql: `
-- Archivované téma zmizí z nabídky a doporučení, vazba minulých akcí na něj zůstává.
ALTER TABLE topics ADD COLUMN archived_at timestamptz;
`,
  },
  {
    id: "0007_login_invites",
    sql: `
-- Ostrá Wiki pouští k přihlášení jen přes jednorázový odkaz od správce. Odkaz se po použití
-- změní na důvěryhodné zařízení (cookie). V databázi jsou jen otisky tokenů, nikdy tokeny samotné.
CREATE TABLE trusted_devices (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret_hash text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX trusted_devices_user_idx ON trusted_devices (user_id);

CREATE TABLE login_invites (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  device_id text REFERENCES trusted_devices(id) ON DELETE SET NULL
);
CREATE INDEX login_invites_user_idx ON login_invites (user_id);
`,
  },
  {
    id: "0008_devices_never_expire",
    sql: `
-- Zařízení platí, dokud ho správce nezruší. Platná zařízení s 30denní lhůtou se převedou na trvalá.
UPDATE trusted_devices SET expires_at = '9999-12-31T00:00:00Z' WHERE revoked_at IS NULL AND expires_at > now();
`,
  },
  {
    id: "0009_personal_calendars",
    sql: `
CREATE TABLE personal_calendars (
  user_id text PRIMARY KEY,
  org_id text NOT NULL,
  account_email text NOT NULL,
  encrypted_refresh_token text NOT NULL,
  scopes text NOT NULL,
  calendar_id text,
  status text NOT NULL CHECK (status IN ('active', 'declined', 'revoked', 'calendar_deleted')),
  error_code text,
  sync_requested_at timestamptz,
  synced_at timestamptz,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE personal_calendar_entries (
  user_id text NOT NULL REFERENCES personal_calendars(user_id) ON DELETE CASCADE,
  event_id text NOT NULL,
  external_event_id text NOT NULL,
  data_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
`,
  },
  {
    id: "0010_personal_calendar_format",
    sql: `
-- Verze podoby akcí, se kterou byl kalendář naposledy srovnán. Nižší než aktuální = přepsat akce a znovu
-- zkusit nastavení kalendáře. Výchozí 0 přepíše všechny dnešní kalendáře při nejbližším otevření Úvodu.
ALTER TABLE personal_calendars ADD COLUMN event_format integer NOT NULL DEFAULT 0;
-- Výsledek posledního nastavení seznamu kalendářů: strojový kód bez obsahu dat (např. none|full:403_forbidden).
ALTER TABLE personal_calendars ADD COLUMN setup_code text;
`,
  },
  {
    id: "0011_calendar_outbox_rsvp",
    sql: `
-- Jen přidání sloupců a tabulek, nic se nemaže ani nepřepisuje.
-- Fronta Kalendáře: kdy se má přechodně neúspěšná vazba zkusit znovu a od kdy se nedaří (upozornění správci).
ALTER TABLE calendar_links ADD COLUMN next_attempt_at timestamptz;
ALTER TABLE calendar_links ADD COLUMN failing_since timestamptz;

-- Odpovědi pozvaných (RSVP) přečtené z kalendáře organizátora. Wiki je jen čte, do Googlu je nikdy nezapisuje.
CREATE TABLE calendar_responses (
  event_id text NOT NULL,
  email text NOT NULL,
  response text NOT NULL CHECK (response IN ('needsAction', 'accepted', 'tentative', 'declined')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, email)
);
CREATE INDEX calendar_responses_email_idx ON calendar_responses (email);

-- Přírůstková synchronizace odpovědí (events.list se syncToken). Bez tokenu proběhne úplná synchronizace.
CREATE TABLE calendar_sync_state (
  org_id text NOT NULL,
  calendar_id text NOT NULL,
  sync_token text,
  full_sync_at timestamptz,
  synced_at timestamptz,
  error_code text,
  failing_since timestamptz,
  lease_until timestamptz,
  PRIMARY KEY (org_id, calendar_id)
);

-- Poslední běhy zpracování fronty podle zdroje (github, vercel-cron, visit, publish). Výpadek plánovače ukáže Správa.
CREATE TABLE calendar_worker_runs (
  org_id text NOT NULL,
  source text NOT NULL,
  last_started_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  PRIMARY KEY (org_id, source)
);
`,
  },
  {
    id: "0012_personal_calendar_removal_failed",
    sql: `
-- Jen rozšíření povolených stavů, data se nemění. \`removal_failed\` = Google odmítl smazat kalendář
-- odebraného účtu; token a řádek zůstávají kvůli dalšímu pokusu.
ALTER TABLE personal_calendars DROP CONSTRAINT IF EXISTS personal_calendars_status_check;
ALTER TABLE personal_calendars ADD CONSTRAINT personal_calendars_status_check
  CHECK (status IN ('active', 'declined', 'revoked', 'calendar_deleted', 'removal_failed'));
`,
  },
  {
    id: "0013_topic_priority_and_order",
    sql: `
-- Garantovaná témata (pořadí 1–3) a ruční pořadí ostatních. Jen nové sloupce, stávající data se nemění.
-- Unikátní index hlídá i souběh: stejné pořadí nedostanou dvě nearchivovaná témata.
ALTER TABLE topics ADD COLUMN priority_rank smallint CHECK (priority_rank BETWEEN 1 AND 3);
ALTER TABLE topics ADD COLUMN manual_rank integer;
CREATE UNIQUE INDEX topics_priority_rank_unique ON topics (org_id, priority_rank)
  WHERE priority_rank IS NOT NULL AND archived_at IS NULL;
`,
  },
  {
    id: "0014_minutes_sources_and_approval",
    sql: `
-- Zápis bez nahrávky (vložený přepis, poznámky, textový soubor, ruční zápis) a schválení konkrétní verze
-- vedoucím akce. Jen nové sloupce a uvolnění NOT NULL, nic se nemaže.
-- Stávající zápisy jsou všechny z nahrávky: dostanou source 'recording' (výchozí hodnota) a zveřejněné
-- se označí jako schválené ve své aktuální verzi, takže je publikum vidí dál beze změny.
ALTER TABLE minutes ALTER COLUMN recording_id DROP NOT NULL;
ALTER TABLE minutes ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE minutes ALTER COLUMN transcript SET DEFAULT '';
ALTER TABLE minutes ADD COLUMN source text NOT NULL DEFAULT 'recording'
  CHECK (source IN ('recording', 'transcript', 'notes', 'file', 'manual'));
-- Zápis z nahrávky má vždy nahrávku i úlohu přepisu, ostatní zdroje ani jedno.
ALTER TABLE minutes ADD CONSTRAINT minutes_source_recording_check
  CHECK ((source = 'recording') = (recording_id IS NOT NULL AND job_id IS NOT NULL));
ALTER TABLE minutes ADD COLUMN approved_version integer;
ALTER TABLE minutes ADD COLUMN approved_by text REFERENCES users(id);
ALTER TABLE minutes ADD COLUMN approved_at timestamptz;
UPDATE minutes SET approved_version = version, approved_by = published_by, approved_at = published_at
  WHERE status = 'published' AND approved_version IS NULL;
`,
  },
  {
    id: "0015_topic_priority_unlimited",
    approval: true,
    sql: `
-- Garantovaných témat může být libovolně mnoho (dřív nejvýš 3). Pořadí zůstává 1..n a unikátní v organizaci
-- (index topics_priority_rank_unique se nemění). Nic se nemaže ani nepřepisuje: jen se uvolní omezení
-- a smallint se rozšíří na integer. Starší kód s novým schématem funguje dál (pořadí 1–3 jsou platná).
-- Bezpečné selhání: když očekávané omezení z 0013 chybí nebo vypadá jinak, schéma se liší od předpokladu
-- a migrace se zastaví celá (transakce), místo aby tiše pokračovala. Blok DO je na jednom řádku, protože
-- prepareDatabase dělí SQL na příkazy podle středníku na konci řádku.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'topics'::regclass AND conname = 'topics_priority_rank_check' AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%priority_rank <= 3%') THEN RAISE EXCEPTION '0015: chybí očekávané omezení topics_priority_rank_check (1–3), migrace zastavena'; END IF; END $$;
ALTER TABLE topics DROP CONSTRAINT topics_priority_rank_check;
ALTER TABLE topics ALTER COLUMN priority_rank TYPE integer;
ALTER TABLE topics ADD CONSTRAINT topics_priority_rank_positive CHECK (priority_rank >= 1);
`,
  },
  {
    id: "0016_event_participation",
    approval: true,
    sql: `
-- Individuální účast (PR1, F03/F05): jen výjimka z odvozené povinnosti nebo dobrovolná přihláška.
-- Povinná účast se neukládá, odvozuje se ze zveřejněné akce a rolí. Jen nové objekty, nic se nemaže ani
-- nepřepisuje, IF NOT EXISTS dovolí bezpečné opakování. Unikátní indexy (org_id, id) jen umožní cizí klíče
-- v rámci organizace: id je už primární klíč, takže je stávající data vždy splňují.
CREATE UNIQUE INDEX IF NOT EXISTS users_org_id_id_key ON users (org_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS events_org_id_id_key ON events (org_id, id);
-- Jeden aktuální záznam na člověka a akci (souběh nevytvoří dva). Důvod jen u omluvy, poznámka volitelná
-- a krátká, nikdy diagnóza. Smazání akce (jen nezveřejněný návrh) nebo účtu záznam smaže (minimalizace dat),
-- historie změn zůstává v audit_log bez důvodu i poznámky.
CREATE TABLE IF NOT EXISTS event_participation (
  org_id text NOT NULL,
  event_id text NOT NULL,
  user_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('voluntary_enrolled', 'excused')),
  excuse_reason text CHECK (excuse_reason IN ('illness', 'vacation', 'other')),
  excuse_note text CHECK (char_length(excuse_note) BETWEEN 1 AND 280),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, event_id, user_id),
  CONSTRAINT event_participation_event_fk FOREIGN KEY (org_id, event_id) REFERENCES events (org_id, id) ON DELETE CASCADE,
  CONSTRAINT event_participation_user_fk FOREIGN KEY (org_id, user_id) REFERENCES users (org_id, id) ON DELETE CASCADE,
  CONSTRAINT event_participation_excuse_check CHECK ((kind = 'excused') = (excuse_reason IS NOT NULL) AND (kind = 'excused' OR excuse_note IS NULL))
);
CREATE INDEX IF NOT EXISTS event_participation_user_idx ON event_participation (org_id, user_id);
`,
  },
  {
    id: "0017_participation_withdrawn",
    approval: true,
    sql: `
-- Dobrovolné odhlášení musí být odlišitelné od stavu, kdy se kolega nikdy nepřihlásil.
-- Jen rozšíření povolených hodnot; dosavadní účasti a omluvy zůstávají.
ALTER TABLE event_participation DROP CONSTRAINT IF EXISTS event_participation_kind_check;
ALTER TABLE event_participation ADD CONSTRAINT event_participation_kind_check
  CHECK (kind IN ('voluntary_enrolled', 'excused', 'withdrawn'));
`,
  },
];
