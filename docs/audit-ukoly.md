# Úkoly z auditu 15. 11. 2026 (vlastní výtah, podklady do repa nepatří)

Stav k 16. 11. Hotové = sloučené v `main` nebo v otevřeném draft PR. Vše z auditu je hotové kromě A07 (mimo rozsah) a 69 textových přepisů z `textove-upravy.csv` (potřebují audit ZIP, v relaci nebyl).

## Hotovo
* S01, S02 (PR 1), A01, A02, A04, A05, A06, A08 (PR 3), U01 (PR #33: Správa 320/360, Integrace ověřit znovu), U09 (PR #33: záložka Témata, stará kotva přesměruje).

## PR 5: stavy nahrávek a texty (A03, T01–T04) · draft, větev `claude/audit-texty-a03`
Hotovo v kódu: A03 (`progressOf`, `recordingProgressByEvent` v `journey.ts`, špatný soubor bez „Zkusit znovu“), T01/T02 a přepisy z tabulky, T03 (`formatEventWhen`), T04 (Integrace, `predani.md`, `google-kalendar.md`), neutrální okno „Akce/Zápis není dostupný“ (část U06). Testy `tests/stav-nahravky.test.ts`. **Neověřeno v Chromiu** (lokální `next start` přes http: CSP blokuje skripty, přihlášení neprojde, použít `next dev`).

* **A03** Nepodporovaná nebo selhaná nahrávka: Plán, výběr „Přidat zápis“, detail i čtenář musí ukazovat stejný stav (`journey.ts` 98–166, `recordings.ts` 281–329). Selhání služby = „Zkusit znovu“, špatný formát = „Nahrát jinou“, čtenář = „Zápis zatím nevyšel“. Při náhradě zůstává starý zveřejněný zápis vidět.
* **T01** Slovník: „Stáhnout zápis“ (stáhne ze zveřejnění) → „Vrátit zápis do návrhu“, „Pozvat“ uloží účet → přesně, sjednotit „Nahrát nahrávku“ (`RecordingSection.tsx` 69–78, `AccessForms.tsx` 212–223). Dál: Plán, Pro koho (akce), Skupiny (účty), Zápis k dokončení, Zveřejnit zápis, Povolit přihlášení. Zrušit akci (zveřejněná) / Smazat návrh / Zahodit návrh změny. Zavřít (prohlížení) / Zpět (potvrzení) / Zrušit (formulář). Vykání.
* **T02** Audio smí i správce, UI tvrdí jen vedoucí a kontrolor (`RecordingSection.tsx` 100, `EventPeek.tsx` 91). Čtenáři nevysvětlovat nedostupné funkce.
* **T03** Jedno formátování data pro detail i náhled, u vícedenní akce neopakovat první datum (`time.ts` 160–179).
* **T04** Integrace bez textu o historickém testu jako aktuálním stavu (`integrace/page.tsx` 67–91), `docs/predani.md` aktualizovat (uvádí 49 testů a staré režimy), `docs/google-kalendar.md` 94–116.
* Dalších 69 přepisů je v auditu v `textove-upravy.csv` (sloupce: původní, navržené znění, důvod, soubor/řádek, priorita).

## Testy desktop a macOS · draft #35, větev `claude/testy-desktop-macos` (stojí na #34)
`npm run e2e` (Playwright, 750 testů, 7 projektů). Opraveno: CSP bez nonce na `/soukromi` a 404, menu na telefonu se hned zavíralo, návrat fokusu z okna otevřeného z menu (část U07), Integrace 320 px.

## PR 6: přístupnost a přehlednost (U02–U08) · sloučené (#36, #38)
Hotovo: **U02** (#36). **U03** tlačítko zájmu má stále text „Mám zájem“ bez vlastního `aria-label`, stav nese `aria-pressed` a fajfka, téma se čte přes `aria-describedby` z nadpisu karty. **U04** pořadí (žádosti první) a „Nastavit a schválit“ už byly, nově úkol „Projít žádosti“ vede na `/sprava#zadosti`. **U05** účastník bez úkolů má na telefonu nahoře „Nejbližší akce“ (z načteného měsíce, jinak jeden dotaz), krok měsíce správce je vždy mezi třemi viditelnými úkoly, prázdný panel se nezobrazuje. **U06** (#34/#35). **U07** menu je disclosure: bez `aria-haspopup`, položky běžným Tab, odchod fokusu menu zavře, návrat fokusu z okna (#35). **U08** dialog akce skládá pole podle šířky formuláře (container query, ne okna), souhrn chyb nahoře, fokus na první chybné pole (i ve sbalených Dalších údajích), ověřeno 320×256. Testy: `e2e/pristupnost.spec.ts`, `tests/journey.test.ts`.

* **U02** Kontrast: hlavička mřížky 2,5:1 (`schedule.module.css` 19–28) → tmavá na zelenošedé 6,28:1. Drobný okrový text 4,44:1 → tmavší okr. Ověřit axe.
* **U03** Tlačítko zájmu: viditelný text a přístupný název se shodují, `aria-pressed` (`TopicActions.tsx` 23–26).
* **U04** Správa: čekající žádosti první, odkaz z upozornění na jejich kotvu, tlačítko „Nastavit a schválit“.
* **U05** Plán na telefonu: účastník hned nejbližší akci, vedoucí konkrétní úkol, správce krok měsíce. Prázdný panel úkolů skrýt.
* **U06** Neplatné `?akce=` / `?zapis=`: neutrální „Akce není dostupná“, návrat se zachovaným měsícem a filtrem, bez prozrazení cizí akce.
* **U07** `Menu.tsx` 63–93: buď disclosure s běžným Tab (bez `aria-haspopup`), nebo skutečné menu s klávesnicí. Návrat fokusu po zavření vnořeného okna.
* **U08** Mobilní dialog akce: pole vedle sebe jen při dostatku místa, souhrn chyb, fokus na první chybu, ověřit 320×256.

## PR 7: Připravit měsíc (G6) · sloučené #39, větev `claude/pripravit-mesic`
Hotovo: tlačítko „Připravit měsíc“ vidí správce vždy (i bez návrhů, s počtem návrhů). Okno: „Doplnit chybějící termíny“ (`generateMonthAction`, nic neodešle), přehled párování nadcházejících zveřejněných akcí (`monthCards[].syncStatus`), živý přehled mezer (bez tématu nebo vedoucího), řádky návrhů se sloupci datum, skupina, téma a vedoucí, dole „Zveřejnit“, „Uložit změny“ (uloží bez zveřejnění, nic neodešle, nezměněné návrhy nechá) a „Zrušit“. Ruční datum jen v témže měsíci a v budoucnu (server: `outside_month`), čas a délka zůstanou. Šablona zůstala v menu Nástroje správce, doplnění termínů se z menu přesunulo do okna (prázdný měsíc má tlačítko dál). Testy: `tests/hromadne-zverejneni.test.ts` (datum mimo měsíc, minulost, uložení bez zveřejnění), `e2e/okna.spec.ts` (okno, kroky, sloupce, mezery, uložení bez změn).

## PR 8: bezpečnost a rychlost · sloučené #40, větev `claude/bezpecnost-rychlost`
Hotovo: `npm audit` 0 zranitelností (15. 11.). CSP s nonce a Referrer-Policy `same-origin` už nastavoval `src/proxy.ts`; nově `next.config.ts` přidává nosniff, Referrer-Policy, X-Frame-Options a HSTS (jen produkční build) i statickým souborům a prefetchům, které proxy vynechává. Limit serverových akcí 120 za minutu na uživatele v `runAction` (nahrávky mají dál vlastní 10 za hodinu). Plán načítá data v jedné paralelní vlně místo pěti postupných, počet dotazů (správce 14, účastník 5, Úvod 4) hlídá rozpočet v `tests/pocet-dotazu.test.ts` včetně kontroly, že neroste s počtem akcí. Logy: `logError` pustí jen kód z bezpečných znaků (část kódů pochází z odpovědi Googlu). Testy: `tests/limity-a-logy.test.ts`, `e2e/stranky.spec.ts` (hlavičky).

## Mimo rozsah teď
A07 (přepis, rozhodne firma), vlastní doména, logo a ověření aplikace u Googlu (firma Wiki zatím nemá).
