# Navazující relace (stav 26. 11. 2026, relace 5 zadání „Finální dokončení po PR #92“)

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

## Fáze A (hotovo, relace 5, jen čtení)
- Produkce Vercel READY = main 2703a0b. Neon produkce: migrace 0001–0014 (chybí 0015–0018), účty 12 (origin invite:
  2 admin, 3 organizer, 7 member). Neon branch br-wandering-paper-b9ef86og (projekt still-shadow-86247101): 0001–0018,
  5 demo účtů (1 admin, 1 organizer, 3 member). Otevřená PR: žádná. Preview DATABASE_URL: sdílená, cíl neověřen.

## Fáze B (rozpracováno)
- Nastaveno: Vercel env `PARTICIPATION=on` jen preview + gitBranch `claude/festive-sagan-lilorz` (id 0jS10jzE1PjjGqaB).
  Bezpečné: bez migrací 0016/0017 zůstane účast vypnutá (`participationReadiness`).
- Nový e2e test (zapis-temat) „garantovaných témat je neomezeně…“ v `e2e/temata-planovani.spec.ts`: 3.–6. téma,
  posun, odebrání, reload, úklid. Projekt zapis-temat 4/4 OK lokálně (PGlite). Účast lokálně kryje `e2e/ucast.spec.ts`
  (nespuštěno v této relaci).
- Čeká na vlastníka: Preview env `DATABASE_URL` (sensitive, preview, gitBranch claude/festive-sagan-lilorz) =
  connection string branche br-wandering-paper-b9ef86og; pak redeploy větve. Bez toho nejde živé Preview ověření.

## Další krok
1. `npx playwright test e2e/ucast.spec.ts --project=windows-1280` (před tím `npm ci` a projekt `prihlaseni`) a doplnit
   chybějící scénáře z fáze B (zrušená/proběhlá akce, změna publika, chyba sítě), pokud je spec nekryje.
2. Až vlastník nastaví DATABASE_URL: Playwright proti Preview URL větve (scénáře účasti z fáze B).
3. Fáze D (náhled 1:1). Text fází: list_events (viz Zadání) → soubor → python, fáze D od „Fáze D“.

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sám sebe jako nadřízeného kohokoli a pak číst jeho důvody omluv (audit
  `excuse_managers.changed` zapíše, kdo koho změnil). Varianty: (a) zakázat nastavení sebe (musí jiný správce),
  (b) povolit, ale zvlášť auditovat a ukázat ve Správě. Doporučení: (a), pokud firma má víc správců.
- C04: deaktivace nadřízeného vazby nemaže (po reaktivaci platí znovu). Má se mazat?
- C05 `vedouci-tymu`: (a) zachovat při uložení účtu, (b) přidělitelná kvalifikace ve Správě, (c) odstranit. Doporučení (a).
- Zvýšení hooku limitu na 200 tis. musí udělat vlastník (`scripts/limit-kontextu.py`, `CLAUDE.md`).
- Preview s DB izolovaného branche (tajemství), schválení migrací 0015–0018 na `zbc-wiki-produkce`.
- Význam role `vedouci-tymu`, skutečné vztahy nadřízených, doba uchování omluv (firma).
