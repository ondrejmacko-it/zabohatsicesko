# Opravné kolo UX/UI k PR #73 – závěrečný report (relace 1–9)

Větev `claude/focused-cerf-gr1tdi` z HEAD PR #73 (`ff7ac54`, shodné s referenčním commitem screenshotů).
Zadání: `ZBC_KOMPLETNI_PROMPT_CLAUDE_CODE_PR73.md` (u uživatele, do repa se nedává). Nic není mergnuto ani nasazeno,
do větve PR #73 (`claude/rychle-akce-a-planovani-temat`) se nepushovalo.

## Shrnutí po oblastech

**Design konzistence.** Vzhled Wiki zachován, žádný redesign, žádná nová knihovna. Jedna menší varianta pole
(`.select-small`), jeden focus ring (A-14, okrový 2 px), ⋯ všude stejné 36 × 32 px s rámečkem (A-01), tóny stavů
z existujících proměnných (`--line`, `--beige`, `status-*`). Bez podbarvení řádků témat (T-04/C-04/T-11), čísla priorit
decentní (T-03). Nápovědy, na kterých závisí výsledek, 13 px a vyšší kontrast (C-01), ostatní beze změny.

**Duplicity a nadbytečný text (D-01–D-03).**
* D-01: název akce neopakuje typ ani skupinu (`eventTitle`/`eventContext`, `src/lib/labels.ts`, unit
  `tests/duplicity-nazvu.test.ts`). Snímek `okno-zapisu-1280`: dřív „… · Firemní vzdělávání RM · Relationship manažeři ·
  Vede…“, nově „Pá 6. 11. 2026 · Vede: Vedoucí akce“.
* D-02: kratší nápovědy, bez druhého Zavřít v Naplánovat téma, bez řádku opakujícího titulek okna; nové samostatné
  potvrzení „Zahodit změny“ (neveřejné úpravy se dřív zahazovaly bez dotazu). Snímek `naplanovat-tema-1280`.
* D-03: okno zápisu odděluje metadata / stav verze (tónovaný pruh se Změnit zdroj) / obsah / akce. Snímek
  `okno-zapisu-1280` a `-390`.

**Rozhodovací overlaye.** Ztráta, zveřejnění a nahrazení dat se rozhodují v samostatném okně (`ConfirmDialog`,
`alertdialog`, Esc = zpět, návrat fokusu): neuložené změny (Z-14), zveřejnění bez tématu/vedoucího a dopad změn
(EventDialog), zveřejnit/smazat vybrané (PlanSelection), nahrazení rozepsaného zápisu (Z-02), zahození neveřejných
změn (D-02). Žádné „Opravdu?“ u neškodných akcí; „Zrušit úpravy“ zahazuje bez dotazu a říká to popiskem (C-03).
V relaci 9 opravena regrese ze Z-14: potvrzení u neplatného formuláře spouštělo `checkValidity()` a pod oknem se
objevil souhrn chyb (eb67ebd, snímek `potvrzeni-zmen-1280`). Otevřené: „Zahodit změny“ a dalších 9 potvrzení přes
`ActionForm` používá vlastní `Modal` (role `dialog`), ne `ConfirmDialog` (`alertdialog`) – funkčně samostatné okno,
sjednocení je kandidát na rozhodnutí uživatele.

**Dropdowny / combobox.** Téma v okně akce = vlastní ARIA combobox (`src/components/Combobox.tsx`) se skupinami
Doporučená/ostatní, filtr bez diakritiky, ruční text povolen. `PrepareMonthDialog` si nechává `<datalist>` (záměrně,
viz tabulka). Menu ⋯ se zarovná podle strany a zůstane v okně (A-08).

**Wizard.** Nezaváděn. Formulář akce má kroky 1/2 jako sekce na jedné obrazovce, přínos vícekrokového průvodce se
neprokázal (víc kliknutí, ztráta přehledu při úpravě jednoho pole).

**Témata a DnD.** T-01 přetažení úchytem jen pro správce (myš, dotyk, klávesnice), jen v rámci skupiny, server
ověřuje očekávané pořadí, při souběhu návrat. T-02–T-11 texty a vzhled. Snímek `temata-1280`.

**Zápisy a verze.** Z-01 úprava schváleného zápisu založí nový návrh a schválená verze zůstává vidět; Z-02 nic se
nemaže, nahrazení s potvrzením na serveru; Z-04–Z-13 kratší volba zdroje, `FilePicker`, Rozpracováno u prázdného,
Změnit zdroj bez ztráty úprav, nadpis „Zápis“; C-02 popisky podle obsahu.

**Kalendář / role.** Technické informace a stav Kalendáře jen správce (A-10), chyba Kalendáře není zelená (S-01),
okno vedoucího a účastníka bez technických řádků (A-11). Snímek `okno-akce-spravce-1280`.

## Vizuální před/po

`docs/screenshots/opravne-kolo/`, `pred-*.png` = `ff7ac54` (HEAD PR #73), `po-*.png` = tato větev (eb67ebd), stejná
fiktivní data, Chromium, 1280 × 800 a 390 × 760. Pořízeno dočasným specem ve worktree (necommitováno).

| Snímek | Co ukazuje |
|---|---|
| `okno-zapisu-1280`, `okno-zapisu-390` | D-01 (eyebrow bez typu a skupiny), D-03 (oddělené části), Z-07/Z-11 (bez věty nahoře a zeleného banneru), Z-10 Změnit zdroj u stavu verze |
| `naplanovat-tema-1280`, `-390` | T-08–T-10, D-02: stávající termín nahoře s hlavní akcí, krátké řádky „návrh“, bez druhého Zavřít |
| `potvrzeni-zmen-1280` | Z-14: místo banneru ve formuláři samostatné okno „Neuložené změny“, bez souhrnu chyb pod ním |
| `okno-akce-spravce-1280` | A-05/A-06 příjemci u „Pro koho“, Další údaje oddělené čarou, A-07/A-13 Beze změn = tlačítka neaktivní, combobox tématu |
| `temata-1280` | T-01 úchyty, T-03 čísla, T-04 bez podbarvení, T-06 bez vnitřního nadpisu |
| `plan-390` | A-03 „Doplnit 8“ místo „Chybí údaje“, A-01 viditelné ⋯ |

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
| D-01 | **Opraveno** (0c3a42b) | Sdílené `eventTitle` a `eventContext` v `src/lib/labels.ts`: porovnání bez diakritiky, velikosti písmen a interpunkce, po celých slovech. Téma, které obsahuje typ (nebo naopak), se nespojuje „Typ: Téma“; typ v názvu se znovu nepíše; skupina, kterou říká typ (Trénink poradců/FV FP = Finanční poradci, Trénink RM/FV RM = RM), se vynechá. Použito: detail akce (eyebrow), okno zápisu, karta Nejbližší akce, Zápisy, Naplánovat téma, úkoly (`journey.ts`), název pozvánky (`calendarSummary`), návrh zápisu. Unit `tests/duplicity-nazvu.test.ts` (9), e2e `temata-planovani` hlídá, že u FP se skupina neopakuje. Okno akce a karty Plánu skupinu nespojovaly (pole Pro koho). Snímky 1280/390 prohlédnuty. |
| D-02 | **Opraveno** (a7ccd3c) | Naplánovat téma: důvod u návrhu „návrh“ (dřív „návrh, uloží se jen návrh“ vedle tlačítka Přidat do návrhu), bez druhého Zavřít dole (zavírá hlavička). Zápis: nápověda textu, souboru, ruční šablony a návrhu kratší; zrušen řádek „Použije se pro zápis akce: …“ (opakoval titulek okna). Navrhnout téma a svátek: jedna věta. Potvrzení ztráty/zveřejnění ponechána. Nově: **Zahodit změny** (okno i detail akce) zahazovalo neveřejné úpravy bez dotazu → samostatné potvrzovací okno (Zpět / Zahodit změny); otevřené okno po zahození hned ukáže zveřejněnou verzi (`key` = revize, dřív držel staré hodnoty a hrozilo jejich nové uložení). e2e `priprava-mesice` „zahození neveřejných změn se potvrzuje“. |
| D-03 | **Opraveno** (502c53c) | Okno zápisu: metadata nad čarou `--line`, stav verze + Změnit zdroj v tónovaném pruhu `--beige`, obsah, pod ním akce (Upravit zápis, Pracovní přepis) oddělené čarou. Jen CSS pod `.peek-section`, žádné nové barvy. Okno akce (stavový pruh / údaje v rámečku / lišta akcí s čarou), Naplánovat téma a detail akce už oddělené byly – beze změny. Karty Plánu beze změny (kompaktní mřížka, zásah by byl redesign). Snímky 1280/390 prohlédnuty; e2e zapisy, zapisy-schvaleni, pristupnost (1280/390/320) OK. |
| Souhrn chyb pod potvrzením | **Opraveno** (eb67ebd, relace 9) | Regrese ze Z-14 nalezená na snímku po: `Modal` zjišťoval platnost přes `checkValidity()`, která spouští `invalid`, a okno akce pod potvrzením ukázalo „Akci zatím nejde uložit“ a rozbalilo Další údaje. Nově `formIsValid` čte `validity` polí. e2e `priprava-mesice` „okno akce se ptá…“ hlídá, že souhrn chybí a Uložit jako návrh se u neplatného formuláře nenabízí. |
| Filtry Plánu 320 px | **Opraveno** (f43f8d5) | Regrese po A-03: kratší štítky souhrnu (44 px) vs. zalomené „Vybrat návrhy“ (52 px) – `grid-auto-rows: 1fr`. e2e `mobilni-ovladani` „filtry 2 × 2“ (320/360/390). |

## Spuštěné testy

* **Relace 9 (závěr):** `npm run build` OK; **celé e2e na 7a37622: 1162 passed / 111 skipped / 0 failed** (8,2 min,
  všech 7 projektů 1280/1920/1440/1512/390/360/320), nestabilní nález axe z relace 7 se neobjevil. Po opravě eb67ebd:
  typecheck OK, lint OK, unit **395/395**, build OK, e2e priprava-mesice + okna + temata-planovani + pristupnost +
  zapisy-schvaleni (1280/390/320) **148 passed / 8 skipped / 0 failed**. Celé e2e po eb67ebd znovu nespuštěno
  (změna je v jedné funkci `Modal`, příslušné sady prošly).
* Relace 8: typecheck OK, lint OK, unit **395/395**; e2e okna, priprava-mesice, plan-planovani, rychle-akce,
  temata-planovani, zapisy, zapisy-schvaleni, stranky (1280 + 390) **261 passed / 0 failed**; po D-03 zapisy,
  zapisy-schvaleni, pristupnost (1280/390/320) 17 passed.
* Relace 7 (konec): celé e2e 1161 passed / 108 skipped / 0 failed.

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
* NEOVĚŘENO: Firefox a skutečný WebKit (jen Chromium s UA macOS), Preview po této větvi, živý Google Kalendář (jen simulace `google-test`), čtečka obrazovky naživo (jen axe a role v e2e).

## Změněná pravidla (pro integraci do Wiki)

* Úprava schváleného zápisu už neruší zveřejnění. Stažení dělá jen „Stáhnout zápis“ (`withdrawMinutes`).
* Nahrazení rozepsaného zápisu s obsahem vyžaduje `confirmReplace=on` (server).
* `moveTopicAction` přijímá i `to` (cílová pozice ve skupině) a `expected` (pořadí, které správce viděl); při rozdílu `conflict`.

## Rizika před nasazením

* **DEP-01 – migrace 0013/0014** (z PR #73, toto kolo schéma nemění) se spouštějí automaticky při startu aplikace.
  Na Preview už proběhly, na produkci proběhnou po merge. Před merge: záloha / branch Neonu, ověření na stagingu,
  kontrola, že stávající zveřejněné zápisy dostaly `approved_version` (jinak by je čtenáři přestali vidět).
  Rozhoduje uživatel (případně ruční migrace místo automatické).
* Změněná serverová pravidla (níže) mění chování pro uživatele: úprava schváleného zápisu už nestahuje zveřejnění,
  nahrazení zápisu vyžaduje `confirmReplace`, `moveTopic` odmítne zastaralé pořadí. Integrace do firemní Wiki musí
  převzít i tyto kontroly, ne jen UI.
* Sdílená Preview DB obsahuje ručně zadaná data („NJBJK“) – před prezentací vyčistit nebo znovu nasadit seed (C-08).
* Firefox/Safari neověřeny: `field-sizing: content` (Z-09) má zálohu `rows`, nativní `<dialog>` a pointer events DnD
  jsou podporované, ale neotestované.
* Ukázka běží na fiktivních datech a v režimu simulace integrací; živý test Kalendáře a přihlášení Google není součástí.

## Otevřené otázky pro uživatele (nic neblokují)

1. Pushnout tuto větev do větve PR #73 (`claude/rychle-akce-a-planovani-temat`)? Zatím ne.
2. DEP-01: nechat migrace 0013/0014 automaticky při startu, nebo je pustit ručně před merge?
3. Sjednotit 10 potvrzení přes `ActionForm` na `ConfirmDialog` (`alertdialog`)?
4. `PrepareMonthDialog`: převést `<datalist>` na combobox i tam?
5. Zdroj zápisu z PDF/DOCX (Z-13) – chcete ho (vyžaduje bezpečný parser)?
6. Vyčistit Preview DB („NJBJK“)?
