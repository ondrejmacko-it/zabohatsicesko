# Navazující relace (stav 28. 11. 2026, relace 79)

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

## Ověřeno
- lint + tsc na změněných souborech OK; vitest `kalendar-osobni*`, `ucast*` 40/40.

## Další kroky (pořadí)
1. Cílená synchronizace: v osobním režimu po změně účasti volat `syncPersonalCalendar(db, viewer.id)` místo
   `syncEvent` → `syncPersonalCalendars` (všichni). Prověřit `actions.ts:262/506/759` a souvislosti.
2. `runCalendarWorker` v osobním režimu (`worker.ts`, nyní `off`): zpracovat `personalSyncNeeded` frontu
   (opakování po chybě bez návštěvy). Změna rolí (`requeueAttendeeSync`) → `requestPersonalSync` pro osobu.
3. Připomínky `personal-api.ts:23` → 7 d e-mail, 1 d e-mail, 60/30/10 min popup (Google max 5 overrides);
   zvýšit `EVENT_FORMAT` na 4 (přepíše existující budoucí události).
4. Stav jednotlivých osobních událostí (`ownCalendarState` v `attendees.ts` vrací v personal `null`).
5. Záložka Účast, nadřízení (včetně sebe, ne na sebe), účet/oslovení, barvy, Témata, e2e, report, draft PR.
- Diagnostika nasazení (CALENDAR_DELIVERY, PARTICIPATION…): neověřeno, jen názvy proměnných, bez hodnot tajemství.

## Technika
- NEPOUŽÍVAT prettier. e2e server jede nad buildem. Systémový prompt relace je velký: hook hlásí 140 tis.
  už po pár krocích, dělat malé jednotky a commitovat průběžně.
