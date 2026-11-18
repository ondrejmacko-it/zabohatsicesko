# Začlenění modulu Vzdělávání do firemní Wiki

Stav: **příprava, nic se ve firemní Wiki nemění.** Dokument popisuje, co modul dnes je, jak ho lze do
stávající Wiki začlenit a co k tomu potřebujeme od firmy. Informace o firemní Wiki, které neznáme,
jsou označené jako **neznámé** a nejsou domyšlené. Konkrétní seznam otázek je v
[podklady-pro-sper.md](podklady-pro-sper.md).

Cíl první fáze: modul Vzdělávání (harmonogram, témata, akce, zápisy, Google Kalendář) se stane součástí
Wiki. Onboarding, knihovna, vyhledávání, správa účtů a další funkční části Wiki **zůstávají beze změny**.

## 1. Co modul dnes je

| Oblast | Stav modulu |
|---|---|
| Framework | Next.js 16 (App Router, server actions, React 19), TypeScript, Node.js ≥ 22. Jeden deploy (UI + server). |
| Architektura | Vrstvy `src/app` (stránky), `src/features/vzdelavani` (UI a serverové akce), `src/server/services` (doménové operace), `src/server/policy.ts` (jediné místo pravidel přístupu), `src/server/calendar` (rozhraní Kalendáře a fronta), `src/server/recordings` (ověření souborů, rozhraní přepisu). |
| Databáze | PostgreSQL přes Drizzle ORM. Lokálně a v testech PGlite, na hostingu Neon (region EU). Migrace jsou čisté SQL v `src/server/db/migrations.ts`, aplikují se samy pod zámkem při prvním připojení, jen přidávací. |
| Autentizace | Podepsaná HttpOnly session cookie. Ostrá Wiki: přihlášení účtem Google (ověření ID tokenu na serveru, vazba na stabilní `sub`), pozvánka na důvěryhodné zařízení. Role a skupiny drží databáze modulu. |
| Oprávnění | Role Správce a Člen týmu, skupiny (`vsichni`, `fp`, `rm`, `tym-a`), vazby vedoucí/kontrolor u akce. Vše ověřuje server. |
| Google Kalendář | Kalendář dedikovaného organizátora, OAuth s šifrovaným obnovovacím tokenem (AES-256-GCM), fronta s opakováním a zámky, čtení RSVP. Popsáno v `docs/kalendar-organizator.md`, `docs/google-kalendar.md`. |
| Soubory | Nahrávky a podklady zápisů soukromě v databázi pod generovaným klíčem, vydávání jen autorizovanou cestou, kontrola obsahu a velikosti. |
| Hosting | Vercel (Production = ostrá Wiki, Preview = ukázka s fiktivními daty), Neon. Plánovač fronty Kalendáře: GitHub Actions + Vercel Cron. |
| Bezpečnost | CSP s nonce, `frame-ancestors 'none'`, `nosniff`, `noindex`, kontrola původu server actions, Zod validace, parametrizované dotazy, omezení počtu pokusů, audit bez obsahu dat. |

## 2. Varianty začlenění

### Varianta 1: Přímé začlenění modulu
Modul běží jako součást Wiki pod její doménou.

* **1a – Pod cestou Wiki přes reverzní proxy** (např. `wiki.firma.cz/vzdelavani` → nasazení modulu).
  Modul zůstává samostatným nasazením, uživatel vidí jednu adresu. Vyžaduje nastavit `basePath` v Next.js,
  sdílenou nebo předanou identitu (viz varianta 2) a úpravu CSP/cookies na společnou doménu.
* **1b – Kód modulu přímo v repozitáři Wiki.** Dává smysl jen pokud je firemní Wiki také Next.js/React
  s Node serverem. Pak lze přenést `src/features/vzdelavani`, `src/server` (služby, policy, kalendář) a
  migrace jako samostatné schéma. **Neznámé:** framework a repozitář firemní Wiki.
* **Nedoporučeno: vložení do iframe.** Modul dnes iframe záměrně zakazuje (`frame-ancestors 'none'`) kvůli
  clickjackingu. Povolit by šlo jen konkrétní doménu Wiki, s dopadem na cookies třetích stran v Safari.

### Varianta 2: Propojení přes SSO nebo API
Modul zůstává samostatnou aplikací, Wiki na něj odkazuje a sdílí identitu.

* **SSO (doporučený první krok):** přihlášení stejným účtem jako do Wiki. Dnes modul umí Google (OIDC).
  Pokud Wiki používá Google Workspace, stačí stejná doména a správa uživatelů. Pokud jiný IdP (Microsoft
  Entra ID, Okta, vlastní), přidá se další poskytovatel do `src/server/auth` se stejnou vazbou na stabilní
  identifikátor. **Neznámé:** poskytovatel identity Wiki.
* **Synchronizace účtů a skupin:** dnes je spravuje Správa systému modulu. Lze je číst z Wiki/IdP (SCIM,
  skupiny v ID tokenu nebo API Wiki). Do té doby zůstává ruční správa v modulu.
* **API pro Wiki:** pokud Wiki chce zobrazovat „Nejbližší akce“ nebo „Čeká na vás“ na své úvodní stránce,
  připravíme čtecí endpoint s autorizací služba–služba. Nic takového zatím nevzniká bez zadání.

### Varianta 3: Budoucí náhrada vybraných částí Wiki
Jen po výslovném schválení firmy. Modul nenahrazuje onboarding, knihovnu, vyhledávání ani správu účtů.
Kandidáti se posuzují samostatně, až bude známá architektura Wiki.

## 3. Doporučený postup
1. Získat podklady ze seznamu v [podklady-pro-sper.md](podklady-pro-sper.md).
2. Rozhodnout variantu (předběžně: 2 se SSO, později 1a pod doménou Wiki).
3. Testovací prostředí Wiki + Preview modulu s fiktivními daty, ověření přihlášení a rolí.
4. Pilot s jednou skupinou, souběh s dosavadním plánováním.
5. Ostrý provoz, vypnutí dosavadních nástrojů (Notion, Numbers) až po potvrzení firmy.

## 4. Mapa potřebných informací

| Oblast | Co víme o modulu | Co potřebujeme od firmy (neznámé) |
|---|---|---|
| Framework a architektura | Next.js 16, Node 22, jeden deploy | Technologie Wiki, způsob rozšiřování (moduly, pluginy, mikro-frontendy), kdo ji vyvíjí |
| Zdrojový kód a přístupy | GitHub repo, CI s lintem, typy, testy, auditem závislostí | Kde je kód Wiki, kdo schvaluje změny, přístup pro vývojáře modulu (čtení/testovací větev) |
| Autentizace | Google OIDC, session cookie, pozvánka zařízení | IdP Wiki, protokol (OIDC/SAML), doména, MFA, odhlášení napříč systémy |
| Oprávnění | Správce/Člen týmu, skupiny, vedoucí/kontrolor | Role a skupiny ve Wiki, kdo je zdroj pravdy, mapování na skupiny modulu |
| Databáze | Postgres (Neon EU), vlastní schéma, přidávací migrace | Smí modul mít vlastní DB? Firemní DB a region, kdo spravuje |
| Google Kalendář | Organizátorský kalendář, OAuth, fronta, RSVP | Který účet je organizátor, Workspace politika (OAuth aplikace, domain-wide delegation ano/ne), vlastnictví stávajících pozvánek |
| Hosting a nasazování | Vercel Production/Preview | Kde běží Wiki, požadavky na hosting (EU, vlastní cloud), proces nasazení a schvalování |
| Testovací prostředí | Preview s fiktivními daty, e2e Playwright | Testovací instance Wiki a testovací účty |
| Úložiště souborů | Soukromě v DB, limit velikosti | Firemní úložiště (Drive, S3, SharePoint), retence, šifrování |
| Bezpečnost | CSP, audit, kontrola obsahu souborů | Bezpečnostní požadavky firmy, penetrační test, pravidla pro iframe a domény |
| GDPR a uchovávání | Audit bez obsahu, minimalizace (nahrazená nahrávka se maže) | Správce a zpracovatel, doba uchování nahrávek/přepisů/zápisů, záznam o zpracování, DPA s poskytovateli |
| Monitoring | Provozní log jen s kódy chyb, stav fronty Kalendáře ve Správě | Firemní monitoring/alerting, kam posílat chyby, kdo drží pohotovost |
| Zálohy a rollback | Neon point-in-time restore (podle plánu), Vercel okamžitý rollback deploymentu, migrace jen přidávací | Požadovaná RPO/RTO, kdo provádí obnovu, test obnovy |

## 5. Rizika a omezení
* Migrace se aplikují automaticky při startu. Před ostrým nasazením do jiné infrastruktury je vhodné
  oddělit krok migrace do nasazovací pipeline.
* Synchronizace Kalendáře předpokládá jednoho organizátora. Více kalendářů je nutné doplnit.
* Přepis nahrávek je ukázkový. Skutečný poskytovatel (a firemní AI/bot) má jen připravenou hranici
  (`TranscriptionProvider`, `MinutesDrafter`) a bez schválení se mu neposílají data.
