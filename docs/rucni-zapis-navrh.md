# Návrh: ruční zápis bez nahrávky

Stav: **návrh, neimplementováno** (rozhodnutí uživatele 17. 11. 2026). Pro ostrou firmu je to praktičtější cesta než
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
