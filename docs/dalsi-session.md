# Navazující relace (stav 28. 11. 2026, relace 87)

Cíl: zadání vlastníka „Opravy po živém uživatelském testování, synchronizace Kalendáře a správa účasti“
(body 0–12: osobní Kalendář podle účasti, stavy synchronizace, připomínky, záložka Účast, nadřízení,
účet a oslovení, funkční barvy Správy, filtry Témat, testy, report, draft PR). Zadání do repa nedávat.
Bez merge, deploye, produkční DB, živého Googlu a Make.

Větev `claude/oprava-kalendare-a-prehled-ucasti` z main `fa5e67f`. PR zatím není (draft až na konci).

## Hotovo
- Příčina č. 1 opravena: `desiredEvents()` v `src/server/calendar/personal.ts` vybírá akce přes
  `participationState()` z domény (povinná bez omluvy / dobrovolně přihlášená), záznamy `event_participation`
  čte jen s `participationEnabled()`.
- `changeOwnParticipation()` zapisuje v téže transakci `requestPersonalSync(tx, [viewer.id])` (osobní režim).
- Test `tests/kalendar-osobni-ucast.test.ts` (přihláška, odhlášení, omluva, zrušení omluvy, beze změn = 0 zápisů).
- Cílená synchronizace: `syncParticipation(eventId, userId)` v `sync.ts`, volá ji akce účasti v `actions.ts`
  (osobní režim = jen kalendář toho, kdo účast změnil; jinak `syncEvent`).
- Plánovač: `runCalendarWorker` v osobním režimu volá `syncDuePersonalCalendars` (`personal.ts`, stejný výběr
  `dueQuery` jako `personalSyncNeeded`), vrací `done` + `pending` = kolik zbývá. Do `calendar_worker_runs`
  v osobním režimu nezapisuje (zdraví plánovače ve Správě je tam `null`, beze změny).
- `updateAccess` v `users.ts` v osobním režimu volá `requestPersonalSync(tx, [userId])`.
- Připomínky: `DEFAULT_REMINDERS` v `personal-api.ts` = e-mail 7 d a 1 d, popup 60/30/10 min (5 = max Googlu),
  platí pro akci i výchozí připomínky kalendáře; `EVENT_FORMAT` = 4 (přepíše akce); text v `PersonalCalendarStatus`.

- Stav osobní události: `ownCalendarState` v personal volá `ownPersonalState` (`attendees.ts`): řádek
  `personal_calendars` (neaktivní/žádný = `link: "none"`, errorCode = attention, syncRequestedAt > syncedAt =
  pending) + záznam `personal_calendar_entries` = `inCalendar`; `OwnCalendar.personal = true`.
  Věty `personalNote` v `src/lib/calendar-note.ts` (zapsaná / není / po přihlášení / nepropojený).

- Nadřízení (bod 7): `setExcuseManagers` už nezakazuje správci určit nadřízeným sebe; člověk sám sobě dál
  `invalid_input`. UI Správy (`sprava/page.tsx` candidates) správce v seznamu už mělo. Test v `omluvy-nadrizeny`.

- Bod 6, jednotka 1: `src/server/services/attendance.ts` = `attendanceScope(viewer, preview)` (náhled/bez účasti
  = null, správce `all`, nadřízený `managed` z `managedEmployeeIds`, jinak null) + `attendanceByEvent(scope, from, to)`
  (zveřejněné akce bez svátků, počty required/excused/enrolled/withdrawn/expected přes `participationState`).
  Test `tests/ucast-prehled.test.ts`. Historie: audit `participation.enroll|withdraw|excuse|revoke_excuse`
  (actor = člověk, entity = event); změna rolí v auditu `users` (ověřit název akce).

- Bod 6, jednotky 2–3 (`attendance.ts`): `attendanceDetail(viewer, scope, eventId)` = lidé v rozsahu, kterých se akce
  týká (bez `optional`/null), stav, `excuse` jen přes `canReadExcuseDetails` (správce jen u lidí, kde je určeným
  nadřízeným), `calendar` = `ownCalendarState`; null = akce neexistuje/svátek. `attendanceByPerson(scope, from, to)`
  = počty za člověka; `attendanceHistory(scope, userId)` = audit `participation.*` (aktér) + `user.*`,
  `excuse_managers.changed` (entity user), null mimo rozsah. Společné `loadPeriod`, `addState`.

- Bod 6, jednotka (c) část 1 (`d5f66ff`): stránka `src/app/(wiki)/vzdelavani/ucast/page.tsx` (scope null → notFound,
  i v náhledu). `?pohled=akce|lide`, detail `?akce=id` (lidé, stav, omluva, badge Kalendáře), historie `?clovek=id`;
  filtry q, od/do (výchozí −30/+60 dní, max 366), skupina, stav, `kalendar=1`. Mobil = `.table table-stack`.
  `calendarStatus(state, calendar)` v `src/lib/calendar-note.ts` (label + problem), test `ucast-stav-kalendare`.
  `PersonAttendance.groups` přidáno.

## Ověřeno
- HEAD `4c7fbf6`: tsc + eslint OK; vitest `kalendar-osobni*`, `kalendar-organizator`, `users` OK (49+14).
- HEAD `3664e50`: tsc + eslint OK; vitest `kalendar-osobni*`, `kalendar-uklid` 30/30.
- HEAD `947da93`: tsc + eslint OK; vitest `kalendar*`, `ucast*`, `google-login`, `migrace-0016` 169/169.

- HEAD po bodu 7: tsc + eslint OK; vitest `omluvy-nadrizeny` 9/9.
- Jednotka 1 bodu 6: tsc + eslint OK; vitest `ucast-prehled` 3/3.
- HEAD `e7a38c6`: tsc + eslint OK; vitest `ucast-prehled` 5/5.
- HEAD `d5f66ff`: tsc + eslint OK; vitest `ucast-stav-kalendare`, `ucast-prehled` 9/9. Stránka zatím neotevřená v prohlížeči.

## Zadání
Plné znění = první zpráva uživatele v relaci `session_01HpUirxBfw13jo5FXzPsfP2` (list_events, kinds `user`,
before_id `1c2d91e3-70a5-48e2-aad8-bf9e5819fbb2`; výstup je velký, číst jen bod, na kterém se pracuje).

## Další kroky (pořadí)
1. Bod 6 (c) dokončit: filtr `kalendar=1` v pohledu akcí zatím jen hláška (problémy se filtrují v detailu).
   Přidat hromadný počet problémů za akci do `attendanceByEvent` (osobní režim: jeden dotaz na
   `personal_calendars` + `personal_calendar_entries` pro akce období; jinak `calendar_links`) a sloupec/filtr.
2. Pill „Účast“ v `SubNav.tsx` jen s propem `showAttendance` z `layout.tsx` (server: `requireUser` +
   `currentPreview` + `attendanceScope(user, Boolean(preview))` ≠ null). Pak e2e scénář stránky (správce vidí,
   zaměstnanec 404, nadřízený jen své lidi) a kontrola v prohlížeči PC + mobil.
3. Účet/oslovení (bod 8), barvy Správy (bod 9), Témata filtry (bod 10), e2e, report, draft PR.
- Diagnostika nasazení (CALENDAR_DELIVERY, PARTICIPATION…): neověřeno, jen názvy proměnných, bez hodnot tajemství.

## Technika
- NEPOUŽÍVAT prettier. e2e server jede nad buildem. Systémový prompt relace je velký: hook hlásí 140 tis.
  už po pár krocích, dělat malé jednotky a commitovat průběžně. Před prací `npm ci` (node_modules chybí).
- Před začátkem `git fetch` a ověřit, že na větvi nepracuje jiná relace (relace 80/81 i 82 zdvojily krok; spouštět jen jednu navazující relaci).
