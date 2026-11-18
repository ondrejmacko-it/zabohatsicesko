-- Prezentační data pro ostrou Wiki (Neon `zbc-wiki-produkce`, výchozí větev `main`).
-- Verze 2 (18. 11. 2026): plný harmonogram listopad 2026 – leden 2027, únor 2027 volný pro živé doporučení.
-- Záloha před spuštěním: Neon větev `zaloha-pred-prezentaci`. Postup a návrat: docs/prezentacni-data.md.
--
-- Co skript udělá (jedna transakce, pojistky na začátku i na konci):
--  1. 8 fiktivních kolegů (`*.prezentace@example.invalid`, nikam nic nepřijde, přihlásit se nemohou).
--     Jméno nese pracovní roli. Organizátor: vedoucí Týmu A, vedoucí RM, metodička FP. Ostatní člen.
--     Správce zůstává jediný (stávající účet). Tvar jako `inviteUser`: origin invite, audit `user.invited`.
--  2. 3 témata od kolegů (`proposeTopic`) a zájem kolegů o témata (pro únorová doporučení).
--  3. Harmonogram: všechny akce z pravidelného týdne 3. 11. 2026 – 29. 1. 2027 zveřejněné, většina s Kdo
--     a Tématem, pár záměrně prázdných. Prošlé nezveřejněné návrhy z 3.–13. 11. se doplní a zveřejní
--     (místo smazání, aby v listopadu nebyly díry). Út 24. 11. dostane chybějící Action time (ruční akce).
--     Tvar jako `updateEvent(..., "publish")` / `createEvent(..., "publish")`: revize + 1, revize `publish`
--     se snímkem `snapshotOf`, vazba Kalendáře `pending`, audit.
--  4. Zrušené zbytky testů (18. 11. „test“, 25. 11. „sds“) dostanou srozumitelný důvod novou revizí `cancel`.
--  Ruční akce vedené stávajícími účty, šablonu týdne, nahrávky, přepisy, zápisy ani únor nemění.
--  Každá změna akce jen nad revizí, se kterou skript počítá (optimistický zámek). Opakované spuštění zastaví pojistka.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.iso(t timestamptz) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT to_char(t AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- Snímek ve tvaru snapshotOf (src/server/domain/snapshot.ts).
CREATE OR REPLACE FUNCTION pg_temp.snap(e events) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'type', e.type, 'label', e.label, 'topicTitle', e.topic_title, 'topicId', e.topic_id,
    'startsAt', pg_temp.iso(e.starts_at), 'endsAt', pg_temp.iso(e.ends_at), 'allDay', e.all_day,
    'audience', e.audience, 'leadId', e.lead_id, 'reviewerId', e.reviewer_id,
    'status', CASE WHEN e.status = 'cancelled' THEN 'cancelled' ELSE 'published' END,
    'cancelReason', e.cancel_reason)
$$;

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
CREATE TEMP TABLE colleague (key text PRIMARY KEY, id text, name text, email text, role text, groups text[]) ON COMMIT DROP;
INSERT INTO colleague VALUES
  ('martin', 'u-' || gen_random_uuid(), 'Martin Beneš (vedoucí Týmu A)',          'martin.prezentace@example.invalid', 'organizer', ARRAY['vsichni','tym-a','fp']),
  ('jana',   'u-' || gen_random_uuid(), 'Jana Dvořáková (vedoucí RM)',            'jana.prezentace@example.invalid',   'organizer', ARRAY['vsichni','rm']),
  ('petra',  'u-' || gen_random_uuid(), 'Petra Svobodová (metodička FP)',         'petra.prezentace@example.invalid',  'organizer', ARRAY['vsichni','fp']),
  ('klara',  'u-' || gen_random_uuid(), 'Klára Veselá (portfolio manažerka)',     'klara.prezentace@example.invalid',  'member',    ARRAY['vsichni','fp']),
  ('vasek',  'u-' || gen_random_uuid(), 'Vašek Novotný (finanční poradce)',       'vasek.prezentace@example.invalid',  'member',    ARRAY['vsichni','fp','tym-a']),
  ('lucie',  'u-' || gen_random_uuid(), 'Lucie Horáková (junior poradkyně)',      'lucie.prezentace@example.invalid',  'member',    ARRAY['vsichni','fp']),
  ('tomas',  'u-' || gen_random_uuid(), 'Tomáš Král (relationship manažer)',      'tomas.prezentace@example.invalid',  'member',    ARRAY['vsichni','rm']),
  ('pavel',  'u-' || gen_random_uuid(), 'Pavel Marek (senior relationship manažer)', 'pavel.prezentace@example.invalid', 'member', ARRAY['vsichni','rm']);

INSERT INTO users (id, org_id, name, email, role, groups, status, origin)
  SELECT id, 'zbc-demo', name, email, role, groups, 'active', 'invite' FROM colleague;
INSERT INTO audit_log (org_id, actor_id, action, entity_type, entity_id)
  SELECT 'zbc-demo', (SELECT id FROM admin_actor), 'user.invited', 'user', id FROM colleague;

-- 2. Témata a zájem ---------------------------------------------------------------------------------
-- Únor 2027 (pravidelný týden, pátky): 5. 2. RM, 12. 2. FP, 19. 2. RM, 26. 2. FP. Skript žádné z volných
-- témat níže nenaplánuje do budoucna, takže je generování února doporučí (pořadí: nenaplánované, zájem,
-- déle neprobrané): 5. 2. „Komunikace s klienty při výkyvech na trzích“, 12. 2. „Hypotéky pro OSVČ…“,
-- 19. 2. „Péče o klíčové klienty…“ (naposledy 6. 11.), 26. 2. „Rozbor schůzky s klientem“.
CREATE TEMP TABLE new_topic (id text PRIMARY KEY, name text, audience text, proposer text) ON COMMIT DROP;
INSERT INTO new_topic VALUES
  ('topic-prezentace-rozbor-schuzky', 'Rozbor schůzky s klientem',              'fp', 'vasek'),
  ('topic-prezentace-hypoteky-osvc',  'Hypotéky pro OSVČ a malé podnikatele',    'fp', 'petra'),
  ('topic-prezentace-vysledky',       'Prezentace výsledků portfolia klientovi', 'rm', 'jana');

INSERT INTO topics (id, org_id, name, audience, proposed_by)
  SELECT t.id, 'zbc-demo', t.name, t.audience, c.id FROM new_topic t JOIN colleague c ON c.key = t.proposer;
INSERT INTO audit_log (org_id, actor_id, action, entity_type, entity_id)
  SELECT 'zbc-demo', c.id, 'topic.propose', 'topic', t.id FROM new_topic t JOIN colleague c ON c.key = t.proposer;

INSERT INTO topic_interests (topic_id, user_id)
  SELECT t.id, c.id
  FROM (VALUES
    ('Rozbor schůzky s klientem', 'vasek'), ('Rozbor schůzky s klientem', 'petra'), ('Rozbor schůzky s klientem', 'lucie'),
    ('Hypotéky pro OSVČ a malé podnikatele', 'petra'), ('Hypotéky pro OSVČ a malé podnikatele', 'vasek'),
    ('Hypotéky pro OSVČ a malé podnikatele', 'lucie'), ('Hypotéky pro OSVČ a malé podnikatele', 'martin'),
    ('Hypotéky pro OSVČ a malé podnikatele', 'klara'),
    ('Prezentace výsledků portfolia klientovi', 'jana'), ('Prezentace výsledků portfolia klientovi', 'tomas'),
    ('Komunikace s klienty při výkyvech na trzích', 'tomas'), ('Komunikace s klienty při výkyvech na trzích', 'lucie'),
    ('Komunikace s klienty při výkyvech na trzích', 'klara'),
    ('Péče o klíčové klienty a pravidelný servis', 'tomas'), ('Péče o klíčové klienty a pravidelný servis', 'pavel'),
    ('Investiční dotazník a rizikový profil klienta', 'lucie'), ('Penzijní spoření a DIP v praxi', 'martin'),
    ('Generační předání rodinného majetku', 'pavel'), ('Refinancování hypoték v roce 2027', 'vasek')
  ) AS v(topic_name, colleague_key)
  JOIN topics t ON t.org_id = 'zbc-demo' AND t.name = v.topic_name AND t.archived_at IS NULL
  JOIN colleague c ON c.key = v.colleague_key
  ON CONFLICT DO NOTHING;

-- 3. Harmonogram ------------------------------------------------------------------------------------
-- Klíč = ID akce a revize, kterou skript očekává. lead NULL = nechat prázdné. topic_name = téma ze seznamu
-- (vazba topic_id), custom_title = vlastní téma. Obojí NULL = téma nechat, jak je.
-- Záměrně úplně prázdné (správce „— doplnit“, kolega „Bude upřesněno“): 3. 12., 15. 12., 23. 12., 30. 12., 22. 1.
-- Jen Kdo bez tématu: 10. 12., 6. 1., 27. 1. Action time bez tématu je běžný pracovní blok.
CREATE TEMP TABLE plan_detail (event_id text PRIMARY KEY, expected_revision int, lead text, topic_name text, custom_title text) ON COMMIT DROP;
INSERT INTO plan_detail VALUES
  -- listopad: prošlé návrhy -> zveřejnit
  ('ev-dd507d10-a8b5-4476-a10d-be4fb6b7d9fb', 1, 'martin', NULL, 'Plán aktivit Týmu A na listopad'),          -- út 3. 11. AT
  ('ev-7225e9ae-6908-4208-8463-a64ac9a3f976', 1, 'klara',  NULL, 'Měsíční přehled portfolií'),                -- st 4. 11. Portfolio
  ('ev-7ed2e658-ff37-4c77-b6e3-9bb3c8659100', 1, 'jana',   NULL, 'Námitky klientů k poplatkům za správu'),    -- čt 5. 11. TRM
  ('ev-b28486ba-da0c-4a0f-9b34-eb5ed765853c', 1, 'pavel',  'Péče o klíčové klienty a pravidelný servis', NULL), -- pá 6. 11. FV RM
  ('ev-3b0ed2fd-8234-45ef-82c2-1676d2be0cf7', 1, 'vasek',  NULL, 'Telefonáty klientům po roční revizi'),      -- út 10. 11. AT
  ('ev-292f0cda-37ec-4951-bbb8-88312215723f', 1, 'petra',  NULL, 'Modelové situace: první schůzka'),          -- st 11. 11. TP
  ('ev-0fa417bb-4638-40d7-a181-ec4790fe585c', 1, 'lucie',  NULL, 'Finanční plán pro mladou rodinu'),          -- pá 13. 11. FV FP
  -- listopad: zveřejněné
  ('ev-0474262f-9ff4-4680-8062-e04c5c8ca03b', 3, 'tomas',  NULL, 'Příprava na schůzku s novým klientem'),     -- čt 12. 11. TRM (vedl testovací účet)
  ('ev-a67b4474-017a-4074-b1da-2e9bcb5579b8', 3, 'petra',  NULL, 'Práce s námitkami u investic'),             -- st 18. 11. TP
  ('ev-78a0ca19-1dc6-493d-be8f-08b9c77ea0bf', 2, 'tomas',  NULL, 'Klientská péče na konci roku'),             -- čt 19. 11. TRM
  ('ev-9e827342-91ea-4522-b0d6-07827d3403e8', 2, 'jana',   NULL, 'Výsledky klientských portfolií za 3. čtvrtletí'), -- pá 20. 11. FV RM
  ('ev-931d47c7-3589-427e-8577-f6d1729c872d', 2, 'pavel',  NULL, 'Servisní schůzka s klíčovým klientem'),     -- čt 26. 11. TRM
  ('ev-0bed4284-7f5e-41f7-9041-32934ff44e7a', 2, 'vasek',  NULL, 'Finanční rezerva v praxi: modelový klient'), -- pá 27. 11. FV FP
  -- prosinec
  ('ev-4ac1d354-e79b-4f87-9119-d389c4eefbc4', 2, 'martin', NULL, NULL),                                       -- út 1. 12. AT
  ('ev-d7da5c45-b3bf-4b3f-bef1-66b26339f4d1', 2, 'klara',  NULL, 'Rebalancování portfolií před koncem roku'), -- st 2. 12. Portfolio
  ('ev-6a504038-6b5e-457d-8b97-b276ea1b763f', 2, 'jana',   NULL, NULL),                                       -- pá 4. 12. FV RM (téma má)
  ('ev-296982ba-d197-468c-b0c4-99a933927992', 2, 'vasek',  NULL, NULL),                                       -- út 8. 12. AT
  ('ev-bb119f8e-7a20-4230-9641-b4bcaea93acf', 2, 'petra',  NULL, 'Modelové situace: doporučení produktu'),    -- st 9. 12. TP
  ('ev-c398604f-ef08-4610-9edc-12517d301cd4', 2, 'tomas',  NULL, NULL),                                       -- čt 10. 12. TRM, téma prázdné
  ('ev-06b21ad9-8d6f-44cc-8362-7199ac567c5d', 2, 'klara',  NULL, 'Měsíční přehled portfolií'),                -- st 16. 12. Portfolio
  ('ev-955ac370-b275-4c06-b70d-932471f90166', 2, 'pavel',  NULL, 'Plán schůzek s klienty na leden'),          -- čt 17. 12. TRM
  ('ev-55e8e56d-175b-4b83-8272-6fc1d74ede89', 2, 'martin', NULL, 'Uzavření roku a plán Týmu A'),              -- út 22. 12. AT
  ('ev-7e912354-b658-44ce-81ca-fb483cdd56fc', 2, 'vasek',  NULL, NULL),                                       -- út 29. 12. AT
  ('ev-04588dd8-311b-4d6a-86ce-dfc9dcdc4ea0', 2, 'jana',   NULL, 'Ohlédnutí za rokem 2026'),                  -- čt 31. 12. TRM
  -- leden
  ('ev-d3966d66-707f-4f1d-a06b-3c2e89aad5e2', 2, 'martin', NULL, 'Cíle Týmu A na rok 2027'),                  -- út 5. 1. AT
  ('ev-000acba5-cc9e-406f-b4de-18ac4f3781b3', 2, 'klara',  NULL, NULL),                                       -- st 6. 1. Portfolio, téma prázdné
  ('ev-9d07e139-517f-42d5-b35c-4e8f4578d70c', 2, 'jana',   NULL, 'Plán péče o klienty na rok 2027'),          -- čt 7. 1. TRM
  ('ev-e3d87522-48f3-43da-9b32-7361eedade76', 2, 'vasek',  NULL, NULL),                                       -- út 12. 1. AT
  ('ev-6910d6b7-2077-4dc3-a712-ee6b40ecec1e', 2, 'lucie',  NULL, 'Nováčci: první měsíc s klienty'),           -- st 13. 1. TP
  ('ev-e10e40e7-01e7-47cd-809a-e75dae225cb6', 2, 'pavel',  NULL, 'Roční revize u klíčových klientů'),         -- čt 14. 1. TRM
  ('ev-f4e2c8d9-c90a-48ce-afde-7ee893451f68', 2, 'martin', NULL, NULL),                                       -- út 19. 1. AT
  ('ev-debcdbb0-9329-48d8-a8dc-b8f18043201e', 2, 'klara',  NULL, 'Výhled trhů na rok 2027'),                  -- st 20. 1. Portfolio
  ('ev-2b2070bc-e55f-49cf-9d78-01be42977f8d', 2, 'tomas',  NULL, 'Rozhovor o generačním předání'),            -- čt 21. 1. TRM
  ('ev-85e16245-03c9-4da9-9dc1-7a2cf5a485ce', 2, 'vasek',  NULL, NULL),                                       -- út 26. 1. AT
  ('ev-b98c103c-9b0f-4f85-b876-87ca1b523c2e', 2, 'petra',  NULL, NULL),                                       -- st 27. 1. TP, téma prázdné
  ('ev-a043cb76-3b13-4e6c-9caa-457e656cd30b', 2, 'tomas',  NULL, 'Práce s doporučeními od klientů');          -- čt 28. 1. TRM

CREATE TEMP TABLE touched ON COMMIT DROP AS
  SELECT e.id
  FROM plan_detail p
  JOIN events e ON e.id = p.event_id AND e.org_id = 'zbc-demo'
  WHERE e.revision = p.expected_revision
    AND e.status IN ('draft', 'published')
    AND e.type <> 'holiday'
    AND (e.status = 'draft' AND e.published_revision IS NULL OR e.revision = e.published_revision);

DO $$
BEGIN
  IF (SELECT count(*) FROM touched) <> (SELECT count(*) FROM plan_detail) THEN
    RAISE EXCEPTION 'Akce se mezitím změnily (% z % odpovídá očekávané revizi).',
      (SELECT count(*) FROM touched), (SELECT count(*) FROM plan_detail);
  END IF;
  IF EXISTS (SELECT 1 FROM plan_detail p WHERE p.topic_name IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM topics t WHERE t.org_id = 'zbc-demo' AND t.name = p.topic_name AND t.archived_at IS NULL)) THEN
    RAISE EXCEPTION 'Chybí téma ze seznamu.';
  END IF;
END $$;

UPDATE events e SET
  lead_id = COALESCE(c.id, e.lead_id),
  topic_id = CASE WHEN p.topic_name IS NOT NULL THEN t.id WHEN p.custom_title IS NOT NULL THEN NULL ELSE e.topic_id END,
  topic_title = COALESCE(t.name, p.custom_title, e.topic_title),
  status = 'published',
  revision = e.revision + 1,
  updated_by = (SELECT id FROM admin_actor),
  updated_at = now()
FROM plan_detail p
LEFT JOIN colleague c ON c.key = p.lead
LEFT JOIN topics t ON t.org_id = 'zbc-demo' AND t.name = p.topic_name AND t.archived_at IS NULL
WHERE e.id = p.event_id AND e.id IN (SELECT id FROM touched);

-- Chybějící Action time v út 24. 11. (pravidelný termín se přesunul na 25. 11. a byl zrušen).
CREATE TEMP TABLE created ON COMMIT DROP AS SELECT 'ev-' || gen_random_uuid() AS id;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM events WHERE org_id = 'zbc-demo' AND type = 'action' AND status <> 'cancelled'
             AND (starts_at AT TIME ZONE 'Europe/Prague')::date = DATE '2026-11-24') THEN
    RAISE EXCEPTION 'Action time 24. 11. už existuje.';
  END IF;
END $$;
INSERT INTO events (id, org_id, origin, calendar_intent, type, label, topic_title, starts_at, ends_at, all_day,
                    audience, lead_id, status, revision, updated_by)
  SELECT id, 'zbc-demo', 'manual', 'create', 'action', 'Action time', 'Příprava kampaně na konec roku',
         TIMESTAMPTZ '2026-11-24 10:00 Europe/Prague', TIMESTAMPTZ '2026-11-24 12:00 Europe/Prague', false,
         'tym-a', (SELECT id FROM colleague WHERE key = 'martin'), 'published', 1, (SELECT id FROM admin_actor)
  FROM created;
INSERT INTO touched SELECT id FROM created;

-- 4. Důvody zrušení po testech: nová revize `cancel` (jen důvod, nic jiného).
CREATE TEMP TABLE reason_fix (event_id text PRIMARY KEY, expected_revision int, reason text) ON COMMIT DROP;
INSERT INTO reason_fix VALUES
  ('ev-8e59d4dd-d94c-4748-8cdf-a2c5be116352', 3, 'Místo Portfolio týmu proběhne Trénink poradců (přesun z 25. 11.).'),
  ('ev-da4f7e09-2177-47de-9283-95fc8d8dd662', 4, 'Action time proběhne v úterý 24. 11., ve středu je Trénink poradců.');
DO $$
BEGIN
  IF (SELECT count(*) FROM reason_fix r JOIN events e ON e.id = r.event_id
      WHERE e.revision = r.expected_revision AND e.status = 'cancelled' AND e.revision = e.published_revision) <> 2 THEN
    RAISE EXCEPTION 'Zrušené akce se mezitím změnily.';
  END IF;
END $$;
UPDATE events e SET cancel_reason = r.reason, revision = e.revision + 1,
                    updated_by = (SELECT id FROM admin_actor), updated_at = now()
FROM reason_fix r WHERE e.id = r.event_id;

-- Zveřejnění (publishInTx) pro všechny dotčené akce.
CREATE TEMP TABLE all_changed ON COMMIT DROP AS
  SELECT id, CASE WHEN id IN (SELECT event_id FROM reason_fix) THEN 'cancel' ELSE 'publish' END AS action FROM (
    SELECT id FROM touched UNION SELECT event_id FROM reason_fix) x;

UPDATE events e SET published = pg_temp.snap(e), published_revision = e.revision
WHERE e.id IN (SELECT id FROM all_changed);

INSERT INTO event_revisions (event_id, revision, action, snapshot, actor_id)
  SELECT e.id, e.revision, a.action, e.published, (SELECT id FROM admin_actor)
  FROM events e JOIN all_changed a ON a.id = e.id;

UPDATE calendar_links l SET sync_status = 'pending', error_code = NULL, attempts = 0, updated_at = now()
WHERE l.event_id IN (SELECT id FROM all_changed);
INSERT INTO calendar_links (event_id, calendar_id, sync_status, synced_revision, attempts)
  SELECT e.id, 'primary', 'pending', 0, 0
  FROM events e
  WHERE e.id IN (SELECT id FROM all_changed) AND e.calendar_intent = 'create'
    AND NOT EXISTS (SELECT 1 FROM calendar_links l WHERE l.event_id = e.id);

INSERT INTO audit_log (org_id, actor_id, action, entity_type, entity_id)
  SELECT 'zbc-demo', (SELECT id FROM admin_actor),
         CASE WHEN a.action = 'cancel' THEN 'event.cancel'
              WHEN a.id IN (SELECT id FROM created) THEN 'event.create_publish'
              ELSE 'event.publish' END,
         'event', a.id
  FROM all_changed a;

-- Noví kolegové patří do publika budoucích akcí svých skupin (requeueAttendeeSync).
UPDATE calendar_links l SET sync_status = 'pending', attempts = 0, error_code = NULL, updated_at = now()
WHERE l.sync_status = 'synced'
  AND l.event_id IN (SELECT id FROM events WHERE org_id = 'zbc-demo' AND starts_at > now()
                     AND published->>'audience' IN ('vsichni', 'fp', 'rm', 'tym-a'));

-- Kontroly ------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM events e WHERE e.id IN (SELECT id FROM all_changed)
             AND (e.published <> pg_temp.snap(e) OR e.published_revision <> e.revision)) THEN
    RAISE EXCEPTION 'Snímek nesedí s akcí.';
  END IF;
  IF EXISTS (SELECT 1 FROM events WHERE org_id = 'zbc-demo' AND status = 'draft'
             AND starts_at >= '2026-11-01' AND starts_at < '2027-02-01') THEN
    RAISE EXCEPTION 'V listopadu až lednu zůstal nezveřejněný návrh.';
  END IF;
  -- Díry: každý den pravidelného týdne 2. 11. 2026 – 31. 1. 2027 má zveřejněnou akci (svátek se počítá).
  IF EXISTS (SELECT 1 FROM generate_series(DATE '2026-11-02', DATE '2027-01-31', '1 day') d
             JOIN template_slots s ON s.org_id = 'zbc-demo' AND s.active AND s.iso_weekday = extract(isodow FROM d)
             WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.org_id = 'zbc-demo' AND e.status = 'published'
                               AND (e.starts_at AT TIME ZONE 'Europe/Prague')::date = d::date)) THEN
    RAISE EXCEPTION 'V harmonogramu zůstala díra.';
  END IF;
  IF EXISTS (SELECT 1 FROM events WHERE org_id = 'zbc-demo' AND starts_at >= '2027-02-01' AND starts_at < '2027-03-01') THEN
    RAISE EXCEPTION 'Únor 2027 má zůstat volný.';
  END IF;
END $$;

SELECT to_char(e.starts_at AT TIME ZONE 'Europe/Prague', 'DD. MM. YYYY') AS den, e.label, e.status,
       u.name AS kdo, e.topic_title AS tema, (e.topic_id IS NOT NULL) AS ze_seznamu, e.cancel_reason,
       e.revision, l.sync_status
FROM events e
LEFT JOIN users u ON u.id = e.lead_id
LEFT JOIN calendar_links l ON l.event_id = e.id
WHERE e.org_id = 'zbc-demo' AND e.starts_at >= '2026-11-01' AND e.starts_at < '2027-02-01'
ORDER BY e.starts_at, e.label;

COMMIT;
