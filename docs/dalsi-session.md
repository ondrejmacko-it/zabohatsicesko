# Navazující relace (stav 27. 11. 2026, relace 77)

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
- Hlavička okna HOTOVO (`98df081`): `.dialog-head` grid `minmax(0,1fr) auto`, ikonové Zavřít (`aria-label`, 44 px)
  v `Modal.tsx`; test „dlouhý název okna nevytlačí Zavřít“ v `e2e/geometrie.spec.ts` (320/360/1280 zelené).
  „Napsat zápis ručně“ je sekundární, audio v MinutesSourceForm není.
- Čeština HOTOVO (`8e868fb`): skloňování přeskočených návrhů (actions.ts), „pro 2 lidi“ (EventDialog),
  pole změny „Pro koho“ místo „Publikum“ (impact.ts + tests/publishing.test.ts), další UI texty bez „publikum“.
  Vykání v src nenalezeno.
- Domů: „Další úkoly (N)“ už existuje v `TasksCard.tsx`; zápisy už seskupené (`zapisy-dalsi`).

## Pořadí práce (jednotka = změna + cílený test + commit + push)
1. Domů – seskupit úkoly „Vyřešit pozvánku“: v `src/server/services/journey.ts` (~ř. 276, smyčka `stuck`) při 2+
   akcích jeden řádek „Pozvánky k vyřešení: N“ s `count` (odkaz na první akci nebo Integrace), test v tests/ nebo e2e.
   Karty na 320 px datum nad textem – ověřit snímkem, opravit jen pokud chybí.
2. Report `docs/report-finalni-ui-pc-mobil.md` (tabulka bodů + checklist živého ověření Účasti: připojení,
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
