# Finální kontrola a nový PR – report (relace 1 a 2)

Zadání: „ZBČ – Finální kontrola, dokončení oprav a příprava nového PR“ (od uživatele 19. 11. 2026, do repa se nedává).
Relace 1: větev `claude/focused-cerf-gr1tdi`. Relace 2: větev `claude/finalni-kontrola-novy-pr-g2r2wd` (= opravná větev + merge main `e27b631`, bez konfliktů). Nic nemergnuto, nic nenasazeno, produkční data jen čtena (SELECT).

## 1. Inventura stavu (ověřeno 19. 11. 2026)

* `origin/main` = `e27b631` (merge PR #73). Strom `e27b631` je shodný s `ff7ac54` (`git diff` prázdný).
* Opravná větev `7de75e0`, merge-base s main `ff7ac54`, 37 commitů navíc (74 souborů, +2475/−575). Konflikty s main
  nejsou (main nemá nic navíc). Pracovní strom čistý. Otevřený PR z větve neexistuje (open PR: 0).
* Vercel projekt `zbc-vzdelavani-demo` (tým `maci`): produkce = `dpl_2srWXKNxJ1muz4z3jSKUQtePQgBJ`, `main` `e27b631`,
  READY, 2026-11-19 07:46 UTC. Preview nasazuje i opravnou větev (poslední `7de75e0`, READY). Vercel MCP projekt
  nevidí (jiný rozsah), čteno přes read-only REST API.

## 7. Migrace a databáze (jen čtení)

| Neon projekt | Role | 0013 / 0014 | Zápisy (`minutes`) |
|---|---|---|---|
| `bitter-breeze-02749976` `zbc-wiki-produkce` | produkce | **proběhly** 2026-11-19 07:47:25 UTC (start po deploy `e27b631`) | **0 řádků** → riziko skrytí schválených zápisů (`approved_version`) v produkci nevzniklo |
| `still-shadow-86247101` `neon-zbz-vzdelavani-demo` | Preview / ukázka | proběhly 2026-11-18 21:05 UTC | 1 návrh (`draft`, bez schválení) |

* Produkce: 15 témat, **3 garantovaná** (nearchivovaná s `priority_rank`), 112 akcí, „NJBJK“ 0×.
* Chyby startu migrací v runtime logu: zatím neověřeno (další relace: `get_runtime_logs` nebo REST, deploy `dpl_2srW…`).
* Neon produkce jednou vrátil 401 a při opakování odpověděl – přechodné, ne oprávnění.

## 10. „NJBJK“ (jen čtení)

* Jen v demo DB `still-shadow-86247101`: `topic-7e7bab00-…`, `org_id` `zbc-demo`, publikum `fp`, navrhl `demo-ucastnik`
  12. 11. 2026 17:50 UTC, nearchivované, bez priority, **2 zájemci**, **1 zveřejněná akce** `ev-abe4fb33-…` (11. 12. 2026
  07:30 UTC). Ukázkový záznam zadaný ručně přes UI. Smazání by se dotklo zájmu a zveřejněné akce (a případně pozvánek
  v simulaci) – návrh vyčištění v další relaci, nic se nemaže bez souhlasu.

## Relace 2: provedené změny

| Bod | Změna | Proč / přínos | Ověření |
|---|---|---|---|
| 4A | `minutesDraftSchema` (Shrnutí smí být prázdné, limity stejné), `updateMinutes` ho používá; nová chyba `minutes_invalid`. Schválení dál vyžaduje `minutesSchema`. Akce Schválit bez Shrnutí odmítne dřív, než cokoli uloží. | Dřív nešel uložit návrh jen s Hlavními body (`minutes_incomplete`), vedoucí přišel o rozepsanou práci. Neúplný zápis zveřejnit nejde. | unit `zapisy-schvaleni` (nový blok 4A–4C), `recordings` |
| 4B | Beze změny kódu, doplněn test: A schválené, B nová verze, neúspěšné uložení B, souběžná úprava B (konflikt), publikum do schválení B čte A, A zůstane v DB jako historie. | Ověření požadavku. | unit |
| 4C | `approveMinutes` zamyká řádek akce (`FOR UPDATE`) a v transakci ověří, že schvalovaný zápis je pořád aktuální. Stejný zámek dostal zápis z nahrávky (`processTranscriptionJob`). | Prokázaný souběh: kontroly běžely před transakcí, takže zdroj nahrazený mezi kontrolou a zápisem vedl ke zveřejnění zastaralé verze. Reprodukční test bez opravy selže (`ok` místo `conflict`). | unit (reprodukce) |
| 2 | `ActionForm` s potvrzením používá `ConfirmDialog` místo pracovního `Modal`. `ConfirmDialog`: `urgent` (role `alertdialog` jen u ztráty dat: neuložené změny, nahrazení zápisu, smazání návrhů, nebezpečné akce), jinak `dialog` (zveřejnění, vytvoření); `busy` (během odesílání Esc ani klik mimo nezavřou); návrat fokusu i ze zavřeného menu. Zpět první s fokusem, nebezpečná volba vpravo; chyba serveru zůstane v potvrzení. | Dřív potvrzení z `ActionForm` vypadalo jinak a schovalo okno pod sebou (např. Zahodit změny v náhledu akce), chyba se mohla ukázat ve skrytém menu. | e2e `priprava-mesice` (fokus, Esc jen potvrzení, okno zůstane), `okna` (role) |
| 3 | `Combobox` má neřízený režim (`defaultValue`, `inputProps`); `PrepareMonthDialog` ho používá místo `<datalist>`. Výběr zapíše hodnotu do DOM pole a vyvolá `input`, takže přehled mezer, Změnit u doporučení, Přijmout/Odmítnout a dotaz na neuložené změny fungují beze změny; po chybě serveru hodnoty zůstanou (`submitKeepingValues`). | Jednotný vzhled a ovládání výběru témat. | e2e: diakritika, Enter, Esc jen nabídka, ruční text, Tab, poslední řádek ve viewportu, neuložené změny (1280 i 320) |
| 5 | Seznam témat: u správce „Nastaveno N ze 3.“ a „bez termínu“ u garantovaného tématu bez budoucí akce. | Garantované ≠ naplánované; správce vidí nezařazené téma. Nic se nedoplňuje ani nezveřejňuje samo. | e2e `temata-planovani` |

### Zjištění bez změny kódu

* **Bod 5:** max. 3 priority (server `priority_full`), pořadí přetažením i šipkami, zájemci jen informativní, naplánované
  téma se znovu nedoporučuje (`isRecommendable` → `!nextPlanned`). Archivace prioritu zruší (obnova ji nevrací), historie
  akcí zůstává. Třetí garantované téma se nezakládá. Návrh do budoucna: úkol správce „Garantované téma nemá termín“ v
  `listTasks` vedle „Nastavte garantovaná témata“ (vyžaduje souhlas, nová logika úkolů).
* **Bod 6 (AM/PM):** Playwright i `scripts/audit-screenshoty.mjs` mají `locale: "cs-CZ"`. Nativní `date`/`time` pole
  v Chromiu ale formátuje podle jazyka prohlížeče/OS, ne podle `navigator.language`; kontejner nemá `LANG` (en-US),
  proto snímky ukazují 11/18/2026 a AM. V českém prohlížeči se ukáže dd.mm.rrrr a 24 h. Vlastní datepicker se
  nepřidává. **Neověřeno** na skutečném českém Windows/macOS/iOS.
* **Bod 4D (PDF/DOCX) – návrh, neimplementováno:** DOCX = ZIP + XML, šlo by bez knihovny jen pro text (`word/document.xml`),
  riziko zip-bomb → limit rozbalené velikosti (např. 5 MB) a počtu položek; PDF vyžaduje parser (`pdfjs-dist`, ~2 MB,
  běh v Node bez canvasu), skenované PDF bez OCR nic nevrátí. Obojí: jen text, soubor se neukládá (stejně jako TXT),
  limit 1 MB vstupu ponechat, parsování v časovém limitu, žádné makro/externí odkazy. Odhad: DOCX 0,5 dne, PDF 1–1,5 dne
  včetně testů. Doporučení: nejdřív DOCX.
* **Bod 9:** změny nemění oprávnění (`canApproveMinutes`, `requireHandledEvent` beze změny), nepřidávají veřejné
  odkazy, logy ani pozvánky. Nová chybová hláška neobsahuje data. Zámek akce prodlužuje transakci schválení o jeden
  `SELECT … FOR UPDATE`.
* **Drobnost mimo rozsah:** úprava neaktuálního návrhu v úzkém okně souběhu (nahrazení zdroje mezi kontrolou a
  `UPDATE`) zapíše do starší verze, která zůstane v historii; nic se nezveřejní ani neztratí.

### Neprovedeno / otevřené

* Bod 7: runtime logy produkce kolem startu migrací (07:46–07:50 UTC) nepřečteny. Rollback: Neon branch/PITR z času
  před 07:47:25 UTC 19. 11. (produkce měla 0 zápisů, migrace 0013/0014 jsou aditivní; návrat kódu = revert merge PR #73
  v novém PR, sloupce mohou zůstat). Doporučení: migrace jako samostatný krok nasazení, ne při startu (DEP-01).
* Bod 10: „NJBJK“ nesmazáno. Návrh: v demo DB smazat zájem (2), téma a zveřejněnou akci jen se souhlasem, nebo akci
  zrušit a téma archivovat (zachová audit). Dlouhodobě: samostatná Neon DB/branch pro prezentaci s resetovaným seedem.
* Firefox a WebKit: v kontejneru nejsou nainstalované, **neověřeno** (WebKit jde na Macu přes `E2E_WEBKIT=1`).

### Testy relace 2 (kód na `6166c3a`, poté jen dokumentace)

Lint OK, typecheck OK, unit **398/398**, build OK, **celé e2e 1169 passed / 111 skipped / 0 failed** (6,7 min; Chromium
1280/1920/1440/1512, telefon 390/360/320, `locale cs-CZ`, axe v `pristupnost`). Přeskočené testy jsou záměrné
(`@desktop` na telefonech, zápisové scénáře jen na jednom projektu). Firefox a WebKit neověřeny (nejsou nainstalované).
Google Kalendář jen v simulaci, žádné skutečné pozvánky.
