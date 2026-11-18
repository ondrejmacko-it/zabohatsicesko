-- Prezentační data pro ostrou Wiki (Neon `zbc-wiki-produkce`, výchozí větev).
-- PŘIPRAVENO, NESPUŠTĚNO. Spustit až po merge PR `claude/doladeni-harmonogramu-a-temat` a po záloze
-- (Neon větev ze stavu před spuštěním). Postup a rollback: docs/prezentacni-data.md.
--
-- Co skript udělá (jedna transakce, pojistky na začátku):
--  1. 6 fiktivních kolegů (role member, e-mail @example.invalid, skupiny FP / RM / Tým A / Všichni),
--     jako `inviteUser`: origin invite, aktivní, audit `user.invited`. Přihlásit se nemohou (doména neexistuje).
--  2. 3 nová témata od kolegů (`proposeTopic`: zájem navrhovatele, audit `topic.propose`) a zájem kolegů
--     o 3 nová a 2 stávající témata. Slouží k živé ukázce doporučení v Připravit měsíc → únor 2027.
--  3. Kolonky Kdo/Téma: u 15 budoucích zveřejněných akcí z pravidelného týdne (26. 11. 2026 – 27. 1. 2027)
--     doplní vedoucího a u části téma, ostatní nechá záměrně prázdné („— doplnit“ / „Bude upřesněno“).
--     Tvar jako `updateEvent(..., "publish")`: revision + 1, revize `publish` se snímkem ve tvaru `snapshotOf`,
--     `published` = snímek, `published_revision` = revize, vazba `calendar_links` `pending`, audit `event.publish`.
--     Akce s neuloženými změnami, zrušené, proběhlé nebo už s vedoucím se přeskočí.
--  Nic nemaže, nemění šablonu týdne, akce vedené stávajícími účty ani nahrávky, přepisy a zápisy.
--  Google Kalendář: vazby `pending` zpracuje běžná synchronizace (osobní režim, bez e-mailů hostům).

BEGIN;

-- Snímek ve tvaru snapshotOf (src/server/domain/snapshot.ts). Čas jako Date.toISOString().
CREATE OR REPLACE FUNCTION pg_temp.iso(t timestamptz) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT to_char(t AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

CREATE OR REPLACE FUNCTION pg_temp.snap(e events) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'type', e.type, 'label', e.label, 'topicTitle', e.topic_title, 'topicId', e.topic_id,
    'startsAt', pg_temp.iso(e.starts_at), 'endsAt', pg_temp.iso(e.ends_at), 'allDay', e.all_day,
    'audience', e.audience, 'leadId', e.lead_id, 'reviewerId', e.reviewer_id,
    'status', CASE WHEN e.status = 'cancelled' THEN 'cancelled' ELSE 'published' END,
    'cancelReason', e.cancel_reason)
$$;

-- Pojistky: jeden správce, kolegové ani nová témata ještě nejsou založení.
DO $$
BEGIN
  IF (SELECT count(*) FROM users WHERE org_id = 'zbc-demo' AND role = 'admin' AND status = 'active') <> 1 THEN
    RAISE EXCEPTION 'Čekal jsem právě jednoho aktivního správce.';
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE email LIKE '%.prezentace@example.invalid') THEN
    RAISE EXCEPTION 'Prezentační kolegové už existují, skript už nejspíš proběhl.';
  END IF;
  IF EXISTS (SELECT 1 FROM topics WHERE id LIKE 'topic-prezentace-%') THEN
    RAISE EXCEPTION 'Prezentační témata už existují.';
  END IF;
END $$;

CREATE TEMP TABLE admin_actor ON COMMIT DROP AS
  SELECT id FROM users WHERE org_id = 'zbc-demo' AND role = 'admin' AND status = 'active';

-- 1. Fiktivní kolegové ------------------------------------------------------------------------------
CREATE TEMP TABLE colleague (key text PRIMARY KEY, id text, name text, email text, groups text[]) ON COMMIT DROP;
INSERT INTO colleague VALUES
  ('vasek',  'u-' || gen_random_uuid(), 'Vašek Novotný',    'vasek.prezentace@example.invalid',  ARRAY['vsichni','fp']),
  ('petra',  'u-' || gen_random_uuid(), 'Petra Svobodová',  'petra.prezentace@example.invalid',  ARRAY['vsichni','fp']),
  ('lucie',  'u-' || gen_random_uuid(), 'Lucie Horáková',   'lucie.prezentace@example.invalid',  ARRAY['vsichni','fp']),
  ('tomas',  'u-' || gen_random_uuid(), 'Tomáš Král',       'tomas.prezentace@example.invalid',  ARRAY['vsichni','rm']),
  ('jana',   'u-' || gen_random_uuid(), 'Jana Dvořáková',   'jana.prezentace@example.invalid',   ARRAY['vsichni','rm']),
  ('martin', 'u-' || gen_random_uuid(), 'Martin Beneš',     'martin.prezentace@example.invalid', ARRAY['vsichni','tym-a']);

INSERT INTO users (id, org_id, name, email, role, groups, status, origin)
  SELECT id, 'zbc-demo', name, email, 'member', groups, 'active', 'invite' FROM colleague;
INSERT INTO audit_log (org_id, actor_id, action, entity_type, entity_id)
  SELECT 'zbc-demo', (SELECT id FROM admin_actor), 'user.invited', 'user', id FROM colleague;

-- 2. Témata a zájem ---------------------------------------------------------------------------------
-- Únor 2027 (pravidelný týden): pá 5. 2. RM, 12. 2. FP, 19. 2. RM, 26. 2. FP. Při generování doporučí
-- 5. 2. „Komunikace s klienty při výkyvech na trzích“ (5 zájemců), 12. 2. „Hypotéky pro OSVČ…“ (4),
-- 19. 2. „Péče o klíčové klienty a pravidelný servis“ (3). 26. 2. zůstane bez doporučení (žádné volné
-- FP téma), „Prezentace výsledků portfolia klientovi“ (2) zůstane v zásobníku. Počty platí pro stav DB 18. 11. 2026.
CREATE TEMP TABLE new_topic (id text PRIMARY KEY, name text, audience text, proposer text) ON COMMIT DROP;
INSERT INTO new_topic VALUES
  ('topic-prezentace-rozbor-schuzky', 'Rozbor schůzky s klientem',                'fp', 'vasek'),
  ('topic-prezentace-hypoteky-osvc',  'Hypotéky pro OSVČ a malé podnikatele',      'fp', 'petra'),
  ('topic-prezentace-vysledky',       'Prezentace výsledků portfolia klientovi',   'rm', 'jana');

INSERT INTO topics (id, org_id, name, audience, proposed_by)
  SELECT t.id, 'zbc-demo', t.name, t.audience, c.id FROM new_topic t JOIN colleague c ON c.key = t.proposer;
INSERT INTO audit_log (org_id, actor_id, action, entity_type, entity_id)
  SELECT 'zbc-demo', c.id, 'topic.propose', 'topic', t.id FROM new_topic t JOIN colleague c ON c.key = t.proposer;

-- Zájem: navrhovatel + kolegové z publika tématu (stávající témata hledá podle přesného názvu).
INSERT INTO topic_interests (topic_id, user_id)
  SELECT t.id, c.id
  FROM (VALUES
    ('Rozbor schůzky s klientem', 'vasek'), ('Rozbor schůzky s klientem', 'petra'), ('Rozbor schůzky s klientem', 'lucie'),
    ('Hypotéky pro OSVČ a malé podnikatele', 'petra'), ('Hypotéky pro OSVČ a malé podnikatele', 'vasek'),
    ('Hypotéky pro OSVČ a malé podnikatele', 'lucie'), ('Hypotéky pro OSVČ a malé podnikatele', 'martin'),
    ('Prezentace výsledků portfolia klientovi', 'jana'), ('Prezentace výsledků portfolia klientovi', 'tomas'),
    ('Komunikace s klienty při výkyvech na trzích', 'tomas'), ('Komunikace s klienty při výkyvech na trzích', 'lucie'),
    ('Péče o klíčové klienty a pravidelný servis', 'tomas')
  ) AS v(topic_name, colleague_key)
  JOIN topics t ON t.org_id = 'zbc-demo' AND t.name = v.topic_name AND t.archived_at IS NULL
  JOIN colleague c ON c.key = v.colleague_key
  ON CONFLICT DO NOTHING;

-- 3. Kolonky Kdo / Téma -----------------------------------------------------------------------------
-- Klíč = generation_key akce z pravidelného týdne. Téma: NULL = nechat, jak je (prázdné zůstane prázdné).
-- topic_name odkazuje na téma ze seznamu Témata (topic_id), custom_title je vlastní téma bez vazby.
CREATE TEMP TABLE plan_detail (generation_key text PRIMARY KEY, lead text, topic_name text, custom_title text) ON COMMIT DROP;
INSERT INTO plan_detail VALUES
  ('zbc-demo:slot-4:2026-11-26', 'tomas',  NULL, 'Námitky klientů k poplatkům za správu'),
  ('zbc-demo:slot-5:2026-11-27', 'vasek',  'Rozbor schůzky s klientem', NULL),
  ('zbc-demo:slot-2:2026-12-01', 'martin', NULL, NULL),
  ('zbc-demo:slot-3:2026-12-02', 'petra',  NULL, NULL),
  ('zbc-demo:slot-5:2026-12-04', 'jana',   NULL, NULL),  -- téma „Návaznost po konzultaci“ už má
  ('zbc-demo:slot-2:2026-12-08', 'martin', NULL, NULL),
  ('zbc-demo:slot-3:2026-12-09', 'vasek',  NULL, 'Modelové situace: první schůzka'),
  ('zbc-demo:slot-3:2026-12-16', 'petra',  NULL, 'Měsíční přehled portfolií'),
  ('zbc-demo:slot-4:2026-12-17', 'tomas',  NULL, NULL),
  ('zbc-demo:slot-2:2027-01-05', 'martin', NULL, NULL),
  ('zbc-demo:slot-4:2027-01-07', 'jana',   NULL, 'Plán péče o klienty na rok 2027'),
  ('zbc-demo:slot-3:2027-01-13', 'lucie',  NULL, NULL),
  ('zbc-demo:slot-3:2027-01-20', 'petra',  NULL, NULL),
  ('zbc-demo:slot-4:2027-01-21', 'tomas',  NULL, 'Rozhovor o generačním předání'),
  ('zbc-demo:slot-3:2027-01-27', 'vasek',  NULL, NULL);
-- Záměrně prázdné zůstávají mimo jiné: 3. 12. a 10. 12. Trénink RM, 15. 12. Action time, 6. 1. Portfolio tým,
-- 22. 1. Firemní vzdělávání RM, vánoční týden a akce, které vedou stávající účty (beze změny).

CREATE TEMP TABLE touched ON COMMIT DROP AS
  SELECT e.id
  FROM plan_detail p
  JOIN events e ON e.org_id = 'zbc-demo' AND e.generation_key = p.generation_key
  WHERE e.status = 'published'
    AND e.revision = e.published_revision      -- žádné rozpracované změny
    AND e.starts_at > now()
    AND e.lead_id IS NULL
    AND (p.topic_name IS NULL AND p.custom_title IS NULL OR e.topic_title IS NULL);  -- téma nepřepisuje

DO $$
BEGIN
  IF (SELECT count(*) FROM touched) = 0 THEN
    RAISE EXCEPTION 'Žádná akce k doplnění (už proběhly, nebo mají vedoucího).';
  END IF;
  IF EXISTS (SELECT 1 FROM plan_detail p WHERE p.topic_name IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM topics t WHERE t.name = p.topic_name AND t.archived_at IS NULL)) THEN
    RAISE EXCEPTION 'Chybí téma ze seznamu.';
  END IF;
END $$;

UPDATE events e SET
  lead_id = c.id,
  topic_id = CASE WHEN p.topic_name IS NOT NULL THEN t.id WHEN p.custom_title IS NOT NULL THEN NULL ELSE e.topic_id END,
  topic_title = COALESCE(t.name, p.custom_title, e.topic_title),
  revision = e.revision + 1,
  updated_by = (SELECT id FROM admin_actor),
  updated_at = now()
FROM plan_detail p
JOIN colleague c ON c.key = p.lead
LEFT JOIN topics t ON t.org_id = 'zbc-demo' AND t.name = p.topic_name AND t.archived_at IS NULL
WHERE e.generation_key = p.generation_key AND e.id IN (SELECT id FROM touched);

-- Zveřejnění (publishInTx): snímek, revize `publish`, vazba Kalendáře čeká na synchronizaci.
UPDATE events e SET published = pg_temp.snap(e), published_revision = e.revision
WHERE e.id IN (SELECT id FROM touched);

INSERT INTO event_revisions (event_id, revision, action, snapshot, actor_id)
  SELECT e.id, e.revision, 'publish', e.published, (SELECT id FROM admin_actor)
  FROM events e WHERE e.id IN (SELECT id FROM touched);

UPDATE calendar_links l SET sync_status = 'pending', error_code = NULL, attempts = 0, updated_at = now()
WHERE l.event_id IN (SELECT id FROM touched);
INSERT INTO calendar_links (event_id, calendar_id, sync_status, synced_revision, attempts)
  SELECT e.id, 'primary', 'pending', 0, 0
  FROM events e
  WHERE e.id IN (SELECT id FROM touched) AND e.calendar_intent = 'create'
    AND NOT EXISTS (SELECT 1 FROM calendar_links l WHERE l.event_id = e.id);

INSERT INTO audit_log (org_id, actor_id, action, entity_type, entity_id)
  SELECT 'zbc-demo', (SELECT id FROM admin_actor), 'event.publish', 'event', id FROM touched;

-- Noví kolegové patří do publika budoucích akcí svých skupin (requeueAttendeeSync).
UPDATE calendar_links l SET sync_status = 'pending', attempts = 0, error_code = NULL, updated_at = now()
WHERE l.sync_status = 'synced'
  AND l.event_id IN (SELECT id FROM events WHERE org_id = 'zbc-demo' AND starts_at > now()
                     AND published->>'audience' IN ('vsichni', 'fp', 'rm', 'tym-a'));

-- Kontrola: snímek sedí s řádkem, revize sedí, přehled pro report.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM events e WHERE e.id IN (SELECT id FROM touched)
             AND (e.published <> pg_temp.snap(e) OR e.published_revision <> e.revision)) THEN
    RAISE EXCEPTION 'Snímek nesedí s akcí.';
  END IF;
END $$;

SELECT to_char(e.starts_at AT TIME ZONE 'Europe/Prague', 'DD. MM. YYYY HH24:MI') AS termin, e.label,
       u.name AS kdo, e.topic_title AS tema, e.revision, l.sync_status
FROM events e
LEFT JOIN users u ON u.id = e.lead_id
LEFT JOIN calendar_links l ON l.event_id = e.id
WHERE e.id IN (SELECT id FROM touched)
ORDER BY e.starts_at;

COMMIT;
