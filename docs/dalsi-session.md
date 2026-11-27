# Navazující relace (stav 27. 11. 2026, relace 68)

Cíl: finální opravné kolo UI PC + mobil (zadání vlastníka „ZBČ – finální UX/UI a funkční stabilizace“,
body 0–12). Implementace, ne audit. Desktop i mobil stejně důležité; vzdušně, nezahušťovat, zachovat identitu Wiki.
Bez merge, deploye, produkční DB, živého Googlu a Make. Screenshoty ani zadání do repa nedávat.

Větev `claude/finalni-vyladeni-ui-pc-mobil` z main `7e9b886` (PR #95 už je v main). PR zatím není.
Zadání (64 KB) a 82 screenshotů nejsou v repu; zhuštěný seznam bodů je v promptu navazující relace.

## Hotovo (HEAD `9eeea4b` + předávka, pushnuto)
- Body 1–3 HOTOVO a ověřené e2e (temata-planovani, temata-hledani, geometrie, stranky: windows-1280 + telefon-360).
  `e2e/geometrie.spec.ts` + helper `lineCount()` v `e2e/support.ts` – sem přidávej geometrické regrese.
- Zbývá z bodu 8 (Zápisy): hlavička „Zápisy k dokončení · N moje · M celkem“, hledání+Stav v jedné liště,
  MinutesSourceForm (jedno pole, TXT/MD/VTT/SRT max 1 MB, nápověda o klientech), sdílená hlavička modalu.
- Bod 4 Náhled role ČÁSTEČNĚ (`9eeea4b`): `src/lib/preview-landing.ts` (+ `tests/preview-landing.test.ts`) –
  `startPreview` po přepnutí vede ze Správy/Integrací (zobrazený není správce) na Domů, z detailu akce na Plán,
  zavře okna (ponechá jen filtrové parametry). Pruh: „Náhled: X · jen ke čtení“ + „Ukončit náhled“, bez seznamu
  stránek; EventPeek už „jen ke čtení“ neopakuje. e2e nahled, pohled-vyber, nahled-role (1280, 360) zelené.
- Známý pád: `e2e/domu-ukoly.spec.ts:40` (pozvánky bez odpovědi) padá i samostatně – úkol pozvánek chybí
  (`invitationsFor` potřebuje calendarLinks s externalEventId ze sync). Nesouvisí se změnami větve
  (page.tsx změněn jen v hlavičce sekce); ověřit v celé sadě, případně zjistit, zda test závisí na pořadí.

## Pořadí práce (jednotka = změna + cílený test + commit + push)
4. Náhled role – dokončit: oslovovat efektivní osobu (pozdrav na Domů v náhledu = jméno zobrazeného, ne správce;
   `src/app/(wiki)/page.tsx` ~ř. 44–70, `src/lib/greeting.ts`), v menu Účet skutečný účet označit „skutečný účet“
   (Topbar.tsx), v náhledu akce zřetelně neaktivní s jedním důvodem nebo skryté (PreviewLock). „Upravit oslovení“
   v náhledu nepovolit.
5. Plán mobil: filtry Všechny/Povinné/Dobrovolné/Moje 2×2, Dnes k navigaci měsíce, čas nezalomitelný,
   „Mění vedoucí, publikum“ → „Změna vedoucího a skupiny“, plovoucí +/⋯ skrýt při viditelné liště/modalu.
6. Detail akce: kompaktní čtecí detail i pro správce + „Upravit akci“; účast hned po metadatech;
   editace: typ+název nahoře, Další údaje neskrývají základ; mobilní footer 2 rovnocenné akce.
7. Přidat akci: sjednotit s editací, „Doporučená témata“, bez číslovaných gigantických karet.
8. Účast: stav jako jedna věta + akce vpravo; „Kalendář: stav neznámý“ → neutrální pravdivý text.
9. Brouček: společná bezpečná zóna s plovoucím panelem/hromadným výběrem (rozšířit `BugButton`).
10. Domů: oslovení do menu Účet; Správa: karty kolegů (e-mail nezalamovat uprostřed domény). Zbytek bodu 8 Zápisy.
11. Report `docs/report-finalni-ui-pc-mobil.md`, celá sada testů, draft PR.

## Technika
- `npm ci`; e2e: nejdřív `npx playwright test --project=prihlaseni --no-deps --trace off --reporter=line`,
  pak cíleně `--project=telefon-360 --no-deps`. Projekty: windows-1280/1920, macos-1440/1512, telefon-390/360/320.
- Mobilní CSS = bloky na konci `src/app/globals.css` (5453 ř.); nepřidávat další override blok, opravovat u zdroje.
- Hook kontextu: systémový prompt je velký (~100k), limit 140k přichází po ~1 jednotce – čti úzce, výstupy
  zkracuj, po každé jednotce commit+push a při 140k rovnou předávka. Celé zadání je v promptu relace 60/61.

## Otevřené otázky pro vlastníka
- Dodat zadání a screenshoty do navazující relace znovu (ZIP), pokud bude potřeba vizuální reference.
