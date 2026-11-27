# Navazující relace (stav 27. 11. 2026, relace 46)

Větev `claude/gallant-bohr-m1lyna`, draft PR #94 (nezakládat další, nemergovat, žádná produkce/DB/Google pozvánky).
Zadání vlastníka 26. 11. body 1–10 je **hotové**. Popis PR #94 obsahuje opravy, změněné soubory, screenshoty,
matici F01–F18 (`docs/matice-f01-f18.md`), testy, překážky a postup kontroly Preview.

## Ověřeno
- Celá e2e sada na e24cf40: 1475 OK, 0 chyb, 292 přeskočeno (`test.skip` podle projektu/šířky), 12,7 min.
- Lint, `tsc`, Vitest 628/628, build na 15fc144; kód aplikace se od té doby neměnil (jen e2e a docs).
- CI (Vercel preview) na PR #94 zelené, žádné review komentáře.

## Další krok
- Čeká se na vlastníka: kontrola Preview podle popisu PR #94, převedení z draftu a ruční merge.
- Na reakce v PR #94 (review, CI) reagovat; jinak nic nezačínat.

## Otevřené (firma)
- C04: mapování nadřízených a retence omluv. F04 živý test s Google Kalendářem (D06). F15 pravidla anonymizace.
- Neon branch `zaloha-pred-0015-2026-11-26` a `test-migrace-0015-0019` smazat jen se souhlasem vlastníka.
