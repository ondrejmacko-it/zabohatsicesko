# Navazující relace (stav 27. 11. 2026, relace 71)

Cíl: finální opravné kolo UI PC + mobil (zadání vlastníka „ZBČ – finální UX/UI a funkční stabilizace“,
body 0–12). Implementace, ne audit. Desktop i mobil stejně důležité; vzdušně, nezahušťovat, zachovat identitu Wiki.
Bez merge, deploye, produkční DB, živého Googlu a Make. Screenshoty ani zadání do repa nedávat.

Větev `claude/finalni-vyladeni-ui-pc-mobil` z main `7e9b886` (PR #95 už je v main). PR zatím není.
Zadání (64 KB) a 82 screenshotů nejsou v repu; zhuštěný seznam bodů je v promptu navazující relace.

## Hotovo (HEAD `2bfc009`, pushnuto)
- Body 1–3 HOTOVO a ověřené e2e. `e2e/geometrie.spec.ts` + helper `lineCount()` v `e2e/support.ts` – sem geometrické regrese.
- Bod 4 Náhled role HOTOVO: `9eeea4b` (přesměrování po přepnutí, jeden pruh), `4e82546` – menu Účet na každé
  šířce (jméno, role, oslovení `SalutationForm`, Odhlásit; samostatné Odhlásit v liště pryč), na Domů jen pozdrav
  (chybné uložení oslovení se vrátí na Domů s polem `osloveni-oprava`), v náhledu „Skutečný účet“ a oslovení se
  nenabízí. Pozdrav už oslovuje zobrazenou osobu. e2e osloveni, zahlavi, nahled, nahled-role (1280, 360) zelené.
- Bod 5 Plán HOTOVO: `3d518b3` („Změna vedoucího a skupiny“), `2bfc009` – „Dnes“ přesunuto do `.month-nav`,
  čas akce přes `EventTime` v `Schedule.tsx` (nowrap půlek, zalomení jen u „ – “). Filtr účasti 4 / 2×2 už platil
  (regresní test). Plovoucí +/⋯ (`QuickActions.tsx`) se už skrývá při viditelné liště, modalu, přesunu i výběru.
  e2e `geometrie.spec.ts -g Plán` zelené na telefon-320 a windows-1280.
- Zbývá z bodu 8 (Zápisy): hlavička „Zápisy k dokončení · N moje · M celkem“, hledání+Stav v jedné liště,
  MinutesSourceForm (jedno pole, TXT/MD/VTT/SRT max 1 MB, nápověda o klientech), sdílená hlavička modalu.
- Známý pád: `e2e/domu-ukoly.spec.ts:40` (pozvánky bez odpovědi) padá i samostatně – úkol pozvánek chybí
  (`invitationsFor` potřebuje calendarLinks s externalEventId ze sync). Nesouvisí se změnami větve; ověřit v celé sadě.

- Bod 6 ROZDĚLANÝ `b9f7352` (tsc zelené, e2e NEověřené): `EventPeek` má `edit`/`editHref`; správce bez
  `upravit=1` vidí čtecí okno (fakta, účast, „Upravit akci“ + `EventMenu` ⋯ s „Otevřít podrobnosti“), s `upravit=1`
  nebo `tema=` formulář. Plán: `editHref` (nabídka Upravit), detail/zápisy/témata/ChangeBanner deeplinky s `&upravit=1`.

## Pořadí práce (jednotka = změna + cílený test + commit + push)
6a. PRVNÍ: upravit e2e, které jako správce klikají na kartu/`?akce=` a čekají formulář (grep `akce=` v e2e:
   okna, okno-akce-*, rychle-akce, vyber-navrhu, plan-planovani, temata-planovani, mimoradny-termin, priprava-mesice,
   klavesnice, mobilni-ovladani, kdo-tema, zapisy, domu-ukoly, nahled, ucast-karta, okno-omluvy) → přidat
   `&upravit=1` nebo klik na „Upravit akci“. `okna.spec.ts:420–448` čeká „Technické informace“ → „Otevřít podrobnosti“
   v ⋯. Spustit cíleně windows-1280 + telefon-360, pak lint (`npx eslint <soubory>`).
6. Detail akce (zbytek): kompaktní čtecí detail i pro správce + „Upravit akci“; účast hned po metadatech;
   editace: typ+název nahoře, Další údaje neskrývají základ; mobilní footer 2 rovnocenné akce.
7. Přidat akci: sjednotit s editací, „Doporučená témata“, bez číslovaných gigantických karet.
8. Účast: stav jako jedna věta + akce vpravo; „Kalendář: stav neznámý“ → neutrální pravdivý text.
9. Brouček: společná bezpečná zóna s plovoucím panelem/hromadným výběrem (rozšířit `BugButton`).
10. Správa: karty kolegů (e-mail nezalamovat uprostřed domény). Zbytek bodu 8 Zápisy. Čeština (skloňování počtů).
11. Report `docs/report-finalni-ui-pc-mobil.md`, celá sada testů, draft PR.

## Technika
- `npm ci`; e2e: nejdřív `npx playwright test --project=prihlaseni --no-deps --trace off --reporter=line`,
  pak cíleně `--project=telefon-360 --no-deps`. Projekty: windows-1280/1920, macos-1440/1512, telefon-390/360/320.
- Mobilní CSS = bloky na konci `src/app/globals.css` (5453 ř.); nepřidávat další override blok, opravovat u zdroje.
- Hook kontextu: systémový prompt je velký (~100k), limit 140k přichází po ~1 jednotce – čti úzce, výstupy
  zkracuj, po každé jednotce commit+push a při 140k rovnou předávka. Celé zadání je v promptu relace 60/61.

## Otevřené otázky pro vlastníka
- Dodat zadání a screenshoty do navazující relace znovu (ZIP), pokud bude potřeba vizuální reference.
