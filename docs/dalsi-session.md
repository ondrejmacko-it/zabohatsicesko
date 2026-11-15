# Prompt pro další session

Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`)
a přilož audit ZIP `ZBC_Audit_balicek_2026-11-15.zip` (do repa nepatří).

---

Pokračuj na modulu Vzdělávání (repo `ondrejmacko-it/zabohatsicesko`). Nečti znovu celé zadání ani celý kód.
Kontext máš v `docs/dalsi-session.md` a `README.md`, pravidla v `CLAUDE.md`, audit v přiloženém ZIPu. Tykej mi,
kroky pro mě piš úplně, pod sebe, s přesnými kliky (Windows, PowerShell).

**Trvalá fakta (neptat se na ně znovu):**
* Vlastní doménu **nemáme a neřešíme** (firma Wiki zatím nemá a nemusí ji používat). Žádné kroky s doménou, logem,
  Search Console ani ověřením aplikace.
* OAuth aplikace (projekt `zbc-vzdelavani-test`) je **In production**, External, 3/100 uživatelů. Production má
  `GOOGLE_OAUTH_PUBLISHED=1` (nastaveno 15. 11., platí od dalšího nasazení Production).
* Úkoly z auditu jsou v `docs/audit-ukoly.md`. Audit ZIP stačí přiložit, jen když je potřeba `textove-upravy.csv`.

**Stav:** PR 4b část 2 je draft [#33](https://github.com/ondrejmacko-it/zabohatsicesko/pull/33) z větve
`claude/vibrant-ritchie-d100a3` (úvod s kartami, záložky Plán | Zápisy | Témata, Plán bez řádku Kalendáře,
Správa na 320/360 px). Uživatel ho mergne sám.

**Stav 15. 11. večer:** PR 5 je draft [#34](https://github.com/ondrejmacko-it/zabohatsicesko/pull/34) z větve `claude/audit-texty-a03` (stojí na #33): A03, T01–T04, přepisy textů
z auditu, okna „Akce/Zápis není dostupný“. Lint, typy, 173/173 testů a build prošly. **Průchod v Chromiu neproběhl:**
`next start` na http blokuje skripty přes CSP (přihlášení do ukázky neprojde); ověřit přes `npx next dev -p 3100`
(nebo zjistit, proč CSP lokálně blokuje i vlastní skripty, to by byla chyba k opravě v PR 8).

**Priorita uživatele (15. 11.):** hlavně testy pro desktopy a macOS. Automatizovaná sada v Playwrightu (desktop
1280, 1440×900, 1512×982 a 1920×1080, Retina `deviceScaleFactor: 2`, macOS user agent, klávesnice, axe), WebKit jen
pokud je v prostředí k dispozici. Skutečné Safari na Macu ověří uživatel podle kroků.

**Další krok:** ověřit PR 5 v Chromiu (role správce, vedoucí, účastník FP i RM; 1280/390/360/320; bez posunu a chyb),
pak PR 6 (U02–U08), PR 7 (Připravit měsíc, G6), PR 8 (bezpečnost a rychlost) podle `docs/audit-ukoly.md`. Každý
draft stavět na předchozím. Pak kompletní kontrola celého výtvoru. Neptat se, rozhodnout nejméně invazivně.

Nouzové zrušení zařízení hlavního správce (UI ho záměrně nenabízí) jde bez změny kódu a deploye přes Neon SQL:
`UPDATE trusted_devices SET revoked_at = now() WHERE id = '<id>'` (ID z dotazu na `trusted_devices` podle e-mailu).
Platí od dalšího požadavku. Můžeš ho provést i ty přes Neon MCP, ale jen na výslovný pokyn uživatele.

**Stav 15. 11. noc 2:** draft [#35](https://github.com/ondrejmacko-it/zabohatsicesko/pull/35) (`claude/testy-desktop-macos`, na #34): `npm run e2e`
(Playwright 1.63.0 nad produkčním buildem, ukázka + ostrá Wiki s falešnými Google hodnotami, 750/750 na Windows 1280/1920,
macOS 1440/1512 Retina s UA Safari/Chrome, telefony 390/360/320; WebKit v prostředí není, `E2E_WEBKIT=1` na Macu).
Opraveno: CSP bez nonce na `/soukromi` a 404 (byla to skutečná chyba, ne http), menu na telefonu, fokus z okna z menu,
Integrace 320 px. Ruční postup pro Mac: `docs/overeni-mac.md`. Draft PR 6 [#36](https://github.com/ondrejmacko-it/zabohatsicesko/pull/36) z `claude/audit-pristupnost-u02-u08` (na #35):
zatím jen U02. Base #34 ukazuje na sloučenou #33, po merge přepnout base na `main`.

**Další krok:** dokončit PR 6 (U03, U04, U05, zbytek U07, U08), pak PR 7 (G6) a PR 8 podle `docs/audit-ukoly.md`.
Před každým PR `npm run e2e` (cca 5 min, `E2E_SKIP_BUILD=1` bez buildu).

---

## Stav 15. 11. 2026 odpoledne 2 (větev `claude/vibrant-ritchie-d100a3`, draft PR 4b část 2)
* **Neon `zbc-wiki-produkce` po merge #32:** 7 vazeb `synced`, `calendar_id = primary`, `connected_at` 13:54 UTC
  (merge 13:50 UTC). Bez zásahu.
* **Úvod:** karty modulů (Vzdělávání, Správa systému jen pro `canManageUsers`) a Nejbližší akce (3, `NextEventsList`).
  Nejbližší akce z Plánu pryč, `nextEventsFor` bez filtru Plánu, `matchesPlanFilter` smazán.
* **Záložky:** Plán | Zápisy | Témata. `/vzdelavani/temata` je samostatná stránka (`TopicsSection`), stará kotva
  `/vzdelavani/zapisy#temata` přesměruje v prohlížeči (`TopicsAnchorRedirect`).
* **Plán:** místo `CalendarStatusLine` jen `CalendarAlert` (nepropojeno/vypršelo/nedostupné/vyprší do 2 dnů).
  Podrobný stav zůstal ve Správě.
* **Správa 320/360 px:** přetékala tabulka příjemců (dlouhé e-maily). Teď `overflow-wrap: anywhere` a pod 480 px
  řádky pod sebou. Ověřeno v Chromiu za správce ukázky (rozbalené sekce, okno Pozvat, simulované dlouhé adresy
  a štítky ostré Wiki). Ostrá Správa s Googlem lokálně přihlásit nejde.
* Ověřeno: lint, typy, 169/169 testů, build, Chromium (správce i účastník, 1280/390/360/320, přesměrování).

## Stav 15. 11. 2026 pozdě večer (větev `claude/brave-clarke-uyu0gb`, draft PR 4b část 1)
* **Diagnóza Kalendáře:** propojení se 15. 11. ve 14:01 uložilo (přepis fungoval, stránka ukazovala jen datum).
  Všech 7 vazeb mělo `calendar_unavailable`: Google na zápis do vedlejšího kalendáře (`…@group.calendar.google.com`)
  vracel 404 (účet k němu neměl přístup), adaptér to hlásil jako výpadek a nelogoval. `resumeAfterReconnect`
  vracel do fronty jen `calendar_revoked`. Přihlašovací callback navíc zneplatňoval nový token u Googlu,
  když propojení už existovalo, což u téhož účtu může shodit i uložené propojení. Logy Vercelu přes API nešly (403).
* **Oprava:** `checkConnection` (vynucená obnova tokenu, odvolaný/nečitelný = smazat), `needsCalendarConnection`
  žádá o souhlas vždy bez platného propojení. Souhlas při přihlášení vždy přepíše starý. 404 = `calendar_no_access`,
  `probeTargetCalendar` po připojení (`?google=bez-pristupu`). `syncAfterReconnect`: převede vazby bez pozvánky na
  nastavený kalendář, obnoví chyby přístupu a odešle celou frontu (`syncPublished`).
* **Vercel (API):** Production `GOOGLE_CALENDAR_ID` a `GOOGLE_ALLOWED_CALENDAR_IDS` = `primary` (rozhodnutí uživatele).
* **Zařízení:** `DEVICE_NEVER_EXPIRES`, migrace `0008_devices_never_expire`, přihlášení obnoví cookie zařízení.
* **Hlavní správce:** `primaryAdminEmail()` = první adresa `BOOTSTRAP_ADMIN_EMAILS`. Session 400 dní, účet, odkazy
  a zařízení nikdo nemění (server `forbidden`, UI bez menu, štítek „hlavní správce“).
* **Správa:** „Zrušit toto zařízení…“ s větou o dopadu, data `22. 11.`, okna s hotovým odkazem se na změny neptají.
* **Integrace v ostré Wiki:** bez tabulky režimů a technických textů, „Připojit znovu“, propojení s časem.
* Ověřeno: lint, typy, 169/169 testů, build, Chromium (vstup 320/360 px). Správa přihlášená v prohlížeči ne, naživo proti Googlu ne.

## Stav 15. 11. 2026 noc (větev `claude/pozvanky-na-zarizeni`, draft PR 4a do `main`)
* **Pozvánka na jedno zařízení** (`src/server/auth/devices.ts`, migrace `0007_login_invites`): odkaz `/vstup#<43 znaků>`
  (256 bitů, v DB HMAC otisk), 7 dní, jednorázový (podmíněný UPDATE), po použití cookie `__Host-zbc_device`
  (`<id>.<tajemství>`, v DB otisk), zařízení platí 30 dní od posledního použití (zápis nejvýš 1× za hodinu).
  Session nese `d` (ID zařízení), `resolveSessionUser` ho v ostré Wiki vyžaduje: starší session bez zařízení neplatí.
  `InviteClaim` čte fragment, maže ho z adresy a posílá POSTem na `/api/pozvanka` (Origin, JSON, limit 10/15 min).
  OAuth start bez zařízení přesměruje na `/vstup`, callback zařízení ověří znovu. `completeLogin` v ostré Wiki
  přes `scopedAccount`: e-mail Googlu musí přesně odpovídat pozvánce, žádné žádosti cizích lidí.
  Pojistka: `/vstup?spravce=1` jen pro `BOOTSTRAP_ADMIN_EMAILS`, po přihlášení zaregistruje zařízení.
* **Správa:** tlačítko „Pozvat člověka“ (okno, výsledek odkaz + Kopírovat), seznam Lidé se stavem zařízení a odkazu,
  menu Nový odkaz / Zneplatnit odkaz / Odhlásit zařízení. Odebrání přístupu zneplatní zařízení i odkaz. Pryč box
  „Jak to funguje“, text o e-mailu, v ostré Wiki „Technické nastavení ukázky“ (místo něj odkaz na nové připojení
  Kalendáře). Čekající žádosti jen když nějaké jsou. Tabulka příjemců v rozbalení. Výběr role Správce ukáže dopad.
* Ověřeno: lint, typy, 164/164 testů (nové `tests/pozvanky.test.ts`), build, Chromium nad `next start` v režimu
  production s falešnými Google hodnotami (neutrální vstup bez tlačítka, neplatný odkaz smazán z adresy a ohlášen,
  přímé OAuth 303 na `/vstup`, cizí Origin 403, `?spravce=1` s tlačítkem, 320 px bez posunu). Naživo proti Googlu ne.
* Po merge: dnešní session správce přestane platit. Přihlášení: `https://zbc-vzdelavani-demo.vercel.app/vstup?spravce=1`.

## Stav 15. 11. 2026 odpoledne (po PR 3, větev `claude/zen-feynman-jcmjd3`, jen tento soubor)
* **Production nasazená** uživatelem (Create Deployment z `main` po #29). Ignored build step je prázdný
  (Automatic), takže každý merge do `main` teď nasadí produkci. Zrušená nasazení Vercel v seznamu skrývá.
  Přihlášení Googlem, bootstrap správce, propojení Kalendáře a Správa ověřené uživatelem naživo (screenshoty).
* Env Production kompletní (ověřeno API, hodnoty nečteny). Změnu projektu Vercelu přes API (ignored build
  step) zablokoval klasifikátor, nastavení dělá uživatel v UI: Settings → Build and Deployment.
* Výhrady uživatele k ostrému UI a požadavek na přihlášení jen přes pozvánku jsou v promptu výše.

## Stav 15. 11. 2026 noc (větev `claude/bezpecne-pozvanky-a-dopad`, draft PR 3 do `main`)
* **Vercel (API):** Production `WIKI_MODE=production`, `LOGIN_MODE`/`CALENDAR_MODE=google-test`,
  `CALENDAR_ATTENDEES=audience`, `APP_URL=https://zbc-vzdelavani-demo.vercel.app`. Preview `WIKI_MODE=demo`,
  `CALENDAR_MODE=simulation`, odebrané `LOGIN_MODE`, všechny `CALENDAR_ATTENDEES`, 9 `APP_URL` a 2 `GATE_MODE`
  na větvích. Obecná `APP_URL` Preview zůstala.
* **Neon:** založení `zbc-wiki-produkce` přes API odmítnuto (organizace spravovaná Vercelem). Udělá uživatel
  ve Vercelu Storage, postup v `docs/nasazeni.md`.
* **A01** `looksLikeSameInvite` (sync.ts): cizí pozvánka ten den do 3 h nebo se stejným názvem zastaví automatiku,
  vlastní pozvánky Wiki (`createdByWiki`) ne. **A05** `mergeDescription`: Wiki mění jen své řádky s adresou akce
  (i HTML s `<br>`). **A02** token dopadu obsahuje otisk adres publika, `ImpactNotConfirmed.stale`. Fronta dál
  podle publika (rozhodnuto). **A04** `publishDrafts(..., confirmedIncomplete)` a zaškrtávátko s počtem v dialogu.
  **A06** `CancelImpact.verified/hasInvite`, dialog „Zkusit znovu“ a vědomé zrušení, server ověří znovu.
  **A08** `SyncPanel.unlinkedReason`, jednotný text v Plánu, vstup ukázky podle `attendeeSource`.
* Ověřeno: lint, typy, 153/153 testů, build. V prohlížeči neprocházeno (dialogy zrušení a hromadného zveřejnění).
  Naživo proti Googlu ne.

## Stav 15. 11. 2026 večer (větev `claude/produkce-a-zvaci-odkaz`, draft PR #28 do `main`)
* **Ostrá Wiki:** prázdná DB dostane jen 4 sloty pravidelného týdne (`seedProductionBase`, `prepareDatabase`
  plní jen DB bez uživatelů i šablony), `seedDatabase` v production vyhodí chybu. `BOOTSTRAP_ADMIN_EMAILS`
  v `completeLogin` (`createBootstrapAdmin`, audit `user.bootstrap_admin`), `GOOGLE_LOGIN_ACCOUNTS` ignorován,
  `DEMO_ACCESS_CODE` nepotřeba, `GOOGLE_ALLOWED_ATTENDEES` povinná jen při `allowlist`.
* **UI production:** `/vstup` jen Google (`LiveGate`), Sidebar bez neaktivních položek a hledání (`live`),
  domov bez hledání, popis stránky podle režimu (`generateMetadata`).
* **Zvací odkaz:** `/vstup?pozvanka=` → `src/app/vstup/pozvanka/route.ts` → cookie `zbc_gate` (src/server/auth/gate.ts,
  7 dní, otisk kódu, sdílený limit `gate:<ip>`). Ukázka Google nenabízí (trasy dál existují, vypne je odebrání
  `LOGIN_MODE` na Preview).
* Ověřeno: lint, typy, 147/147 testů, build, Chromium nad `next start` (ukázka i production s falešnými
  hodnotami Google). Naživo proti Googlu ne.
* Otevřené: Vercel Authentication a ignored build step pro Production, Hobby plán, OAuth Testing (vyprší ~19. 11.).

## Stav 15. 11. 2026 (větev `claude/relaxed-edison-tb8rqz`, draft PR 1 do `main`)
* **Odhlášení (S02):** `endSession` maže cookie se stejnými atributy jako uložení (`Secure`, `maxAge: 0`).
  Ověřeno v produkčním buildu v Chromiu: cookie zmizí, Plán přesměruje na `/vstup`, audio vrátí 401.
* **`WIKI_MODE=production` (S01):** odmítá demo session (`resolveSessionUser`), výběr i přepnutí role, obnovu dat
  (`resetDemoAction` i `resetDatabase`, tedy i `npm run db:reset`), přepínače simulace; skutečný čas; skryté
  ukázkové prvky na vstupu, v liště a na Integraci. `src/instrumentation.ts` nespustí ostrou Wiki bez Google
  přihlášení a Kalendáře (`liveWikiConfigProblems`). Testy `tests/produkce.test.ts`. 141 ze 141 testů, lint,
  typy, build. Production na Vercelu zatím nemá env ani DB, nic se nenasazovalo.
* Vercel: projekt přes Vercel MCP konektor není vidět (jiný token), přes `api.vercel.com` s proxy ano
  (tým `team_PtkXmFd9hI7UeUYovGkbwZQG`). Vercel Authentication chrání všechna nasazení včetně production.
* Rizika k řešení s uživatelem: Hobby plán je nekomerční, OAuth v režimu Testing (7 dní, 100 uživatelů),
  nahrávky v production přepis neumí (návrh: ruční zápis bez audia), úklid skutečných účtů z DB preview.

## Stav 15. 11. 2026 (větev `claude/pensive-ramanujan-lk23o9`, kód beze změn proti `main`)
* Snímky předány znovu: 368 snímků (4 role a vstupní brána, 1280 a 390 px, 2×) ve 4 ZIPech do 30 MB, v 1. části `SEZNAM.md` a zdrojový kód. Vznikly automatickým průchodem lokálního buildu (`next start` nad PGlite, každé tlačítko, menu a okno z menu, nic se neodesílá) a scénářem zápisu (správce nahrál nahrávku k ev-11-10, zveřejnil, ostatní role čtou). Vodorovný posun nikde, chyby v konzoli žádné. Skripty jsou mimo repo.
* Poznámka pro lokální snímkování: brána má limit 10 pokusů za 15 minut na IP (v DB). Na lokálním serveru stačí každému kontextu prohlížeče dát jiné `x-forwarded-for`.
* Další krok beze změny: živý test s uživatelem (bod 3), propojení Testing vyprší kolem 19. 11.

## Stav 14. 11. 2026 večer (větev `claude/youthful-brown-attvm9`, draft PR do `main`)
Vychází z `claude/sharp-babbage-5nqoac` (ta zůstala bez PR, její práce je v této větvi). Ověřeno: lint, typy, testy, build (viz PR). Naživo proti Googlu neověřeno.

* Menu místo řad tlačítek: sekce Nahrávka a zápis má menu ⋯ (testovací nahrávka, „Stáhnout zveřejněný zápis…“), Integrace při připojení „Možnosti připojení“ (Připojit znovu, Odpojit), panel Kalendáře v detailu menu ⋯ (nová pozvánka místo spárování, nástroje simulace, technické nastavení). U proběhlé akce, kterou správce vede, je „Upravit“ vedlejší.
* Opravy osy: blok údajů akce na 390 px už není odsazený (`.section.facts-section`), ve Správě drží vlastní účet odznak stavu ve stejné ose (prázdné místo místo menu, „· váš účet“ u jména).
* Ověřeno v Chromiu nad PGlite (Playwright): správce u cizí akce nahrál záznam, AutoRefresh přepnul na návrh zápisu bez obnovení (asi 7 s), uložení, zveřejnění, úprava, stažení zápisu; účastník FP zápis čte bez nahrávky, RM ho nevidí; „Přidat zápis“ na 1280 px bez posunu; Plán za účastníka na 390 px bez posunu; schválení a zamítnutí čekající žádosti (žádosti vložené skriptem do lokální DB). Snímky všech rolí, oken a menu na 1280 a 390 px předány jako ZIP (mimo repo), bez vodorovného posunu.
* Hydratační varování na Plánu (13. 11.) se lokálně nepodařilo vyvolat ani s pásmem prohlížeče Europe/Prague a America/New_York (server UTC). Pokud se znovu objeví na preview, poslat přesný text z konzole.
* Preview této větve: `https://zbc-vzdelavani-demo-git-claude-youthful-brown-attvm9-maci.vercel.app`, `APP_URL` nastavená přes API. Uživatel přidá do Google konzole `<adresa>/api/google/prihlaseni/callback` a `<adresa>/api/google/kalendar/callback`.
* Sloučeno s `main` po PR #19 (jiná relace): na `/vstup` je jen jedna persona správce, `demo-organizator` zůstává v seedu jako „Druhý správce ukázky“ (vazba na testovací účet Google). Odsouhlaseno 14. 11.: ostré zveřejňování a skutečné pozvánky na preview smí Claude spouštět bez dalšího ptaní.
* Další krok: živý test s uživatelem krok za krokem (bod 3 promptu z 14. 11.), až řekne. Hromadné zveřejnění před prvním ostrým použitím potvrdit. Propojení Testing vyprší kolem 19. 11.

Stav 14. 11. 2026 (větev `claude/sharp-babbage-5nqoac`, bez PR)

Ověřeno: lint, typy, 135 ze 135 testů, build. V Chromiu nad PGlite dialog „Přidat akci“ a Správa za správce
na 1280 a 390 px (bez vodorovného posunu, bez chyb v konzoli). **Naživo proti Googlu neověřeno.**

- **Vercel:** `CALENDAR_ATTENDEES=audience` je nově nastavená pro všechna preview (bez omezení na větev),
  podle rozhodnutí uživatele. Starší proměnné omezené na větve zůstaly, mají stejnou hodnotu.
- **Dialog akce:** pod výběrem publika blok „Pozvánku dostane N lidí“ se jmény (nad 8 jmen rozbalovací „a další“).
  Data z `loadInviteRecipients` (`services/calendar-status.ts`, bez dotazu na Google, `loadCalendarStatus` ji
  používá). V testovacím režimu (`allowlist`) řekne, kolik lidí ze skupiny zatím pozvánku nedostane.
  Doporučená témata mají počet zájemců jako okrový odznak. Test v `tests/kalendar-prihlaseni.test.ts`.
- **Role v textech:** „organizátor“ v UI i komentářích nahrazen „správcem“. Zůstává jen tam, kde jde o Googlem
  definovaného organizátora události (`google.ts`, `simulated.ts`, `docs/google-kalendar.md`). Persona
  `demo-organizator` se jmenuje „Správce vzdělávání“ (role v DB dál `organizer`, id beze změny). Na sdílené
  databázi preview se nové jméno projeví až po „Obnovit ukázková data“.
- **Správa:** žádost má hlavní tlačítko „Schválit…“ (okno s rolí a skupinami) a v menu „Zamítnout žádost…“.
  Uživatel má menu ⋯ s „Upravit roli a skupiny“ (okno) a „Odebrat přístup…“ (potvrzení, role a skupiny
  zůstanou), odebraný „Vrátit přístup…“. Úprava, odebrání a vrácení ověřené v prohlížeči, schválení ne.
- **Dokumentace:** `README.md`, `docs/predani.md`, `docs/google-prihlaseni.md`, `docs/google-kalendar.md`
  odpovídají stavu (jedna role Správce, souhlas ke Kalendáři při přihlášení, `GOOGLE_OAUTH_PUBLISHED`,
  příjemci, řádek stavu, automatické vazby a fronta, hromadné zveřejnění).

## Stav 13. 11. 2026 pozdě v noci (větev `claude/tender-fermat-oepq6p`)

Ověřeno: lint, typy, 134 ze 134 testů, build. V Chromiu nad PGlite okno „Zveřejnit návrhy“ za správce na 1280
a 390 px (bez vodorovného posunu). **Naživo proti Googlu neověřeno.**

- **Proč 4 zveřejněné akce neměly pozvánku:** seed zakládá akce se záměrem `pair`, `publishInTx` vytvoří vazbu
  jen pro `create` a fronta `syncPending` čte jen existující vazby. V režimu Googlu seed žádné vazby nezakládá.
- **Automatické vazby** (`sync.ts`: `linkPublishedWithoutInvite`, `syncPublished`): každá zveřejněná budoucí
  nezrušená akce bez vazby ji dostane a fronta založí pozvánku. Pozvánku, kterou Wiki založila dřív (před obnovou
  dat), pozná podle klíče a nezdvojí. Výjimka: když ve stejném čase leží v Kalendáři cizí nespárovaná pozvánka,
  akce zůstane „bez vazby“ a správce ji spáruje nebo založí novou. Bez propojeného Kalendáře se nezakládá nic.
  Spouští se po otevření Plánu správcem, po zveřejnění, po hromadném zveřejnění a po obnově ukázkových dat.
  Platí i v simulaci (ukázkové akce bez pozvánky ji dostanou po otevření Plánu).
- **Hromadné zveřejnění** (`PublishMonthDialog`, `listMonthDrafts`, `publishDrafts`, `publishMonthAction`):
  tlačítko „Zveřejnit návrhy (počet)“ vedle „Přidat akci“. Nahoře přehled dopadu (počet akcí, kolik lidí dostane
  e-mail a z jakých skupin, podle režimu Kalendáře). Základ ze šablony je předvybraný, návrhy přidané navíc
  ne. Téma a vedoucího jde doplnit přímo v řádku. Návrhy změn zveřejněných akcí v okně nejsou (jen počet),
  server je odmítne stejně jako cizí měsíc, proběhlé termíny a zastaralou verzi návrhu.
  Testy: `tests/hromadne-zverejneni.test.ts`, dva nové v `tests/google-calendar.test.ts`.
- **Neuděláno z promptu:** živý test, hosté a témata v dialogu akce, texty „organizátor“, Správa v okně a menu,
  doověření oken, dokumentace, snímky.

## Stav 13. 11. 2026 noc (větev `claude/blissful-mendel-ejkw5s`, draft PR do `main`)

Vychází z `claude/amazing-edison-51eo2g`. Ověřeno: lint, typy, 128 ze 128 testů, build. V Chromiu nad PGlite jen
Plán a Správa za správce na 1280 a 390 px (řádek Kalendáře, tabulka příjemců, výběr role, bez vodorovného
posunu). **Naživo proti Googlu neověřeno nic z níže uvedeného.**

- **Souhlas ke Kalendáři při přihlášení** (`google-login.ts`, `api/google/prihlaseni/*`): po každém přihlášení
  Googlem si prohlížeč uloží podepsanou cookie `zbc_google_hint` s ID uživatele. Při dalším přihlášení server
  podle ní pozná aktivního správce, a pokud Wiki nemá propojení, požádá Google na jedné obrazovce o identitu
  i `calendar.events` (`prompt=consent`, `access_type=offline`, `login_hint`). Callback propojení uloží
  (`saveGrant`), jinak token hned zneplatní (`revokeToken`). První přihlášení z nového prohlížeče jde starou
  cestou: druhé automatické přesměrování na `/api/google/kalendar/pripojit?auto=1`. Odmítnutý souhlas:
  brána nabídne „Přihlásit se bez Kalendáře“ (`?kalendar=ne`), `?jiny=1` vynutí výběr účtu.
- **Příjemci pozvánek** (`attendees.ts`, `listRecipients`): v režimu Googlu aktivní účty skupiny akce. Nově
  i fiktivní role svázaná s účtem Google ze seznamu `GOOGLE_LOGIN_ACCOUNTS` (dostane pozvánku na adresu Google).
  Přepínač `CALENDAR_ATTENDEES=audience` je od 13. 11. v noci zapnutý jen pro preview této větve. Budoucí
  vazby jsou vrácené do fronty, odešlou se, když správce otevře Plán (`after(syncPending)` na stránce Plán).
  Osobní účet uživatele je na jeho žádost z databáze smazaný (i vazba na Google), nezakládat ho znovu.
- **Stav Kalendáře** (`services/calendar-status.ts`, `CalendarStatusLine.tsx`): řádek na Plánu (jen správce mimo
  náhled) a ve Správě v sekci „Kalendář a pozvánky“ s tabulkou, kdo dostane pozvánku podle skupiny. Propojení
  se při načtení ověří u Googlu (vypršelý souhlas se pozná hned). V režimu Testing ukazuje datum vypršení
  (7 dní od souhlasu), dva dny předem nabídne „Obnovit propojení“. `GOOGLE_OAUTH_PUBLISHED=1` upozornění vypne.
- **Jedna role Správce** (`policy.ts`: `canPlan`, `isOrganizer` a `isAdmin` jsou totéž): v databázi zůstávají
  `admin` i `organizer`, Správa nabízí jen Správce a Člena týmu. Správce smí u každé akce nahrát záznam,
  číst pracovní zápis, zveřejnit ho i stáhnout (`canHandleRecording`, `canReadPublishedMinutes`). Mezi úkoly
  „Čeká na vás“ má dál jen akce, které sám vede nebo kontroluje. Testy: `tests/kalendar-prihlaseni.test.ts`,
  upravené `access`, `users`, `zapisy-temata`.
- **Nedoděláno z promptu:** hosté a doporučená témata v dialogu akce, zbylé texty „organizátor“ v UI, celá
  část C, dokumentace `README.md`, `docs/predani.md`, `docs/google-*.md`, snímky. Živý test neproběhl.

**Preview této větve:** `https://zbc-vzdelavani-demo-git-claude-blissful-mendel-ejkw5s-maci.vercel.app`, vlastní
`APP_URL` je na Vercelu nastavená. V Google konzoli je potřeba přidat `<adresa>/api/google/prihlaseni/callback`
a `<adresa>/api/google/kalendar/callback` (dělá uživatel). Přihlašovat se jen z této adresy větve.

**Diagnostika preview 13. 11. (proč se nic nepropisovalo):** Kalendář propojený je (12. 11. 17:48 testovacím
účtem svázaným s `demo-organizator`), synchronizace běží (5 vazeb `synced`, poslední 13. 11. 19:41). Pozvánky
ale šly jen na jednu adresu z `GOOGLE_ALLOWED_ATTENDEES`, protože `CALENDAR_ATTENDEES` na Vercelu není
nastavené. Osobní účet uživatele je ve Wiki Člen týmu ve skupinách Všichni a FP (pozvaný), neplánuje a mezi
hosty nebyl. Propojení v režimu Testing vyprší kolem 19. 11. Výchozí `APP_URL` preview míří na starou větev
`ccr-2d4283fa-slno9d`, každá testovaná větev proto potřebuje vlastní.

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
