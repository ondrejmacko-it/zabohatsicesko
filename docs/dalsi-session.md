# Navazující relace (stav 27. 11. 2026, relace 58)

Cíl: finální responzivní audit a mobilní UX (zadání vlastníka body 1–23, zhuštěně v promptu relace 47/48).
Žádný redesign desktopu, merge, deploy, produkční DB, živý Google ani Make. Na konci draft PR + report.
Větev `claude/oprava-mobilni-responzivita` z main `01db12f`, HEAD `c304fa1` (+ tato předávka). PR zatím není.
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
  `e2e/okno-akce-vyber.spec.ts`.
- e88847b velké okno ≤640: okraj těla 12, `.form-main` 10 px → Téma 86 % šířky – `e2e/okno-akce-sirka.spec.ts`.
- c304fa1 Typ v okně akce = Combobox selectOnly; testy volí Typ přes `chooseOption` (okna, vyber-kontext,
  pristupnost, temata-planovani). V okně akce už žádný nativní select.

## Ověřeno (c304fa1)
- okno-akce-*, okna, pas-stavu, mobilni-ovladani, okno-omluvy, pristupnost, vyber-kontext, mimoradny-termin,
  klavesnice, priprava-mesice, rychle-akce, plan-planovani, temata-planovani (+ zapis-temat) na windows-1280
  a telefon-390/320 OK. tsc, eslint OK. Prettier v repu nevynucován (globals.css nepřeformátovávat).
- Celá sada (Vitest + Playwright) spuštěna v relaci 58 na c304fa1; výsledek v relaci 59 ověřit znovu, pokud chybí zde.

## Technika
- `npm ci`; Playwright si server spustí sám (build + 3310/3311/3313). Před `--no-deps` nejdřív
  `npx playwright test --project=prihlaseni --no-deps --trace off --reporter=line`.
- Cíleně: `npx playwright test e2e/<soubor> --project=telefon-390 --no-deps --trace off --reporter=dot`.
  Zápisové testy témat jen v projektu `zapis-temat`. Mobilní CSS = bloky na konci `src/app/globals.css`.

## Další krok
1. Bod 5: krátký audit ostatních obrazovek na 347 px (jen nálezy, malé opravy), před/po screenshoty do
   scratchpadu (ne do repa), draft PR podle `.github/pull_request_template.md` + report vlastníkovi.
   Do PR: Google účet v liště ověřen jen CSS; no-JS Zobrazit u Pohledu pryč; simulace vs. živý test.

## Otevřené otázky pro vlastníka
- Odsazení na telefonu (shell 12 + panel 16 + sekce 14 = 42 px/stranu) zúženo jen na Plánu – srovnat globálně?
  „Vybrat návrhy“ přesunout do nabídky Filtry?
- Velká okna přes celou obrazovku (4aed6d4) – vyhovuje, nebo bottom sheet?
- „Kalendář: stav neznámý“ (`src/lib/calendar-note.ts`, osobní režim / allowlist) – pravdivá věta je doménové
  rozhodnutí vlastníka; zatím beze změny.
- Oddělení osobní účasti od editace v okně akce (EventPeek → kompaktní detail + „Upravit akci“) – návrh předložit.
- Domů + oslovení do účtu: `SalutationForm` je dle komentáře záměrně pod pozdravem (D03, zamčený v náhledu
  D4 1:1). Přesunout do Menu „Účet“, nebo jen přidat odkaz? Co přesně znamená „Domů do účtu“? Zatím beze změny.
