# Navazující relace (stav 26. 11. 2026, relace 13 zadání „Finální dokončení po PR #92“)

Větev `claude/festive-sagan-lilorz` z main 2703a0b (PR #92 v main). Limit relace 170 tis. (start v cloudu zabere
~120 tis., na práci zbývá málo: čti cíleně, výstupy zkracuj). Nic nemergovat/nenasazovat, žádné vzdálené migrace,
změny produkčního Vercelu/Neonu ani Google pozvánky bez schválení vlastníka. Před testy `npm ci` (node_modules chybí).

## Zadání
Plné znění: první zpráva uživatele „ZBČ – FINÁLNÍ DOKONČENÍ PROJEKTU PO PR #92“ v relaci
session_01HpUiryLcisq3sp1bDNE1U2: `list_events` kinds=["user"], limit 100,
`before_id=ce15ad91-6fd8-49f9-b71c-5b737056552a` (výsledek jde do souboru; JSON za úvodní hlavičkou, najdi řetězec
obsahující „PO PR #92“ a „Fáze“, ulož do scratchpadu a čti jen řádky své fáze: E ř. 302–349, F 350–407,
G 408–484, H 485–535, I 536–556, J 557–583, K 584–637, L 638–656, výstup 657+).
Fáze: A audit · B účast na izolovaném Preview · C hotovo · D náhled 1:1 hotovo · E hromadný výběr (bod 9) ·
F Zápisy (bod 11) · G celkové UI (bod 13) · H Témata a barvy · I Google Kalendář F04 · J matice F01–F18, D01–D07 ·
K UX/regresní audit + smoke E2E v CI · L release checklist · výstup: report + draft PR.

## Hotovo
- A (jen čtení): produkce = main 2703a0b, Neon produkce migrace 0001–0014 (chybí 0015–0018); Neon branch
  br-wandering-paper-b9ef86og (projekt still-shadow-86247101) 0001–0018 s demo účty.
- B: Vercel env `PARTICIPATION=on` jen preview + gitBranch této větve. `e2e/ucast.spec.ts` lokálně OK. Živé Preview
  čeká na vlastníka (Preview `DATABASE_URL` = branch výše, pak redeploy).
- C01–C06 hotovo (a029755…e4b6a8f).
- D hotovo: D1 `PreviewLock`/`LockedLink`, D2 zamčené nástroje v detailu/Plánu/Tématech/Zápisech, D3 Správa podle
  oprávnění zobrazeného, D4 (relace 13, commit po 547efc9): `cardActions` už nebere `preview` (zápis v menu
  vedoucího zůstává, zamyká `CardMenu`), „Přidat akci“ v `EventDialog` zamčené, v náhledu bez úchytů přesunu
  (`movableFrom` jen mimo náhled; tím v náhledu chybí i „+“ na dni v mřížce – drobná odchylka 1:1, případně vrátit
  jako zamčené). Serverová pojistka `tests/nahled-mutace.test.ts`.
- Ověřeno na D4: vitest 609/609, tsc, eslint čisté; `e2e/nahled-role.spec.ts` + `e2e/nahled.spec.ts` 19/19
  (windows-1280). Celá e2e windows-1280: VIZ NÍŽE.

## Další krok
1. Fáze E (hromadný výběr): soubory `PlanSelection.tsx`, `Schedule.tsx`, `PlanFilters.tsx`, `harmonogram/page.tsx`,
   `status.ts` (`monthSummary`/`awaitsPublishing` vs `isPickable` – počítadlo „Návrhy“ nesedí s výběrem).
   Nejdřív krátký návrh prezentace typů návrhů + texty výběrové lišty uživateli (CLAUDE.md: větší změny schválit),
   pak po jednotkách. Testy: změna měsíce, Měsíc/Seznam, filtry, reload, Esc, hromadné smazání/zveřejnění,
   chyba, změna dat na serveru, potvrzení; lišta nesmí zakrývat karty ani zpětnou vazbu (i mobil).
2. Pak F–L podle zadání.

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst jeho důvody omluv (audit to zapíše).
  Doporučení: zakázat nastavení sebe. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0018 na produkci.
- Zvýšení limitu relace (hook `scripts/limit-kontextu.py`) jen vlastník.
