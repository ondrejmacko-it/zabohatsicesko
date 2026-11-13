# Prompt pro další session

Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`).

---

Pokračuj na demu modulu Vzdělávání. Nečti znovu celé zadání ani celý kód. Kontext máš v `README.md`,
`docs/predani.md`, `docs/google-kalendar.md` a `docs/google-prihlaseni.md`, pravidla v `CLAUDE.md`.
Uživateli tykej, piš přátelsky. Větší změny nejdřív navrhni, nejasnosti se ptej.

## Stav 13. 11. 2026 odpoledne (větev `oprava/bezpecne-zverejneni-akci`, draft PR #10)

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

**Zbývá (v tomto pořadí):**

1. Bod 3: pruh režimů (ukázkový čas, Kalendář, přepis) je na mobilu jen schovaný, **na stránku Integrace se
   ještě nepřidal**. Pořadí polí v dialogu akce (dopředu typ, termín, téma, vedoucí, publikum, ostatní do
   „Další nastavení“; pozor na `required` pole ve sbaleném `<details>`). Výslovné stažení zveřejněného zápisu
   neexistuje, zatím platí jen „do schválení náhrady“.
2. Bod 4: stín původního termínu pro organizátora, přehled dopadu (kdo dostane storno) v dialogu zrušení,
   věta „co má člověk udělat“ u stavů, průvodce měsícem ve třech krocích, ruční odesílání formulářů na
   `/sprava` (`AccessForms.tsx`).
3. Bod 5: úplný průchod rolemi po dodělání bodů výše. Úkol „Nahraj audio z dnešní akce“ nejde v ukázkovém čase
   (12. 11. 9:00) vidět, dnešní akce ještě neskončila. Ověřen jen typy a kódem, ne v prohlížeči.
4. Bod 6, živý test: nic z něj neproběhlo. Větev `oprava/bezpecne-zverejneni-akci` nemá vlastní `APP_URL` ani
   redirect URI v Googlu. Uživatel zvažuje test rovnou na Production (deploy a merge dělá sám). Připravit
   přesný postup. Nahlášená chyba přihlášení druhým Google účtem a `/sprava` z 13. 11. pořád neověřena,
   hypotézy: chybějící `APP_URL` a redirect URI větve, účet mimo `GOOGLE_LOGIN_ACCOUNTS`, `<form action>`
   v `AccessForms.tsx`, stav účtu v Neonu (`users`, `user_identities`).

Pozor: preview sdílí databázi Neon. Migrace 0006 je aditivní, starší kód s ní běží.

K rozhodnutí pro Annu: posun střídání typů po svátku nebo zrušení, hromadné zveřejnění měsíce, fiktivní vzory
zápisu pro školení, poradu a trénink. Nově: co přesně znamená skupina Tým A (text nápovědy u publika je odhad).

## Stav kódu (starší)

- `main` obsahuje PR #1 až #6 (poslední je krok A, správa uživatelů a stránka `/sprava`).
- Větev `claude/jolly-goodall-c5hp6c` (z `main`), draft PR: **kroky B, C a D cílového průchodu**.
  - **B, hosté z publika:** `src/server/calendar/attendees.ts`. Wiki zve aktivní účty skupiny akce a spravuje
    jen hosty, které sama přidala (`calendar_links.managed_attendees`, migrace `0005_managed_attendees`).
    Pozvání, změna skupin a odebrání přístupu vrátí budoucí pozvánky do fronty (`syncPending`). V režimu
    Googlu je výchozí pevný seznam `GOOGLE_ALLOWED_ATTENDEES`, publikum zapíná `CALENDAR_ATTENDEES=audience`
    (na Vercelu zatím nenastaveno). Pozor: i spárovaná existující pozvánka teď dostane chybějící publikum.
  - **C, Zápisy:** `/vzdelavani/zapisy` (jen zveřejněné a oprávněné, hledání bez diakritiky, filtr typu a
    skupiny). Zveřejnění zápisu doplní odkaz do popisu pozvánky a Kalendář rozešle změnu.
  - **D, Moje cesta:** výchozí stránka modulu (`/vzdelavani` na ni přesměruje): Čeká na vás, Nejbližší akce,
    Poslední zápisy, prázdné stavy. Menu Moje cesta · Harmonogram · Zápisy · Témata (+ Integrace organizátorovi).
  - **Přehlednost:** detail akce má nahoře výrazné Kdy · Vede · Pro koho, odkaz zpět vede tam, odkud
    uživatel přišel (`?odkud=zapisy|moje-cesta`), podrobnosti pozvánky jsou u synchronizované akce sbalené,
    na `/sprava` je štítek „Pozvaný“.
- Větev `claude/blissful-mendel-quw7mn` navazuje na `claude/jolly-goodall-c5hp6c` (obsahuje její commity
  B, C, D) a přidává **dokončení přehlednosti**: v Harmonogramu je vedle přepínače Měsíc/Seznam
  viditelné hlavní tlačítko Přidat akci a nabídka „Nástroje organizátora“ (Doplnit měsíc ze šablony, Šablona
  týdne), výsledek doplnění se vypíše v nabídce. Na Integracích drobné rozestupy a užší tlačítko obnovy dat.
- Ověřeno lokálně 12. 11.: lint, typová kontrola, 90 z 90 testů, build, průchod v prohlížeči (PGlite) pro
  `/sprava`, Moje cesta, Zápisy, detail akce, Harmonogram s nabídkou, Témata a Integrace, vše i na šířce
  390 px bez vodorovného posunu. Účastník nabídku organizátora nevidí. **Živě proti Googlu neověřeno nic
  z B a C.**
- Draft PR #8 z `claude/blissful-mendel-quw7mn` nahrazuje starší draft #7 (`claude/jolly-goodall-c5hp6c`),
  ten uživatel zavře. Na #8 pokračuj, dokud ho uživatel nesloučí.
- `next dev` vytváří v kořeni soubor `AGENTS.md`. Do repa nepatří, před commitem ho smaž.

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
1b. **Chyba k opravě (nalezena 12. 11. při focení):** formulář akce (`ActionForm`) po neúspěšném zveřejnění
   (chybí téma nebo vedoucí) přepne Typ na Action time a Publikum na Všichni. Opravit a přidat test.
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
