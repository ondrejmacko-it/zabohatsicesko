# Prompt pro další session

Jako první zprávu nové relace stačí napsat: **„Pokračuj podle `docs/dalsi-session.md`.“**
Úvodní prompt drž krátký, jinak sebere kontext. Jedna relace = jeden krok ze seznamu níže, po kroku commit,
push a přepsání tohoto souboru (jen aktuální stav, historie je v gitu).

## Stav 14. 11. 2026 (větev `claude/vzdelavani-b8-e-ybvvgg`, draft PR #21 do `main`)

Ověřeno: lint, typy, build, 165 ze 165 testů. Naživo proti Googlu neověřeno nic. Hotové jsou bloky A
a B3 až B8 a B10. Production na Vercelu nemá proměnné prostředí a buildy z `main` se přeskakují.

Pravidla: tykej, piš přátelsky. Na `main` nepushuj, merge dělá uživatel přes PR. Produkci sám nenasazuj,
jen ji připrav a nastav, co jde přes API. Osobní účet uživatele je z Wiki smazaný, nezakládej ho a nikam
ho nezvi. Ostré zveřejňování a skutečné pozvánky na preview smíš spouštět bez ptaní.

Zásada UI: hlavní údaje a akce vyniknou, vedlejší texty jsou menší a tlumené, nic mimo osu. Každou novinku
pochopí člověk, který Wiki vidí poprvé: jedna věta, žádné technické pojmy. Po každém kroku ověř v prohlížeči
na 1280 a 390 px (konzole bez chyb, žádný vodorovný posun).

## Kroky v pořadí (jeden na relaci)

1. **B9 Zájem o téma z pozvánky.** Do `desiredData` v `src/server/calendar/sync.ts` přidat u budoucí akce
   s `topicId` řádek s odkazem `<APP_URL>/vzdelavani/temata?tema=<id>`. Rozhodnuto: jen do nově zakládaných
   pozvánek a do těch, které se stejně mění (kvůli odkazu se nic znovu nerozesílá, porovnání popisu v
   `reconcile` tomu přizpůsobit). Stránka `temata` přesměruje na `/vzdelavani/zapisy?zajem=<id>#temata`,
   `TopicsSection` kartu zvýrazní, zájem je běžné tlačítko (POST po přihlášení, GET nic nezapisuje).
   Doplnit návrat po přihlášení: krátká cookie s interní cestou začínající `/vzdelavani`, čte ji `enterDemo`
   a callback Google přihlášení. Test pravidel a oprávnění.
2. **B11 a drobnosti.** `Consequences` do zrušení akce (`EventMenu`), stažení zápisu (`RecordingMenu`,
   rozšířit `confirm` v `ActionForm` o body) a odebrání přístupu (`AccountActions`). Zpráva po pozvání
   kolegy (`inviteMessage` v `AccessForms.tsx`): tykání zůstává, text doladit (kdo zve, k čemu Wiki je,
   odkaz, jedna věta jak se přihlásit). Detail akce během lhůty má psát „Pozvánka odejde za chvíli“.
3. **Úklid a optimalizace.** Mrtvý kód a nepoužívané exporty, alias `isOrganizer`/`isAdmin` nahradit
   `canPlan`, sloučit role `admin` a `organizer` v databázi (migrace, zeptej se před ní), zápisy filtrovat
   v databázi, krátká mezipaměť odpovědí z Kalendáře na Plánu, velikost balíčku a rychlost stránek změřit
   před a po.
4. **Bezpečnostní rozbor.** Oprávnění každé serverové akce a API, session a cookies, OAuth, CSP, tajemství
   v gitu a buildu, limity pokusů. Výstup: nálezy podle závažnosti a opravy s testy.
5. **Živý test (blok C)** na preview této větve. Nejdřív nastav přes API vlastní `APP_URL`
   (`https://zbc-vzdelavani-demo-git-<větev>-maci.vercel.app`) a `CALENDAR_ATTENDEES=audience` a zeptej se,
   zda uživatel přidal v Google konzoli `<adresa>/api/google/prihlaseni/callback`
   a `<adresa>/api/google/kalendar/callback`. Postup: přihlášení správce, řádek „Kalendář“ na Plánu, vazby
   a hosté budoucích akcí (Neon `calendar_links`), „Připravit další měsíc“, nový účet a žádost, schválení,
   pozvánky, odpovědi, zpět po zveřejnění, změna, zrušení, odkaz na zápis.
6. **Dokumentace (blok D):** `README.md`, `docs/predani.md`, `docs/google-prihlaseni.md`,
   `docs/google-kalendar.md` podle skutečného stavu (jedna role Správce, souhlas ke Kalendáři při přihlášení,
   `GOOGLE_OAUTH_PUBLISHED`, příjemci, řádek stavu, automatické vazby, fronta a cron, hromadné zveřejnění,
   průvodce měsícem, Správa v oknech, hromadné pozvání, odpovědi, zpět po zveřejnění, `PUBLISH_UNDO_SEC`).
7. **Production z `main`** (až uživatel sloučí PR). Přes API nastav nesecretní proměnné pro Production
   (`CALENDAR_MODE`, `LOGIN_MODE`, `CALENDAR_ATTENDEES=audience`, `APP_URL`, `GOOGLE_LOGIN_ACCOUNTS` podle
   preview). Uživatel doplní tajemství (`SESSION_SECRET`, `DEMO_ACCESS_CODE`, `TOKEN_ENCRYPTION_KEY`,
   `CRON_SECRET`, OAuth klient, `DATABASE_URL`), produkční přesměrovací adresy v Google konzoli a povolí
   buildy z `main` (ignored build step). Doporučení: samostatná větev databáze v Neonu pro produkci
   a zveřejnění OAuth aplikace (v režimu Testing souhlas vyprší po 7 dnech). Potom ověření v produkci.
8. **Snímky (blok E):** každé okno a stav za každou roli na 1280 a 390 px jako ZIP se seznamem, mimo repo.

## Otevřené otázky

- „Pozvánky ať se posílají hned“ (14. 11.): bráno jako ostré pozvánky kolegům v produkci hned
  (`CALENDAR_ATTENDEES=audience`). Pokud tím uživatel myslel zrušit desetisekundovou lhůtu po zveřejnění,
  stačí `PUBLISH_UNDO_SEC=0`. Ověř si to hned na začátku.
- Vlastní doména pro produkční `APP_URL`? Samostatná produkční databáze?
- Zavřít starý draft z `ccr-7b6bed1b-1ejvib` a PR #19, smazat větev `claude/vzdelavani-vercel-preview-52jflw`?
- Odloženo, rozhoduje firma: poskytovatel přepisu a úložiště (`docs/nahravky-moznosti.md`), pravidlo
  střídání typů ve slotu šablony, kam trvale uložit zadání (do tohoto repa ne).

## Co je dobré vědět

- **B8 Zpět po zveřejnění:** `unpublishEvents`, `listUndoable` (`services/events.ts`), `PublishUndoBar.tsx`
  v layoutu Wiki, sloupec `events.invite_hold_until` (migrace `0007`). Testy běží s `PUBLISH_UNDO_SEC=0`.
- **Vercel:** tým `maci`, projekt `zbc-vzdelavani-demo`, plán Hobby. Preview vzniká pushem větve.
  `POST /v13/deployments` nepoužívat (vytvoří produkční deploy). Cron běží jen v produkci, jednou denně.
  Preview chrání Vercel Authentication, runtime logy přes konektor vrací 403. Všechny preview sdílí jednu
  databázi Neon (projekt `neon-zbz-vzdelavani-demo`). Google přihlášení a Kalendář sdílí jednoho OAuth klienta.
- **Přístupový kód** do Wiki zná jen uživatel, nikam ho nezapisuj.
- **Lokální běh:** `SIM_LATENCY_MS=0 npx next dev -p 3100` nad PGlite. Playwright je
  v `/opt/node-tools/node_modules` (načíst přes `createRequire`), přihlášení na `/vstup`:
  `label.persona:has(input[value="demo-spravce"])` a odeslat. Po větší změně serverových modulů server
  restartuj. `AGENTS.md` v kořeni nemaž.
- **Odsouhlaseno dřív:** fiktivní role a simulace zůstávají jako přepínače. E-maily rozesílá jen Google.
  Jména zájemců o téma vidí jen správce. Nahrávky a přepis jsou zatím jen demo, nic placeného.
