# Navazující relace (stav 28. 11. 2026, relace 92)

Cíl: zadání vlastníka „Opravy po živém uživatelském testování, synchronizace Kalendáře a správa účasti“
(body 0–12). Zadání do repa nedávat. Bez merge, deploye, produkční DB, živého Googlu a Make.

Větev `claude/oprava-kalendare-a-prehled-ucasti` z main `fa5e67f`, HEAD `7f02d0e` (+ tato předávka).
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
- `7f02d0e`: tsc + eslint OK; vitest `kalendar-osobni-rucne` 3/3. Build a e2e po této změně NEspuštěny.
- `fc05f98`: tsc + eslint OK, build OK; vitest `osloveni` 4/4; e2e `osloveni`, `zahlavi`, `nahled-role`
  (windows-1280, telefon-390) 18/18, `menu-ucet` (+ telefon-360) 3/3. Fresh kontejner: e2e poprvé bez `--no-deps`.
- `5bef7f7`: tsc + eslint OK, build OK; e2e `ucast-prehled` + `nahled` (windows-1280, telefon-390, telefon-360) prošly.
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
1. Bod 8 – dokončit sekci Google Kalendář v menu Účet (`7f02d0e`): `AccountCalendar` v
   `src/features/vzdelavani/components/PersonalCalendarStatus.tsx` (stav vždy, „Synchronizovat teď“ přes
   `ActionForm` jen ve stavu active, jinak odkaz `PERSONAL_CONNECT_HREF`), `syncOwnCalendarAction` (konec
   `src/features/vzdelavani/actions.ts`, náhled odmítne `runAction`), služba `syncOwnCalendarNow` v
   `src/server/services/calendar-status.ts`, layout předává `calendar` jen mimo náhled, CSS `.account-calendar`.
   Zbývá: `npx next build`, rozšířit `e2e/menu-ucet.spec.ts` o sekci (zjistit, zda e2e server běží v režimu
   personal – grep `CALENDAR_DELIVERY` v `playwright.config.ts`; pokud ne, e2e jen ověří, že sekce chybí),
   spustit e2e `menu-ucet` (windows-1280, telefon-360/390).
2. Bod 9 barvy Správy (zelená/červená/modrá/neutrální/varovná, i v dialozích a zprávách), bod 10 filtry Témat.
3. Zkontrolovat zbytky bodu 4 (ruční synchronizace vlastního kalendáře, přehled problémů pro správce) a bodu 3
   (první synchronizace po propojení, dry-run inventura) – ověřit grepem, co už existuje, nedomýšlet.
4. Celé lint/tsc/vitest/build/e2e, report `docs/report-oprava-kalendare-ucasti.md`, draft PR, závěrečný report uživateli.
- Diagnostika nasazení (CALENDAR_DELIVERY, PARTICIPATION…): neověřeno, jen názvy proměnných, bez hodnot tajemství.

## Technika
- NEPOUŽÍVAT prettier. e2e server jede nad buildem (po změně UI `npx next build`). Před prací `npm ci`.
- Cílené e2e: `npx playwright test <soubor> --project=windows-1280 --project=telefon-390 --no-deps --reporter=dot --trace off`.
- Hook hlásí 140 tis. velmi brzy (systémový prompt ~110 tis.): bez průzkumu rovnou implementovat podle bodu 1, malé jednotky, commit + push po každé.
- Před začátkem `git fetch` a ověřit, že na větvi nepracuje jiná relace; spouštět jen jednu navazující relaci.
