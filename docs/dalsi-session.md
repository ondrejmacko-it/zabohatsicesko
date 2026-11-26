# Navazující relace (stav 26. 11. 2026, relace 24 zadání „Finální dokončení po PR #92“)

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
- F, G (G1–G5), H (H1, H2, snímky) hotovo – detaily v git logu (82be4a1 … d7fe624).
  Pozor: dočasný snímkový spec, který uloží návrh na ev-11-26, rozbije teardown `vyber-navrhu`.
- I1 (0889e6a): rollback `PARTICIPATION` – `participationSchemaReady()` (config.ts), `eventAttendees` při
  vypnutém přepínači a existujících záznamech akce počítá hosty dál ze záznamů. Test v `kalendar-ucast`
  („rollback přepínače…“). Kalendářové testy 61 OK, tsc+eslint OK.
- I pokrytí ověřeno čtením testů: pozvánka povinné (f04), omluva ihned + odebrání bez declined (f04, ucast),
  dobrovolný po přihlášení/odhlášení (f04, ucast), zrušení omluvy obnoví (ucast), role/deaktivace (ucast),
  bez duplicit (f04 souběh, ucast), ruční hosté+RSVP (ucast, google-calendar), chyba Googlu (f04).

- I2 (3463545): `src/server/calendar/activation.ts` – `activationInventory` (jen čte, počty bez adres: přidání
  povinní/přihlášení, odebrání omluvení/nepřihlášení/neaktivní, starší vazby, otisk) a `queueActivationSync`
  (dry-run bez otisku; jinak jen s `PARTICIPATION=on` a shodným otiskem, po dávkách, audit). CLI
  `scripts/kalendar-migrace.ts aktivace-ucasti | synchronizovat-ucast`, postup v `docs/kalendar-migrace.md`.
  `participationInputs` sdílené s `eventAttendees`. Test v `kalendar-ucast` (aktivace…). Kalendář 35 OK, tsc+eslint OK.
  Fáze I hotová (živý test jen po schválení vlastníka).

## Další krok
- J (zadání ř. 557–583): matice F01–F18 + D01–D07 proti `docs/pozadavky-f01-f18.md`, integrace/firemní
  rozhodnutí označit, ne Hotovo. Pak K (584–637), L (638–656), výstup (657+): report + draft PR.
- Zadání: `list_events` výsledek → Python (`raw_decode` po `{`, rekurzivně řetězec s „PO PR #92“ a „Fáze“) do
  scratchpadu, pak `sed -n` jen řádky fáze.
- Celou vitest sadu spustit jednou před předáním (naposledy celá na 8546138: 611 OK).

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst jeho důvody omluv (audit to zapíše).
  Doporučení: zakázat nastavení sebe. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0019 na produkci.
- Živý test F04 / aktivace účasti na testovacím kalendáři: schválení + testovací účty.
- Zvýšení limitu relace (hook `scripts/limit-kontextu.py`) jen vlastník.
