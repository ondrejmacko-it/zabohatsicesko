# Návrh: ruční zápis bez nahrávky

Stav: **implementováno ve fázi F4** (větev `claude/rychle-akce-a-planovani-temat`, migrace 0014), rozdíly viz
„Implementace“ na konci. Původní návrh: rozhodnutí uživatele 17. 11. 2026. Pro ostrou firmu je to praktičtější cesta než
automatický přepis.

## Výchozí stav
- `FixtureTranscription` (`src/server/recordings/transcription.ts`) přepíše jen jednu ukázkovou nahrávku (kontrola
  SHA-256). Každý jiný soubor skončí chybou `unsupported_fixture`. Přepis skutečné schůzky neumí. UI to říká
  u nahrávání.
- Tabulka `minutes` má `recording_id`, `job_id` a `transcript` NOT NULL, takže zápis bez nahrávky nejde uložit.

## Návrh
1. Migrace: `recording_id`, `job_id` povolit NULL, `transcript` default `''`. Přidat sloupec `source` (`'transcript' | 'manual'`).
   Stávající řádky dostanou `transcript`.
2. Doména: `createManualMinutes(viewer, eventId)` vytvoří prázdný návrh podle šablony typu akce. Oprávnění stejné jako
   `canHandleRecording`, akce musí být zveřejněná, proběhlá a nezrušená. Současně smí být jen jeden aktuální zápis
   (unikátní index na `event_id`, kde zápis není nahrazený, plus kontrola `version` při ukládání).
3. Úprava a zveřejnění přes stávající `MinutesEditor` a `publishMinutes`, včetně auditu a odkazu v Kalendáři.
4. Nahrání nahrávky k ručnímu zápisu ho nesmí přepsat bez potvrzení.
5. UI: v pracovním okně zápisu tlačítko „Napsat zápis ručně“ vedle nahrávání.
6. Testy: oprávnění (vedoucí, kontrolor, správce, kolega), souběh dvou založení, zrušená a budoucí akce, zveřejnění a
   vrácení do návrhu.

## Implementace (F4) a rozdíly od návrhu
- `source` má hodnoty `recording | transcript | notes | file | manual` (navíc vložený text a textový soubor).
  CHECK hlídá, že jen zápis z nahrávky má `recording_id` a `job_id`.
- Místo unikátního indexu „jeden aktuální zápis“: aktuální je nejnovější zápis mimo vyměněné nahrávky. Souběh
  založení hlídá zámek řádku akce a `replaceId` (aktuální zápis, který uživatel viděl). Nahrazený textový návrh
  se smaže, návrh z nahrávky zůstává u nahrávky.
- Zveřejnění = `approveMinutes` (dříve `publishMinutes`): jen vedoucí akce, konkrétní verze. Kontrolor a správce
  upravují, neschvalují. Zveřejněný zápis jde upravit, změna obsahu schválení zruší (`approved_version` zůstane jako
  historie). Vrácení do návrhu (`withdrawMinutes`) beze změny.
- Nahrání nahrávky k ručnímu zápisu: místo potvrzení upozornění „Nový návrh nahradí rozpracovaný návrh zápisu“.
