# Navazující relace (stav 27. 11. 2026, relace 75)

Cíl: finální opravné kolo UI PC + mobil (zadání vlastníka body 0–12, zhuštěné zadání je v promptu relace).
Implementace, ne audit. Bez merge, deploye, produkční DB, živého Googlu a Make. Screenshoty ani zadání do repa nedávat.

Větev `claude/finalni-vyladeni-ui-pc-mobil` z main `7e9b886`. PR zatím není.

## Hotovo (jen co ovlivní další krok)
- Body 1–6 a Přidat akci HOTOVO (viz git log). Geometrie: `e2e/geometrie.spec.ts` + `lineCount()` v `e2e/support.ts`.
- Účast HOTOVO (`f4b34e5`): `ParticipationPanel.tsx` jedna řada (vlevo h2 + stavová věta „Povinné pro tebe.“,
  „Dobrovolné, můžeš se přihlásit.“, „Přihlášeno.“, „Omluva zaznamenána.“, vpravo akce), štítek a prop `label`
  pryč, omluva s `inFlight` ref proti dvojkliku, CSS `.participation-*` u zdroje. e2e ucast, ucast-karta,
  okno-omluvy, nahled zelené (windows-1280 + telefon-360), vitest c03 zelený.
- Brouček částečně (commit „Brouček: …“): překážky i otevřené `.menu-list` a `[role=listbox]`, výška z
  `visualViewport` (klávesnice) + posluchač resize, mobilní `main` padding-bottom 72 px (konec karet nad broučkem),
  „v navigaci“ místo „v levém menu“. Opraven mock `useSearchParams` v `tests/nahled-zamek.test.ts`.
  e2e broucek-rychle-akce + zpetna-vazba telefon-360 prošly, ALE na buildu před změnou BugButton – po `next build`
  zopakovat.

## Pořadí práce (jednotka = změna + cílený test + commit + push)
1. `npx next build`, zopakovat e2e broucek-rychle-akce, zpetna-vazba (telefon-360, windows-1280); přidat do
   `e2e/geometrie.spec.ts` test: otevřené menu ⋯ / Vybrat návrhy se nepřekrývá s `[data-testid=broucek]`.
   Dialog broučka: „Skrýt broučka“ jako sekundární (FeedbackRoot.tsx ~ř. 207 – ověřit třídu tlačítka).
2. Správa – karty kolegů (jméno+e-mail+stav, role+skupiny, e-mail nelámat uprostřed domény, stav a ⋯ na ose).
3. Zápisy zbytek: hlavička „Zápisy k dokončení · N moje · M celkem“, hledání+Stav v jedné liště,
   MinutesSourceForm (jedno pole, TXT/MD/VTT/SRT max 1 MB, UTF-8, nápověda o klientech), hlavička modalu.
4. Čeština: skloňování počtů (zájemce, návrh), tykání.
5. Report `docs/report-finalni-ui-pc-mobil.md` (tabulka bodů + checklist živého ověření Účasti: připojení,
   povinná pozvánka, dobrovolná registrace, omluva, návrat, přesun, zrušení, retry, ruční host), celá sada
   (lint, tsc, vitest, build, e2e), draft PR dle šablony.

## Technika
- `npm ci`; e2e: `npx playwright test --project=prihlaseni --no-deps --trace off --reporter=line`, pak cíleně
  `--project=telefon-360 --no-deps`. e2e server jede nad buildem – po změně kódu `npx next build`.
- Známý pád: `e2e/domu-ukoly.spec.ts:40` (pozvánky bez odpovědi) – nesouvisí s větví, ověřit v celé sadě.
- Hook kontextu: systémový prompt ~100k, limit 140k přijde po 1–2 jednotkách. Čti úzce, po jednotce commit+push.

## Otevřené otázky pro vlastníka
- Žádné blokující.
