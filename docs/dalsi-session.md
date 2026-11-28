# Navazující relace (stav 28. 11. 2026, relace 93)

Cíl: zadání vlastníka „Opravy po živém uživatelském testování, synchronizace Kalendáře a správa účasti“
(body 0–12). Zadání do repa nedávat. Bez merge, deploye, produkční DB, živého Googlu a Make.

Větev `claude/oprava-kalendare-a-prehled-ucasti` z main `fa5e67f`, HEAD `851a593` (+ tato předávka).
PR zatím není (draft až na konci, spolu se závěrečným reportem uživateli).

## Hotovo (shrnutí, detaily v `git log`)
- Bod 1–3: `desiredEvents()` přes `participationState()`, `requestPersonalSync` v transakci změny účasti a rolí,
  cílené `syncParticipation`, plánovač `syncDuePersonalCalendars`, připomínky 7 d/1 d e-mail + 60/30/10 min popup.
- Bod 4 (část): `ownPersonalState`, `calendarStates` (hromadně), věty `personalNote`/`calendarStatus` v `src/lib/calendar-note.ts`.
- Bod 6: stránka `src/app/(wiki)/vzdelavani/ucast/page.tsx` (akce/lidé, detail, historie, filtry, problémy Kalendáře),
  pill „Účast“ v menu jen se `attendanceScope`. e2e `e2e/ucast-prehled.spec.ts` (`c18d3a1`).
  Telefon (`5bef7f7`): popisky počtů `.stack-label`/`td.stack-count`, prázdné buňky `td.stack-empty` skryté, `.back-row`.
- Přepínač náhledu `PreviewSwitch`: `aria-label="Pohled"` (na telefonu je label skrytý, axe hlásil label-title-only).
- Bod 7: správce smí být nadřízeným jiných, sám sobě ne.

## Ověřeno
- `851a593` (bod 8 hotový): build OK; vitest `ucet-kalendar` 3/3 (render `AccountCalendar`: active → „Synchronizovat teď“,
  none/revoked → odkaz propojení); e2e `menu-ucet` windows-1280 + telefon-390 + telefon-360 15/15 (ukázka sekci nemá,
  demo server nemá `CALENDAR_DELIVERY=personal`, ten má jen live server bez OAuth přihlášení v e2e).
- `fc05f98`: vitest `osloveni` 4/4; e2e `osloveni`, `zahlavi`, `nahled-role` 18/18. `5bef7f7`: e2e `ucast-prehled` + `nahled` OK.
- Dříve `891f3e3`: vitest `kalendar*`, `ucast*` 152/152.

## Zadání
Plné znění: relace `session_01HpUirxBfw13jo5FXzPsfP2`, list_events kinds `user`, limit 5,
before_id `8eded5aa-7157-4cc2-b1d8-4476831eb9dd` (zpráva uuid `b3885b91…`). Číst jen potřebný bod.
Bod 8 stručně: projít průchod účtem (otevření, osobní údaje, vlastní oslovení + uložení/reset, propojení Google
Kalendáře, ruční synchronizace, stav propojení, odhlášení). Desktop = kompaktní nabídka, telefon = samostatné okno.
Opravit pozicování, scroll, vrstvení, přetékání, fokus, klávesnici, zavírání, zachování neuložených změn.
Oslovení: 5. pád, vlastní hodnota, neutrální náhrada, žádné oslovení ze systémových názvů účtů; ověřit diakritiku,
dlouhá/neobvyklá jména a náhled za kolegu.

## Další kroky (pořadí)
1. Bod 9 barvy Správy (zjištěno, neimplementováno). Soubor `src/features/sprava/components/AccessForms.tsx`,
   CSS `src/app/globals.css` (`.btn` ř. ~526, `.btn-primary` = okrová, `.btn-danger` = obrys `--danger`,
   tokeny `--ok`/`--ok-soft`, `--danger`; modrý token chybí, `.menu-list .btn` ř. ~963 přebíjí vzhled v menu).
   `ActionForm` (`src/components/ActionForm.tsx`) má `variant` primary/default/danger, potvrzovací tlačítko
   danger/primary → přidat `success`/`info` a propsat do confirm tlačítka. Návrh mapování: zelená = Přidat přístup,
   Nastavit a schválit, Vytvořit odkaz, Vrátit přístup (+ submit v AccessForm approve/restore); červená = Odebrat
   přístup, Odhlásit zařízení, Zamítnout, Zneplatnit čekající odkaz; modrá = Nový odkaz pro zařízení (+ potvrzení),
   Kopírovat; okrová/neutrální = Upravit přístup, Nadřízený, Uložit; varovná = čekající žádosti (badge-ochre/notice).
   V menu (`.menu-list .btn`) barvit text/ikonu, ne plochu. Barva nesmí být jediným nositelem (text zůstává).
   Ověřit i `ActionMessage` (úspěch zeleně, chyba červeně) a dark mode tokeny, pokud existují. Test: vitest render +
   e2e správy (grep `e2e/sprava*`), build.
2. Bod 10 filtry Témat (Pro mou roli / Všechna + vyhledávání v jednom řádku na PC, telefon plná šířka).
3. Zbytky bodu 4 (přehled problémů pro správce) a bodu 3 (první synchronizace po propojení, dry-run inventura) – grepem.
4. Celé lint/tsc/vitest/build/e2e, report `docs/report-oprava-kalendare-ucasti.md`, draft PR, závěrečný report uživateli.
- Diagnostika nasazení (CALENDAR_DELIVERY, PARTICIPATION…): neověřeno, jen názvy proměnných, bez hodnot tajemství.

## Technika
- NEPOUŽÍVAT prettier. e2e server jede nad buildem (po změně UI `npx next build`). Před prací `npm ci`.
- Cílené e2e: `npx playwright test <soubor> --project=windows-1280 --project=telefon-390 --no-deps --reporter=dot --trace off`.
- Hook hlásí 140 tis. velmi brzy (systémový prompt ~110 tis.): bez průzkumu rovnou implementovat podle bodu 1, malé jednotky, commit + push po každé.
- Před začátkem `git fetch` a ověřit, že na větvi nepracuje jiná relace; spouštět jen jednu navazující relaci.
