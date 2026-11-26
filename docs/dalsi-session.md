# Navazující relace (stav 26. 11. 2026, relace 15 zadání „Finální dokončení po PR #92“)

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
  C01–C06, D1–D4 hotovo (viz git log). `e2e/ucast.spec.ts:262` samostatně OK (v celé sadě jen timeout pod zátěží).
- E1 (abb7f96): `draftBreakdown`/`draftHint` v `status.ts`, štítek Návrhy má nápovědu s rozpadem
  (nové / změny zveřejněných / v minulosti jen smazat / bez tématu či vedoucího); počet = filtr „navrhy“
  (konzistentní). Test `tests/navrhy-rozpad.test.ts`. tsc + eslint čisté.

- E2–E4 (6aa27c6): lišta „Vybráno Y z X nových návrhů“ + rozpad (`data-testid=rozpad-vyberu`); návrhy změn
  z viditelných karet (`draftBreakdown(cards).changes`); `picked` = Map id→revize, po refresh (i po chybě akce)
  vyřadí změněné s hláškou v `duvod-vyberu`; `SelectionZone key` = měsíc|typ|stav|ucast. Nový
  `e2e/vyber-kontext.spec.ts` (v projektu zapis-temat přidán do testMatch) – prošel na windows-1280, telefon-390,
  zapis-temat. tsc + eslint čisté. Celá vitest sada po změně neověřena (výstup se ořízl) – spustit `npx vitest run`.
  Zveřejnění z výběru e2e v tomto souboru není (kryjí ho okna/priprava-mesice).

## Další krok
1. `npx vitest run --reporter=dot | tail -5` (kontrola po E2–E4).
2. Fáze F Zápisy (zadání ř. 350–407), pak G (408–484), H, I, J, K, L a výstup (657+) podle zadání.

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst jeho důvody omluv (audit to zapíše).
  Doporučení: zakázat nastavení sebe. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0018 na produkci.
- Zvýšení limitu relace (hook `scripts/limit-kontextu.py`) jen vlastník.
