# Prompt pro další session

Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`).

---

Pokračuj na demu modulu Vzdělávání (repo `ondrejmacko-it/zabohatsicesko`). Nečti znovu celé zadání ani celý kód.
Kontext máš v `docs/dalsi-session.md`, `README.md` a `docs/google-prihlaseni.md`, pravidla v `CLAUDE.md`.
Tykej mi, piš přátelsky. Na nejasnosti se ptej, ale úpravy níže jsou odsouhlasené, rovnou je udělej.

Stav 13. 11. 2026 v noci: `main` obsahuje PR #1 až #15. Větev `claude/festive-shannon-s7wa4o` má navíc náhled akce
v okně nad Plánem, okrové návrhy a jednotný styl chybějících údajů (bez PR). Pokud není sloučená, vyjdi z ní,
jinak z `main`. Její preview má vlastní `APP_URL` a přihlášení Googlem na ní funguje (ověřil jsem 13. 11.).

Zásada pro celé UI: hlavní údaje a hlavní akce musí vyniknout, vedlejší texty jsou menší a tlumené, nic není
ani o pixel mimo osu, vše je jasné na první pohled.

ČÁST A · opravy a novinky (v tomto pořadí, po každém bloku ověř v prohlížeči na 1280 a 390 px):

1. Okno akce (`EventPeek`):
   - Vejde se bez posuvníku. Nabídka „Další možnosti“ se dnes ořízne o okraj okna a přidá posuvník: udělej z ní
     skutečné rozbalovací menu, které se vykreslí nad oknem (ne uvnitř rolované části).
   - „Zrušit akci“ a „Upravit“ se dnes otevřou jako okno v okně a původní okno pod nimi ujede a prosvítá.
     Druhé okno má to první nahradit (nebo se vykreslit mimo něj), nikdy dvě rozbitá okna na sobě.
   - Do „Další možnosti“ dej vše pohromadě: Zobrazit zápis, Otevřít celý detail, Nahradit pravidelný termín,
     Zrušit akci, Smazat. Tlačítko „Upravit“ zůstává hlavní vpravo. Pokud vymyslíš přehlednější rozložení, použij ho.
2. Klik mimo zavírá: každé menu (`details.menu`), každé okno (`Modal`) i náhled akce. Rozepsaný formulář se
   přitom nesmí ztratit bez potvrzení (dialog akce už potvrzení má). Esc funguje dál.
3. Rozbalovací menu místo řady tlačítek všude, kde to dává smysl (detail akce, řádky ve Správě, témata).
4. Filtry „Zobrazit jako“, „Typ akce“ a „Stav“ přesuň na Plánu úplně nahoru, nad „Čeká na vás“ a „Nejbližší akce“.
   Musí měnit obsah celé stránky, tedy i oba horní bloky, ne jen harmonogram. V náhledu „Zobrazit jako“ ukazují
   horní bloky to, co vidí vybraná skupina nebo kolega (stejná pravidla `policy.ts`, jen ke čtení).
5. Zápisy a témata:
   - Témata odliš pozadím jako karty, ať je vidět, že jde o obsah, ne o další text.
   - U tématu jde zobrazit zájemce (kdo, ne jen počet). Ověř na serveru, kdo jména smí vidět, a zeptej se mě,
     pokud to z pravidel není jasné.
   - Na stránce Zápisy tlačítko „Přidat zápis“ (pro vedoucího a organizátora): okno jako „Přidat akci“ se seznamem
     jen těch proběhlých akcí, kde zápis chybí. Existující zápisy se zobrazují rovnou jako dnes.
6. Odložené z minula: stejné okno jako u akce použij u zápisu ze stránky Zápisy a u úprav uživatele ve Správě.
7. Cokoli dalšího, co zlepší přehlednost podle zásady výše, udělej a vypiš mi to.

ČÁST B · až bude A hotová a ověřená:

8. Napiš mi přesný postup, jak ověřit živě: přihlášení Googlem, žádost na `/sprava`, schválení, propojení Kalendáře
   a `CALENDAR_ATTENDEES=audience`. Zahrň, kde ve Správě zjistím, který účet je ve které skupině (zatím to nevím).
   `audience` nezapínej, dokud ti účty nepotvrdím, posílá skutečné pozvánky.
9. Kompletní dokumentace: `README.md`, `docs/predani.md`, `docs/google-*.md` a `docs/dalsi-session.md` musí
   odpovídat skutečnému stavu. Staré bloky v `docs/dalsi-session.md` zkrať.
10. Srovnej kód: větev postav na nejnovějším `main`, vše zprovozni (lint, typy, testy, build, preview) a připrav
    draft PR do `main`. Merge dělám já.
11. Nascreenshotuj každé jediné okno a stav, na který se dá ve Wiki dostat, za každou roli, na 1280 a 390 px:
    všechny stránky, otevřená okna (Přidat akci, Upravit, Zrušit, náhled akce, šablona týdne, potvrzení),
    rozbalená menu i výběry ve formulářích, prázdné a chybové stavy, vstupní bránu, čekající žádost.
    Pošli mi je jako ZIP se seznamem, co je na kterém snímku. Do repa je nedávej.

Production na Vercelu nemá proměnné prostředí a buildy z `main` se přeskakují, vše běží na preview.
Na `main` nepushuj. Respektuj limit kontextu: když se blíží, ulož stav do `docs/dalsi-session.md` a pošli mi
navazující prompt.

---

## Nahlášeno uživatelem 13. 11. 2026 v noci (ze snímků preview, neopraveno)

- Okno akce: nabídka „Další možnosti“ je oříznutá a přidává posuvník, „Zrušit akci“ se otevře uvnitř okna a to
  pod ním ujede. Příčina k ověření: `<dialog>` vnořený v `.dialog-body` s `overflow-y: auto` a `.menu-list`
  s `position: absolute`.
- Přihlášení Googlem na preview této větve funguje (lišta ukazuje „Přihlášení účtem Google“). Automatický
  souhlas ke Kalendáři a ostatní kroky živého testu uživatel zatím nepotvrdil.
- Uživatel neví, který účet je ve které skupině, ověří to až podle postupu z bodu 8 promptu.

## Stav 13. 11. 2026 v noci (větev `claude/festive-shannon-s7wa4o`, vychází z `main` po PR #15)

- `main` obsahuje PR #1 až #15 (včetně obsahu PR #14). Tato větev přidává připomínky uživatele k přehlednosti:
  - **Náhled akce v okně nad Plánem** (`EventPeek`, `RouteModal`, parametr `?akce=<id>`): stav v barevném pruhu,
    Kdy, Téma, Vede, Pro koho, dole „Otevřít celý detail“, Další možnosti a Upravit. Měsíc, filtry i posun stránky
    zůstávají. Celá stránka `/vzdelavani/akce/<id>` funguje dál (odkazy z pozvánek a Zápisů).
  - **Chybějící údaj má v celé Wiki jeden styl** (`Todo`, třída `.todo`: menší, kurzívou, okrově). Organizátor čte
    „doplnit téma“, ostatní „zatím neurčeno“. Tečkovaná linka zmizela. Zásada uživatele: hlavní údaje a akce mají
    vynikat, vedlejší texty být menší a tlumené (`.hint`). Držet ji i u dalších úprav.
  - **Návrhy okrově** s pruhem vlevo (`--draft`), štítek „Návrh“. Popisky „Téma“ a „Vede“ v kartách malé a tlumené.
  - **Zarovnání:** šipky měsíce, přepínač Měsíc a Seznam a „Zrušit filtry“ mají stejnou výšku jako sousední prvky.
- Ověřeno: lint, typy, testy, build. Chromium nad PGlite za organizátora na 1280 px: otevření okna, Upravit nad
  oknem, zavření bez posunu stránky. **Neověřeno:** 390 px, ostatní role, náhled „Zobrazit jako“ v okně, Safari.
- **Další krok (odsouhlaseno):** stejné okno u zápisu ze stránky Zápisy a u úprav uživatele ve Správě. Potom
  projít zbylé stránky podle zásady výše (detail akce, Správa, Integrace).
- **Živý test pořád neproběhl.** Větev má na Vercelu vlastní `APP_URL`
  (`https://zbc-vzdelavani-demo-git-claude-festive-shannon-s7wa4o-maci.vercel.app`), uživatel má v Google konzoli
  přidat její dvě přesměrovací adresy. Přihlášení z preview bez vlastní `APP_URL` vrací na starou větev
  `ccr-2d4283fa-slno9d` (společná `APP_URL`). Před `CALENDAR_ATTENDEES=audience` potvrdit účty ve skupinách.
- Lokální průchod: na `/vstup` vybrat `label.persona` a odeslat, po přihlášení čekat na změnu adresy.

## Stav 13. 11. 2026 pozdě večer (větev `claude/festive-shannon-s7wa4o`, vychází z větve PR #14)

- PR #14 (`claude/focused-dirac-gphy4f`) je pořád draft a nesloučený. Tato větev na něj navazuje:
  - `docs/google-kalendar.md` a `docs/google-prihlaseni.md` popisují automatické propojení Kalendáře.
  - `docs/google-workspace-moznosti.md`: návrh variant A až E (In production bez ověření, ověření, Workspace
    Internal, servisní účet s delegováním). Doporučení pro demo je B. Ověřeno jen z výsledků vyhledávání,
    `developers.google.com` a `support.google.com` nejsou v povolené síti prostředí.
  - Integrace: text o hostech pozvánek odpovídá `CALENDAR_ATTENDEES`, doplněna věta o automatickém propojení.
    Ostatní „ukázkové“ texty (Ukázka chyb, Ukázková data, štítek „neověřeno proti Googlu“ u Přihlášení)
    čekají na rozhodnutí uživatele a na výsledek živého testu.
  - Zápisy po měsících: `groupByMonth` (`src/features/vzdelavani/minutes.ts`) řadí podle zveřejněného termínu,
    test `tests/zapisy-mesice.test.ts` (více měsíců, přelom roku, pražský čas). V prohlížeči s více měsíci neviděno.
- Ověřeno: lint, typy, 118 ze 118 testů, build.
- **Živý test (kroky 1 a 2 promptu výše) neproběhl**, čeká na uživatele: potvrzení obou přesměrovacích adres
  v Google konzoli a seznam účtů ve skupinách před `CALENDAR_ATTENDEES=audience`. Preview větve PR #14 je
  nasazené (commit `eb85ab6`), `APP_URL` větve sedí. Tato větev vlastní `APP_URL` nemá, testuje se na PR #14.
- Vercel přes konektor vrací 403 nebo 404, funguje `curl https://api.vercel.com/...?slug=maci`.

## Stav 13. 11. 2026 večer (větev `claude/focused-dirac-gphy4f`, zatím bez PR)

- `main` obsahuje PR #1 až #13. Tato větev zapracovává připomínky uživatele ke stránce Plán:
  - **Horní bloky:** „Čeká na vás“ a „Nejbližší akce“ jsou stejně vysoké, se stejnými řádky (`.brief-row`).
    Úkoly nad tři se sbalí do „Další úkoly“, nejbližší akce jsou až tři (`nextEventsFor`, `NextEventsList`).
  - **Stav měsíce je mezi úkoly organizátora** (`monthTasks` ve `status.ts`): „k doplnění“ a „čeká na zveřejnění“
    s tlačítkem, které zúží harmonogram (`?stav=`). Řádek s čísly (`MonthSummaryBar`) a odrážkový seznam
    (`PlanGaps`) jsou pryč, filtr **Stav** je třetí výběr vedle „Zobrazit jako“ a „Typ akce“.
  - **Detail akce z náhledu „Zobrazit jako“** (`?jako=` na `/vzdelavani/akce/[id]`): počítá se pro vybranou
    skupinu nebo kolegu, jen ke čtení, nástroje vedoucího se v náhledu nenabízejí.
  - Domovská stránka vyká, vstupní stránka říká „Ukázka“ místo „Prototyp“.
- Ověřeno: lint, typy, 115 ze 115 testů, build. Chromium nad PGlite: Plán za organizátora (1280 a 390 px),
  vedoucího a účastníka, filtr K doplnění, náhled za FP a za vedoucího včetně detailu, Zápisy se dvěma
  zveřejněnými zápisy (nadpis měsíce se ukazuje), bez vodorovného posunu. **Neověřeno:** Safari, živý Google.
- **Živý test:** pro tuto větev je na Vercelu nastavená `APP_URL`
  `https://zbc-vzdelavani-demo-git-claude-focused-dirac-gphy4f-maci.vercel.app`. Uživatel musí v Google konzoli
  přidat `<APP_URL>/api/google/prihlaseni/callback` a `<APP_URL>/api/google/kalendar/callback`. Přihlašovat se
  jen z této adresy větve, ne z adresy jednotlivého nasazení. `redirect_uri=` z chyby na staré větvi uživatel
  zatím neposlal.
- **Automatické propojení Kalendáře (odsouhlaseno a naprogramováno 13. 11., naživo neověřeno):** po přihlášení
  Googlem pošle Wiki organizátora nebo správce, pokud propojení chybí, rovnou na souhlas ke Kalendáři
  (`needsCalendarConnection`, `/api/google/kalendar/pripojit?auto=1`, účet jde jako `login_hint`) a vrátí ho na
  Plán. Ostatní role nic navíc nedostanou. Chybějící propojení je první úkol v „Čeká na vás“. Jedno propojení
  platí pro celou Wiki, zápisy vedoucího (odkaz na zápis v pozvánce) jdou přes něj. Stránka Integrace zůstává
  jako technická adresa. Uživatel neví, kdo ve firmě vlastní kalendář: účet organizátora do něj musí smět
  zapisovat. Dokud je OAuth aplikace v režimu Testing, propojení vyprší po 7 dnech. Dokumentace v
  `docs/google-kalendar.md` a `docs/google-prihlaseni.md` tento tok zatím nepopisuje.
- Otevřené: „Ukázka“ a přepínač rolí zůstávají. Texty na technické stránce Integrace jsou pořád „ukázkové“.

## Stav 13. 11. 2026 pozdě odpoledne (větev `ccr-aad79b00-uhlkt9`, PR do `main`)

- `main` obsahuje PR #1 až #12. Uživatel prošel web na preview a nadiktoval připomínky, tato větev je zapracovává:
  - **Navigace ze čtyř záložek na dvě:** „Plán“ (`/vzdelavani/harmonogram`: Čeká na vás a Nejbližší akce vedle sebe,
    pod nimi harmonogram) a „Zápisy a témata“ (`/vzdelavani/zapisy`). `/vzdelavani/prehled`, `/moje-cesta` a `/temata`
    přesměrují. Integrace zmizela z navigace, stránka `/vzdelavani/integrace` zůstává jako technické nastavení
    s odkazem ze Správy. Pruh režimů ukázky je už jen tam.
  - **Harmonogram:** vlevo měsíc a přepínač Měsíc / Seznam, vpravo Nástroje organizátora a úplně na kraji Přidat akci.
    Průvodce měsícem nahradil řádek s čísly (`monthSummary`, `MonthSummaryBar`), která jsou zároveň filtr (`?stav=navrhy`,
    `?stav=doplnit`). Filtr typu akce (`?typ=`) a „Zobrazit jako“ (`?jako=skupina-fp` nebo `kolega-<id>`,
    `src/server/services/preview.ts`): jen organizátor, jen ke čtení, počítá se stejnými pravidly `policy.ts`.
  - **Dialog akce:** zvýrazněný blok Základní údaje, výrazné upozornění na den mimo šablonu týdne (pondělí), akci jde uložit.
  - **Témata:** jeden seznam, doporučená mají štítek, Upravit a Archivovat u každého řádku (`TopicsSection`).
  - **Zápisy:** po měsících, s vysvětlením, že zápis je i u akce v Plánu.
  - **Správa:** vysvětlení rolí a skupin, tlačítka rychlého nastavení (Účastník FP, RM, Tým A, Organizátor).
- Ověřeno: lint, typy, 111 ze 111 testů (nový `tests/nahled.test.ts`), build. Chromium nad PGlite za organizátora na
  1280 a 390 px: Plán, filtry, náhled za FP, upozornění na pondělí, rychlé nastavení ve Správě, Zápisy a témata,
  přesměrování, bez vodorovného posunu. **Neověřeno:** ostatní role v prohlížeči, Safari, živý Google.
- **Přihlášení Googlem na preview `ccr-8554df8b-jabz1f` hlásí `redirect_uri_mismatch`.** Nasazení je v pořádku
  (`APP_URL` větve nastavená, build po ní), chyba je v Google konzoli (překlep v adrese, nebo se změna ještě
  nepropsala). Čeká se na řádek `redirect_uri=` z chybové stránky Googlu od uživatele.
- Production na Vercelu nemá žádné proměnné prostředí a buildy z `main` se přeskakují. Živý test proto na preview.
- Rozhodnutí uživatele 13. 11.: připojování Kalendáře nemá být samostatný krok pro uživatele, do budoucna má
  přihlášení Googlem dát oprávnění automaticky. **Zatím neřešeno**, připojení Kalendáře zůstává na technické stránce.
  Štítek „Ukázka“ a přepínač rolí prozatím zůstávají.
- Otevřené: karta akce z náhledu „Zobrazit jako“ vede na detail v pohledu organizátora. Domovská stránka Knihovna
  má texty tykáním („Co tě čeká“), zbytek UI vyká.

## Stav 13. 11. 2026 večer (větev `ccr-8554df8b-jabz1f`, PR #12 do `main`)

- PR #12 spojuje #10 a #11 (ty uživatel zavře) a **dokončuje zbylé body 3 a 4 šestibodového zadání**:
  - pruh režimů ukázky je i na stránce Integrace (`ModeStrip`), na telefonu tam zůstává vidět,
  - dialog akce: Typ, termín, Téma, Vede, Publikum nahoře, Název v plánu a Kontrolor zápisu ve sbaleném
    „Další nastavení“ (otevře se samo, když jsou vyplněné jinak než výchozím způsobem nebo při neplatném poli),
  - „Stáhnout zveřejněný zápis“ (`withdrawMinutes`): publikum zápis nevidí, vedoucí ho má zpět jako návrh,
    z pozvánky zmizí odkaz,
  - stín původního termínu v harmonogramu organizátora (`EventCard.movedFrom`),
  - „Koho se zrušení dotkne“ v dialogu zrušení (`cancelImpact`): skupina ve Wiki a hosté pozvánky,
  - věta „co udělat“ pod stavem v detailu akce (`statusAdvice`, jen organizátor),
  - průvodce měsícem ve třech krocích nad harmonogramem (`monthSteps`: Termíny, Témata a vedoucí, Zveřejnění),
  - texty z #10 sjednocené na vykání jako zbytek UI.
- Konflikty #10 a #11: dialog akce má ruční odeslání z #10, ostatní formuláře `submitKeepingValues` z #11.
- Ověřeno: lint, typy, 108 ze 108 testů (nový `tests/dokonceni.test.ts`), build. Prohlížeč (Chromium, PGlite):
  všechny stránky za organizátora, vedoucího a účastníka na 1280, 820 a 390 px bez vodorovného posunu, nové
  funkce proklikané (dialog, zrušení, stín, průvodce, zveřejnění a stažení zápisu, pohled účastníka).
- **Neověřeno:** skutečné Safari, živý test proti Googlu (stažení zápisu a storno jen v simulaci), úkol
  „Nahrajte audio z dnešní akce“ v prohlížeči.
- Další krok po sloučení #12: živý test (bod 6 níže). Větev pro něj potřebuje `APP_URL` a redirect URI.
- `next dev` vytváří v kořeni soubor `AGENTS.md`. Do repa nepatří, před commitem ho smaž.

## Stav 13. 11. 2026 odpoledne (původně draft PR #10)

Relace znovu došla k limitu kontextu. Z šestibodového zadání je hotové toto (lint, typy, 101 z 101 testů, build,
průchod v prohlížeči nad PGlite: organizátor a kolega mimo publikum na desktopu, vedoucí a účastník FP na 390 px):

- **Bod 1:** „Potvrdit dopad a zveřejnit“ (RM → FP i zpět) funguje na desktopu i mobilu. Chyba se nepotvrdila,
  tlačítko bylo zablokované jen po dobu ukládání. Teď během ukládání ukazuje „Ukládám…“.
- **Bod 2 celý:** „K doplnění“ v harmonogramu (`planGaps` ve `status.ts`), „Nahradit pravidelný termín“ v detailu
  budoucí akce ze šablony (`EventDialog` s `replace`), správa témat Upravit, Archivovat, Obnovit
  (migrace `0006_topic_archive`, aditivní sloupec `topics.archived_at`).
- **Bod 3 částečně:** navigace Přehled · Harmonogram · Zápisy · Témata, `/vzdelavani/moje-cesta` přesměruje na
  `/vzdelavani/prehled`. Přehled podle role (organizátor má nahoře termíny k doplnění a návrhy ke zveřejnění,
  kdo nemá úkol, vidí nejdřív nejbližší akci). Domov má „Otevřít akci“ nebo „Otevřít harmonogram“. Na mobilu
  zkrácené záhlaví („Ukázka“, bez podtitulu a bez pruhu režimů). Stavy „Zveřejněno · máš návrh změny“,
  „Kalendář čeká na opravu“, „Kalendář se synchronizuje“. Účastník u minulé akce vidí, jestli se zápis
  připravuje. Výměna nahrávky nechá publiku poslední zveřejněný zápis, dokud vedoucí neschválí nový.
- **Bod 4 částečně:** „Zahodit návrh změny“ jedním klikem (`discardDraftChanges`, Kalendář se nemění),
  vysvětlení FP, RM a Tým A u publika (`GROUP_HINTS`), úkol vedoucího „Nahraj audio z dnešní akce“.

**Zbývá:** body 3 a 4 jsou hotové (viz výše), zbývá živý test.

4. Bod 6, živý test: nic z něj neproběhlo. Větev `oprava/bezpecne-zverejneni-akci` ani `ccr-8554df8b-jabz1f` nemá vlastní `APP_URL` ani
   redirect URI v Googlu. Uživatel zvažuje test rovnou na Production (deploy a merge dělá sám). Připravit
   přesný postup. Nahlášená chyba přihlášení druhým Google účtem a `/sprava` z 13. 11. pořád neověřena,
   hypotézy: chybějící `APP_URL` a redirect URI větve, účet mimo `GOOGLE_LOGIN_ACCOUNTS`, `<form action>`
   v `AccessForms.tsx`, stav účtu v Neonu (`users`, `user_identities`).

Pozor: preview sdílí databázi Neon. Migrace 0006 je aditivní, starší kód s ní běží.

K rozhodnutí pro Annu: posun střídání typů po svátku nebo zrušení, hromadné zveřejnění měsíce, fiktivní vzory
zápisu pro školení, poradu a trénink. Nově: co přesně znamená skupina Tým A (text nápovědy u publika je odhad).

## Hotovo 13. 11. 2026 (původně PR #11)

- `main` obsahuje PR #1 až #9. Tato větev z něj vychází.
- **Oprava formulářů:** `src/features/shared/keep-values.ts` (`submitKeepingValues`). React po akci formulář
  resetoval, proto se po neúspěšném zveřejnění přepnul Typ a Publikum a jinde mizel rozepsaný text. Použito
  ve formuláři akce, zápisu, šablony týdne, zrušení akce, návrhu tématu a správy přístupů. Test
  `tests/form-submit.test.ts`, v prohlížeči ověřeno, že se chyba bez opravy projeví a s opravou ne.
- **Přehlednost:** týdny v Seznamu jsou bloky se střídavým pozadím, v Měsíci se střídají řádky, aktuální
  týden má okrový pruh a štítek „tento týden“, dnešní den je podbarvený. Tabulky mají střídavé řádky.
  Údaje o akci v detailu jsou jeden blok. Další termíny v Moje cesta jsou řádky místo podtržených odkazů.
- **Apple zařízení:** pole mají na dotyku 16 px (iOS jinak po klepnutí přiblíží), tlačítka 44 px, select a
  pole data a času mají vypnutý nativní vzhled Safari, odsazení pro výřez iPhonu (`viewport-fit=cover`,
  `env(safe-area-inset-*)`), zamčený posun pod dialogem, vypnuté automatické odkazy z čísel a dat.
  Mřížka měsíce se vejde na iPad na výšku. Na telefonu jsou v horním menu jen sekce, které někam vedou.
- **Duplicity:** jméno role v horní liště se už neopakuje vedle přepínače.
- Ověřeno lokálně v Chromiu na rozměrech iPhone SE, iPhone, iPad na výšku i na šířku, MacBook 13" a iMac:
  žádný vodorovný posun stránky. **Ve skutečném Safari (WebKit) neověřeno**, v prostředí není k dispozici.
  První věc ke kontrole na iPhonu a Macu: formulář Přidat akci (pole data a času) a nabídky.
- Otevřené k rozhodnutí: „Nejbližší akce“ je v Moje cesta i v Harmonogramu, na Tématech jsou doporučená
  témata nahoře a znovu ve výpisu všech. Obojí zatím ponecháno. Nabídky (Nástroje organizátora, Další
  možnosti) se nezavírají klepnutím mimo.

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

## Živý test (zatím neproběhl)

- Preview staré větve `ccr-2d4283fa-slno9d` má stejný kód jako `main`, na ni míří `APP_URL` i redirect
  URI v Googlu. Kroky v `docs/google-prihlaseni.md` (pro novou větev už upravené) a ověření
  automatické synchronizace po znovupřipojení Kalendáře (zrušit přístup v Google účtu, zveřejnit změnu,
  znovu připojit) čekají na uživatele.
- Pro preview jiné větve: uživatel přidá v Google konzoli redirect URI
  `https://zbc-vzdelavani-demo-git-<větev>-maci.vercel.app/api/google/prihlaseni/callback`
  (a `/api/google/kalendar/callback`), Claude nastaví branch-specific `APP_URL` přes Vercel API.
- Pozor: všechny preview sdílí jednu databázi Neon (jen větev `main`). Migrace 0004 je aditivní,
  starý kód s ní běží, ale po obnově dat uvidí i personu správce.

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

## Další kroky

1. Hotovo 12. 11.: přehled `docs/nahravky-moznosti.md` je v PR #8. Uživatel rozhodl dál ho teď neřešit
   (ověřování na živých stránkách, další kandidáti ani striktnost EU). Možná vznikne vlastní řešení nebo se
   použije firemní systém. Priorita je dodělat web.
1b. Hotovo 13. 11.: chyba formuláře akce po neúspěšném zveřejnění je opravená (viz výše).
   Screenshoty všech obrazovek dostal uživatel jako ZIP (složka `screenshots/`, v repu není, čeká na
   rozhodnutí). Nezachycené stavy: přístupová brána, přihlášení Googlem, čekající žádost, „Vyžaduje
   pozornost“ se Zkusit synchronizaci znovu, výpadek přepisu.
2. Společná session s uživatelem: živý test (přihlášení Googlem, čekající žádost na `/sprava`, znovupřipojení
   Kalendáře), potom `CALENDAR_ATTENDEES=audience` na preview a ověření hostů a odkazu na zápis v pozvánce.
   Branch-specific `APP_URL` pro větev PR #8 je nastavená (12. 11.), zbývá redirect URI v Googlu (uživatel).
3. Po živém testu: připomínky uživatele, testy, úpravy a změny včetně UI.
4. Až firma schválí a zaplatí: skutečné úložiště, dělení dlouhých záznamů a skutečný přepis.

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
