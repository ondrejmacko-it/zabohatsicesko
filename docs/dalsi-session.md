# Navazující relace (stav 26. 11. 2026, relace 18 zadání „Finální dokončení po PR #92“)

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
- A, B (Preview čeká na vlastníka: Preview `DATABASE_URL` = Neon branch br-wandering-paper-b9ef86og, pak redeploy),
  C01–C06, D1–D4, E1–E4, F1–F4 hotovo (viz git log).
- F1+F2 (82be4a1) okno K dokončení (Moje úkoly / Ostatní), F3 (d39fd02) upozornění na citlivá data nad polem.
  Zbytek F3 posouzen: struktura už odpovídá (hlavička stav + `ApproverNote`, upozornění nad polem, akce dole) – beze změny.
- F4 (b15660a + oprava typu): testy schvalování OK (`zapisy-f13-f15`, `zapisy-schvaleni`). `listTasks` nad limit
  `MAX_MINUTES_TASKS`=4 přidá souhrnný úkol `zapisy-dalsi` („Další zápisy k dokončení: N“, href
  `/vzdelavani/zapisy?pridat=1`, `count: N`); odznaky Čeká na tebe počítají `taskCount()` (journey.ts).
  Test `tests/k-dokonceni.test.ts` (5 OK). tsc OK.

## Další krok
- G celkové UI (zadání ř. 408–484): nejdřív snímky. Pozor: dočasný spec v `e2e/` shodí webServer (build dělá
  type check celého repa) – piš ho typově čistě, nebo do scratchpadu s vlastním configem. Spuštění:
  `npx playwright test <spec> --project=prihlaseni --project=windows-1280 --project=telefon-390 --trace off`.
  Přihlášení `test.use({ storageState: authFile("spravce") })` z `e2e/support.ts`, Pohled = `getByLabel("Pohled")`.
  Body G: horní lišta (Topbar.tsx, PreviewSwitch.tsx – centrování Pohledu, dlouhá jména, oddělit účet/kolegu/ukončení),
  harmonogram (4 úrovně: období, Měsíc/Seznam, filtry účasti, správa), Domů, sjednocení dialogů, texty (tykání, D03 oslovení).
- Pak H (ř. 485–535), I (536–556), J (557–583), K (584–637), L (638–656), výstup (657+).
- Zadání: uložit do scratchpadu Pythonem (`json.JSONDecoder().raw_decode` po `{`, rekurzivně najít řetězec s
  „PO PR #92“ a „Fáze“), pak `sed -n` jen řádky fáze.
- Celou vitest sadu spustit jednou před předáním (naposledy celá na 8546138: 611 OK).

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst jeho důvody omluv (audit to zapíše).
  Doporučení: zakázat nastavení sebe. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0018 na produkci.
- Zvýšení limitu relace (hook `scripts/limit-kontextu.py`) jen vlastník.
