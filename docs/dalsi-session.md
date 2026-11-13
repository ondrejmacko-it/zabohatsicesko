# Prompt pro další session

Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`).

---

Pokračuj na demu modulu Vzdělávání (repo `ondrejmacko-it/zabohatsicesko`). Nečti znovu celé zadání ani celý kód.
Kontext máš v `docs/dalsi-session.md`, `README.md`, `docs/google-prihlaseni.md` a `docs/google-kalendar.md`,
pravidla v `CLAUDE.md`. Tykej mi, piš přátelsky. Úpravy níže jsou odsouhlasené, rovnou je udělej. Ptej se jen
na věci označené „zeptej se“.

Stav: `main` obsahuje PR #1 až #15. Větev `claude/amazing-edison-51eo2g` (bez PR) má nová okna, menu, filtry
nahoře, témata jako karty a zápisy v okně (viz „Stav“ v `docs/dalsi-session.md`). Pokud není sloučená, vyjdi
z ní, jinak z `main`.

Zásada pro celé UI: hlavní údaje a hlavní akce musí vyniknout, vedlejší texty jsou menší a tlumené, nic není
ani o pixel mimo osu, vše je jasné na první pohled.

ČÁST A · Kalendář musí konečně fungovat (nejvyšší priorita)

Co dnes nefunguje a proč (ověřeno v kódu 13. 11.): přihlášení žádá jen `openid email profile`, souhlas ke
Kalendáři je druhý krok jen pro organizátora a správce a jen když Wiki žádné propojení nemá
(`needsCalendarConnection`). Propojení je jedno pro celou Wiki a zapisuje do jednoho kalendáře
(`GOOGLE_CALENDAR_ID`). Hosté pozvánek jsou bez `CALENDAR_ATTENDEES=audience` jen adresy z
`GOOGLE_ALLOWED_ATTENDEES`, proto se nový účet v pozvaných neobjeví a nic se mu nepropíše.

1. Souhlas ke Kalendáři rovnou při přihlášení: kdo plánuje (správce), dostane jednu obrazovku Googlu
   s přihlášením i oprávněním `calendar.events` a Wiki si propojení uloží sama, bez dalšího kroku. Účet, který
   už ve Wiki je a plánuje, pozná server podle e-mailu před přesměrováním (nebo požádej o oprávnění až druhým
   automatickým přesměrováním, pokud to jinak nejde). Účastník oprávnění ke Kalendáři nedává, pozvánky
   dostává jako host.
2. Účastníci se do pozvánek dostanou sami: skuteční hosté jsou aktivní účty skupiny akce. Navrhni a udělej
   bezpečné zapnutí (`CALENDAR_ATTENDEES=audience`): ve Správě jasně ukaž, komu Wiki pozvánky pošle, a přepínač
   zapni na preview až po mém potvrzení účtů (zeptej se, posílá skutečné e-maily).
3. Stav Kalendáře musí být vidět: na Plánu a ve Správě řádek „Kalendář: propojeno účtem X, kalendář Y,
   pozvánky dostává: …“ nebo výrazná výzva „Propojit“. V dialogu akce ukaž skutečné hosty podle skupiny, ne jen
   testovací adresu. Když propojení chybí nebo vypršelo (režim Testing, 7 dní), řekni to hned a nabídni opravu.
4. Zjisti na preview, proč se mi teď nic nepropisuje: stav `integration_credentials` a `calendar_links`
   v Neonu (projekt `neon-zbz-vzdelavani-demo`), proměnné na Vercelu, role mého účtu. Výsledek mi napiš.
5. Projdi se mnou živý test krok za krokem (přihlášení, žádost, schválení, propojení, pozvánka, změna, zrušení,
   odkaz na zápis) a napiš přesný postup včetně toho, kde ve Správě vidím, který účet je ve které skupině.

ČÁST B · role a oprávnění

6. Sluč role organizátor a správce do jedné: v UI jedna role „Správce“ (plánuje, zveřejňuje, spravuje účty,
   vidí vše). V databázi nech obě hodnoty a v `policy.ts` je ber stejně, ať není potřeba destruktivní migrace.
   Uprav texty, Správu, ukázkové role na `/vstup` a testy.
7. Správce smí u každé akce nahrát záznam, upravit a zveřejnit i stáhnout zápis (dnes jen vedoucí a kontrolor).
   V okně „Přidat zápis“ pak má u všech akcí „Nahrát záznam“. Přidej testy oprávnění.
8. Jména zájemců o téma vidí každý, kdo smí plánovat (správce). Tak to už je, jen ověř po sloučení rolí.
   V dialogu akce nabídni doporučená témata s počtem zájemců.

ČÁST C · dodělat z minula (po každém bloku ověř na 1280 a 390 px)

9. Správa: úpravy uživatele v okně (`Modal`), řádkové akce v menu (`src/components/Menu.tsx`), na první pohled
   vidět účet, roli a skupiny.
10. Menu místo řady tlačítek: detail akce pro vedoucího, Integrace, `SyncPanelView`.
11. Doověř: okno zveřejněného zápisu za čtenáře, nahrání záznamu v okně (průběh a `AutoRefresh`), „Přidat zápis“
    na 1280 px, Plán za účastníka na 390 px, varování o hydrataci na Plánu ve vývojovém režimu.
12. Cokoli dalšího, co zlepší přehlednost podle zásady výše, udělej a vypiš mi to.

ČÁST D · předání

13. Dokumentace: `README.md`, `docs/predani.md`, `docs/google-*.md` a `docs/dalsi-session.md` odpovídají stavu.
14. Větev postav na nejnovějším `main`, zprovozni lint, typy, testy, build a preview (vlastní `APP_URL` větve
    nastav sám, přesměrovací adresy v Googlu přidám já, napiš mi je) a připrav draft PR do `main`. Merge dělám já.
15. Snímky každého okna a stavu za každou roli na 1280 a 390 px (stránky, okna, menu, výběry, prázdné a chybové
    stavy, vstupní brána, čekající žádost) jako ZIP se seznamem. Do repa je nedávej.

Production na Vercelu nemá proměnné prostředí a buildy z `main` se přeskakují, vše běží na preview.
Na `main` nepushuj. Respektuj limit kontextu: začni částí A, a když se limit blíží, ulož stav do
`docs/dalsi-session.md` a pošli mi navazující prompt.

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

Rozhodnuto uživatelem 13. 11. večer: jména zájemců vidí ti, kdo plánují (tak to je). Správce a organizátor
mají umět vše včetně zápisů u cizích akcí a role se mají sloučit do jedné. Kalendář má fungovat automaticky
už od přihlášení (části A a B promptu).

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
