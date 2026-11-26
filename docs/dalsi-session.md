# Navazující relace (stav 26. 11. 2026, relace 19 zadání „Finální dokončení po PR #92“)

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

- G1 (a93f0fb): lišta – na ≥1280 px Pohled geometricky uprostřed (mřížka 1fr auto 1fr), účet oddělený čarou
  a `role=group` „Přihlášený účet“, celý název pohledu v `title`. Snímky 1100/1280/1440 + náhled OK; e2e zahlavi,
  nahled, mobilni-ovladani 38 OK. Harmonogram prověřen snímky: účastník bez prázdného místa, Měsíc/Seznam odlišené.
- G2 (008c3e2): D03 vlastní oslovení – migrace 0019 `user_salutations` (approval), `salutationsEnabled()`,
  služba `services/salutation.ts`, akce `osloveni-actions.ts`, `SalutationForm` pod pozdravem na Domů.
  Testy: `tests/d03-osloveni.test.ts`, `e2e/osloveni.spec.ts` OK, tsc+eslint OK.

## Další krok
- G zbytek (zadání ř. 408–484): Domů – panely `.home-columns` mají přirozenou výšku (align-items:start; teď se
  natahují), štítek „Povinné pro tebe“ v kartě Co tě čeká se roztahuje na celou šířku (má být fit-content);
  počet Čeká na tebe = 1, ale úkol „Odpověz na pozvánky (2)“ – zvážit `count` u úkolu pozvánek (invitations.ts).
  Pak sjednocení dialogů (hlavička/patička, fokus, scroll) a průchod texty (tykání, Vede/Kdo, Pro koho/Pro skupinu).
- Snímky: dočasný spec v `e2e/zz-snimky.spec.ts` (typově čistý, do scratchpadu; necommitovat), spuštění
  `npx playwright test <spec> --project=prihlaseni --project=windows-1280 --project=telefon-390 --trace off`.
- Pak H (ř. 485–535), I (536–556), J (557–583), K (584–637), L (638–656), výstup (657+).
- Zadání: uložit do scratchpadu Pythonem (`json.JSONDecoder().raw_decode` po `{`, rekurzivně najít řetězec s
  „PO PR #92“ a „Fáze“), pak `sed -n` jen řádky fáze.
- Celou vitest sadu spustit jednou před předáním (naposledy celá na 8546138: 611 OK).

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst jeho důvody omluv (audit to zapíše).
  Doporučení: zakázat nastavení sebe. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0019 na produkci.
- Zvýšení limitu relace (hook `scripts/limit-kontextu.py`) jen vlastník.
