# Navazující relace (stav 26. 11. 2026, relace 28 zadání „Finální dokončení po PR #92“)

Větev `claude/festive-sagan-lilorz` z main 2703a0b. Limit relace 170 tis. (start ~120 tis.: čti cíleně, výstupy
zkracuj). Nic nemergovat/nenasazovat, žádné vzdálené migrace, změny produkčního Vercelu/Neonu ani Google bez
schválení vlastníka. Před testy `npm ci`. Lint souboru: `npx eslint <soubor>`.

## Hotovo
- A–J hotovo (`git log 2703a0b..HEAD`, těla commitů C01–I2 = podklad pro report A). J: vitest 621 OK, lint, typy.
- K: smoke E2E v CI (`e2e-smoke`, @smoke). Všechny 4 deterministické chyby z běhu na 5f8080f opraveny:
  51b2195 (axe Zápisů), 3d4967a (náhled Domů, oslovení), b1b8f24 (nabídka Filtry), 7dc9c8c (`ucast.spec`: test
  „soukromí omluvy“ nechal omluvu bez úklidu → test 262 vybral proběhlou akci). `ucast.spec` 24 passed/1 skip.
- Celá sada po 7dc9c8c NEDOBĚHLA (relace skončila) – spustit znovu.

## Další krok
1. Celá e2e na pozadí: `npx playwright test --trace off --reporter=dot > <scratchpad>/e2e.txt 2>&1` (~1–1,5 h,
   předchozí: 1444 passed/256 skipped/25 failed). Cíl 0 failed; nové chyby opravit po jednotkách.
2. Mezitím `docs/report-finalni-dokonceni.md` (zadání „Finální výstup“):
   A nálezy: problém, příčina, soubor, závažnost, oprava, důkaz (z commitů C01–K4).
   B matice F01–F18 přesně 18 řádků: stav implementace, lokální ověření, Preview ověření, produkční stav, omezení,
     chybějící schválení (zdroj `docs/pozadavky-f01-f18.md`; F04 simulace, F15 heuristika, Preview „čeká na
     DATABASE_URL“, produkce = PR #92 bez PARTICIPATION).
   C lint, typy, build, unit, e2e, bezpečnost, migrace, skutečný PostgreSQL (Neon branch
     `overeni-ucast-0016-0018`), Google (simulace, živý test neschválen).
   D screenshoty (malá sada, každý s prostředím + commitem): Domů účastník a správce; budoucí povinná s Omluvit se;
     formulář omluvy; omluveno; dobrovolná s Přihlásit se; přihlášeno; odhlášeno; totéž v náhledu osoby (cookie
     `zbc_nahled=demo-spravce|kolega-demo-ucastnik`, viz `e2e/nahled-role.spec.ts`); ≥5 garantovaných témat (postup
     v `e2e/temata-planovani.spec.ts:444`); hromadný výběr („Vybrat návrhy“); návrh změny + vysunutí originálu
     (`e2e/priprava-mesice.spec.ts:285`, hover `[data-original-of]`); Zápisy; horní lišta; mobil 390.
     Účast běží na ukázce s PARTICIPATION=on (port 3313, `e2e/ucast.spec.ts` `plan`/`openCard`). Postup: dočasný
     necommitovaný spec v `e2e/` (fixtures `authFile`, `settle`), spustit PO celé sadě, PNG do
     `docs/screenshots/finalni-dokonceni/`, spec smazat.
   E co zbývá: jen schválení, rozhodnutí firmy, chybějící integrace, neověřená produkce, rizika.
3. L schvalovací checklist (do reportu, nic nespouštět), 10 bodů: ověření deploymentu (rollback `a30605c`, PR #91;
   po merge nový), DB + záloha (Neon `zbc-wiki-produkce`, branch snapshot; má 0001–0014), čekající migrace
   0015–0019 (všechny `approval: true`, `src/server/db/migrations.ts`), pořadí: záloha → merge → APPROVED_MIGRATIONS
   (0015…0019) + redeploy → `SELECT id FROM schema_migrations` → `kalendar-migrace.ts aktivace-ucasti` (otisk) →
   PARTICIPATION=on → nadřízení ve Správě → `synchronizovat-ucast --provest <otisk> --davka 20` → smoke →
   rollback (Instant Rollback; PARTICIPATION smazat; migrace jen přidávají; hosté s uloženou účastí se nemění, I1).
   Ke každému: změna, účel, riziko, následek. Podklady `docs/navod-merge-f01-f18.md`, `docs/kalendar-migrace.md`
   (sekce Aktivace účasti). Aktualizovat návod o 0019.
4. Draft PR do main (šablona PR v repu, pokud je) + subscribe; pak report uživateli (až vše hotovo).

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst důvody omluv (audit to zapíše). Doporučení:
  zakázat. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0019 na produkci.
- Živý test F04 / aktivace účasti na testovacím kalendáři: schválení + testovací účty.
