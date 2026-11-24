# Navazující relace (stav 24. 11. 2026)

## Stav
- Větev `oprava/kompletni-audit-rozhrani-a-funkci` (draft PR #87 do `main`) obsahuje opravu překryvu lišty harmonogramu
  a sloučené větve auditu: #88 (účast, náhledy, U09/U10/PM-13), #89 (příprava měsíce, O1–O4), #90 (témata, zápisy,
  Úvod, Kalendář). Rozhodnutí vlastníka jsou zapsaná v `docs/audit-2026-11-23/*.md`.
- Ověřeno na spojené větvi: `npx eslint . --ignore-pattern ".claude/**"` 0 nálezů, `npx tsc --noEmit` OK,
  `npx vitest run` 58 souborů / 581 testů zelených. Bez nové migrace, beze změny konfigurace a přepínačů.
- NEOVĚŘENO: celá sada Playwright na spojené větvi. Běh byl spuštěn, ale přerušen vypnutím počítače.
  Relace hlásily dva padající testy témat mimo svůj rozsah: `e2e/temata-planovani.spec.ts:216` (pořadí témat)
  a „starší test účastníka na Tématech“.

## Částečný běh E2E (649 z 1618 testů, přerušeno)
Selhání (opakují se na windows-1280 i windows-1920):
- `e2e/stranky.spec.ts:32` Účastník FP: „Detail akce RM“ a „Detail akce týmu A“; Účastník RM: „Detail akce týmu A“.
  Pravděpodobně test čeká starou viditelnost (cizí akce = „není dostupná“), ale od PR #86 je zveřejněná akce vidět všem.
  Ověřit, co test tvrdí, a upravit na platné pravidlo bez oslabení (nezveřejněné/soukromé údaje dál nesmí uniknout).
- `e2e/temata-planovani.spec.ts:455` Témata očima účastníka (F10–F12): ověřit oproti #90 (Nejžádanější/garance).

## Další krok
1. `npx playwright test --reporter=line` na této větvi (porty v `e2e/constants.mjs` jsou pevné, nesmí běžet jiné worktree).
2. Každé selhání rozhodnout: skutečná chyba → oprava kódu, zastaralé očekávání → úprava jen podle platného pravidla.
3. Prohlédnout snímky harmonogramu, náhledů a okna Připravit měsíc (320/768/1280/1920).
4. Teprve pak doplnit report do PR #87 a označit ho jako připravený. Merge do `main` dělá jen vlastník.

## Pozn.
- `npx eslint .` bez `--ignore-pattern` prochází i ignorované `.claude/worktrees/` (worktree relací) a hlásí tisíce
  falešných nálezů. Worktree lze po skončení smazat.
