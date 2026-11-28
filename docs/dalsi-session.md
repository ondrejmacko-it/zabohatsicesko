# Navazující relace (stav 28. 11. 2026, relace 81)

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

## Ověřeno
- HEAD `4c7fbf6`: tsc + eslint OK; vitest `kalendar-osobni*`, `kalendar-organizator`, `users` OK (49+14).
- HEAD `3664e50`: tsc + eslint OK; vitest `kalendar-osobni*`, `kalendar-uklid` 30/30.

## Další kroky (pořadí)
1. Stav jednotlivých osobních událostí: `ownCalendarState` v `attendees.ts:101` vrací v personal `null`
   (panel pak ukáže „stav nelze ověřit“). Návrh: v personal číst `personal_calendars` (status, errorCode,
   syncRequestedAt vs syncedAt) + `personal_calendar_entries` (userId, eventId) → `OwnCalendar`
   (`link` synced/pending/attention, `inCalendar` = záznam existuje); věty v `src/lib/calendar-note.ts`
   upravit pro osobní kalendář (nejde o pozvánku). Bez propojeného kalendáře zvlášť (výzva k propojení).
2. Záložka Účast, nadřízení (včetně sebe, ne na sebe), účet/oslovení, barvy, Témata, e2e, report, draft PR.
- Diagnostika nasazení (CALENDAR_DELIVERY, PARTICIPATION…): neověřeno, jen názvy proměnných, bez hodnot tajemství.

## Technika
- NEPOUŽÍVAT prettier. e2e server jede nad buildem. Systémový prompt relace je velký: hook hlásí 140 tis.
  už po pár krocích, dělat malé jednotky a commitovat průběžně. Před prací `npm ci` (node_modules chybí).
- Před začátkem `git fetch` a ověřit, že na větvi nepracuje jiná relace (relace 80 a 81 zdvojily krok).
