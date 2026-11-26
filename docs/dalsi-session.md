# Navazující relace (stav 26. 11. 2026, relace 26 zadání „Finální dokončení po PR #92“)

Větev `claude/festive-sagan-lilorz` z main 2703a0b (PR #92 v main). Limit relace 170 tis. (start ~120 tis.: čti
cíleně, výstupy zkracuj). Nic nemergovat/nenasazovat, žádné vzdálené migrace, změny produkčního Vercelu/Neonu ani
Google pozvánky bez schválení vlastníka. Před testy `npm ci`. Lint souboru: `npx eslint <soubor>` (bez `-q`).

## Zadání
Plné znění: první zpráva uživatele „ZBČ – FINÁLNÍ DOKONČENÍ PROJEKTU PO PR #92“ v relaci
session_01HpUiryLcisq3sp1bDNE1U2: `list_events` kinds=["user"], limit 100,
`before_id=ce15ad91-6fd8-49f9-b71c-5b737056552a` (výsledek jde do souboru; Python `raw_decode` od prvního `{`,
rekurzivně najdi nejdelší řetězec s „PO PR #92“ a „Fáze“). Řádky: L 638–656, výstup 657–727 (report A–E:
A nálezy s příčinou/souborem/závažností/opravou/důkazem; B matice F01–F18 přesně 18 řádků; C lint/typy/build/unit/
e2e/bezpečnost/migrace/PostgreSQL/Google; D screenshoty s prostředím a commitem; E co zbývá; L schvalovací
checklist 10 bodů – nic nespouštět).

## Hotovo
- A–J hotovo (git log 2703a0b..HEAD). J: vitest 621 OK, lint, typy (d453aca). Zásady matice F01–F18 viz
  `docs/pozadavky-f01-f18.md` (F04 simulace, F15 heuristika, Preview „čeká na DATABASE_URL“, produkce = PR #92).
- K: smoke E2E v CI (job `e2e-smoke` v `.github/workflows/ci.yml`, tagy `@smoke`, 125 testů v
  windows-1280 + telefon-390 + zapis-temat; `--list` ověřeno, teardown běží jen @smoke). Skipy mají důvod (36×,
  hlavně „zápis jen jednou“ / jen telefon / jen Chromium).
- Celá e2e sada na 5f8080f: 1444 passed, 256 skipped, 25 failed (13,4 min, 3 workery). Selhání jsou
  deterministická (všechny desktop projekty), ne nestabilita:
  1. OPRAVENO 51b2195: Zápisy axe – `.btn-note` opacity (kontrast 4,09) a aria-label tlačítka „K dokončení“ bez
     viditelného textu (`src/app/globals.css`, `src/app/(wiki)/vzdelavani/zapisy/page.tsx`). Ověřeno: stranky
     „Zápisy: axe|obsah“ 17/17 na windows-1280.
  2. OTEVŘENÉ `e2e/nahled-role.spec.ts:47` (FP, RM, vedoucí): v náhledu chybí tlačítko „Uložit“, které skutečný
     účet má (řádek 63 `buttons`). Zjistit, na které stránce z PAGES (pravděpodobně Témata nebo Domů po I/F změnách)
     a zda je chyba v náhledu (`src/…` render v preview) nebo v testu.
  3. OTEVŘENÉ `e2e/plan-planovani.spec.ts:173`: po kliknutí na typ filtru checkbox `typeBoxes.nth(0)` neexistuje /
     nemá fokus (po navigaci s `typ=` se seznam překreslí).
  4. OTEVŘENÉ `e2e/ucast.spec.ts:262` (@smoke, jen windows-1280): `locator.click: Test ended` na „Omluvit se“
     v `[data-ucast-panel]` (ř. 285) – asi timeout 30 s, test je dlouhý; zkontrolovat čekání, ne zvyšovat timeout.

## Další krok
1. Reprodukovat 2–4 samostatně (`npx playwright test --trace off --project=windows-1280 <soubor>:<řádek>`), opravit
   příčinu, commit + push po každé.
2. Celá sada znovu na pozadí (`--reporter=dot > scratchpad/e2e.txt`), cíl 0 failed.
3. L checklist + report `docs/report-finalni-dokonceni.md` (A–E) + screenshoty (D, malá sada) + draft PR do main.

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst důvody omluv (audit to zapíše). Doporučení:
  zakázat nastavení sebe. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0019 na produkci.
- Živý test F04 / aktivace účasti na testovacím kalendáři: schválení + testovací účty.
- Zvýšení limitu relace (hook `scripts/limit-kontextu.py`) jen vlastník.
