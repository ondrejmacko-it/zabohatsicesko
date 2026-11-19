# Opravné kolo UX/UI k PR #73 – průběžný report (po relaci 6)

Větev `claude/focused-cerf-gr1tdi` z HEAD PR #73 (`ff7ac54`, shodné s referenčním commitem screenshotů).
Zadání: `ZBC_KOMPLETNI_PROMPT_CLAUDE_CODE_PR73.md` (u uživatele, do repa se nedává). Relace končí na limitu
kontextu, práce pokračuje v navazující relaci. Nic není mergnuto ani nasazeno.

## Stav nálezů

| ID | Stav | Co a kde |
|---|---|---|
| Z-01 | **Opraveno** | `updateMinutes` (`src/server/services/recordings.ts`): úprava zveřejněného zápisu založí nový řádek `minutes` jako návrh (verze +1), schválený řádek zůstane `published`. Bez migrace. Kopie zápisu z nahrávky má zdroj `transcript` (UNIQUE `job_id`). Zámek akce + kontrola verze proti souběhu, audit `minutes.edit_published`. Test `tests/zapisy-schvaleni.test.ts`, e2e `e2e/zapisy-schvaleni.spec.ts` (čtenář dál vidí schválený text). |
| Z-02 | **Opraveno** | `createMinutesDraft`: žádné `tx.delete`, nahrazený návrh zůstává v DB jako starší verze. Návrh s obsahem server nahradí jen s `confirmReplace` (jinak `replace_unconfirmed`). UI: `ConfirmDialog` „Nahradit rozepsaný zápis?“ v `MinutesSourceForm`. |
| Z-14 | **Opraveno** | Banner `dialog-confirm` uvnitř `Modal` nahrazen samostatným `ConfirmDialog` (nativní `<dialog>` ve vrchní vrstvě, `alertdialog`, `aria-labelledby/-describedby`, Esc/klik mimo = pokračovat, návrat fokusu). Volby: Pokračovat v úpravách / Uložit jako návrh (jen když formulář obsahuje `data-confirm-save` a je platný) / Zahodit změny. |
| S-01 | **Opraveno** | `EventPeek.tsx`: pás stavu bere tón z `primaryStatus` (`status-danger`, `status-attention`), chyba Kalendáře není zelená. Bez e2e screenshotu. |
| Z-03 | **Opraveno** | `.source-list` 2 × 2, ≤ 560 px jeden sloupec. Neověřeno screenshotem. |
| DEP-01 | Blokováno (rozhodnutí uživatele) | Migrace 0013/0014 dál běží automaticky při startu. Před merge: staging, záloha Neonu, kontrola schválených zápisů. Tato relace schéma nemění. |
| Potvrzení v okně akce a výběru | **Opraveno** (e1a463f) | `EventDialog`: „Zveřejnit bez tématu a vedoucího?“ a „Zveřejnit změny?“ (dopad) v `ConfirmDialog` místo lišty `confirm-bar` ve formuláři. `PlanSelection`: zveřejnit/smazat vybrané v `ConfirmDialog`. Důkaz: e2e `okna.spec.ts` (Zpět k úpravám nic nezmění, fokus zpět na Zveřejnit, Esc zavře jen potvrzení), 1280/390/320. |
| Combobox témat | **Opraveno** (f1a4cea, b1968e5) | `src/components/Combobox.tsx` (ARIA combobox + listbox, skupiny Doporučená/ostatní, filtr bez diakritiky, šipky/Enter/Esc, klik jen otevírá) v `EventDialog` místo `<datalist>`. Název akce `autoComplete="off"`. Důkaz: e2e `okna.spec.ts` „nabídka tématu“, `priprava-mesice.spec.ts` (Esc nejdřív zavře nabídku), 1280 + 320. `PrepareMonthDialog` si záměrně nechává `<datalist>` (tabulka nekontrolovaných polí, Změnit maže pole v DOM, bez skupin) – lze převést později. |
| A-01 | **Opraveno** (c47960d) | ⋯ karty vždy viditelné, 36 × 32 px s rámečkem `--line`, dotyková plocha ~44 × 44 (pseudo-prvek), bez `opacity:.6`, rozměr karet beze změny. Důkaz: e2e `rychle-akce.spec.ts` „⋯ a + v mřížce“ (velikost, opacity 1), screenshot 1280/390 prohlédnut. |
| A-08 | **Opraveno** (c47960d) | `Menu.tsx`: tlačítko v levé půlce okna → menu zarovnané k levé hraně, jinak k pravé, vždy v okně. Důkaz: stejný e2e (první a poslední ⋯). |
| A-02 | **Opraveno** (c47960d) | `.addDay` v prázdném dni opacity .35, při najetí/fokusu 1, ve dni s akcemi dál skryté. Důkaz: e2e (únor 2027, opacity 0,35). |
| A-05, A-06 | **Opraveno** (b76bd1a) | Příjemci pozvánky přímo pod „Pro koho“ (`audienceField`), „Další údaje“ jeden řádek v plné šířce oddělený čarou, bez druhého rámečku. Screenshot 1280/320 prohlédnut; e2e okna/priprava-mesice/rychle-akce/klavesnice/pristupnost 152 passed. Název v plánu u typu ≠ Jiná akce zůstal v Dalších údajích (vlastní název zachován). |
| A-10 | **Již v pořádku** (test b76bd1a) | Technické informace a stav Kalendáře dostává jen správce (`detail.sync` jen `isOrganizer`). Důkaz: e2e `okna.spec.ts` „technické informace jen pro správu“ (vedoucí, účastník RM: 0×; správce: ano). V nabídce okna správce odkaz zůstává (A-09/A-11 neřešeno). |
| T-01 | **Opraveno** (5d7886a, 0f36560) | `TopicOrderList.tsx`: úchyt jen správci (tlumený, odlišný od Mám zájem a ⋯), pointer events myš i dotyk (`touch-action:none`), jen v rámci skupiny, optimisticky, při chybě/souběhu návrat + `router.refresh`, šipky na úchytu, oznámení `aria-live`. Server ověřuje pořadí (`expected`). Důkaz: e2e `temata-planovani` „přetažení pořadí úchytem“ (myš 1280, klávesnice, souběh dvou oken s návratem, CDP prst 390 bez posunu stránky). |
| T-02 | **Opraveno** (0f36560) | „Při plánování se nabízejí jako první, v tomto pořadí a bez ohledu na počet zájemců.“ Ověřeno v `recommendTopics`/`isRecommendable` (garantovaná i bez zájmu); automatické datum neslibuje. |
| T-03 | **Opraveno** (0f36560) | Decentní čísla 1/2/3 u garantovaných pro všechny (`.topic-rank`), `ol` zůstává. e2e kontroluje „1“, „2“. |
| T-04, C-04, T-11 | **Opraveno** (d1b8bee) | Bez podbarvení řádků; garance = ochrový pruh, Nejžádanější jen štítek. Screenshot 1280/390/320 prohlédnut. |
| T-05 | **Opraveno** | Přetažení + šipky na úchytu; menu Posunout výš/níž zůstává jako další cesta. |
| T-06 | **Opraveno** (d1b8bee) | Vnitřní nadpis „Témata“ jen pro čtečky (`visually-hidden`), úvodní věta vedle Navrhnout téma. |
| T-07 | **Opraveno** (d1b8bee) | Tlačítko v okně „Navrhnout téma“. |
| T-08, T-09, T-10 | **Opraveno** (bf406d2) | Okno Naplánovat téma: krátký úvod, stávající termín nahoře s hlavním „Otevřít stávající akci“, „Další termín“ a Vytvořit novou akci sekundárně, 3 akce + Zobrazit další, krátký řádek (`návrh, uloží se jen návrh` / `zveřejněno, změnu potvrdíte`), „Otevřít a doplnit“. e2e upraveno. |
| A-12 | **Opraveno** (bf406d2) | Předvyplněné téma jen tichý řádek „… je předvyplněné, zatím nic není uložené ani zveřejněné.“ místo banneru. |
| Z-04 | **Opraveno** (21a40a2) | `MinutesSourceForm`: jedna věta u každé volby, formát a limit až v nápovědě zvoleného zdroje. Screenshot 1280/390 prohlédnut. |
| Z-05 | **Opraveno** (21a40a2) | `src/components/FilePicker.tsx`: skutečný `input type=file` vizuálně skrytý v tlačítku `.btn` (fokus na tlačítku), název + velikost, chyba velikosti. Použito v nahrávce i textovém souboru. e2e `zapisy.spec.ts` (název souboru). Firefox/WebKit neověřeno. |
| Z-06 | **Opraveno** (21a40a2) | Výchozí volba „Vložit text“, „Nahrávka (ukázka)“ poslední s větou „Přepis umí jen ukázkovou nahrávku.“, u nahrávání „nenahrávejte ji“ (skutečnou schůzku). e2e `zapisy.spec.ts` volbu vybírá. |
| Z-07, Z-11 | **Opraveno** (21a40a2) | Bez věty „Kolegové uvidí…“ nahoře (pravidlo u Schválit a zveřejnit), bez banneru nahrazení vedle ConfirmDialog, bez „Zveřejněno pro publikum“ (duplicita se stavem), nápověda návrhu a „kolegové vidí dříve schválený“ jako tichý text; výrazné zůstává jen nesoulad typu a chybějící vedoucí. |
| Z-08 | **Opraveno** (21a40a2) | `src/lib/minutes.ts` `minutesStarted`: prázdná šablona = stav panelu `awaiting`, štítek „Rozpracováno“, „Rozpracováno, verze 1“; výběr a úkoly `started` („zápis rozpracovaný“, „Dokončit zápis“). Stejné pravidlo server používá pro `confirmReplace` → prázdnou šablonu nahradí bez potvrzovacího okna. Testy `zapisy-schvaleni.test.ts`, `stav-nahravky.test.ts`, e2e `zapisy-schvaleni.spec.ts`. |
| Z-09 | **Opraveno** (21a40a2) | `.textarea-grow`: min 60 px, `field-sizing: content`, `rows` podle obsahu (2–8) jako záloha. |
| Z-10 | **Opraveno** (21a40a2) | `MinutesWorkspace.tsx`: „Změnit zdroj“ u stavu verze vymění editor za volbu zdroje (editor jen skrytý, úpravy zůstanou), „Zpět k zápisu“, fokus na zvolený zdroj a zpět; nový návrh vrátí okno k editoru. e2e `zapisy-schvaleni.spec.ts`. |
| Z-12 | **Opraveno** (21a40a2) | Nadpis „Zápis“, „Nahrávka a zápis“ jen s nahrávkou nebo zdrojem z nahrávky. e2e. Odkazy „Nahrávka a zápis“ v okně akce (`EventPeek`, `status.ts`) zatím beze změny. |
| Z-13 | **Opraveno** (21a40a2) | Nápověda „Jen TXT, MD, VTT nebo SRT … PDF ani Word zatím nejdou, vložte z nich text.“ PDF/DOCX nepodporujeme (bez bezpečného parseru) – rozhodnutí uživatele, zda je chce. |
| C-07 | **Opraveno** (21a40a2) | Stránka Zápisy: nadpis „Zveřejněné zápisy“, tlačítko „K dokončení“ s počtem (přístupný název „Zápisy k dokončení: N“), okno „Zápisy k dokončení“ / „Moje zápisy k dokončení“. e2e `okna.spec.ts`. |
| Oprava úpravy schváleného zápisu | **Opraveno** (21a40a2) | Text v `MinutesEditor` po Z-01 nepravdivě tvrdil, že kolegové zápis přestanou vidět; nově „Uložení založí nový návrh. Kolegové do jeho schválení dál vidí tuto schválenou verzi.“ |
| A-03 | **Opraveno** (1d41667) | Štítky souhrnu měsíce: „Návrhy N“ (přístupně „Návrhy N ke zveřejnění“) a „Doplnit N“ místo „Chybí údaje“ (přístupně „Doplnit N akcí“), `title` vysvětlí důvod, skupina „Zúžit plán měsíce“ (odlišení od osobních úkolů „Čeká na vás“). Klik zúží plán a skočí na `#mesic`; zúžená agenda začíná první počítanou akcí. Kotva přímo na kartu zamítnuta: mřížka i agenda jsou v DOM zároveň, na telefonu by mířila na skrytou mřížku. Delší „Ke zveřejnění/K doplnění“ se na 320 px zalamovaly (screenshot), proto krátké. e2e `plan-planovani` „souhrn měsíce“ (1280/390/320). |
| A-04, C-05 | **Opraveno** (47e752b) | Karta: jeden stavový štítek (beze změny `cardStatus`), výstraha jen pro chybějící údaj, který karta neukazuje jako „— doplnit“ (`hiddenMissingDetails`, typicky Action time bez tématu); dřív návrh hlásil chybějící údaje dvakrát. Pro čtečku zůstávají řádky „Kdo: — doplnit“. Unit `kdo-tema.test.ts` (3 nové). |
| A-07, A-13 | **Opraveno** (a321167) | `EventDialog`: zveřejněná akce bez úprav = „Beze změn“, Zveřejnit změny neaktivní a bez `btn-primary`; primární až po změně. Potvrzení dopadu beze změny. e2e `okna.spec.ts` „Zveřejnit změny termínu“. |
| A-09 | **Opraveno** (152960d) | Ikona u každé položky nabídky okna akce (Technické informace, Opravit v Kalendáři, Nahrávka a zápis), Kalendáře (nastavení, simulace, nová pozvánka) a zápisu; „Vrátit zápis do návrhu…“ jako `menu-danger` (dřív v nabídce vypadal neutrálně). Destruktivní pod čarou dole. e2e `okna.spec.ts` „nabídka okna akce“. |
| C-02 | **Opraveno** (5540951) | `minutesSectionLabel` (`src/lib/minutes.ts`): „Nahrávka a zápis“ jen s nahrávkou / zápisem z nahrávky, jinak „Zápis“ (okno akce, detail akce, nadpis sekce). Menu karty: „Upravit zápis“ místo „Nahrávka a zápis“ (vedle „Zobrazit zápis“). „Co vkládáte“ místo „Druh textu“. „Technické informace“ zůstávají jen správci (A-10), „Název v plánu“ a „Připravit návrh zápisu“ ponechány (srozumitelné). Unit testy. |
| C-03 | Rozpracováno (necommitnuto nic) | Analýza: „Zrušit“ v `TopicActions` (Navrhnout téma ř. 102, Upravit téma ř. 331), `TemplateDialog` ř. 74, `PrepareMonthDialog` ř. 374, `MoveEvent` ř. 94, `AccessForms` (98, 157, 283). Návrh: úpravy existujícího → „Zrušit úpravy“, potvrzení přesunu → „Nepřesouvat“ (vedle „Zrušit akci“ je „Zrušit“ dvojznačné), prázdný formulář → „Zavřít“. e2e odkazy: `mobilni-ovladani` 160, 223; `plan-planovani` 62. |
| A-11, A-14, C-01, C-06, C-08 | Zatím neřešeno | Pořadí v `docs/dalsi-session.md`. |

## Ověření (skutečně spuštěno v této relaci)

* typecheck OK, lint OK, unit **381/381** (vitest, celá sada).
* e2e `priprava-mesice` + `zapisy-schvaleni` (windows-1280): 11 testů, po úpravě očekávání Z-01 vše prošlo;
  `zapisy-schvaleni` + `zapisy` + `okna` na windows-1280 a telefon-390: 62 passed / 1 skipped.
* build OK.
* Relace 3: typecheck OK, lint OK, unit **382/382**; e2e (1280 + 320/390) okna, priprava-mesice, temata-planovani,
  pristupnost, klavesnice: 98 passed / 4 skipped; rychle-akce, mobilni-ovladani, klavesnice, pristupnost, plan-planovani:
  55 passed / 19 skipped; okna, priprava-mesice, rychle-akce, klavesnice, pristupnost, kdo-tema, doporucene-tema:
  152 passed / 9 skipped; temata-planovani (1280) 10 passed. Build v relaci 3 nespuštěn.
* Relace 4: typecheck OK, lint OK, unit `temata-priority` OK; e2e temata-planovani + pristupnost + klavesnice (1280/390/320)
  33 passed / 6 skipped; temata-planovani + priprava-mesice + okna (1280/320) prošly po úpravě očekávání.
* Relace 5: typecheck OK, lint OK, unit **382/382** (celá sada; opraveno zastaralé očekávání v `temata-priority` z bf406d2,
  které v relaci 4 padalo); e2e zapisy + zapisy-schvaleni + okna (1280 + 390) 73 passed / 1 skipped, zapisy-schvaleni po
  rozšíření (1280) prošlo. Build v relaci 5 nespuštěn.
* Relace 6: typecheck OK, lint (změněné soubory) OK; unit `kdo-tema`, `zapisy-schvaleni`, `rychle-akce` OK; e2e
  plan-planovani + mobilni-ovladani + pristupnost (1280/320) 31 passed / 15 skipped; kdo-tema + rychle-akce +
  plan-planovani (1280/390) 29 passed; okna (1280/320) 69 passed; okna + zapisy + zapisy-schvaleni + klavesnice (1280)
  48 passed; zapisy + zapisy-schvaleni + rychle-akce + okna (1280) 50 passed. Screenshot štítků 1280/320 prohlédnut.
  Celá unit sada a build v relaci 6 nespuštěny.
* NEOVĚŘENO: celé e2e, screenshoty před/po, Firefox/WebKit, Preview, živý Kalendář.

## Změněná pravidla (pro integraci do Wiki)

* Úprava schváleného zápisu už neruší zveřejnění. Stažení dělá jen „Stáhnout zápis“ (`withdrawMinutes`).
* Nahrazení rozepsaného zápisu s obsahem vyžaduje `confirmReplace=on` (server).
* `moveTopicAction` přijímá i `to` (cílová pozice ve skupině) a `expected` (pořadí, které správce viděl); při rozdílu `conflict`.
