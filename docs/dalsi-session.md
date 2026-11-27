# Navazující relace (stav 27. 11. 2026, relace 57)

Cíl: finální responzivní audit a mobilní UX (zadání vlastníka body 1–23, zhuštěně v promptu relace 47/48).
Žádný redesign desktopu, merge, deploy, produkční DB, živý Google ani Make. Na konci draft PR + report.
Větev `claude/oprava-mobilni-responzivita` z main `01db12f`, HEAD `c5cbb13` (+ tato předávka). PR zatím není.
Screenshoty vlastníka (Android ~347 px) v relaci už nejsou; pro další dialogy požádat o nové (do repa nedávat).

## Hotovo (commity, vše s cíleným e2e testem, který bez opravy padá)
- bb7a92d lišta ≤640 (grid brand+účet / role / Pohled, Menu „Účet“ v `Topbar.tsx`) – `e2e/zahlavi.spec.ts`.
  Google účet ověřen jen CSS na ukázce (uvést v PR).
- 5195ef5 + 657a248 karta agendy (čas nezalomený, štítky celé, ⋯ 44×44) – `e2e/karta-agendy.spec.ts`.
- bb7d94a filtry Plánu (≤560 flex, menší okraje Plánu) – `e2e/filtry-planu.spec.ts`.
- 9b701b6 brouček vedle quick actions – `tests/zpetna-vazba.test.ts`, `e2e/broucek-rychle-akce.spec.ts`.
- 4aed6d4 velká okna ≤640 přes celou obrazovku, závoj 60 % – `e2e/okno-akce.spec.ts` („prosvítání“ = okraj).
- b43def2 texty účasti bez rodu (`ParticipationPanel.tsx`); b4d1f1c radio omluvy – `e2e/okno-omluvy.spec.ts`.
- 0b3e8f1 pás stavu okna – `e2e/pas-stavu.spec.ts`; c81ca59 mimořádný den = `.notice` – `e2e/mimoradny-termin.spec.ts`.
- b8f0ede Pohled = `Combobox selectOnly` (no-JS tlačítko Zobrazit pryč – uvést v PR) – `e2e/pohled-vyber.spec.ts`,
  helper `choosePreview`.
- c5cbb13 okno akce: Vede, Pro koho, Kdo zkontroluje zápis = `Combobox selectOnly` (div.field + label htmlFor,
  „Jen vedoucí“ = value ""), helper `chooseOption(scope, label, {value}|{label})` v `e2e/support.ts` –
  `e2e/okno-akce-vyber.spec.ts`. Typ zůstává nativní select.

## Ověřeno (c5cbb13)
- okno-akce-vyber, priprava-mesice, temata-planovani, pristupnost, okna, okno-akce, mimoradny-termin, pas-stavu,
  mobilni-ovladani na windows-1280 + telefon-390/320: 185 OK; rychle-akce, vyber-kontext, kdo-tema,
  plan-planovani 30 OK; temata-planovani + vyber-navrhu v `zapis-temat` 4 OK. tsc, eslint OK.
- Celá sada naposledy jen na main (1475 OK, Vitest 628/628) – před PR spustit celou.

## Technika
- `npm ci`; Playwright si server spustí sám (build + 3310/3311/3313). Před `--no-deps` nejdřív
  `npx playwright test --project=prihlaseni --no-deps --trace off --reporter=line`.
- Cíleně: `npx playwright test e2e/<soubor> --project=telefon-390 --no-deps --trace off --reporter=dot`.
  Zápisové testy témat jen v projektu `zapis-temat`. Mobilní CSS = bloky na konci `src/app/globals.css`.

## Další krok
1. Téma v okně akce na 347 px: input má clientWidth jen 236 px (scrollWidth 402 u dlouhého názvu). Zjistit proč
   (form-grid, padding, sloupec?), na ≤640 dát poli celou šířku těla okna; test šířka pole ≥ 85 % `.dialog-body`.
   Případně Typ (`EventDialog.tsx` ~ř. 371) taky na Combobox selectOnly.
2. Domů + oslovení do účtu (Menu „Účet“ v `Topbar.tsx`; „Upravit oslovení“ teď pod pozdravem na Domů).
3. Bod 5: audit ostatních obrazovek, desktop regrese, celá sada, před/po screenshoty, draft PR + report.

## Otevřené otázky pro vlastníka
- Odsazení na telefonu (shell 12 + panel 16 + sekce 14 = 42 px/stranu) zúženo jen na Plánu – srovnat globálně?
  „Vybrat návrhy“ přesunout do nabídky Filtry?
- Velká okna přes celou obrazovku (4aed6d4) – vyhovuje, nebo bottom sheet?
- „Kalendář: stav neznámý“ (`src/lib/calendar-note.ts`, osobní režim / allowlist) – pravdivá věta je doménové
  rozhodnutí vlastníka; zatím beze změny.
- Oddělení osobní účasti od editace v okně akce (EventPeek → kompaktní detail + „Upravit akci“) – návrh předložit.
