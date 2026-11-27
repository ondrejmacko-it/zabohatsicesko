# Navazující relace (stav 27. 11. 2026, relace 47)

Cíl: finální responzivní audit a mobilní UX (zadání vlastníka „ZBČ – Finální responzivní audit…“, body 1–23,
plné znění v promptu relace 47). Žádný redesign desktopu, žádný merge, deploy, produkční DB, živý Google ani Make.
Větev `claude/oprava-mobilni-responzivita` z main `01db12f` (PR #94 je mergnutý). PR zatím není, na konci draft.
Screenshoty z telefonu do relace nedorazily, vlastník je má nahrát. Do té doby reprodukce v Chromiu.

## Plán po relacích (vlastníkovi poslán, čeká se na reakci)
1. P0 horní lišta + P0 karta harmonogramu, geometrické testy (bounding box, scrollWidth, výška řádku času).
2. Kompaktní harmonogram, filtry/lišta, tři tečky + menu (44×44), brouček vs. quick actions.
3. Dialogy (hlavička/tělo/patička, neprůhlednost), oddělit osobní účast od editace (EventPeek afterFields
   → kompaktní detail + „Upravit akci“; **návrh nejdřív předložit vlastníkovi**), potvrzení, radio/checkboxy.
4. Combobox místo nativních selectů (PreviewSwitch, vedoucí, téma, skupina, schvalovatel), Domů + oslovení
   do účtu, texty/štítky/barvy (notice-danger u mimořádného termínu → info), kalendář „stav neznámý“ (pravdivě).
5. Audit ostatních obrazovek, desktop regrese, matice rozlišení, celá sada, před/po screenshoty, draft PR + report.

## Zjištěno (relace 47)
- Horní lišta, příčina potvrzena v `src/app/globals.css`: `.topbar:has(.account-google){flex-wrap:nowrap}`
  (ř. ~4386) + `.view-switch{width:100%}` na ≤640 px (ř. ~4811) → při Google účtu se Pohled a účet tlačí na
  jeden řádek a překrývají. Další definice lišty: ř. 144–200, 368, 1917–1960, 4656–4840 (grid ≥641 px).
  `.account-google .account-name` na telefonu má `opacity:0` (jméno je jen v title). Navrh: jediný blok
  mobilních pravidel (≤640): grid „brand account“ / „view view“, účet jako Menu (jméno, role, e-mail, Odhlásit).
- `Topbar.tsx` (62 ř.) a `PreviewSwitch.tsx` (nativní select s optgroup, auto-submit) přečteny. Combobox
  (`src/components/Combobox.tsx`) je volnotextový input s nabídkou – pro výběr pohledu se hodí jen s režimem
  „pouze z nabídky“ (doplnit prop, ne nová komponenta). Menu (`Menu.tsx`) je fixed, nahoru/dolů, Esc.
- Spuštění: `npm ci`, pak `node e2e/server.mjs` (build + ukázka 3310, ostrá 3311, účast 3313), přihlášení
  `enterDemo` v `e2e/support.ts`; projekty telefon-390/360/320 v `playwright.config.ts`.

## Ověřeno
- Nic nového se neměnilo. Main 01db12f: dle relace 46 e2e 1475 OK, Vitest 628/628.

## Další krok
Jednotka 1: oprava horní lišty (CSS sjednocení + účet do Menu na telefonu) + `e2e/zahlavi.spec.ts`
geometrický test (Google účet s dlouhým jménem v ostré Wiki 3311, správce s Pohledem, 320–430 px:
žádný průnik boxů brand/view/account, scrollWidth ≤ clientWidth). Pak jednotka 2: `.agendaEvent`
v `schedule.module.css` (čas na vlastním řádku, štítky pod ním, test výšky času = 1 řádek).
