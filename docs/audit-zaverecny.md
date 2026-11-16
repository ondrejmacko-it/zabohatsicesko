# Závěrečný audit (16. 11. 2026)

## Rozsah a postup

* Stav: lokální integrační větev `main` (`9c41df6`) + #47 + #48 + #49 + opravy z tohoto auditu. Větev se nepushuje.
* Servery `node e2e/server.mjs` (produkční build, ukázka na 3310 a ostrá Wiki s falešnými hodnotami Googlu na 3311),
  sezení z `e2e/.auth`, snímky `node scripts/audit-screenshoty.mjs <repo> <výstup>`.
* Role správce, vedoucí, účastník FP a účastník RM × šířky 1280, 390, 360 a 320 px × Úvod, Plán (měsíc i seznam),
  detail akce, Zápisy, Témata, Moje cesta (+ Správa a Integrace u správce). Vstupní stránky bez přihlášení
  (ukázka, ostrá Wiki, ostrá Wiki pro správce). Celkem 148 snímků, JPEG q60, celé stránky.
* Snímky jsou v `ZBC_Audit_zaverecny_2026-11-16.zip` (6,1 MB). Do repa nepatří.

## Výsledky automatických kontrol

| Kontrola | Výsledek |
| --- | --- |
| Vodorovný posun na všech 148 snímcích | žádný |
| `npm run lint`, `npx tsc --noEmit` | bez chyb |
| `npm test` (vitest) | větev oprav 199/199, integrační větev 202/202 |
| `npm run e2e` (7 profilů, Windows, macOS Retina, telefony 390/360/320) | větev oprav 788 prošlo, 30 přeskočeno, 0 selhalo; #47 totéž |

## Nálezy a opravy

| # | Nález | Kde | Stav |
| --- | --- | --- | --- |
| 1 | Na 320 px tlačítko „Mám zájem“ mačká název tématu do sloupce po slovech a začátek názvu přetéká pod tlačítko | Témata, všechny role | **Opraveno**: obsah karty má základ 12rem, tlačítka jdou na úzké kartě pod text |
| 2 | Tabulka „Režimy integrací“ se na 320 px láme po jednotlivých písmenech („Go / ogl / e“) | Integrace (správce, ukázka) | **Opraveno**: do 480 px je každý řádek pod sebou (název, režim, popis) |
| 3 | Hlavní menu na 320 px končí useknutou „Správa syst…“ | Všechny stránky správce | Ponecháno: menu je záměrně vodorovně posuvné, posun stránky nevzniká. Případně doplnit přechod do ztracena na pravém okraji |
| 4 | Zástupný text „Vyhledávání ve Wiki je mimo roz…“ je na 320 px useknutý | Úvod | Ponecháno: pole je neaktivní a nápověda je i ve čtečce. Případně kratší text |

Desktop 1280: karty Témat zůstávají ve dvou sloupcích s tlačítkem vpravo (ověřeno na snímku po opravě).
Vstupní stránky (ukázka i ostrá Wiki) jsou na všech šířkách bez posunu, karta uprostřed (#48).

## Co zbývá

* Živé ověření Kalendáře účastníků po merge #47 (čtení `setup_code`, režim self-invite, e-maily Gmail i Spam):
  postup v `docs/kalendar-ucastniku.md`, část „Po merge #47“.
* Skutečné Safari na Macu: postup v `docs/overeni-mac.md` (v prostředí není WebKit).
* A07 (rozhodne firma) a přepisy z `textove-upravy.csv` podle `docs/audit-ukoly.md`.
* Nálezy 3 a 4 jsou kosmetické, nechávám na rozhodnutí uživatele.
