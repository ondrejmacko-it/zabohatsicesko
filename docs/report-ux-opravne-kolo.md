# Opravné kolo UX/UI k PR #73 – průběžný report (relace 1)

Větev `claude/focused-cerf-gr1tdi` z HEAD PR #73 (`ff7ac54`, shodné s referenčním commitem screenshotů).
Zadání: `ZBC_KOMPLETNI_PROMPT_CLAUDE_CODE_PR73.md` (u uživatele, do repa se nedává). Relace skončila na limitu
kontextu, proto je hotová jen první skupina (P0 + základ potvrzovacích oken). Nic není mergnuto ani nasazeno.

## Stav nálezů

| ID | Stav | Co a kde |
|---|---|---|
| Z-01 | **Opraveno** | `updateMinutes` (`src/server/services/recordings.ts`): úprava zveřejněného zápisu založí nový řádek `minutes` jako návrh (verze +1), schválený řádek zůstane `published`. Bez migrace. Kopie zápisu z nahrávky má zdroj `transcript` (UNIQUE `job_id`). Zámek akce + kontrola verze proti souběhu, audit `minutes.edit_published`. Test `tests/zapisy-schvaleni.test.ts`, e2e `e2e/zapisy-schvaleni.spec.ts` (čtenář dál vidí schválený text). |
| Z-02 | **Opraveno** | `createMinutesDraft`: žádné `tx.delete`, nahrazený návrh zůstává v DB jako starší verze. Návrh s obsahem server nahradí jen s `confirmReplace` (jinak `replace_unconfirmed`). UI: `ConfirmDialog` „Nahradit rozepsaný zápis?“ v `MinutesSourceForm`. |
| Z-14 | **Opraveno** | Banner `dialog-confirm` uvnitř `Modal` nahrazen samostatným `ConfirmDialog` (nativní `<dialog>` ve vrchní vrstvě, `alertdialog`, `aria-labelledby/-describedby`, Esc/klik mimo = pokračovat, návrat fokusu). Volby: Pokračovat v úpravách / Uložit jako návrh (jen když formulář obsahuje `data-confirm-save` a je platný) / Zahodit změny. |
| S-01 | **Opraveno** | `EventPeek.tsx`: pás stavu bere tón z `primaryStatus` (`status-danger`, `status-attention`), chyba Kalendáře není zelená. Bez e2e screenshotu. |
| Z-03 | **Opraveno** | `.source-list` 2 × 2, ≤ 560 px jeden sloupec. Neověřeno screenshotem. |
| DEP-01 | Blokováno (rozhodnutí uživatele) | Migrace 0013/0014 dál běží automaticky při startu. Před merge: staging, záloha Neonu, kontrola schválených zápisů. Tato relace schéma nemění. |
| Ostatní (A-01–A-14, T-01–T-11, Z-04–Z-13, C-01–C-08, combobox témat, impact/incomplete potvrzení v `EventDialog`, `PlanSelection`) | Zatím neřešeno | Pořadí a plán v `docs/dalsi-session.md`. |

## Ověření (skutečně spuštěno v této relaci)

* typecheck OK, lint OK, unit **381/381** (vitest, celá sada).
* e2e `priprava-mesice` + `zapisy-schvaleni` (windows-1280): 11 testů, po úpravě očekávání Z-01 vše prošlo;
  `zapisy-schvaleni` + `zapisy` + `okna` na windows-1280 a telefon-390: 62 passed / 1 skipped.
* build OK.
* NEOVĚŘENO: celé e2e, screenshoty před/po, Firefox/WebKit, Preview, živý Kalendář.

## Změněná pravidla (pro integraci do Wiki)

* Úprava schváleného zápisu už neruší zveřejnění. Stažení dělá jen „Stáhnout zápis“ (`withdrawMinutes`).
* Nahrazení rozepsaného zápisu s obsahem vyžaduje `confirmReplace=on` (server).
