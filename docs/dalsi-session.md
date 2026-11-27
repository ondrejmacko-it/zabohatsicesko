# Navazující relace (stav 27. 11. 2026, relace 48)

Cíl: finální responzivní audit a mobilní UX (zadání vlastníka body 1–23, zhuštěně v promptu relace 47/48).
Žádný redesign desktopu, merge, deploy, produkční DB, živý Google ani Make. Na konci draft PR + report.
Větev `claude/oprava-mobilni-responzivita` z main `01db12f`. PR zatím není. Kód zatím beze změn.

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
- Lišta, příčina: `src/app/globals.css` `.topbar:has(.account-google){flex-wrap:nowrap}` (~ř. 4386) +
  `.view-switch{width:100%}` na ≤640 (~ř. 4811); `.account-google .account-name{opacity:0}` na telefonu.
  Další pravidla lišty ř. 144–200, 368, 1917–1960, 4656–4840. Návrh: jeden blok ≤640 grid „brand account“ /
  „view view“, účet jako `Menu` (jméno, role, e-mail, Odhlásit). `Topbar.tsx` 62 ř., `PreviewSwitch.tsx` select.
- Test Google účtu: e2e se Googlem nepřihlásí (session `via:"google"` vyžaduje identitu v `user_identities`,
  ostrá Wiki navíc důvěryhodné zařízení – `src/server/auth/session.ts` resolveSessionUser). Nejjednodušší:
  ukázka 3310 + geometrický test přes demo účet s dlouhým jménem, nebo doplnit e2e seed Google identity
  jen pro server 3310 (ověřit, že `googleLoginConfig()` tam není null). Rozhodni levnější variantu.
- Spuštění: `npm ci`, Playwright si server spustí sám (`node e2e/server.mjs`, build + 3310/3311/3313),
  projekty telefon-390/360/320, `windows-1280`; stávající `e2e/zahlavi.spec.ts` hlídá 641–1200 px.

## Ověřeno
Nic nového. Main 01db12f: dle relace 46 e2e 1475 OK, Vitest 628/628.

## Další krok
Jednotka 1: lišta (CSS sjednocení ≤640 + účet do Menu) + geometrický test v `e2e/zahlavi.spec.ts`
(320–430 px, žádný průnik boxů brand/view/account, scrollWidth ≤ clientWidth, celé jméno v otevřeném účtu).
Jednotka 2: `.agendaEvent` v `src/features/vzdelavani/components/schedule.module.css` (čas na 1 řádku,
štítky pod ním jako celky) + test výšky času = 1 řádek.
