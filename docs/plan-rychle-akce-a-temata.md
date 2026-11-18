# Plán: rychlé akce, plánování témat, zápisy se schválením

Větev `claude/rychle-akce-a-planovani-temat` z main 59cadc0. Draft PR, merge dělá uživatel.
Zásada: vizuálně skoro beze změny, přínos je v práci. Rozšiřovat existující `Menu`, `EventMenu`, `MoveDropZone`,
`EventDialog`, `PrepareMonthDialog`, služby a oprávnění. Žádná druhá implementace mazání, přesunu, zveřejnění.

## Rozhodnutí přijatá bez dotazu (nejméně invazivní, jdou později přepnout)
* Migrace jsou jen přidávací (`ADD COLUMN`, `DROP NOT NULL`). Spouští se samy při startu aplikace, tedy na Preview
  (sdílená ukázková DB) po pushi a na produkci až po merge. Uvést v PR.
* Přesun zůstává jen v rámci měsíce (`planMove` → `outside_month`). Rozšíření jen navrhnout v reportu.
* Duplikace = předvyplněný formulář Přidat akci, uložit jde jen jako návrh. Nic se nekopíruje mimo pole formuláře.
* Zápis schvaluje (= zveřejňuje) jen vedoucí akce. Kontrolor a správce mohou návrh upravit, schválit ne. Bez vedoucího
  nejde zápis zveřejnit, UI řekne „Doplňte vedoucího akce“. Změna obsahu po schválení schválení ruší (verze).
* Garantovaná témata: max. 3, pořadí 1–3, platnost v čase bez automatiky. Bez nastavení správce vidí úkol.
* Ruční pořadí ostatních témat: šipky Posunout výš/níž (přístupné), žádné drag & drop. Štítek Nejžádanější zůstává
  vázaný na skutečný počet zájemců, ruční pořadí má vlastní tiché označení.
* Témata se dál vážou jménem → ID při uložení (`topicIdByName`), zveřejněné snímky drží svůj název.
* Žádné externí AI API. Zdroj zápisu „přepis/poznámky/dokument“ = text vložený nebo nahraný soubor .txt/.md/.vtt/.srt
  (kontrola velikosti a UTF-8 obsahu), z něj vznikne upravitelný návrh. Integrační hranice = rozhraní
  `MinutesDrafter` s jednou lokální implementací (rozdělení textu do šablony), bez sítě.

## Fáze
1. **F1 Rychlé akce u akcí** (P0): jednotný vzhled `Menu` (ikony, oddělovač, nebezpečné položky dole), nový klientský
   `CardMenu` jako sourozenec odkazu v `CardWrap` (mřížka, seznam, agenda), položky podle stavu/role/minulosti:
   návrh = Upravit, Přesunout termín, Duplikovat, Zveřejnit návrh, Smazat návrh; zveřejněná budoucí = Upravit,
   Přesunout, Duplikovat, Otevřít podrobnosti, Zrušit akci; proběhlá = Otevřít podrobnosti, Zobrazit zápis,
   Nahrávka a zápis (vedoucí/kontrolor/správce), Duplikovat jako novou (správce). Přesun otevře stávající
   `MovePicker`/`MoveConfirm`. Zveřejnit návrh = stávající kontrola úplnosti a dopadu (bez obcházení).
   Smazat/Zrušit = stávající dialogy z `EventMenu` (po smazání zůstat v kontextu Plánu). Duplikace přes `?kopie=<id>`.
   Totéž menu v okně akce (`EventPeek`) doplnit o Duplikovat.
2. **F2 Témata** (P0): migrace `topics.priority_rank` (1–3, unikátní), `topics.manual_rank`; sekce Garantovaná
   témata nad ostatními; menu tématu (Naplánovat téma, Upravit, Nastavit/Zrušit prioritu, Posunout výš/níž,
   Archivovat); „Naplánovat téma“ = okno se seznamem vhodných budoucích akcí (preferovat návrh bez tématu se stejnou
   skupinou a typem řízeným tématem, vysvětlit proč) + „Vytvořit novou akci“ (předvyplněný formulář). Přiřazení k
   návrhu jen uloží návrh; u zveřejněné akce otevře okno akce s předvyplněným tématem (běžné zveřejnění s dopadem).
   Téma s budoucím termínem: ukázat datum a odkaz na akci. Doporučení ve formuláři: priorita odpovídající skupině,
   pak skupina, pak zájem; štítky Garantované / Doporučené, počet zájemců, termín. Upozornění při nevhodné skupině.
   `suggestTopics` při doplnění měsíce preferuje garantovaná témata.
3. **F3 Příprava měsíce a formuláře** (P0/P1): přehled stavu návrhů (připraveno / chybí vedoucí / chybí téma /
   kolize / vybráno) s přechodem na řádek; hromadné doplnění vedoucího (jen prázdná pole); Přijmout/Odmítnout
   zjednodušit jen pokud nic neztratí; Pravidelný týden → „Pravidelný rozvrh“ s vysvětlením; ochrana neuložených
   změn v okně akce (zavření, Esc) jen při skutečné změně; sjednocení `select` stylu.
4. **F4 Zápisy** (P0): migrace `minutes` (recording_id/job_id NULL, `source`, `approved_version`, `approved_by`,
   `approved_at`); zdroje: nahrávka (stávající), text přepisu/poznámek, soubor .txt/.md/.vtt/.srt, ruční zápis;
   zveřejnění jen schválením vedoucím konkrétní verze; úkol vedoucímu „Dokončit zápis“; testy oprávnění.
5. **F5 Dokumenty a předání**: `docs/integrace-do-firemni-wiki.md`, `docs/podklady-pro-sper.md`, celé e2e,
   screenshoty, report `docs/report-rychle-akce-a-temata.md`, draft PR.

Stav fází se zapisuje do `docs/dalsi-session.md` (horní blok).
