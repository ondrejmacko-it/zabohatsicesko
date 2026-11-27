# Navazující relace (stav 27. 11. 2026, relace 76)

Cíl: finální opravné kolo UI PC + mobil (zadání vlastníka body 0–12, zhuštěné zadání je v promptu relace).
Implementace, ne audit. Bez merge, deploye, produkční DB, živého Googlu a Make. Screenshoty ani zadání do repa nedávat.

Větev `claude/finalni-vyladeni-ui-pc-mobil` z main `7e9b886`. PR zatím není.

## Hotovo (jen co ovlivní další krok)
- Body 1–7 HOTOVO (viz git log). Geometrie: `e2e/geometrie.spec.ts` + `lineCount()` v `e2e/support.ts`.
- Účast HOTOVO (`f4b34e5`), stav jako jedna věta vedle akce; omluva s `inFlight` ref.
- Brouček HOTOVO: překážky `.menu-list`/listbox, visualViewport, padding konce obsahu; po buildu ověřeno
  (broucek-rychle-akce, zpetna-vazba, geometrie na telefon-360/320 + windows-1280 zelené). Regresní test
  „Brouček nepřekrývá ovladače“ (menu ⋯ Správa, lišta Vybrat návrhy). „Skrýt broučka“ už je sekundární (btn-small).
- Správa: e-mail se láme jen před „@“ (`<wbr>` v `sprava/page.tsx`); karta už má jméno+e-mail / role+skupiny /
  zařízení, stav a ⋯ v `.account-side` na ose se jménem (snímek 320 prohlédnut).
- Zápisy: `.missing-summary` „N moje · M celkem.“ (nebo „Celkem M.“), badge u skupin pryč, `.missing-filter`
  nowrap (hledání+Stav v řadě); nápověda MinutesSourceForm „Nevkládej jména ani jiné údaje klientů…“.
  MinutesSourceForm už má jedno pole, TXT/MD/VTT/SRT v UTF-8 max 1 MB, detail „Jak Wiki s textem zachází“.
- HEAD `9fa0a7e`.

## Pořadí práce (jednotka = změna + cílený test + commit + push)
1. Zápisy – hlavička modalu: dlouhý název nesmí vytlačit Zavřít na nový řádek (RouteModal.tsx, ikonové zavření
   s aria-label); ověřit „Napsat ručně“ jako sekundární a audio demo skryté v MinutesSourceForm.
2. Čeština: skloňování počtů (zájemce, návrh – hledej `zájemc`, `návrh` s čísly), tykání (grep `yberte|yplňte|Zvolte`).
3. Domů: úkoly seskupit, „Další úkoly“ s počtem; karty na 320 px datum nad textem (jen pokud chybí).
4. Report `docs/report-finalni-ui-pc-mobil.md` (tabulka bodů + checklist živého ověření Účasti: připojení,
   povinná pozvánka, dobrovolná registrace, omluva, návrat, přesun, zrušení, retry, ruční host), celá sada
   (lint, tsc, vitest, build, e2e), draft PR dle šablony.

## Technika
- `npm ci`; e2e: `npx playwright test --project=prihlaseni --no-deps --trace off --reporter=line`, pak cíleně
  `--project=telefon-360 --no-deps`. e2e server jede nad buildem – po změně kódu `npx next build`.
- Známý pád: `e2e/domu-ukoly.spec.ts:40` (pozvánky bez odpovědi) – nesouvisí s větví, ověřit v celé sadě.
- NEPOUŽÍVAT prettier (repo nemá config, přeformátuje soubor). Snímky: node skript ve scratchpadu + `node e2e/server.mjs` (port 3310), storageState `e2e/.auth/*.json` po projektu prihlaseni.
- Hook kontextu: systémový prompt ~100k, limit 140k přijde po 1–2 jednotkách. Čti úzce, po jednotce commit+push.

## Otevřené otázky pro vlastníka
- Žádné blokující.
