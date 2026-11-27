# Navazující relace (stav 27. 11. 2026, relace 51)

Cíl: finální responzivní audit a mobilní UX (zadání vlastníka body 1–23, zhuštěně v promptu relace 47/48).
Žádný redesign desktopu, merge, deploy, produkční DB, živý Google ani Make. Na konci draft PR + report.
Větev `claude/oprava-mobilni-responzivita` z main `01db12f`, HEAD `bb7d94a` (+ tato předávka). PR zatím není.

## Screenshoty vlastníka (16 ks, Android Chrome, ~347 CSS px, zdelavani-demo.vercel.app, správce Google)
Zip: `/root/.claude/uploads/df1d1066-197f-551e-8282-0e240871cc1e/56421696-ZBC_mobilni_screenshoty_2026-11-27.zip`
(v nové relaci asi chybí, pak požádej o nové nahrání; do repa je nedávat). Potvrzené nálezy:
- Lišta: „Můj pohled“ přes „ZBC Spravce · Správce“, Odhlásit vedle (Google účet). Navigace = velký černý blok
  (Domů/Vzdělávání/Správa systému + Zpětná vazba na dalším řádku).
- Domů: „Upravit oslovení“ pod pozdravem, po rozbalení formulář nad úkoly. Úkoly = dlouhé bloky s textem
  „Proběhla a nemá zápis. Vlož přepis…“. PreviewSwitch = nativní Android select přes celou obrazovku.
- Dialog akce je **průsvitný** (text Plánu prosvítá), zelený banner „Zveřejněno“, téma v selectu useknuté
  („Příprava na schůzku s novým klient“), patička Další možnosti + Beze změn + Uložit jako návrh/Zveřejnit.
- Karta: čas „09:00–10:30“ po znacích (Mimořádná + Povinné pro tebe), „12:30 – 15:00“ na 3 řádky u Návrhu
  změny; role vedoucího v závorce se láme; tři tečky ~22 px, bledé; úchyt ≡ těsně pod nimi.
- Quick actions (+ …) a brouček vpravo dole překrývají kartu. Filtry Plánu = 4 řádky pilulek.
- „V pondělí se vzdělávání běžně nekoná“ = červený notice-danger. Tvoje účast až pod celým editorem.
- Omluva: bottom sheet přes formulář, nativní modré radio. Po omluvě „Omluven/a“ + „Na této akci jsi
  omluvený.“ (rod!). „Můžeš se přihlásit“ ve štítku i v textu. „Kalendář: stav neznámý“ všude.

## Plán po relacích
1. P0 lišta + P0 karta harmonogramu, geometrické testy. 2. Kompaktní harmonogram, filtry, tři tečky 44×44,
brouček vs. quick actions. 3. Dialogy (neprůhlednost!), oddělení účasti (návrh předložit vlastníkovi),
potvrzení, radio. 4. Combobox místo selectů, Domů + oslovení do účtu, texty/barvy, kalendář. 5. Audit,
desktop regrese, matice rozlišení, celá sada, před/po screenshoty, draft PR + report.

## Technika
- Hotovo (bb7a92d): lišta ≤640 = blok na konci `globals.css` (grid: brand+účet Google v ř. 1, výběr role
  ukázky ř. 2, Pohled ř. 3); `Topbar.tsx` má `Menu` „Účet“ (jméno, role, e-mail Google, Odhlásit), na >640
  skryté. Google se v e2e přihlásit nedá, test jede na ukázce se stejnými třídami (riziko: Google větev
  ověřena jen CSS, ne živě – uvést v PR).
- Spuštění: `npm ci`, Playwright si server spustí sám (build + 3310/3311/3313), projekty telefon-390/360/320,
  `windows-1280`. Cíleně: `npx playwright test e2e/<soubor> --project=telefon-390 --trace off --reporter=line`.

## Ověřeno
- bb7a92d: `e2e/zahlavi.spec.ts` telefon-390/320 + windows-1280 OK, tsc a eslint OK.
- 5195ef5 karta agendy (≤760: flex-wrap, čas nezalomený po znacích, štítky `nowrap` jako celky, `overflow-wrap:
  break-word`) + 657a248 ⋯ 36×32 tmavší, plocha 44×44, bez překryvu s ≡. Test `e2e/karta-agendy.spec.ts`
  (320/347/360/390, správce + ucastnikFp; bez opravy padá). Spolu s mobilni-ovladani, kdo-tema, rychle-akce,
  ucast-karta na telefon-390/320 zelené; tsc a eslint OK. Desktop nedotčen (vše v `@media max-width: 760px`).

- bb7d94a filtry Plánu (≤560: flex místo 2 × 2, účast vlastní řádek 13 px, od 347 px 4 pilulky vedle sebe, pod
  347 px 2 × 2; `.panel:has(.plan-zone)` 12 px a `.section:has(> .plan-zone)` 10 px po stranách; `data-wide` a
  `wideLast` odstraněny). Test `e2e/filtry-planu.spec.ts` (bez opravy padá). Spolu s mobilni-ovladani,
  harmonogram-rozlozeni, plan-planovani, vyber-navrhu, rychle-akce, karta-agendy na telefon-390/320 + windows-1280:
  79 passed; tsc a eslint OK. Správce na 320 px = 4 řádky (účast 2 × 2), od 347 px nejvýš 3.

## Další krok
1. Brouček (zpětná vazba, `.bug-dock`) vs. quick actions (+ …) vpravo dole překrývají kartu; na 320 px `.bug-dock`
   sahá do x=341 (mimo okno, fixed – ověřit, zda je oříznutý, nebo vyčnívá). Napsat geometrický test.
2. Pak bod 3 plánu (dialogy).

## Otevřené otázky pro vlastníka
- Odsazení na telefonu: tři vnořené okraje (shell 12 + panel 16 + sekce 14) berou 42 px na stranu. Zúženo zatím
  jen na Plánu; má se srovnat globálně? „Vybrat návrhy“ přesunout do nabídky Filtry (ušetří řádek)?
