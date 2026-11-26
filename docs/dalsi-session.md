# Navazující relace (stav 26. 11. 2026, relace 17 zadání „Finální dokončení po PR #92“)

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
  C01–C06, D1–D4, E1–E4 hotovo (viz git log). Vitest na 8546138: 67 souborů / 611 OK.
- F1+F2 (82be4a1): `MissingMinutesItem.mine` (= `minutesTaskRole` write, nebo review a draft), okno K dokončení
  `RouteModal wide` + klientský `MissingMinutesList.tsx` (mřížka `.missing-row` Název·Datum·Vedoucí·Stav·Akce,
  štítky Chybí vedoucí/Chybí zápis/Rozpracováno/Čeká na schválení, skupiny „Moje úkoly“ / „Ostatní (správcovský
  přehled)“ jakmile jsou cizí akce, hledání + filtr stavu od 7 položek). Tlačítko: badge = moje, „· všech N“ u správce.
  Test `tests/k-dokonceni.test.ts`, e2e `okna.spec.ts:250` rozšířen (windows-1280 + telefon-390 OK). CSS `.picker-*` odstraněno.
- F3 část (d39fd02): `MinutesSourceForm` krátké upozornění `.notice` NAD polem, technický text v `<details>`
  (`data-testid=citliva-data` zachován). e2e `zapisy-schvaleni.spec.ts` OK.

## Další krok
- F3 zbytek: oddělit Kontext / Stav a odpovědná osoba (`RecordingSection` hlavička + `ApproverNote`) / Vstup / Akce
  – nejdřív se podívat, zda to po F3 části ještě dává smysl (malá změna, nebo přeskočit).
- F4 schvalování: ověřit testy (`tests/zapisy-f13-f15.test.ts`, re-approval `approvedVersion` v `RecordingSection`).
- Zvážit popisek „Čeká na tebe“ (Domů/Plán, `MAX_MINUTES_TASKS`=4) – odkaz na K dokončení, když je víc.
- Pak G (zadání ř. 408–484), H, I, J, K, L a výstup (657+). Zadání: uložit do scratchpadu Pythonem
  `json.JSONDecoder().raw_decode` (soubor má víc JSON řádků), hledat řetězec s „PO PR #92“ a „Fáze“.
- Celou vitest sadu spustit jednou před předáním (po F1 neověřena celá, jen cílené soubory).

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst jeho důvody omluv (audit to zapíše).
  Doporučení: zakázat nastavení sebe. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0018 na produkci.
- Zvýšení limitu relace (hook `scripts/limit-kontextu.py`) jen vlastník.
