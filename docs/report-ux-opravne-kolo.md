# Opravné kolo UX/UI k PR #73 – průběžný report (po relaci 7)

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
| C-03 | **Opraveno** (ddf3143) | Význam podle situace: „Zavřít“ u nového/neaktivního okna (Navrhnout téma, Nový odkaz, schválení či vrácení přístupu) se chová jako Zavřít v záhlaví – s rozepsanými změnami se zeptá (`data-modal-close` v `Modal`); „Zrušit úpravy“ u úprav existujícího (Upravit téma, šablona rozvrhu, Připravit měsíc, úprava přístupu) zahodí bez dotazu, říká to samo; „Nepřesouvat“ v potvrzení přesunu (vedle „Zrušit akci“ bylo „Zrušit“ dvojznačné); „Ponechat přístup“ vedle Odebrat přístup. e2e `temata-planovani` „Zavřít dole v okně hlídá rozepsaný návrh“ (1280/320), upravené `mobilni-ovladani`, `plan-planovani`. „Zpět“ v procesu už dřív (ConfirmDialog „Zpět k úpravám“). |
| A-11 | **Již v pořádku** (po A-10/A-09, ověřeno screenshotem) | Okno akce správce: technické informace jen v nabídce, Kalendář se ukazuje jen při chybě (odkaz Opravit). Okno vedoucího/účastníka: stav + 4 řádky údajů. Detail akce: Kdy/Vede/Pro koho v jednom bloku, Technické informace sbalené jen pro správce. Snímky 1280/390 (správce, vedoucí, `ev-11-18`, `tr-rm-1112`) prohlédnuty; další zmenšování by šlo proti „nezmenšovat do nepřehlednosti“. |
| A-14 | **Opraveno** (78bd8cd) | Jeden ring `--focus-ring: 2px solid var(--ochre)`, offset 2 px (dovnitř jen v rolovaném seznamu nabídky a u úchytu, pole -1 px přes rámeček). Dřív: průsvitný stín (kontrast 1,63 : 1, v režimu vynucených barev mizel), pole černý outline, nabídka okrový. Okrová má ≥ 3,6 : 1 vůči všem plochám včetně tmavého menu. Datum/čas: `:focus-within` (Chrome hlásí fokus ve vnitřním segmentu). e2e `klavesnice` „focus ring je všude stejný, Shift+Tab…“ (20× Tab na Plánu, 12× Tab v okně = past fokusu, Shift+Tab, Esc + návrat fokusu), 1280 + macos-1440. Screenshot karty a okna s fokusem prohlédnut. |
| C-01 | **Opraveno** (5c05205) | `--muted` na panelech má 4,5–5,5 : 1 (AA splněno), problém je 12 px. Jen nápovědy, na kterých závisí výsledek, dostaly `.field-hint-key` (13 px, `--ink-soft`, 8+ : 1): limit/formát souboru, „Navržené datum, zkontrolujte“, kdo pozvánku nedostane, testovací režim pozvánek, co hromadné doplnění přepíše, jednorázový odkaz. Ostatní nápovědy beze změny. e2e `zapisy` kontroluje 13 px a barvu. |
| C-06 | **Již v pořádku** (test 121f5e4) | Desktop: nativní HTML5 drag, žádný vlastní prvek v DOM. Telefon: `.move-ghost` = klon karty s `aria-hidden`, `pointer-events:none`, odstraní se v `stopTouch` (puštění, pointercancel, odchod ze stránky). e2e `mobilni-ovladani`: během tažení právě 1 kopie s textem karty, po puštění i puštění mimo 0 kopií a 0 `data-lifted`, po Nepřesouvat karta jednou na původním dni; `plan-planovani` (desktop) karta po zrušení jednou. |
| C-08 | **Již v pořádku** / rozhodnutí uživatele | „Action time“ je firemní typ akce (`src/lib/labels.ts`), ne překlep – ponecháno. „NJBJK“ v repu ani seedu není: jde o data ručně zadaná na sdílené Preview DB. Před prezentací Preview vyčistit nebo znovu nasadit seed – rozhoduje uživatel (zásah do sdílených dat). |
| D-01, D-02, D-03 | Zatím neřešeno (nový pokyn, přeposlaný z jiné relace) | Duplicity typu/skupiny v názvech, nadbytečný text, vizuální oddělení metadat/stavu/obsahu/akcí. Postup v `docs/dalsi-session.md`. |
| Filtry Plánu 320 px | **Opraveno** (f43f8d5) | Regrese po A-03: kratší štítky souhrnu (44 px) vs. zalomené „Vybrat návrhy“ (52 px) – `grid-auto-rows: 1fr`. e2e `mobilni-ovladani` „filtry 2 × 2“ (320/360/390). |

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
* Relace 7: lint OK, typecheck OK, unit **386/386** (celá sada); e2e plan-planovani + mobilni-ovladani + temata-planovani
  + okna (1280/390) 104 passed / 11 skipped; klavesnice (1280 + macos-1440) 18 passed; pristupnost + klavesnice +
  rychle-akce + zapisy (1280/390) 29 passed / 4 skipped; zapisy + okna + priprava-mesice + zapisy-schvaleni (1280/320)
  2× 87 passed / 1 skipped (první běh 1 nestabilní nález axe, při opakování neprošel znovu – sledovat v celém e2e);
  mobilni-ovladani + plan-planovani (1280/320/360/390) prošly. Celé e2e: **1161 passed / 108 skipped / 0 failed** (7,7 min).
* NEOVĚŘENO: celé e2e, screenshoty před/po, Firefox/WebKit, Preview, živý Kalendář.

## Změněná pravidla (pro integraci do Wiki)

* Úprava schváleného zápisu už neruší zveřejnění. Stažení dělá jen „Stáhnout zápis“ (`withdrawMinutes`).
* Nahrazení rozepsaného zápisu s obsahem vyžaduje `confirmReplace=on` (server).
* `moveTopicAction` přijímá i `to` (cílová pozice ve skupině) a `expected` (pořadí, které správce viděl); při rozdílu `conflict`.
