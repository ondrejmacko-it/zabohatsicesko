# Navazující relace (stav 26. 11. 2026, relace 4 zadání „Finální dokončení po PR #92“)

Větev `claude/festive-sagan-lilorz` z main 2703a0b (PR #92 v main). Limit relace 170 tis. (start v cloudu zabere
~120 tis., na práci zbývá málo: čti cíleně, výstupy zkracuj). Nic nemergovat/nenasazovat, žádné vzdálené migrace,
změny produkčního Vercelu/Neonu ani Google pozvánky bez schválení vlastníka. Před testy `npm ci` (node_modules chybí).

## Zadání
Plné znění: první zpráva uživatele s nadpisem „ZBČ – FINÁLNÍ DOKONČENÍ PROJEKTU PO PR #92“ v relaci
session_01HpUiryLcisq3sp1bDNE1U2. `list_events` kinds=["user"], limit 100, `before_id=ce15ad91-6fd8-49f9-b71c-5b737056552a`
(výsledek jde do souboru; text vytáhni pythonem a grepni nadpis fáze, např. „Fáze D“). Čti jen svou fázi.
Fáze: A audit stavu · B účast + garantovaná témata na izolovaném Preview · C01–C06 (hotovo) · D náhled 1:1 ·
E hromadný výběr (bod 9) · F Zápisy (bod 11) · G celkové UI (bod 13) · H Témata a barvy účasti · I Google Kalendář F04 ·
J matice F01–F18, D01–D07 · K UX/regresní audit + smoke E2E v CI · L release checklist · výstup: report + draft PR.

## Hotovo (fáze C)
- C01 a029755, C02 e1f654d, C03 910e0dc (viz commity a testy c01/c02/c03).
- C04 8e78cea+f3b85cf: `managedExcusesAt` vrací jen platné omluvy podle `participationState` (zrušená/nezveřejněná
  akce, neaktivní účet, zánik povinnosti po změně rolí/publika = historický záznam). Testy v
  `tests/omluvy-nadrizeny.test.ts` (7/7, nový test bez opravy padá). Ověřeno beze změny: správce sám nic nevidí,
  náhled nic, souběh `setExcuseManagers` serializuje zámek řádků `users`, zrušení omluvy zmizí, víc nadřízených OK.
- C05 jen zjištění (viz otázky).
- C06 e4b6a8f: text `MinutesSourceForm.tsx` (lokální šablona, ne AI shrnutí; heuristické vynechání, ne zaručená
  anonymizace), `e2e/zapisy-schvaleni.spec.ts` očekávání, `docs/integrace-do-firemni-wiki.md` (training: "never"
  = deklarace v kódu, ne smluvní garance). E2E nespuštěno.
- tsc OK na e4b6a8f. Celá sada, eslint celý a e2e zatím ne.

## Fáze A audit (relace 4, 26. 11., jen čtení)
- Produkce Vercel `zbc-vzdelavani-demo`: READY dpl_xei6Euj… = main 2703a0b (PR #92). Preview větve READY na 2116733.
  Starší ERROR build 8e78cea (C04) opraven f3b85cf.
- Neon `zbc-wiki-produkce` (bitter-breeze-02749976) main: `schema_migrations` 0001–0014, chybí 0015–0018 (potvrzeno).
- Neon `neon-zbz-vzdelavani-demo` (still-shadow-86247101) branch `overeni-ucast-0016-0018`
  (br-wandering-paper-b9ef86og): ready, má 0001–0018 (vč. starých 0007_invite_hold, 0008_access_links).
- Vercel env (jen názvy/nesecretní hodnoty): `PARTICIPATION` není nastavena nikde → účast je všude „off“.
  Produkce: WIKI_MODE=production, LOGIN_MODE=google-test, CALENDAR_MODE=google-test, CALENDAR_ATTENDEES=audience,
  GOOGLE_OAUTH_PUBLISHED=1. Preview: WIKI_MODE=demo, CALENDAR_MODE=simulation, DEMO_ACCESS_CODE;
  APPROVED_MIGRATIONS jen pro starou větev claude/finalni-kontrola-novy-pr-g2r2wd (0015).
  Nepotvrzeno: na kterou DB míří Preview DATABASE_URL (šifrované, nedešifrováno).
- Testovací účty: neověřeno (tabulka `users` nemá sloupec `active`; zjisti schéma v `src/server/db/schema.ts`).
- Google Kalendář: produkce v režimu google-test (skutečné API s omezením), Preview simulace. Živě neověřeno.

## Další krok
1. Dokonči A: účty na branchi (`SELECT role…` podle schema.ts), PR otevřená (GitHub MCP list_pull_requests).
2. B: požadavky na schválení vlastníka = Preview env pro větev `claude/festive-sagan-lilorz`: `PARTICIPATION=on`
   (nesecretní, smíš nastavit sám jen pro preview+gitBranch) a DATABASE_URL na br-wandering-paper (tajemství →
   vlastník). Pak scénáře účasti a garantovaných témat v prohlížeči (Playwright) proti Preview URL.
3. Pak fáze D (náhled 1:1). Text fází: soubor list_events (viz Zadání), fáze A od „3. Fáze A“, B od „4. Fáze B“.

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sám sebe jako nadřízeného kohokoli a pak číst jeho důvody omluv (audit
  `excuse_managers.changed` zapíše, kdo koho změnil). Varianty: (a) zakázat nastavení sebe (musí jiný správce),
  (b) povolit, ale zvlášť auditovat a ukázat ve Správě. Doporučení: (a), pokud firma má víc správců.
- C04: deaktivace nadřízeného vazby nemaže (po reaktivaci platí znovu). Má se mazat?
- C05 `vedouci-tymu`: (a) zachovat při uložení účtu, (b) přidělitelná kvalifikace ve Správě, (c) odstranit. Doporučení (a).
- Zvýšení hooku limitu na 200 tis. musí udělat vlastník (`scripts/limit-kontextu.py`, `CLAUDE.md`).
- Preview s DB izolovaného branche (tajemství), schválení migrací 0015–0018 na `zbc-wiki-produkce`.
- Význam role `vedouci-tymu`, skutečné vztahy nadřízených, doba uchování omluv (firma).
