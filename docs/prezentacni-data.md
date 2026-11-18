# Prezentační data pro ostrou Wiki

Skript: [`prezentacni-data.sql`](prezentacni-data.sql) (verze 2). **SPUŠTĚNO 18. 11. 2026 na Neon `zbc-wiki-produkce`,
větev `main`, jedna transakce, commit OK.** Před spuštěním ověřeno nanečisto na dočasné větvi
`test-prezentace-nanecisto` (`br-noisy-mountain-bah3cwh2`, lze smazat).

## Záloha

Neon větev `zaloha-pred-prezentaci` (`br-broad-frog-bav5vdmf`), stav `main` k 18. 11. 2026 09:44 UTC, bez compute.
Návrat: obnovit `main` z této větve (Neon Console → Branches → Restore). Starší záloha `zaloha-pred-cistenim-2026-11-17`.

## Co se změnilo (ověřeno kontrolním SELECTem po commitu)

* **8 fiktivních kolegů** `*.prezentace@example.invalid` (nefunkční doména, nic nepřijde, nepřihlásí se):
  organizátor Martin Beneš (vedoucí Týmu A; Všichni, Tým A, FP), Jana Dvořáková (vedoucí RM; Všichni, RM),
  Petra Svobodová (metodička FP; Všichni, FP); člen Klára Veselá (portfolio manažerka; FP), Vašek Novotný
  (finanční poradce; FP, Tým A), Lucie Horáková (junior poradkyně; FP), Tomáš Král (relationship manažer; RM),
  Pavel Marek (senior relationship manažer; RM). Pracovní role je v jméně. Správce zůstává jediný.
* **Témata:** 3 nová od kolegů (Rozbor schůzky s klientem, Hypotéky pro OSVČ a malé podnikatele, Prezentace
  výsledků portfolia klientovi) a zájem kolegů o nová i stávající témata.
* **Harmonogram 3. 11. 2026 – 29. 1. 2027:** 55 zveřejněných akcí, 2 zrušené, 0 návrhů, 46 s Kdo, 37 s Tématem.
  Každý den pravidelného týdne má zveřejněnou akci (kontrola v transakci).
  * Prošlé nezveřejněné návrhy 3.–13. 11. (7 akcí) se **nesmazaly**, ale doplnily a zveřejnily (dohoda: bez děr).
  * Út 24. 11. nová ruční akce Action time (Martin, „Příprava kampaně na konec roku“).
  * Čt 12. 11. Trénink RM: vedoucí z testovacího účtu nahrazen Tomášem Králem.
  * Zrušené zbytky testů: důvod „test“ (18. 11. Portfolio tým) a „sds“ (25. 11. Action time) přepsán novou revizí `cancel`.
  * Záměrně prázdné (správce „— doplnit“, kolega „Bude upřesněno“): 3. 12., 15. 12., 23. 12., 30. 12., 22. 1.;
    jen Kdo bez tématu 10. 12., 6. 1., 27. 1.
  * Ruční akce stávajících účtů (Setkání týmu, Ondra, Někdo random) beze změny.
* Audit: `user.invited` 8, `topic.propose` 3, `event.publish` 36, `event.create_publish` 1, `event.cancel` 2.
  Revize `publish` 37, `cancel` 2. Snímky sedí s řádky (kontrola v transakci).
* **Únor 2027 je prázdný.** Na testovací větvi spočteno pořadí doporučení: 5. 2. RM „Komunikace s klienty při
  výkyvech na trzích“ (6 zájemců), 12. 2. FP „Hypotéky pro OSVČ…“ (5), 19. 2. RM „Péče o klíčové klienty…“
  (4, naposledy 6. 11.), 26. 2. FP „Rozbor schůzky s klientem“ (3). „Prezentace výsledků…“ zůstane v zásobníku.
  Živě neověřeno v UI (vyjde při Připravit měsíc → únor → Doplnit).

## Kalendář

Všech 53 vazeb `calendar_links` je `pending`, zpracuje je běžná synchronizace (osobní režim podle inventury,
bez e-mailů hostům). Zveřejnění prošlých listopadových akcí je propíše i do osobních kalendářů připojených účtů
skupin FP / RM / Tým A. Fiktivní adresy kalendář nemají.

## Stav UI

PR #70 (kolonky Kdo/Téma, doporučení) je v `main` (8092e27). Produkční deploy z `main` v této relaci neověřen.

## Ruční návrat bez zálohy

Kolegy, témata a zájmy lze dohledat podle `%.prezentace@example.invalid` a `topic-prezentace-*`. Akce vrátit
novou revizí přes UI. Jednodušší je obnova ze zálohy.
