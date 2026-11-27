# Navazující relace (stav 27. 11. 2026, relace 59)

Cíl: finální responzivní audit a mobilní UX (zadání vlastníka body 1–23). **Hotovo**, draft PR otevřen.
Žádný redesign desktopu, merge, deploy, produkční DB, živý Google ani Make.
Větev `claude/oprava-mobilni-responzivita` z main `01db12f`, poslední kód `c2ee85d`. Draft PR #95.

## Hotovo
- Všechny opravy bodů 1–23 + audit 347 px (Domů, Plán, Zápisy, Témata, Integrace, Správa; správce a účastník FP).
- c2ee85d: Zpětná vazba v menu na ≤900 px bez oddělovače svislého menu, ≤640 px písmo 13 px –
  `e2e/menu-telefon.spec.ts` (bez opravy padá). Jiné nálezy audit nenašel.
- Popis PR obsahuje opravy, testy, vědomé změny (no-JS Zobrazit u Pohledu pryč, Google účet ověřen jen CSS)
  a otevřené otázky. Před/po screenshoty jen ve scratchpadu relace 59 (ne v repu).

## Ověřeno (c2ee85d)
- ESLint, `tsc` OK, Vitest 629/629, Playwright 1526 OK / 546 skipped / 0 failed.

## Technika
- `npm ci`; před `--no-deps` nejdřív `npx playwright test --project=prihlaseni --no-deps --trace off --reporter=line`.
- Mobilní CSS = bloky na konci `src/app/globals.css`.

## Další krok
- Čeká se na vlastníka: kontrola Preview, odpovědi na otázky, převedení z draftu a ruční merge.
- Reagovat na review/CI v PR; jinak nic nezačínat.

## Otevřené otázky pro vlastníka
- Odsazení na telefonu (42 px/stranu) zúženo jen na Plánu – srovnat globálně? „Vybrat návrhy“ do nabídky Filtry?
- Velká okna přes celou obrazovku – vyhovuje, nebo bottom sheet?
- „Kalendář: stav neznámý“ (`src/lib/calendar-note.ts`) – pravdivá věta je rozhodnutí vlastníka.
- Oddělení osobní účasti od editace v okně akce (kompaktní detail + „Upravit akci“) – návrh předložit.
- Oslovení (`SalutationForm`, D03) do Menu „Účet“, nebo jen odkaz? Co znamená „Domů do účtu“?
