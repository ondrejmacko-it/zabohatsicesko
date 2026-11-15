# Úkoly z auditu 15. 11. 2026 (vlastní výtah, podklady do repa nepatří)

Stav k 15. 11. odpoledne. Hotové = sloučené nebo v otevřeném draft PR.

## Hotovo
* S01, S02 (PR 1), A01, A02, A04, A05, A06, A08 (PR 3), U01 (PR #33: Správa 320/360, Integrace ověřit znovu), U09 (PR #33: záložka Témata, stará kotva přesměruje).

## PR 5: stavy nahrávek a texty (A03, T01–T04)
* **A03** Nepodporovaná nebo selhaná nahrávka: Plán, výběr „Přidat zápis“, detail i čtenář musí ukazovat stejný stav (`journey.ts` 98–166, `recordings.ts` 281–329). Selhání služby = „Zkusit znovu“, špatný formát = „Nahrát jinou“, čtenář = „Zápis zatím nevyšel“. Při náhradě zůstává starý zveřejněný zápis vidět.
* **T01** Slovník: „Stáhnout zápis“ (stáhne ze zveřejnění) → „Vrátit zápis do návrhu“, „Pozvat“ uloží účet → přesně, sjednotit „Nahrát nahrávku“ (`RecordingSection.tsx` 69–78, `AccessForms.tsx` 212–223). Dál: Plán, Pro koho (akce), Skupiny (účty), Zápis k dokončení, Zveřejnit zápis, Povolit přihlášení. Zrušit akci (zveřejněná) / Smazat návrh / Zahodit návrh změny. Zavřít (prohlížení) / Zpět (potvrzení) / Zrušit (formulář). Vykání.
* **T02** Audio smí i správce, UI tvrdí jen vedoucí a kontrolor (`RecordingSection.tsx` 100, `EventPeek.tsx` 91). Čtenáři nevysvětlovat nedostupné funkce.
* **T03** Jedno formátování data pro detail i náhled, u vícedenní akce neopakovat první datum (`time.ts` 160–179).
* **T04** Integrace bez textu o historickém testu jako aktuálním stavu (`integrace/page.tsx` 67–91), `docs/predani.md` aktualizovat (uvádí 49 testů a staré režimy), `docs/google-kalendar.md` 94–116.
* Dalších 69 přepisů je v auditu v `textove-upravy.csv` (sloupce: původní, navržené znění, důvod, soubor/řádek, priorita).

## PR 6: přístupnost a přehlednost (U02–U08)
* **U02** Kontrast: hlavička mřížky 2,5:1 (`schedule.module.css` 19–28) → tmavá na zelenošedé 6,28:1. Drobný okrový text 4,44:1 → tmavší okr. Ověřit axe.
* **U03** Tlačítko zájmu: viditelný text a přístupný název se shodují, `aria-pressed` (`TopicActions.tsx` 23–26).
* **U04** Správa: čekající žádosti první, odkaz z upozornění na jejich kotvu, tlačítko „Nastavit a schválit“.
* **U05** Plán na telefonu: účastník hned nejbližší akci, vedoucí konkrétní úkol, správce krok měsíce. Prázdný panel úkolů skrýt.
* **U06** Neplatné `?akce=` / `?zapis=`: neutrální „Akce není dostupná“, návrat se zachovaným měsícem a filtrem, bez prozrazení cizí akce.
* **U07** `Menu.tsx` 63–93: buď disclosure s běžným Tab (bez `aria-haspopup`), nebo skutečné menu s klávesnicí. Návrat fokusu po zavření vnořeného okna.
* **U08** Mobilní dialog akce: pole vedle sebe jen při dostatku místa, souhrn chyb, fokus na první chybu, ověřit 320×256.

## PR 7: Připravit měsíc (G6)
Jedno okno: návrhy měsíce, mezery (bez tématu/vedoucího), publikum, stav párování. Přidání návrhu nic neodešle. Šablona zůstává v nastavení. Datum a skupiny ručně měnitelné.

## PR 8: bezpečnost a rychlost
`npm audit` (v auditu 0 zranitelností), hlavičky (CSP, Referrer-Policy), limity serverových akcí, počet dotazů na Plánu a Úvodu, logy bez citlivých údajů.

## Mimo rozsah teď
A07 (přepis, rozhodne firma), vlastní doména, logo a ověření aplikace u Googlu (firma Wiki zatím nemá).
