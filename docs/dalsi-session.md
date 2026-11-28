# Navazující relace (stav 28. 11. 2026, relace 78)

Cíl: finální opravné kolo UI PC + mobil (zadání vlastníka body 0–12). Implementace HOTOVA, čeká na review vlastníka.
Bez merge, deploye, produkční DB, živého Googlu a Make. Screenshoty ani zadání do repa nedávat.

Větev `claude/finalni-vyladeni-ui-pc-mobil` z main `7e9b886`, HEAD `c2d6961` (+ tato předávka).
Draft PR: https://github.com/ondrejmacko-it/zabohatsicesko/pull/96

## Hotovo
- Všechny body zadání, tabulka po oblastech s commity: `docs/report-finalni-ui-pc-mobil.md` (+ checklist živého ověření Účasti).
- Domů: 2+ zaseknuté pozvánky = jeden úkol `kalendar-pozvanky` s `count` (`a191fc6`, test v `tests/journey.test.ts`).
- Plán: „Dnes“ na kontejneru ≤ 400 px jde pod název měsíce (`globals.css`, `c2d6961`).
- e2e srovnány se záměrnými změnami: editace akce přes `upravit=1` / odkaz „Upravit akci“, věta „Omluva zaznamenána.“.

## Ověřeno
- `a191fc6`: lint 0, tsc 0, vitest 636/636, build OK, e2e 1581 passed / 20 failed.
- `c2d6961` (nový build): všech 20 dříve padajících testů prošlo (`--last-failed` 33/33 + `vyber-navrhu`).
  Celé e2e na `c2d6961` znovu neběželo, mění se jen CSS lišty Plánu a testy.

## Další krok
- Vlastník: review draftu PR, živé ověření Účasti podle checklistu v reportu, ruční merge.
- Při připomínkách z PR: oprava na stejné větvi, cíleně e2e (`--project=telefon-360 --no-deps`, po změně `npx next build`).

## Technika
- NEPOUŽÍVAT prettier. e2e server jede nad buildem.

## Otevřené otázky pro vlastníka
- Žádné blokující.
