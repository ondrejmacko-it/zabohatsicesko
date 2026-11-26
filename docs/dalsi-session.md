# Navazující relace (stav 26. 11. 2026, relace 25 zadání „Finální dokončení po PR #92“)

Větev `claude/festive-sagan-lilorz` z main 2703a0b (PR #92 v main). Limit relace 170 tis. (start v cloudu zabere
~120 tis., na práci zbývá málo: čti cíleně, výstupy zkracuj). Nic nemergovat/nenasazovat, žádné vzdálené migrace,
změny produkčního Vercelu/Neonu ani Google pozvánky bez schválení vlastníka. Před testy `npm ci`.

## Zadání
Plné znění: první zpráva uživatele „ZBČ – FINÁLNÍ DOKONČENÍ PROJEKTU PO PR #92“ v relaci
session_01HpUiryLcisq3sp1bDNE1U2: `list_events` kinds=["user"], limit 100,
`before_id=ce15ad91-6fd8-49f9-b71c-5b737056552a` (výsledek jde do souboru; Python `raw_decode` od prvního `{`,
rekurzivně najdi nejdelší řetězec s „PO PR #92“ a „Fáze“, ulož do scratchpadu). Čti jen řádky:
K 584–637, L 638–656, výstup 657–727. (J 557–583 už přečteno, shrnutí níže.)

## Hotovo
- A–I hotovo (git log 2703a0b..HEAD). Preview čeká na vlastníka (Preview `DATABASE_URL` = Neon branch
  br-wandering-paper-b9ef86og, pak redeploy). I2: `src/server/calendar/activation.ts`, `docs/kalendar-migrace.md`.
- J ověřeno na d453aca: vitest 69 souborů / 621 OK, `npm run lint` OK, `npm run typecheck` OK.
  Mapování bod → test je v `docs/pozadavky-f01-f18.md` (tabulka „Bod → konkrétní testy“). Matice F01–F18 se píše
  do finálního reportu (sekce B, přesně 18 řádků: implementace, lokální ověření, Preview, produkce, omezení,
  schválení). Zásady pro matici: F04 = hotovo v simulaci, živý Google čeká na schválení (D06); F15 = lokální
  heuristika, budoucí AI bez trénování je firemní rozhodnutí/integrace; Preview u všech „neověřeno, čeká na
  Preview DATABASE_URL“; produkce = main má PR #92, změny této větve nejsou nasazené; F10 nově bez limitu
  garantovaných (e2e `temata-planovani` › „garantovaných témat je neomezeně…“, migrace 0015). D01–D07 doplnit
  do reportu stejným způsobem (D05 integrace do Moje ZBČ nezačala, D06 dodrženo).
- Celá e2e sada (1725 testů, 3 workery) spuštěná, po ~40 testech 3× F (pravděpodobně okna/harmonogram, neověřeno),
  běh zastaven kvůli limitu relace. Výsledek zatím není.

## Další krok (K)
1. `npx playwright test --trace off --reporter=dot > scratchpad/e2e.txt` na pozadí (run_in_background), pak
   `grep -n "✘\|failed\|flaky\|skipped" | head`. Selhání reprodukovat samostatně (`--project=windows-1280 -g …`),
   příčinu opravit (izolace dat mezi projekty/workery), ne retry/timeouty. Skipy zdokumentovat.
2. CI smoke E2E (nový job v `.github/workflows/ci.yml`, `npx playwright install` NE – v CI `npx playwright install
   --with-deps chromium`): přidat tag ` @smoke` do titulů a spouštět
   `npx playwright test --grep @smoke --project=windows-1280 --project=telefon-390 --project=zapis-temat`.
   Ověřit `--list`, že teardown projekt `zapis-temat` s CLI grep běží jen @smoke. Kandidáti:
   stranky.spec (obsah a bez vodorovného posunu; chráněné stránky vedou na vstup; vstup do ukázky; špatný kód),
   ucast.spec ř. 40, 143, 262; nahled.spec ř. 12, 164; temata-planovani ř. 444; rychle-akce scénář 1 (Zveřejnit
   návrh); zapisy-schvaleni ř. 12; ostra-wiki ř. 26.
3. Pak L (release checklist, bez spouštění) a výstup: report `docs/report-finalni-dokonceni.md` (A–E) + draft PR.

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst jeho důvody omluv (audit to zapíše).
  Doporučení: zakázat nastavení sebe. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0019 na produkci.
- Živý test F04 / aktivace účasti na testovacím kalendáři: schválení + testovací účty.
- Zvýšení limitu relace (hook `scripts/limit-kontextu.py`) jen vlastník.
