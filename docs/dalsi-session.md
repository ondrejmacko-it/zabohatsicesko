# Navazující relace (stav 27. 11. 2026, relace 61)

Cíl: finální opravné kolo UI PC + mobil (zadání vlastníka „ZBČ – finální UX/UI a funkční stabilizace“,
body 0–12). Implementace, ne audit. Desktop i mobil stejně důležité; vzdušně, nezahušťovat, zachovat identitu Wiki.
Bez merge, deploye, produkční DB, živého Googlu a Make. Screenshoty ani zadání do repa nedávat.

Větev `claude/finalni-vyladeni-ui-pc-mobil` z main `7e9b886` (PR #95 už je v main). PR zatím není.
Zadání (64 KB) a 82 screenshotů nejsou v repu; zhuštěný seznam bodů je v promptu navazující relace.

## Hotovo (HEAD `0a6f188`, pushnuto)
- Bod 1 Zápisy k dokončení: `.missing-row` = `.missing-main` (název, datum·vedoucí, datum nowrap) + `.missing-side`
  (stav + CTA), ≤640 px pod sebou. „Zobrazeno X z Y“ + Zrušit filtr jen při filtru. CTA úkolů (`journey.ts`) i okna:
  Připravit zápis / Pokračovat v zápisu / Zkontrolovat zápis / Schválit zápis (vedoucí) / Přiřadit vedoucího.
- Nový `e2e/geometrie.spec.ts` + helper `lineCount()` v `e2e/support.ts` – sem přidávej další geometrické regrese.
- Ověřeno: vitest (stav-nahravky, zapisy-f13-f15, journey, zapisy-schvaleni) zelené; tsc čistý; e2e geometrie
  (windows-1280, telefon-320/360) a okna „dokončení“ zelené na `0a6f188`. Test geometrie jsem neověřil proti stavu
  před opravou (chybí důkaz, že by padal) – při příležitosti ověřit.
- Zbývá z bodu 8: hlavička „Zápisy k dokončení · N moje · M celkem“, hledání+Stav v jedné liště, MinutesSourceForm
  (jedno pole přepisu, formáty TXT/MD/VTT/SRT max 1 MB, nápověda o klientech), sdílená hlavička modalu.

## Pořadí práce (jednotka = změna + cílený test + commit + push)
1. ~~Zápisy k dokončení~~ hotovo (viz výše).
2. Mobilní černá navigace: 4 položky v řadě nebo 2×2, 3 položky přes celou šířku; Zpětná vazba ne osamocená.
3. Témata: filtr Pro mou roli/Všechna + vyhledávání v jedné liště (jeden zdroj stavu), PageCall text vlevo
   + CTA vpravo v jedné řadě; ⋯ kontrastní všude (sdílená ikonová akce, 44px hit area).
4. Náhled role: přepnutí z nepřístupné trasy (Správa/Integrace) → přesměrovat na Domů/Plán; jeden stručný
   banner „Náhled: … · jen ke čtení“ + Ukončit náhled, bez seznamu stránek; oslovovat efektivní osobu.
5. Plán mobil: filtry Všechny/Povinné/Dobrovolné/Moje 2×2, Dnes k navigaci měsíce, čas nezalomitelný,
   „Mění vedoucí, publikum“ → „Změna vedoucího a skupiny“, plovoucí +/⋯ skrýt při viditelné liště/modalu.
6. Detail akce: kompaktní čtecí detail i pro správce + „Upravit akci“; účast hned po metadatech;
   editace: typ+název nahoře, Další údaje neskrývají základ; mobilní footer 2 rovnocenné akce.
7. Přidat akci: sjednotit s editací, „Doporučená témata“, bez číslovaných gigantických karet.
8. Účast: stav jako jedna věta + akce vpravo; „Kalendář: stav neznámý“ → neutrální pravdivý text.
9. Brouček: společná bezpečná zóna s plovoucím panelem/hromadným výběrem (rozšířit `BugButton`).
10. Domů: oslovení do menu Účet; Správa: karty kolegů (e-mail nezalamovat uprostřed domény).
11. Report `docs/report-finalni-ui-pc-mobil.md`, celá sada testů, draft PR.

## Technika
- `npm ci`; e2e: nejdřív `npx playwright test --project=prihlaseni --no-deps --trace off --reporter=line`,
  pak cíleně `--project=telefon-360 --no-deps`. Projekty: windows-1280/1920, macos-1440/1512, telefon-390/360/320.
- Mobilní CSS = bloky na konci `src/app/globals.css` (5453 ř.); nepřidávat další override blok, opravovat u zdroje.
- Hook kontextu: systémový prompt je velký (~100k), limit 140k přichází po ~1 jednotce – čti úzce, výstupy
  zkracuj, po každé jednotce commit+push a při 140k rovnou předávka. Celé zadání je v promptu relace 60/61.

## Otevřené otázky pro vlastníka
- Dodat zadání a screenshoty do navazující relace znovu (ZIP), pokud bude potřeba vizuální reference.
