# Report: rychlé akce, plánování témat a zápisy se schválením

Větev `claude/rychle-akce-a-planovani-temat` z main 59cadc0 (18. 11. 2026). Plán a rozhodnutí:
[plan-rychle-akce-a-temata.md](plan-rychle-akce-a-temata.md). Merge dělá uživatel přes PR.

PR: https://github.com/ondrejmacko-it/zabohatsicesko/pull/73 (draft)

Zásada celé větve: vzhled skoro beze změny, přínos je v práci. Rozšiřují se stávající `Menu`, `EventMenu`,
`MovePicker`, `EventDialog`, `PrepareMonthDialog`, služby a `policy.ts`. Mazání, přesun ani zveřejnění nemají
druhou implementaci.

## 1. Co zůstalo zachované
* Oddělení návrhu a zveřejnění, revize akcí, kontrola souběhu a jedna cesta zveřejnění (kontrola úplnosti
  a dopadu na pozvánky) pro okno akce, hromadné zveřejnění i nové „Zveřejnit návrh…“ z karty.
* Přesun jen v rámci měsíce, tažením i výběrem dne. Smazat jde jen návrh, zveřejněnou akci jen zrušit
  s ukázaným dopadem (stávající dialogy z `EventMenu`).
* Témata se k akci dál vážou jménem → ID při uložení, zveřejněné snímky drží svůj název. Štítek
  Nejžádanější zůstává vázaný na skutečný počet zájemců.
* Cesta nahrávka → přepis → kontrola → oprava → zveřejnění. Stávající zveřejněné zápisy zůstanou viditelné
  (migrace 0014 jim zapíše schválení jejich verze).
* Oprávnění se nikde neoslabila. Účastník nevidí správu, návrhy ani interní doporučení.
* Přijmout / Změnit / Odmítnout u doporučeného tématu v Připravit měsíc (jen vizuálně: Přijmout je hlavní).

## 2. Co přibylo
* **Rychlé akce ⋯** na kartách akcí a stejné menu v okně akce (doplněné o Duplikovat).
* **Duplikovat akci** přes předvyplněné Přidat akci (`?kopie=<id>`), uložit jde jen jako návrh, datum se
  navrhne (o týden později, jinak nejbližší stejný den v týdnu) s poznámkou „Navržené datum, zkontrolujte.“
* **Zveřejnit návrh** přímo z karty (`PublishOneDialog`) se stejnou kontrolou úplnosti a dopadu.
* **Garantovaná témata** (nejvýš 3, pořadí 1–3) nad ostatními; ruční pořadí ostatních šipkami s tichou
  poznámkou „Pořadí upravil správce.“ a „Seřadit podle zájmu“. Úkol správce „Nastavte garantovaná témata“.
* **Menu tématu**: Naplánovat téma, Upravit téma, Nastavit/Zrušit prioritu, Posunout výš/níž, Archivovat….
* **Naplánovat téma**: okno s vhodnými budoucími akcemi (s vysvětlením proč) a „Vytvořit novou akci“
  s předvyplněným tématem, typem a dnem šablony.
* **Doporučení ve formuláři akce**: garantovaná → stejná skupina → zájem, štítky Garantované / Doporučené,
  počet zájemců, termín; upozornění při nevhodné skupině. Doplnění měsíce preferuje garantovaná témata.
* **Připravit měsíc**: přehled Připraveno / Chybí vedoucí / Chybí téma / Kolize / Vybráno s přechodem na
  pole a hromadné doplnění vedoucího jen do prázdných polí.
* **Nastavit pravidelný rozvrh** (dřív Pravidelný týden) s vysvětlením, k čemu slouží.
* **Ochrana neuložených změn** v okně akce: dotaz při zavření jen při skutečné změně hodnot.
* **Zápisy z více zdrojů**: nahrávka, vložený přepis nebo poznámky, soubor .txt/.md/.vtt/.srt (1 MB,
  striktní UTF-8, titulky bez časů), ruční zápis. Návrh z textu lokálně za rozhraním `MinutesDrafter`.
* **Schválení zápisu vedoucím**: stav verze („Návrh, verze N“, „Schváleno: verze N“, „Verze N čeká na nové
  schválení“), Schválit a zveřejnit jen pro vedoucího, úkol „Dokončit zápis“ vedoucímu a „Zkontrolovat
  zápis“ kontrolorovi.
* Migrace **0013** (`topics.priority_rank`, `topics.manual_rank`) a **0014** (zdroj a schválení zápisu).

Screenshoty (Chromium, deviceScaleFactor 2, fiktivní seed): `docs/screenshots/rychle-akce-menu.png`,
`garantovana-temata.png`, `naplanovat-tema.png`, `doporuceni-formular.png`, `pripravit-mesic-prehled.png`,
`pravidelny-rozvrh.png`, `zapis-zdroj.png`, `zapis-schvaleni.png`, `rychle-akce-mobil.png` (390 px).

## 3. Kde jsou Quick Actions
Tlačítko ⋯ (`CardMenu.tsx`, položky z `cardActions` ve `status.ts`) je sourozenec odkazu karty, takže klik
na ⋯ neotevře detail. Je v mřížce měsíce, v Seznamu i v agendě na telefonu. Totéž menu má okno akce (`EventPeek`).

| Stav akce | Položky |
|---|---|
| Návrh (budoucí) | Upravit akci, Přesunout termín…, Duplikovat akci, Zveřejnit návrh… · pod čarou Smazat návrh… |
| Zveřejněná budoucí | Upravit akci, Přesunout termín…, Duplikovat akci, Otevřít podrobnosti · pod čarou Zrušit akci… |
| Proběhlá | Otevřít podrobnosti, Zobrazit zápis (je-li zveřejněný), Nahrávka a zápis (vedoucí, kontrolor, správce), Duplikovat jako novou (správce) |
| Zrušená | Otevřít podrobnosti, Duplikovat jako novou (správce) |
| Svátek, režim Vybrat návrhy | bez menu |

Účastník u budoucích akcí menu nemá (u proběhlých jen čtecí položky). Kdo by měl jedinou položku, menu
nedostane, stačí klik na kartu.

## 4. Propojení témat s akcemi
* Z tématu: ⋯ → Naplánovat téma. Má-li téma budoucí termín, okno ukáže datum a odkaz na akci.
* Nabídka (`planCandidates`): přednost má návrh bez tématu se stejnou skupinou a typem řízeným tématy,
  každá položka říká proč. Nejvýš 5 akcí, zveřejněné až za návrhy.
* Přiřazení k návrhu (`assignTopicAction` → `updateEvent`) uloží jen návrh, nic neodešle. U zveřejněné akce
  se otevře okno akce s předvyplněným tématem (`?akce=&tema=`) a dál platí běžné zveřejnění s dopadem.
* Z akce: doporučení ve formuláři (`recommendTopics`, stejné pořadí používá doplnění měsíce `suggestTopics`).

## 5. Duplikace
`duplicateFormValues` v `detail.ts` kopíruje jen pole formuláře (název, typ, skupina, čas, téma, vedoucí,
kontrolor, popis). Nekopírují se vazby zdroje (pozvánka, revize, zápis, nahrávka, odpovědi). Kopie vznikne
jen jako nový návrh a server zveřejnění formuláře s `duplicateOf` odmítne, aby kopie nešla odeslat bez
kontroly. Po uložení se otevře okno nové akce v jejím měsíci.

## 6. Zjednodušení
* Zveřejnit jeden návrh z karty bez otevírání okna a bez režimu Vybrat návrhy.
* Hromadné doplnění vedoucího místo výběru u každého řádku zvlášť.
* Přehled stavu měsíce s přechodem na první dotčené pole.
* Zápis bez nahrávky: vložit text nebo nahrát soubor, z něj upravitelný návrh v šabloně.
* Dotaz „Zavřít bez uložení“ jen při skutečné změně; předvyplnění (duplikát, téma) je výchozí stav.

## 7. Sjednocení menu a dropdownů
* `Menu` má jeden vzhled položek (ikona, text, oddělovač, nebezpečné položky dole a červeně) a variantu
  `card` s nenápadným ⋯. Klávesnice všude stejně: Enter otevře, Esc zavře a vrátí fokus.
* Výběry: `.select` a jediná menší varianta `.select-small` (lišta 30 → 32 px, filtry 34 → 32 px, na dotyku
  38 px a písmo 16 px kvůli zvětšování v iOS).

## 8. Úmyslně odmítnuté nebo jen navržené změny
* **Přesun mimo měsíc** se nezavádí, jen navrhuji: dnes přesun hlídá kolize a dopad v rámci měsíce
  (`planMove` → `outside_month`). Rozšíření by šlo přes přepnutí měsíce ve stávajícím `MovePicker`.
* **Sloučení Přijmout / Změnit / Odmítnout** do jednoho výběru: ztratilo by se zaznamenané odmítnutí
  (rozhodnutí přežije obnovení i nové doplnění) a auditní stopa. Zůstávají tři s jasnou hierarchií.
* **Drag & drop pořadí témat**: šipky Posunout výš/níž jsou ovladatelné klávesnicí i čtečkou.
* **Externí AI pro zápisy**: žádné volání ven, jen rozhraní `MinutesDrafter` s lokální implementací.
* **Schválení zápisu správcem nebo kontrolorem**: schvaluje jen vedoucí akce, ostatní návrh upravují.
* **Automatická platnost garantovaných témat v čase**: bez zadání firmy jen ruční nastavení.
* **Ubrání potvrzení**: smazání a zrušení dál vyžaduje potvrzení, zveřejnění kontrolu úplnosti.

## 9. Výsledky testů (naměřené v relaci F5, 18. 11. 2026, na commitu d78ce49)

| Kontrola | Výsledek |
|---|---|
| `npm run lint` | bez chyb a varování |
| `npm run typecheck` | bez chyb |
| `npm test` (vitest, PGlite) | 40 souborů, **380 / 380 passed** (54 s) |
| `npm run build` | úspěšný produkční build |
| `npm run e2e` (celé, 7 projektů Chromium + přihlášení) | **1092 passed, 105 skipped, 0 failed** (7,1 min), 3 workery |

Přeskočené testy jsou záměrné (`@desktop` testy se na telefonech neopakují, zapisující testy běží jen
v jednom projektu). Žádný test nespadl, flaky test se v tomto běhu neprojevil. Regrese nebyla potřeba opravovat.

## 10. Scénáře

### Scénáře části 04 a 06 (CLAUDE.md)
Původní zadání v repu není. Část 04 je převzatá v [predani.md](predani.md) (sekce Ověřené scénáře, body 1–8);
v F5 jsem je neprocházel ručně, mapuji je na automatické testy z celého běhu výše (všechny prošly):

| 04 | Scénář | Pokrytí |
|---|---|---|
| 1 | Špatný kód a odkaz odmítnuty, bez přihlášení vstup a 401 | `stranky.spec.ts` (přístup bez přihlášení, špatný kód), `ostra-wiki.spec.ts` (neplatný odkaz, chráněné stránky) |
| 2 | Harmonogram listopadu (dny, svátek, zrušený trénink, mimořádné akce) | `kdo-tema.spec.ts`, `stranky.spec.ts`, `tests/plan.test.ts`, `tests/pevne-svatky.test.ts` |
| 3 | Úprava tématu, návrh přežije obnovení, zveřejnění upraví stejnou pozvánku | `tests/publishing.test.ts`, `tests/google-calendar.test.ts` (simulace, napodobené HTTP) |
| 4 | Mobil: agenda bez posunu do strany | `stranky.spec.ts` a `mobilni-ovladani.spec.ts` na 390/360/320 px |
| 5 | Účastník označí zájem a navrhne téma | `pristupnost.spec.ts` (U03), `tests/topics-and-time.test.ts` |
| 6 | Nahrávka → zpracování → kontrola → zveřejnění | `zapisy.spec.ts`, `tests/recordings.test.ts` |
| 7 | Účastník čte zápis, přepis ani audio nevidí | `zapisy.spec.ts` (FP ho najde, RM ne), `tests/zapisy-schvaleni.test.ts` |
| 8 | Kolega mimo publikum nic nezíská ani přímým odkazem | `okna.spec.ts` (cizí akce neprozradí obsah), `unik-dat.spec.ts`, `tests/access.test.ts` |

**Část 06** zadání se mi v repu nepodařilo dohledat (žádný dokument ani test ji neoznačuje). Je to otevřená otázka.

### Scénáře 1–12 této větve
**Číslování 1–12 je rekonstruované z plánu (F1–F4), ne z původního zadání**, které v repu není. Čísla 1, 2, 3
a 11 odpovídají názvům testů v `e2e/rychle-akce.spec.ts`. Všechny uvedené testy prošly v běhu výše.

| # | Scénář | Pokrytí | Výsledek |
|---|---|---|---|
| 1 | Quick Actions u návrhu: Upravit, Přesunout, Duplikovat, Zveřejnit z karty, Smazat s potvrzením | `rychle-akce.spec.ts` „scénář 1“, `tests/rychle-akce.test.ts` | prošlo |
| 2 | Quick Actions u zveřejněné (bez Smazat, Zrušit s dopadem) a proběhlé akce (zápis, nahrávka, kopie) | `rychle-akce.spec.ts` „scénář 2“, `tests/rychle-akce.test.ts` (proběhlá, zrušená, náhled) | prošlo; proběhlá jen unit |
| 3 | Duplikace: předvyplněný nový návrh, zveřejnění kopie server odmítne | `rychle-akce.spec.ts` „scénář 3“, `tests/rychle-akce.test.ts` | prošlo |
| 4 | Garantovaná témata, pořadí, souběh posledního volného pořadí | `temata-planovani.spec.ts`, `tests/temata-priority.test.ts` | prošlo (souběh jen PGlite) |
| 5 | Naplánovat téma k existujícímu návrhu, zveřejněné akci i nové akci | `temata-planovani.spec.ts` (3 testy), `tests/temata-priority.test.ts` | prošlo |
| 6 | Doporučení ve formuláři a doplnění měsíce s preferencí garantovaných | `temata-planovani.spec.ts` (doporučení), `doporucene-tema.spec.ts`, `tests/temata-priority.test.ts` | prošlo |
| 7 | Připravit měsíc: přehled a hromadné doplnění vedoucího jen do prázdných | `priprava-mesice.spec.ts`, `okna.spec.ts`, `tests/priprava-mesice.test.ts` | prošlo |
| 8 | Nastavit pravidelný rozvrh s vysvětlením | `okna.spec.ts` „Nastavit pravidelný rozvrh…“ | prošlo |
| 9 | Ochrana neuložených změn (zavření, Esc, vrácení hodnoty, předvyplnění) | `priprava-mesice.spec.ts` (okno akce: 3 testy) | prošlo |
| 10 | Zápis z textu/souboru → schválení vedoucím → změna schválení zruší | `zapisy-schvaleni.spec.ts` (vložený text), `tests/zapisy-schvaleni.test.ts` (soubor, VTT/SRT, souběh, verze) | prošlo; nahrání souboru jen unit |
| 11 | Mobil: ⋯ na telefonu, menu v okně, 320 px bez posunu do strany | `rychle-akce.spec.ts` „scénář 11“ (390/360/320), `stranky.spec.ts`, `pristupnost.spec.ts` (320×256) | prošlo |
| 12 | Oprávnění: kontrolor a správce zápis neschválí, účastník nevidí správu témat | `tests/zapisy-schvaleni.test.ts`, `zapisy-schvaleni.spec.ts` (správce bez tlačítka), `temata-planovani.spec.ts` (účastník), `tests/temata-priority.test.ts` | prošlo |

## 11. Porovnání počtu kroků (před / po)
Kroky „po“ jsou **spočítané z kroků e2e testů** (uvedený test). Kroky „před“ jsou **odhad** podle UI na
main 59cadc0, nebyly měřené testem, s výjimkou řádku zápisu.

| Úloha | Před | Po | Zdroj „po“ |
|---|---|---|---|
| Duplikovat akci | odhad: Přidat akci + ručně ~8 polí + Uložit ≈ 10 kroků | ⋯ → Duplikovat akci → Uložit jako návrh = 3 kliky (datum předvyplněné) | `rychle-akce.spec.ts` scénář 1 a 3 |
| Naplánovat téma k návrhu | odhad: Témata → Plán → najít vhodný den → karta → pole Téma → Uložit ≈ 6 kroků + hledání | ⋯ tématu → Naplánovat téma → Přidat do návrhu = 3 kliky | `temata-planovani.spec.ts` |
| Doplnit vedoucího do N prázdných řádků | odhad: N výběrů + Uložit = N + 1 | výběr vedoucího → Doplnit do N řádků → Uložit = 3 kroky pro libovolné N | `priprava-mesice.spec.ts` |
| Zveřejnit jeden návrh | odhad: karta → okno akce → Zveřejnit → potvrdit ≈ 4 | ⋯ → Zveřejnit návrh… → Zveřejnit = 3 kliky (+1 zaškrtnutí u neúplného návrhu) | `rychle-akce.spec.ts` scénář 1 |
| Zveřejnit zápis (vedoucí) | spočítané ze `zapisy.spec.ts` na main: Zveřejnit zápis = 1 klik po kontrole | Schválit a zveřejnit = 1 klik; zápis z textu navíc zdroj, vložení, Připravit návrh = +3 | `zapisy-schvaleni.spec.ts` |

U zápisu je pro kontrolora a správce po změně **o krok víc** (zveřejní až vedoucí). Je to záměrná kontrola,
ne zjednodušení.

## 12. Omezení a neověřené scénáře
* **Souběh na Neonu neověřen.** Zámky a unikátní index (priorita témat, založení zápisu, schválení verze)
  jsou otestované jen na PGlite.
* **Živá firemní Wiki** neověřena, její architektura není známá ([integrace-do-firemni-wiki.md](integrace-do-firemni-wiki.md)).
* **Živý Google Kalendář** v této větvi neověřen. Testy běží proti simulaci a napodobenému HTTP; nové funkce
  používají stávající zveřejnění, pozvánky samy nemění.
* **WebKit / Safari** neověřen (v cloudu není; na Macu `E2E_WEBKIT=1 npm run e2e`). Telefony jsou Chromium
  s emulací dotyku, ne skutečný iPhone.
* **Skutečný přepis a firemní AI/bot** nejsou napojené, návrh z textu dělá lokální šablona.
* **Preview na Vercelu** po pushi z této relace neověřeno (migrace se tam spustí samy).
* Nahrání textového souboru v prohlížeči není v e2e, jen ve službě a validaci (`tests/zapisy-schvaleni.test.ts`).
* Kopie z okna akce drží jen měsíc, ne pohled Seznam/agenda. Na 320 px se u návrhu se štítkem může zalomit čas.
* V okně Naplánovat téma se tlačítko „Přidat do návrhu“ u kratšího popisu zobrazí vpravo, u delšího pod
  textem (viz `naplanovat-tema.png`). Funkčně v pořádku, vizuálně nesjednocené.

## 13. Potřebné informace od firmy
Úplný seznam je v [podklady-pro-sper.md](podklady-pro-sper.md). K této větvi hlavně: kdo určuje garantovaná
témata a na jak dlouho; kdo smí zápis schválit při nepřítomnosti vedoucího; v jakém formátu přijdou přepisy
a poznámky; co smí firemní AI/bot dostat. **Nevíme, kdo nebo co je SPER**; adresáta podkladů je potřeba potvrdit.

## 14. Otevřené otázky
1. Archivace tématu ruší jeho prioritu a obnovení ji nevrací. Má ji vracet?
2. Nová témata se při ručním pořadí řadí na konec. Je to správně?
3. Okno Naplánovat téma nabízí nejvýš 5 akcí, zveřejněné až za návrhy. Stačí to?
4. Nová akce k tématu pro „Všichni“ / Tým A má typ Jiná akce. Má být jiný?
5. Správce, který není vedoucí, zápis neschválí ani při nepřítomnosti vedoucího (jen doplní vedoucího). Výjimka?
6. Vedoucí může schválit i bez kontroly kontrolorem. Má být kontrola povinná?
7. „Návrh“ a „čeká na schválení“ je jeden stav. Stačí to?
8. Nahrání nahrávky nahradí textový návrh jen s upozorněním, bez zvláštního potvrzení. Stačí to?
9. Čtenář zápisu nevidí číslo verze. Má ho vidět?
10. Má se okno ptát při zavření neuloženého duplikátu nebo předvyplněného tématu? Dnes ne.
11. Hromadné doplnění vedoucího jde do všech prázdných řádků, ne jen do vybraných. Je to správně?
12. Okno akce nemá tlačítko Zrušit (zavírá Zavřít, Esc nebo klik mimo). Doplnit?
13. Menší výběr se zvětšil o 2 px (30 → 32 px). Vizuálně v pořádku?
14. Platnost garantovaných témat v čase (měsíc, čtvrtletí)?
15. Co přesně je část 06 zadání, kterou CLAUDE.md zmiňuje mezi scénáři?

## 15. Nasazení a migrace
Migrace **0013_topic_priority_and_order** a **0014_minutes_sources_and_approval** se spustí **samy při startu
aplikace** (pod zámkem, jen přidávací, nic nemažou). Na **Preview** (sdílená ukázková DB) se aplikují už po
pushi této větve, na **produkční DB** až po merge do main. 0014 zapíše stávajícím zveřejněným zápisům schválení
jejich aktuální verze, takže je publikum vidí dál. Chování starší verze kódu nad zápisy bez nahrávky není ověřené.

## 16. Commity
* `2df5388` Plán: rychlé akce, plánování témat a zápisy se schválením
* `2968d2f` Menu: jednotný vzhled položek a nenápadné ⋯ pro karty akcí
* `0d38512` Plán: rychlé akce ⋯ u karet akcí
* `59ed98f` Plán: Duplikovat akci přes předvyplněné Přidat akci
* `5e88242` Testy: rychlé akce ⋯, duplikace a zveřejnění návrhu z karty
* `85e0a6c` Dokumenty integrace do firemní Wiki a předávka fáze 1
* `1f27d10` Témata: garantovaná priorita, ruční pořadí a plánování (migrace 0013)
* `011263e` Témata: sekce Garantovaná, menu tématu a Naplánovat téma
* `edf652b` Formulář akce: doporučení se štítky se na 320 px zalomí
* `d2c25e0` Testy: garantovaná témata, ruční pořadí a Naplánovat téma
* `2e22dbc` Předávka: fáze 2 Témata hotová
* `03f753c` Připravit měsíc: přehled stavu návrhů a doplnění vedoucího do prázdných
* `9bd2e52` Okno akce: dotaz při zavření jen při skutečné změně hodnot
* `8de1a72` Pravidelný týden → Nastavit pravidelný rozvrh s vysvětlením
* `10591bb` Jednotný vzhled výběru: .select a jediná menší varianta .select-small
* `5b53068` Testy: přehled Připravit měsíc, doplnění vedoucího a neuložené změny
* `2395173` Předávka: fáze 3 Příprava měsíce a formuláře hotová
* `85fffaa` Zápisy: migrace 0014 se zdrojem zápisu a schválenou verzí
* `63ad8ed` Zápisy: návrh z textu a souboru, schválení verze jen vedoucím
* `7bd3c89` Nahrávka a zápis: volba zdroje, stav verze a Schválit a zveřejnit
* `63f9eba` Testy: oprávnění schválení zápisu, textové zdroje a migrace 0014
* `d78ce49` Předávka: fáze 4 Zápisy hotová
* F5: tento report, screenshoty, dokumenty integrace a předávka (commity níže v PR)

Commity F1 (2df5388 až 85e0a6c) nesou `Claude-Session` relace uvedené v zadání. Commity F2–F5 nesou
`Claude-Session: https://claude.ai/code/session_01HpUirvDC9rMsBJYGmm6iFo`, tedy relaci, ve které vznikly,
a ne ID ze zadání.
