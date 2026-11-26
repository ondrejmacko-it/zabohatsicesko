# Navazující relace (stav 26. 11. 2026, relace 27 zadání „Finální dokončení po PR #92“)

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
- Celá e2e sada na 5f8080f: 1444 passed, 256 skipped, 25 failed (deterministická, desktop projekty). Stav oprav:
  1. OPRAVENO 51b2195: Zápisy axe (`.btn-note` kontrast, aria-label „K dokončení“).
  2. OPRAVENO 3d4967a: náhled Domů skrýval formulář oslovení („Uložit“). Nyní zamčený (`SalutationForm` `locked`),
     `saveSalutation` v náhledu nic nezapíše. nahled-role + osloveni 13/13 (windows-1280).
  3. OPRAVENO b1b8f24: `SelectionZone` měl `key` s filtry → přemontování zavřelo nabídku Filtry. Teď prop
     `contextKey` + reset stavu při vykreslení, hlášení akce se po změně kontextu neukáže. plan-planovani +
     vyber-* 20 passed (windows-1280, zapis-temat).
  4. OTEVŘENÉ `e2e/ucast.spec.ts:262`: samotný (`-g nadřízeného`) projde, celý `ucast.spec.ts` na windows-1280
     selže (16 passed, 1 failed): `locator.click: Test ended` na „Omluvit se“ (ř. 285) v ownPage (FP). Tedy
     závislost na pořadí: dřívější test v souboru (ř. 40 smoke účast, ř. 93 F04, ř. 143 soukromí) nechá na
     poslední povinné kartě listopadu FP stav, kde panel nemá „Omluvit se“ (pravděpodobně omluvená/přihlášená
     akce bez úklidu, nebo `openCard` vybere jinou kartu). Postup: v testu 262 vypsat `data-ucast-panel` atribut
     a tlačítka ownPage; najít test bez úklidu; opravit úklid nebo `openCard(…, except)`. Timeout nezvyšovat.

## Další krok
1. Opravit bod 4 (běh: `npx playwright test --trace off --project=windows-1280 e2e/ucast.spec.ts`, ~3 min,
   spouštět na pozadí), commit + push.
2. Celá sada znovu na pozadí (`--reporter=dot > scratchpad/e2e.txt`), cíl 0 failed.
3. L checklist (10 bodů ze zadání, nic nespouštět; env: PARTICIPATION, CALENDAR_MODE/DELIVERY/ATTENDEES,
   APPROVED_MIGRATIONS, migrace 0015–0019) + report `docs/report-finalni-dokonceni.md` (A–E) + screenshoty D
   (malá sada, s prostředím a commitem) + draft PR do main. Zadání L/výstup: viz výše (řádky 638–727).

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst důvody omluv (audit to zapíše). Doporučení:
  zakázat nastavení sebe. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0019 na produkci.
- Živý test F04 / aktivace účasti na testovacím kalendáři: schválení + testovací účty.
- Zvýšení limitu relace (hook `scripts/limit-kontextu.py`) jen vlastník.
