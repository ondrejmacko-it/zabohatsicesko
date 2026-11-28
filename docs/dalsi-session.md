# Navazující relace (stav 28. 11. 2026, relace 95)

Cíl: zadání vlastníka „Opravy po živém uživatelském testování, synchronizace Kalendáře a správa účasti“
(body 0–12). Zadání do repa nedávat. Bez merge, deploye, produkční DB, živého Googlu a Make.

Větev `claude/oprava-kalendare-a-prehled-ucasti` z main `fa5e67f`. Draft PR založený v relaci 95
(číslo v GitHubu). Merge provádí uživatel ručně.

## Stav
- Všechny body zadání hotové, přehled s commity v `docs/report-oprava-kalendare-ucasti.md`.
- Poslední funkční změna: `b1082c8` (bod 10, filtr Témat viditelný na telefonu, e2e `temata-filtr`).

## Ověřeno (HEAD po `7f2a542`)
- ESLint, `tsc --noEmit` bez chyb; vitest 665/665; `next build` OK.
- Playwright celá sada: 1639 prošlo, 703 přeskočeno značkami projektů, 0 selhalo.

## Další krok
- Čekat na připomínky uživatele k draft PR. Živé ověření na preview s testovacím Google účtem
  (`CALENDAR_DELIVERY=personal`, připomínky, zápisy) dělá uživatel, hodnoty tajemství se nečtou.

## Otevřené otázky
- Proměnné nasazení (CALENDAR_DELIVERY, účast) neověřené proti preview.
- Chování starší verze nad událostmi `EVENT_FORMAT = 4` po případném revertu neověřené.

## Technika
- NEPOUŽÍVAT prettier. e2e server jede nad buildem. Celá e2e sada trvá ~17 min (background timeout ≥ 30 min).
