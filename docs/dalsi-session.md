# Navazující relace (stav 26. 11. 2026, relace 31 zadání „Finální dokončení po PR #92“)

Větev `claude/festive-sagan-lilorz` z main 2703a0b. Limit relace 170 tis. (start ~120 tis.: čti cíleně, výstupy
zkracuj). Nic nemergovat/nenasazovat, žádné vzdálené migrace, změny produkčního Vercelu/Neonu ani Google bez
schválení vlastníka. Před testy `npm ci`. Lint souboru: `npx eslint <soubor>`.

## Hotovo
- A–L hotovo (`git log 2703a0b..HEAD`; mělká historie: `git fetch --deepen=60`).
- Relace 30: ověření na deee432 – lint OK, typy OK, vitest 69/621 OK, `next build` OK, `npm audit --omit=dev` 0,
  celá e2e 1469 passed / 256 skipped / **0 failed** (12,0 min). Doplněno do reportu C (fa29abd).
- Screenshoty D: 18 PNG v `docs/screenshots/finalni-dokonceni/` + tabulka v reportu D (fa29abd). Žádné zástupné
  hodnoty v `docs/report-finalni-dokonceni.md` nezbývají.
- Pozn.: dočasný screenshotový spec mění sdílená data, takže v témže běhu shodí `zapis-temat` testy – mimo celou sadu
  je nepouštět s ním (spec je smazaný).

## Další krok
- Hotovo: draft PR #93 (`claude/festive-sagan-lilorz` → main), CI na 4f6d202 zelené (lint/typy/testy/build,
  e2e-smoke, citlivé cesty, Vercel Preview Ready), `mergeable_state: clean`. Finální report předán uživateli.
- Čeká jen na vlastníka: review a ruční merge PR #93, rozhodnutí níže. Bez nového zadání nic dalšího nedělat.

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst důvody omluv (audit to zapíše). Doporučení:
  zakázat. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0019 na produkci.
- Živý test F04 / aktivace účasti na testovacím kalendáři: schválení + testovací účty.
