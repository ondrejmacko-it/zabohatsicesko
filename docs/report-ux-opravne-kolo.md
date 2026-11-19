# Opravné kolo UX/UI k PR #73 – průběžný report (po relaci 3)

Větev `claude/focused-cerf-gr1tdi` z HEAD PR #73 (`ff7ac54`, shodné s referenčním commitem screenshotů).
Zadání: `ZBC_KOMPLETNI_PROMPT_CLAUDE_CODE_PR73.md` (u uživatele, do repa se nedává). Relace končí na limitu
kontextu, práce pokračuje v navazující relaci. Nic není mergnuto ani nasazeno.

## Stav nálezů

| ID | Stav | Co a kde |
|---|---|---|
| Z-01 | **Opraveno** | `updateMinutes` (`src/server/services/recordings.ts`): úprava zveřejněného zápisu založí nový řádek `minutes` jako návrh (verze +1), schválený řádek zůstane `published`. Bez migrace. Kopie zápisu z nahrávky má zdroj `transcript` (UNIQUE `job_id`). Zámek akce + kontrola verze proti souběhu, audit `minutes.edit_published`. Test `tests/zapisy-schvaleni.test.ts`, e2e `e2e/zapisy-schvaleni.spec.ts` (čtenář dál vidí schválený text). |
| Z-02 | **Opraveno** | `createMinutesDraft`: žádné `tx.delete`, nahrazený návrh zůstává v DB jako starší verze. Návrh s obsahem server nahradí jen s `confirmReplace` (jinak `replace_unconfirmed`). UI: `ConfirmDialog` „Nahradit rozepsaný zápis?“ v `MinutesSourceForm`. |
| Z-14 | **Opraveno** | Banner `dialog-confirm` uvnitř `Modal` nahrazen samostatným `ConfirmDialog` (nativní `<dialog>` ve vrchní vrstvě, `alertdialog`, `aria-labelledby/-describedby`, Esc/klik mimo = pokračovat, návrat fokusu). Volby: Pokračovat v úpravách / Uložit jako návrh (jen když formulář obsahuje `data-confirm-save` a je platný) / Zahodit změny. |
| S-01 | **Opraveno** | `EventPeek.tsx`: pás stavu bere tón z `primaryStatus` (`status-danger`, `status-attention`), chyba Kalendáře není zelená. Bez e2e screenshotu. |
| Z-03 | **Opraveno** | `.source-list` 2 × 2, ≤ 560 px jeden sloupec. Neověřeno screenshotem. |
| DEP-01 | Blokováno (rozhodnutí uživatele) | Migrace 0013/0014 dál běží automaticky při startu. Před merge: staging, záloha Neonu, kontrola schválených zápisů. Tato relace schéma nemění. |
| Potvrzení v okně akce a výběru | **Opraveno** (e1a463f) | `EventDialog`: „Zveřejnit bez tématu a vedoucího?“ a „Zveřejnit změny?“ (dopad) v `ConfirmDialog` místo lišty `confirm-bar` ve formuláři. `PlanSelection`: zveřejnit/smazat vybrané v `ConfirmDialog`. Důkaz: e2e `okna.spec.ts` (Zpět k úpravám nic nezmění, fokus zpět na Zveřejnit, Esc zavře jen potvrzení), 1280/390/320. |
| Combobox témat | **Opraveno** (f1a4cea, b1968e5) | `src/components/Combobox.tsx` (ARIA combobox + listbox, skupiny Doporučená/ostatní, filtr bez diakritiky, šipky/Enter/Esc, klik jen otevírá) v `EventDialog` místo `<datalist>`. Název akce `autoComplete="off"`. Důkaz: e2e `okna.spec.ts` „nabídka tématu“, `priprava-mesice.spec.ts` (Esc nejdřív zavře nabídku), 1280 + 320. `PrepareMonthDialog` si záměrně nechává `<datalist>` (tabulka nekontrolovaných polí, Změnit maže pole v DOM, bez skupin) – lze převést později. |
| A-01 | **Opraveno** (c47960d) | ⋯ karty vždy viditelné, 36 × 32 px s rámečkem `--line`, dotyková plocha ~44 × 44 (pseudo-prvek), bez `opacity:.6`, rozměr karet beze změny. Důkaz: e2e `rychle-akce.spec.ts` „⋯ a + v mřížce“ (velikost, opacity 1), screenshot 1280/390 prohlédnut. |
| A-08 | **Opraveno** (c47960d) | `Menu.tsx`: tlačítko v levé půlce okna → menu zarovnané k levé hraně, jinak k pravé, vždy v okně. Důkaz: stejný e2e (první a poslední ⋯). |
| A-02 | **Opraveno** (c47960d) | `.addDay` v prázdném dni opacity .35, při najetí/fokusu 1, ve dni s akcemi dál skryté. Důkaz: e2e (únor 2027, opacity 0,35). |
| A-05, A-06 | **Opraveno** (b76bd1a) | Příjemci pozvánky přímo pod „Pro koho“ (`audienceField`), „Další údaje“ jeden řádek v plné šířce oddělený čarou, bez druhého rámečku. Screenshot 1280/320 prohlédnut; e2e okna/priprava-mesice/rychle-akce/klavesnice/pristupnost 152 passed. Název v plánu u typu ≠ Jiná akce zůstal v Dalších údajích (vlastní název zachován). |
| A-10 | **Již v pořádku** (test b76bd1a) | Technické informace a stav Kalendáře dostává jen správce (`detail.sync` jen `isOrganizer`). Důkaz: e2e `okna.spec.ts` „technické informace jen pro správu“ (vedoucí, účastník RM: 0×; správce: ano). V nabídce okna správce odkaz zůstává (A-09/A-11 neřešeno). |
| T-01 | Rozpracováno (5d7886a) | Server hotový: `moveInOrder(ids, id, cílová pozice)`, `moveTopic(viewer, id, pozice, expected)` – kontrola souběhu (`conflict`, nic se nezapíše), garantovaná drží čísla priorit, skupina se nemění, audit `topic.move_to`; `moveTopicAction` bere `to` + `expected`. Unit `tests/temata-priority.test.ts` (382/382). **Chybí UI přetažení** (úchyt, pointer events, rollback). |
| A-03, A-04, A-07, A-09, A-11–A-14, T-02–T-11, Z-04–Z-13, C-01–C-08 | Zatím neřešeno | Pořadí v `docs/dalsi-session.md`. |

## Ověření (skutečně spuštěno v této relaci)

* typecheck OK, lint OK, unit **381/381** (vitest, celá sada).
* e2e `priprava-mesice` + `zapisy-schvaleni` (windows-1280): 11 testů, po úpravě očekávání Z-01 vše prošlo;
  `zapisy-schvaleni` + `zapisy` + `okna` na windows-1280 a telefon-390: 62 passed / 1 skipped.
* build OK.
* Relace 3: typecheck OK, lint OK, unit **382/382**; e2e (1280 + 320/390) okna, priprava-mesice, temata-planovani,
  pristupnost, klavesnice: 98 passed / 4 skipped; rychle-akce, mobilni-ovladani, klavesnice, pristupnost, plan-planovani:
  55 passed / 19 skipped; okna, priprava-mesice, rychle-akce, klavesnice, pristupnost, kdo-tema, doporucene-tema:
  152 passed / 9 skipped; temata-planovani (1280) 10 passed. Build v relaci 3 nespuštěn.
* NEOVĚŘENO: celé e2e, screenshoty před/po, Firefox/WebKit, Preview, živý Kalendář.

## Změněná pravidla (pro integraci do Wiki)

* Úprava schváleného zápisu už neruší zveřejnění. Stažení dělá jen „Stáhnout zápis“ (`withdrawMinutes`).
* Nahrazení rozepsaného zápisu s obsahem vyžaduje `confirmReplace=on` (server).
* `moveTopicAction` přijímá i `to` (cílová pozice ve skupině) a `expected` (pořadí, které správce viděl); při rozdílu `conflict`.
