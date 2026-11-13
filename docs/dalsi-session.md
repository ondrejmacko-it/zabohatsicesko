# Prompt pro další session

Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`).

---

Pokračuj na demu modulu Vzdělávání (repo `ondrejmacko-it/zabohatsicesko`). Nečti znovu celé zadání ani celý kód.
Kontext máš v `docs/dalsi-session.md`, `README.md` a `docs/google-prihlaseni.md`, pravidla v `CLAUDE.md`.
Tykej mi, piš přátelsky. Na nejasnosti se ptej, ale úpravy níže jsou odsouhlasené, rovnou je udělej.

Stav 13. 11. 2026: `main` obsahuje PR #1 až #15. Větev `claude/amazing-edison-51eo2g` (bez PR) vychází z
`claude/festive-shannon-s7wa4o` a má hotové body 1, 2, 4 a 5 z části A (viz „Stav“ níže). Pokud není sloučená,
vyjdi z ní, jinak z `main`.

Zásada pro celé UI: hlavní údaje a hlavní akce musí vyniknout, vedlejší texty jsou menší a tlumené, nic není
ani o pixel mimo osu, vše je jasné na první pohled.

ČÁST A · zbývá (po každém bloku ověř v prohlížeči na 1280 a 390 px):

1. Správa: úpravy uživatele v okně (`Modal`) místo formulářů v řádku, řádkové akce v rozbalovacím menu
   (`src/components/Menu.tsx`), ať je na první pohled vidět, který účet je ve které skupině a roli.
2. Projdi zbylá místa s řadou tlačítek (detail akce pro vedoucího, Integrace, `SyncPanelView`) a kde to dává
   smysl, použij `Menu`. Projdi všechna okna: klik mimo zavírá, rozepsaný formulář se ptá.
3. Doověř z minulé relace: okno zápisu na stránce Zápisy za čtenáře se zveřejněným zápisem, nahrání záznamu
   v okně (průběh zpracování a `AutoRefresh`), „Přidat zápis“ na 1280 px za vedoucího, Plán za účastníka na 390 px,
   varování o hydrataci v konzoli na Plánu (objevilo se ve vývojovém režimu, v druhém běhu ne).
4. Cokoli dalšího, co zlepší přehlednost podle zásady výše, udělej a vypiš mi to.

ČÁST B · až bude A hotová a ověřená:

5. Napiš mi přesný postup, jak ověřit živě: přihlášení Googlem, žádost na `/sprava`, schválení, propojení Kalendáře
   a `CALENDAR_ATTENDEES=audience`. Zahrň, kde ve Správě zjistím, který účet je ve které skupině (zatím to nevím).
   `audience` nezapínej, dokud ti účty nepotvrdím, posílá skutečné pozvánky.
6. Kompletní dokumentace: `README.md`, `docs/predani.md`, `docs/google-*.md` a `docs/dalsi-session.md` musí
   odpovídat skutečnému stavu.
7. Srovnej kód: větev postav na nejnovějším `main`, vše zprovozni (lint, typy, testy, build, preview; větev
   potřebuje vlastní `APP_URL` na Vercelu a já přidám přesměrovací adresy v Googlu) a připrav draft PR do `main`.
   Merge dělám já.
8. Nascreenshotuj každé jediné okno a stav, na který se dá ve Wiki dostat, za každou roli, na 1280 a 390 px:
   všechny stránky, otevřená okna (Přidat akci, Upravit, Zrušit, náhled akce, zápis, Přidat zápis, šablona týdne,
   potvrzení), rozbalená menu i výběry ve formulářích, prázdné a chybové stavy, vstupní bránu, čekající žádost.
   Pošli mi je jako ZIP se seznamem, co je na kterém snímku. Do repa je nedávej.

Production na Vercelu nemá proměnné prostředí a buildy z `main` se přeskakují, vše běží na preview.
Na `main` nepushuj. Respektuj limit kontextu: když se blíží, ulož stav do `docs/dalsi-session.md` a pošli mi
navazující prompt.

---

## Stav 13. 11. 2026 (větev `claude/amazing-edison-51eo2g`, bez PR)

Hotovo a ověřeno (lint, typy, 121 ze 121 testů, build; Chromium nad PGlite):

- **Okna (`src/components/Modal.tsx`):** vykreslují se přes portál do `<body>`. Okno otevřené z jiného okna to
  první po dobu práce schová (pravidlo `body > .dialog[open]:has(~ .dialog[open])`), po zavření se první vrátí.
  Klik mimo a Esc zavírají. Rozepsaný formulář (otisk polí se od otevření změnil) se nejdřív zeptá. Dialog akce
  si změny hlídá sám (`selfGuarded`).
- **Menu (`src/components/Menu.tsx`):** nahrazuje `details.menu`. Seznam je `position: fixed`, neořízne ho okno
  ani tabulka, otevře se nahoru, když se dolů nevejde. Zavírá klik mimo, Esc, posun stránky a volba položky.
  Položky zůstávají v dokumentu, aby si okna otevřená z menu držela stav. Odesílací tlačítka menu nezavírají.
- **Okno akce (`EventPeek`):** vlevo „Další možnosti“ (Zobrazit zápis, Otevřít celý detail, Nahradit pravidelný
  termín, pod čarou Zrušit akci nebo Smazat návrh), vpravo hlavní „Upravit“. Bez posuvníku na 1280 i 390 px.
  Stejné rozložení má záhlaví celého detailu akce. Kdo není organizátor, má odkazy jako tlačítka.
- **Plán:** filtry jsou úplně nahoře (`.plan-filter-bar`). „Čeká na vás“ i „Nejbližší akce“ se počítají pro
  diváka z „Zobrazit jako“ (`listTasks`, `nextEventsFor` se stejnými pravidly, úkoly v náhledu bez tlačítek)
  a respektují Typ akce i Stav (`matchesPlanFilter`, `JourneyTask.eventType`). Skryté úkoly ohlásí řádek
  „Filtr skrývá další úkoly“.
- **Témata:** karty ve dvou sloupcích, doporučená okrově. Jména zájemců po kliknutí na počet. **Vidí je jen
  organizátor a správce** (`listTopicInterested`, jinak `forbidden`), ostatní jen počet. Je to opatrná volba,
  čeká na potvrzení uživatele. Správa tématu je v menu (Upravit, Archivovat).
- **Zápisy:** zápis se otevírá v okně nad stránkou (`?zapis=<id>`, `MinutesPeek`), vedoucí v něm rovnou nahraje
  záznam a zápis zkontroluje. Tlačítko „Přidat zápis“ s počtem (`?pridat=1`, `listMissingMinutes`): vedoucí
  a kontrolor vidí své proběhlé akce bez zápisu, organizátor všechny jako přehled s odkazem na akci. **Organizátor
  sám nahrát nesmí**, pokud akci nevede (oprávnění se neměnila).
- Testy: `tests/zapisy-temata.test.ts`.

Neověřeno: body v části A.3 promptu, Safari, živý Google. Správa (bod A.1) se nezačala.

Otevřené otázky pro uživatele:

- Smí jména zájemců o téma vidět i vedoucí akcí nebo všichni ze skupiny tématu? Teď jen organizátor a správce.
- Má organizátor smět nahrát záznam a zveřejnit zápis i u akce, kterou nevede? Teď ne.

Poznámky k prostředí: lokální běh `npx next dev -p 3100` nad PGlite, na `/vstup` kliknout na `label.persona`
a odeslat. Po větší změně serverových modulů vývojový server restartuj (držel starou verzi modulu).
`AGENTS.md` v kořeni je v repu, nemaž ho. Živý test: preview větve potřebuje vlastní `APP_URL`
(`https://zbc-vzdelavani-demo-git-<větev>-maci.vercel.app`) a dvě přesměrovací adresy v Google konzoli
(`/api/google/prihlaseni/callback`, `/api/google/kalendar/callback`). Větev `claude/festive-shannon-s7wa4o` je má.
Všechny preview sdílí jednu databázi Neon. Starší historii relací najdeš v gitu tohoto souboru.

## Odsouhlaseno 12. 11. 2026

- Hotové demo „jak by to vypadalo v realitě“, fiktivní role a simulace zůstávají jako přepínače.
- Role smí přidělovat správce i organizátor (roli správce jen správce). Pozvánka i žádost.
- Zatím osobní Gmaily, jeden firemní kalendář vzdělávání, jeden OAuth klient.
- E-maily: žádný vlastní poskytovatel. Pozvánky a změny rozesílá Google. Zveřejněný zápis doplní odkaz
  do pozvánky s rozesláním změny, ve Wiki je to v Moje cesta.

## Rozhodnuto 12. 11. 2026 večer

- Zásada UI: co je v dané části důležité, musí být vidět hned a přehledně. Proto je Přidat akci samostatné
  tlačítko a v nabídce jsou jen méně časté nástroje.
- Pořadí: nejdřív dodělat zbytek, potom živý test, potom testy, úpravy a změny včetně UI.
- Nahrávky a přepis: zatím jen demo. Firma nemá žádné vlastní služby ani úložiště, uživatel může nabídnout
  Google Disk. **Nic placeného se nezavádí, dokud to firma neschválí a nezaplatí.** Přepis teď není klíčový,
  stačí znát možnosti. Požadavek na budoucí přepis: co nejkvalitnější čeština, ideálně bez chyb, zpracování
  v EU. Delší záznamy (2 až 2,5 h) se v praxi otestují až na žádost firmy.

## Vercel a přístupy

- Tým `maci`, projekt `zbc-vzdelavani-demo`, plán Hobby. Preview se spouští pushem větve, produkci
  přeskakuje ignored build step. `POST /v13/deployments` nepoužívat (vytvoří produkční deploy).
- Proměnné pro Preview jsou nastavené (`CALENDAR_MODE`, `LOGIN_MODE`, `GOOGLE_*`, `TOKEN_ENCRYPTION_KEY`,
  `APP_URL`, `GOOGLE_LOGIN_ACCOUNTS`). Nesecretní zakládá Claude přes API sám, tajemství doplní uživatel.
- Preview chrání Vercel Authentication. Pro Playwright: sdílecí odkaz z dashboardu (Share, 23 h) a
  dočasně povolený host preview v síťových pravidlech prostředí (po testu odebrat). Vercel runtime logy
  přes konektor vrací 403, data jdou číst přes Neon konektor (projekt `neon-zbz-vzdelavani-demo`).
- Do Wiki se automat dostane jen přístupovým kódem. Kód zná uživatel, nikam ho nezapisuj. Doporučeno
  ho po testu 12. 11. změnit, protože byl v chatu.
- Pozor: Google přihlášení a Kalendář sdílí jednoho OAuth klienta.

## Čeká na odpověď uživatele

- Výběr poskytovatele přepisu a úložiště: přehled je v `docs/nahravky-moznosti.md`, odloženo, rozhodne firma.
- Skutečné pravidlo střídání typů ve slotu šablony a zda předvyplňovat téma i tréninkům.
- Kam trvale uložit zadání (ZIP), aby ho nebylo nutné posílat. Do tohoto veřejného repa ne.

## Úklid, rozhoduje uživatel

- Token pro `api.vercel.com` v síťových tajemstvích prostředí Default a sloučená větev
  `claude/vzdelavani-vercel-preview-52jflw`.
- Jednobajtový soubor `h` v kořeni repa (commit „Create h“), nejspíš omyl.
- Tento soubor uvádí názvy projektů na Vercelu a v Neonu. Nejsou to tajemství, u veřejného repa zvážit.

Respektuj limit kontextu v `CLAUDE.md`. Na `main` nepushuj, merge dělá uživatel přes PR.
