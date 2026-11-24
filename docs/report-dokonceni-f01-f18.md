# Report: finální dokončení F01–F18 po PR #91

Větev `claude/nice-lamport-vjfy87` (z `main` a30605c), 24. 11. 2026. Znění bodů: `docs/pozadavky-f01-f18.md`,
mapování na testy tamtéž. Release postup: `docs/navod-merge-f01-f18.md`.

## Stav F01–F18

„Simulace“ = ověřeno lokálně (PGlite, simulace Kalendáře), Preview i e2e. „Produkce“ = co uvidí ostrá Wiki po merge.

| Bod | Stav | Co je hotové | Ověření | Produkce po merge |
|---|---|---|---|---|
| F01 | Hotovo | Pro koho (Všichni / FP / RM) v přípravě měsíce i v okně akce | unit `priprava-mesice`, `ucast-role`; e2e `okna` | vidět |
| F02 | Hotovo | Štítky Povinné pro tebe / Můžeš se přihlásit (`ParticipationBadge`), filtr Moje/Všechny, Povinné/Dobrovolné | unit `ucast-role`, `ucast-prihlasky`; e2e `ucast`, `stranky` | za přepínačem (0016+0017 a `PARTICIPATION=on`) |
| F03 | Hotovo | Omluvit se (nemoc / dovolená / jiné + poznámka), Přihlásit/Odhlásit; omluvu čte nadřízený nastavený ve Správě (0018) | unit `ucast-prihlasky`, `omluvy-nadrizeny`; e2e `ucast` (vč. nadřízeného) | za přepínačem (+0018) |
| F04 | Hotovo v simulaci | Povinná = pozvánka po zveřejnění, omluva odebere z hostů, dobrovolná až po přihlášení | unit `kalendar-f04`, `kalendar-ucast`; e2e `ucast` F04 | za přepínačem; živý Google jen po schválení (D06) |
| F05 | Hotovo | Více rolí = povinné akce všech rolí, pozvánka jen jednou | unit `ucast-role`; e2e `ucast` F05 | za přepínačem |
| F06 | Hotovo | Jedno hlavní Připravit měsíc, prázdný stav jednou | unit + e2e `priprava-mesice-f06-f09` | vidět |
| F07 | Hotovo | Průvodce ukáže všechny kroky, jedno Zavřít; nově i Navrhnout téma s jedním Zavřít | e2e `priprava-mesice-f06-f09`, `temata-planovani` (C-03) | vidět |
| F08 | Hotovo | Hromadně téma i vedoucí, štítek Chybí téma filtruje řádky | unit + e2e `priprava-mesice-f06-f09` | vidět |
| F09 | Hotovo | Šedé Zveřejnit říká proč („Doplň téma a vedoucího u N akcí.“) | unit + e2e `priprava-mesice-f06-f09` | vidět |
| F10 | Hotovo | Vysvětlení garantovaných témat, filtr Pro mou roli / Všechna (více rolí) | unit `temata-f10-f12`; e2e `temata-planovani`, `ucast` | vidět |
| F11 | Hotovo | Úchyty a pořadí jen správce, pořadí ověřuje server | unit `temata-f10-f12`; e2e `temata-planovani` | vidět |
| F12 | Hotovo | Bez „zatím neproběhlo“, „Termín se potvrzuje“ | unit `temata-f10-f12`; e2e `temata-planovani` | vidět |
| F13 | Hotovo | Kdo zápis schvaluje; úkol napsat zápis má vedoucí nebo správce | unit `zapisy-f13-f15`; e2e `zapisy-schvaleni` | vidět |
| F14 | Hotovo | Jedno pole „Vlož přepis nebo poznámky“ + soubor, nahrávka skrytá | unit `zapisy-f13-f15`; e2e `zapisy-bez-nahravky` | vidět |
| F15 | Hotovo | AI vynechá jména a kontakty klientů, služba bez trénování | unit `zapisy-f13-f15`; e2e `zapisy-bez-nahravky` | vidět |
| F16 | Hotovo | Náhled za kolegu s jeho jménem, bez Správy systému; náhled kolegy-správce 1:1 jen ke čtení | unit `nahled`, `audit-ucast-nahledy`; e2e `nahled` | vidět |
| F17 | Hotovo | Tykání, „Ahoj, Anno“ (5. pád, neutrální tvar), „Co tě čeká“ | unit `osloveni`; e2e `domu-ukoly`, `nahled` | vidět |
| F18 | Hotovo | Záhlaví na užším okně na jednom řádku | e2e `zahlavi` | vidět |

## UX body zadání po PR #91

| Bod | Stav |
|---|---|
| 8 – stoh návrhu změny | **Vráceno.** PR #91 (791840a) omylem odstranil překrytí zveřejněné verze kartou návrhu. Okrová karta znovu leží na „Zveřejněné verzi“, najetí myší na pruh ji vysune (bez animace při omezeném pohybu), v režimu výběru originál okno neotevře. e2e `priprava-mesice` (hover, z-index, opacity, reduced motion), `vyber-navrhu`. |
| Navrhnout téma – dvakrát Zavřít | **Hotovo.** Jen Zavřít v záhlaví, s rozepsaným návrhem se zeptá. e2e `temata-planovani` C-03. |
| 9, 11, 13 | **Odloženo vlastníkem** (24. 11.), přesné znění není v repu. |

## Ověření (commit viz PR)

Na a32243e (kód), 24. 11. 2026, cloudový kontejner, Chromium:

* `npm run lint` OK, `tsc --noEmit` OK, `vitest run` 591/591, `npm run build` OK.
* Celé e2e (všechny projekty: 1280, 1920, 1440, 1512, telefony 390/360/320, zápisy): **1441 passed, 250 skipped,
  1 failed**. Selhání: `ucast.spec.ts:262` „nadřízený pro omluvy“ (windows-1280), překročený limit 90 s pod plnou
  zátěží. Samostatně hned poté prošel (8/8 vč. přihlášení). Bez opravy, sledovat v CI.
* Cílené po změně stohu: `priprava-mesice`, `vyber-navrhu`, `temata-planovani` (1280, 390, zápisy) prošly;
  dvě chyby v paralelním běhu (sdílená data souběžných projektů) samostatně prošly.
* Simulace × živý test: Kalendář jen simulace a fake Google; DB migrace 0016–0018 jen SQL na izolovaném Neon
  branchi, aplikace proti němu neběžela.

## Rizika a otevřené věci

* Účast (F02–F05) v produkci až po schválení migrací 0015–0018 na `zbc-wiki-produkce` a `PARTICIPATION=on`.
  Aplikaci proti izolovanému Neon branchi z cloudu spustit nejde. Doporučený test je Preview s jeho `DATABASE_URL`
  (změna Vercel proměnných, potřebuje schválení), nebo lokálně `scripts/overeni-ucasti-db.ts`.
* Živé pozvánky Google (F04) neověřené, jen simulace a fake Google (D06).
* Skutečné mapování nadřízených a dobu uchování omluv dodá firma.
* Neon branch `overeni-ucast-0016-0018` smazat po Preview testu (free limit 10 branchí).
