# Prompt pro další session

Jako první zprávu nové relace stačí napsat: **„Pokračuj podle `docs/dalsi-session.md`.“**
Úvodní prompt drž krátký, jinak sebere kontext. Jedna relace = jeden krok ze seznamu níže, po kroku commit,
push a přepsání tohoto souboru (jen aktuální stav, historie je v gitu).

## Stav 14. 11. 2026 večer (větev `claude/bold-ptolemy-t0ygu1` = PR #21 + krok 0, draft PR #21 je z `claude/vzdelavani-b8-e-ybvvgg`)

Ověřeno: lint, typy, build, 176 ze 176 testů. V Chromiu nad PGlite na 1280 a 390 px (konzole bez chyb, bez
vodorovného posunu): okna „Nový odkaz k přihlášení“ a „Jednorázový kód“ v menu účtu, zpráva po pozvání kolegy,
hromadné pozvání s osobním odkazem u každého řádku, Správa s `GATE_MODE=invite` po přihlášení kódem.
Dřív: B9 a brána na pozvánku. Naživo proti Googlu neověřeno nic. Hotové jsou bloky A, B3 až B10, vstup
na pozvánku a krok 0 (kromě `GATE_MODE=invite` na preview, čeká na dohodu). Production na Vercelu nemá
proměnné prostředí a buildy z `main` se přeskakují.

Pravidla: tykej, piš přátelsky. Na `main` nepushuj, merge dělá uživatel přes PR. Produkci sám nenasazuj,
jen ji připrav a nastav, co jde přes API. Osobní účet uživatele je z Wiki smazaný, nezakládej ho a nikam
ho nezvi. Ostré zveřejňování a skutečné pozvánky na preview smíš spouštět bez ptaní.

Zásada UI: hlavní údaje a akce vyniknou, vedlejší texty jsou menší a tlumené, nic mimo osu. Každou novinku
pochopí člověk, který Wiki vidí poprvé: jedna věta, žádné technické pojmy. Po každém kroku ověř v prohlížeči
na 1280 a 390 px (konzole bez chyb, žádný vodorovný posun).

## Zadání uživatele ze 14. 11. večer (odsouhlasené, rozplánované do kroků níže)

Vstup jen osobním odkazem, jednorázové kódy od správce pro lidi bez Gmailu, produkce z `main` jen s přihlášením,
co nejlepší zabezpečení a optimalizace, vlastní bot pro přepis, plná automatizace, Apple zařízení podle norem,
kompletní příprava produkce a krátký seznam toho, co musí doplnit uživatel (jen nezbytné).

Rozhodnuto: odkaz platí do prvního přihlášení, zařízení si Wiki pamatuje 180 dní. Kód platí jednou, zařízení pak
zůstane přihlášené 30 dní. Fiktivní role jen na preview a lokálně. Přepis: vlastní bot, logiku zpracování záznamu
do zápisu programujeme my, model běží přes API uživatele (například OpenAI), klíč dodá uživatel.

## Kroky v pořadí (jeden na relaci)

0. **Hotovo** (doověření vstupu na pozvánku). Zbývá jen po dohodě nastavit na preview přes API `GATE_MODE=invite`
   (uživatel pak potřebuje první odkaz, viz „První správce“ níže).

1. **B11 a drobnosti.** `Consequences` do zrušení akce (`EventMenu`), stažení zápisu (`RecordingMenu`,
   rozšířit `confirm` v `ActionForm` o body) a odebrání přístupu (`AccountActions`). Zpráva po pozvání
   kolegy (`inviteMessage` v `AccessForms.tsx`): tykání zůstává, text doladit (kdo zve, k čemu Wiki je,
   odkaz, jedna věta jak se přihlásit). Při zapnuté lhůtě má detail akce psát „Pozvánka odejde za chvíli“.
   **Bot pro přepis** (vlastní krok po kroku 3): rozhraní poskytovatele v `src/server/recordings`, přepis přes
   API uživatele (`request_credential` pro hostitele API, klíč nikdy do repa ani do proměnné v chatu), vlastní
   logika: dělení dlouhého záznamu, přepis po částech, sestavení zápisu (shrnutí, klíčové body, rozhodnutí,
   další kroky) a kontrola vedoucím před zveřejněním. Zeptej se na poskytovatele a zpracování v EU.
   **Apple zařízení** (vlastní krok): WCAG 2.2 AA a zásady Applu (cíle dotyku 44 px, `env(safe-area-inset-*)`,
   pole 16 px proti přiblížení, `100dvh`, `dialog` v Safari). V prostředí je jen Chromium, skutečné Safari
   projde uživatel podle krátkého seznamu.
2. **Úklid a optimalizace.** Mrtvý kód a nepoužívané exporty, alias `isOrganizer`/`isAdmin` nahradit
   `canPlan`, sloučit role `admin` a `organizer` v databázi (migrace, zeptej se před ní), zápisy filtrovat
   v databázi, krátká mezipaměť odpovědí z Kalendáře na Plánu, velikost balíčku a rychlost stránek změřit
   před a po.
3. **Bezpečnostní rozbor.** Oprávnění každé serverové akce a API, session a cookies, OAuth, CSP, tajemství
   v gitu a buildu, limity pokusů. Výstup: nálezy podle závažnosti a opravy s testy.
4. **Živý test (blok C)** na preview této větve. Nejdřív nastav přes API vlastní `APP_URL`
   (`https://zbc-vzdelavani-demo-git-<větev>-maci.vercel.app`) a `CALENDAR_ATTENDEES=audience` a zeptej se,
   zda uživatel přidal v Google konzoli `<adresa>/api/google/prihlaseni/callback`
   a `<adresa>/api/google/kalendar/callback`. Postup: přihlášení správce, řádek „Kalendář“ na Plánu, vazby
   a hosté budoucích akcí (Neon `calendar_links`), „Připravit další měsíc“, nový účet a žádost, schválení,
   pozvánky, odpovědi, zpět po zveřejnění, změna, zrušení, odkaz na zápis.
5. **Dokumentace (blok D):** `README.md`, `docs/predani.md`, `docs/google-prihlaseni.md`,
   `docs/google-kalendar.md` podle skutečného stavu (jedna role Správce, souhlas ke Kalendáři při přihlášení,
   `GOOGLE_OAUTH_PUBLISHED`, příjemci, řádek stavu, automatické vazby, fronta a cron, hromadné zveřejnění,
   průvodce měsícem, Správa v oknech, hromadné pozvání, odpovědi, zpět po zveřejnění, `PUBLISH_UNDO_SEC`, zájem o téma z pozvánky).
6. **Production z `main`** (až uživatel sloučí PR). Přes API nastav nesecretní proměnné pro Production
   (`CALENDAR_MODE`, `LOGIN_MODE`, `CALENDAR_ATTENDEES=audience`, `APP_URL`, `GOOGLE_LOGIN_ACCOUNTS` podle
   preview). Uživatel doplní tajemství (`SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`,
   `CRON_SECRET`, OAuth klient, `DATABASE_URL`), produkční přesměrovací adresy v Google konzoli a povolí
   buildy z `main` (ignored build step). Doporučení: samostatná větev databáze v Neonu pro produkci
   a zveřejnění OAuth aplikace (v režimu Testing souhlas vyprší po 7 dnech). Potom ověření v produkci.
7. **Snímky (blok E):** každé okno a stav za každou roli na 1280 a 390 px jako ZIP se seznamem, mimo repo.

## Otevřené otázky

- Rozhodnuto 14. 11.: pozvánky odchází hned po zveřejnění. Lhůta „zpět po zveřejnění“ je vypnutá
  (výchozí `PUBLISH_UNDO_SEC=0`), kód zůstává a jde zapnout proměnnou. V dokumentaci ji popiš jako volitelnou.
- Rozhodnuto 14. 11.: produkce dostane samostatnou větev databáze v Neonu (založ ji přes konektor
  a řekni uživateli, kam vložit `DATABASE_URL`) a zatím výchozí produkční adresu Vercelu jako `APP_URL`
  (vlastní doménu jde přidat později). V kroku 6 napiš uživateli přesný seznam: co, kam a jak doplnit.
- Varování o hydrataci na `/vstup` v Playwrightu (styl `caret-color` u přepínačů) vzniká pořízením snímku
  před dokončením hydratace, v běžném prohlížeči se neukáže.
- Zavřít starý draft z `ccr-7b6bed1b-1ejvib` a PR #19, smazat větev `claude/vzdelavani-vercel-preview-52jflw`?
- Odloženo, rozhoduje firma: poskytovatel přepisu a úložiště (`docs/nahravky-moznosti.md`), pravidlo
  střídání typů ve slotu šablony, kam trvale uložit zadání (do tohoto repa ne).

## Co je dobré vědět

- **Vstup na pozvánku:** `gateMode()` v `config.ts` (`invite` vždy při `VERCEL_ENV=production`, jinak podle
  `GATE_MODE`, výchozí `open`). Tabulka `access_links` (migrace `0008`, jen otisky), služba
  `src/server/auth/access-links.ts`, odkaz `/pozvanka/<token>` dá prohlížeči cookie zařízení `zbc_zarizeni`
  a přesměruje na `/vstup`. Bez platné cookie `/vstup` ukáže jen „Přístup jen na pozvánku“ a začátek přihlášení
  Googlem vrací 404. Callback Googlu pustí jen účet, kterému odkaz patří. Kód: `enterWithCode`, session `code`
  na 30 dní, v layoutu upozornění na e-mail pro pozvánky. V režimu `invite` není potřeba `DEMO_ACCESS_CODE`
  a session fiktivní role neplatí. Správa: menu účtu „Nový odkaz k přihlášení“ a „Jednorázový kód“, pozvání
  kolegy i hromadné pozvání vrací osobní odkaz ve zprávě (u hromadného `CopyMessage compact` na řádek).
  Cizí účet Google v režimu `invite` žádost nezaloží (`completeLogin` s `allowRequests: false`, důvod
  `not_invited` → brána „jiny-ucet“) a Správa pak sekci Čekající žádosti skryje, když je prázdná.
  Testy `tests/vstup-na-pozvanku.test.ts`, `tests/users.test.ts`, `tests/hromadne-pozvani.test.ts`.
- **První správce v produkci** nemá jak dostat odkaz z Wiki. Postup: po nasazení vlož přes Neon konektor řádek
  do `access_links` (otisk SHA-256 náhodného tokenu, `kind='link'`, uživatel podle `GOOGLE_LOGIN_ACCOUNTS`)
  a odkaz `<APP_URL>/pozvanka/<token>` pošli uživateli v chatu. Je to zápis do databáze, potvrď ho s uživatelem.

- **B9 Zájem o téma z pozvánky:** `desiredData` (`sync.ts`) přidá budoucí nezrušené akci s `topicId` řádek
  s odkazem `/vzdelavani/temata?tema=<id>`. Jen do nových pozvánek a do těch, které se stejně mění
  (`withoutTopicLink` v `reconcile`). Odkaz obslouží `temata/route.ts`: přihlášeného pošle na
  `/vzdelavani/zapisy?zajem=<id>#temata`, nepřihlášenému uloží cíl do cookie `zbc_navrat` (15 minut, jen cesty
  `/vzdelavani…`, `src/server/auth/return-path.ts`) a po přihlášení ho tam vrátí `enterDemo` i callback Googlu.
  Když callback rovnou pokračuje na propojení Kalendáře (první přihlášení správce), návrat se nepoužije.
  `TopicsSection` dá téma první a zvýrazní ho, zájem zapíše až tlačítko. Test `tests/zajem-z-pozvanky.test.ts`.
  Naživo zbývá ověřit v kroku 4: jak Google řádek s odkazem v pozvánce zobrazí.

- **B8 Zpět po zveřejnění (ve výchozím stavu vypnuté):** `unpublishEvents`, `listUndoable` (`services/events.ts`), `PublishUndoBar.tsx`
  v layoutu Wiki, sloupec `events.invite_hold_until` (migrace `0007`). Test `tests/zpet-po-zverejneni.test.ts` si lhůtu zapíná sám.
- **Vercel:** tým `maci`, projekt `zbc-vzdelavani-demo`, plán Hobby. Preview vzniká pushem větve.
  `POST /v13/deployments` nepoužívat (vytvoří produkční deploy). Cron běží jen v produkci, jednou denně.
  Preview chrání Vercel Authentication, runtime logy přes konektor vrací 403. Všechny preview sdílí jednu
  databázi Neon (projekt `neon-zbz-vzdelavani-demo`). Google přihlášení a Kalendář sdílí jednoho OAuth klienta.
- **Přístupový kód** do Wiki zná jen uživatel, nikam ho nezapisuj.
- **Lokální běh:** `SIM_LATENCY_MS=0 npx next dev -p 3100` nad PGlite. Playwright je
  v `/opt/node-tools/node_modules` (načíst přes `createRequire`), přihlášení na `/vstup`:
  `label.persona:has(input[value="demo-spravce"])` a odeslat. Po větší změně serverových modulů server
  restartuj. `AGENTS.md` v kořeni nemaž. Položky v `Menu` klikej až po `scrollIntoViewIfNeeded()` spouště,
  posun stránky menu zavře (proto se dřív skript zasekl).
- **Odsouhlaseno dřív:** fiktivní role a simulace zůstávají jako přepínače. E-maily rozesílá jen Google.
  Jména zájemců o téma vidí jen správce. Nahrávky a přepis jsou zatím jen demo, nic placeného.
