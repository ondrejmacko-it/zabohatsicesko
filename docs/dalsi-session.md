# Navazující relace (stav 26. 11. 2026, relace 29 zadání „Finální dokončení po PR #92“)

Větev `claude/festive-sagan-lilorz` z main 2703a0b. Limit relace 170 tis. (start ~120 tis.: čti cíleně, výstupy
zkracuj). Nic nemergovat/nenasazovat, žádné vzdálené migrace, změny produkčního Vercelu/Neonu ani Google bez
schválení vlastníka. Před testy `npm ci`. Lint souboru: `npx eslint <soubor>`.

## Hotovo
- A–K hotovo (`git log 2703a0b..HEAD`; historie je mělká: `git fetch --deepen=60`). Všechny 4 chyby e2e opraveny (7dc9c8c).
- Relace 29: 151ec31 návod merge (main 2703a0b, 0019, aktivace účasti). `docs/report-finalni-dokonceni.md`
  napsán: A nálezy (C01–K5), B matice F01–F18, E zbývá, L checklist 10 bodů. Zástupné hodnoty k doplnění:
  `E2E_LINT`, `BUILD_RESULT`, `VITEST_RESULT`, `E2E_RESULT`, `E2E_COMMIT`, `AUDIT_RESULT`, `SCREENSHOTS`.
- Celá e2e na 3733419 (13,8 min): 1462 passed/256 skipped/7 failed, vše `e2e/okna.spec.ts:250` (odkaz K dokončení
  má po 51b2195 název podle viditelného textu). Opraveno c5ce055, ověřeno cíleně: windows-1280 + telefon-320 11 passed.
  Celou sadu pustit ještě jednou (~15 min, na pozadí) → cíl 0 failed, výsledek do reportu C (E2E_RESULT).

## Další krok
1. `npm run lint && npm run typecheck && npx vitest run --reporter=dot | tail -5 && npm run build | tail -5`,
   `npm audit --omit=dev | tail -3`; doplnit zástupné hodnoty v reportu (commit = HEAD před doplněním).
2. Screenshoty D (malá sada, každý s prostředím + commitem; seznam v reportu sekce D chybí – doplnit):
   Domů účastník a správce; budoucí povinná s Omluvit se; formulář omluvy; omluveno; dobrovolná s Přihlásit se;
   přihlášeno; odhlášeno; totéž v náhledu osoby (cookie `zbc_nahled=demo-spravce|kolega-demo-ucastnik`, viz
   `e2e/nahled-role.spec.ts`); ≥5 garantovaných témat (`e2e/temata-planovani.spec.ts:444`); „Vybrat návrhy“;
   návrh změny + vysunutí originálu (`e2e/priprava-mesice.spec.ts:285`, hover `[data-original-of]`); Zápisy;
   horní lišta; mobil 390. Účast na ukázce s PARTICIPATION=on (port 3313, `e2e/ucast.spec.ts` `plan`/`openCard`).
   Dočasný necommitovaný spec v `e2e/` (fixtures `authFile`, `settle`), PNG do
   `docs/screenshots/finalni-dokonceni/`, spec smazat. Do reportu D tabulka: soubor, co ukazuje, prostředí, commit.
3. Draft PR do main podle `.github/pull_request_template.md` (simulace vs. živý test, výsledky) + subscribe;
   pak report uživateli (poslední relace).

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst důvody omluv (audit to zapíše). Doporučení:
  zakázat. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0019 na produkci.
- Živý test F04 / aktivace účasti na testovacím kalendáři: schválení + testovací účty.
