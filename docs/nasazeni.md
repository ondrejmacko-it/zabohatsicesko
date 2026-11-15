# Nasazení: ostrá Wiki a ukázka

Jeden projekt na Vercelu, dvě prostředí s odlišným účelem. Kód je stejný, liší se proměnnými prostředí
a databází.

| | Production (ostrá Wiki) | Preview (ukázka) |
|---|---|---|
| Účel | Firma, skuteční lidé | Předvádění a testování změn z větví |
| `WIKI_MODE` | `production` | `demo` |
| Vstup | Jen účet Google | Zvací odkaz nebo přístupový kód, pak výběr fiktivní role. Google se nenabízí. |
| Data | Vlastní databáze Neon. Prázdná, při prvním spuštění dostane jen pravidelný týden (skupiny jsou v kódu). | Sdílená ukázková databáze s fiktivním seedem |
| Kalendář | Google (`CALENDAR_MODE=google-test`), pozvánky skutečnému publiku | Simulace |
| Čas | Skutečný | Ukázkový (listopad 2026) |
| Nahrávky | Jako v ukázce: testovací nahrávka, skutečný přepis zatím není | Ukázkový režim |

Ostrá Wiki se nespustí, dokud jí chybí přihlášení Googlem nebo Kalendář. Chybějící proměnné vypíše
názvem v logu nasazení (hodnoty nikdy). Fiktivní role, obnovu ukázkových dat ani přepínače simulace
v ní nejde zapnout.

## Proměnné prostředí

Nesecretní hodnoty může nastavit Claude přes API Vercelu. Tajemství zadává jen vlastník projektu.

### Production

| Proměnná | Kdo | Hodnota |
|---|---|---|
| `WIKI_MODE` | Claude | `production` |
| `LOGIN_MODE` | Claude | `google-test` |
| `CALENDAR_MODE` | Claude | `google-test` |
| `CALENDAR_ATTENDEES` | Claude | `audience` (pozvánky dostanou aktivní účty skupiny akce) |
| `APP_URL` | Claude | Produkční adresa bez lomítka na konci |
| `DATABASE_URL` | vlastník | Připojení k novému projektu Neon `zbc-wiki-produkce` (region EU) |
| `SESSION_SECRET` | vlastník | Nový náhodný řetězec, aspoň 32 znaků. Jiný než v Preview. |
| `TOKEN_ENCRYPTION_KEY` | vlastník | Nových 32 bajtů v base64 (`openssl rand -base64 32`). Jiný než v Preview. |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | vlastník | OAuth klient (ideálně vlastní pro produkci) |
| `GOOGLE_CALENDAR_ID`, `GOOGLE_ALLOWED_CALENDAR_IDS` | vlastník | Firemní kalendář vzdělávání |
| `BOOTSTRAP_ADMIN_EMAILS` | vlastník | Adresa (nebo adresy oddělené čárkou), jejíž první přihlášení Googlem založí správce |

V Production **nenastavovat** `GOOGLE_LOGIN_ACCOUNTS` (ostrá Wiki ho ignoruje), `DEMO_ACCESS_CODE`
(nepotřebuje), `DEMO_CLOCK`, `SIM_LATENCY_MS` ani `GOOGLE_ALLOWED_ATTENDEES` (při `audience` se nečte).
`GOOGLE_OAUTH_PUBLISHED=1` přidat, až bude souhlasová obrazovka Googlu zveřejněná.

### Preview

| Proměnná | Kdo | Hodnota |
|---|---|---|
| `WIKI_MODE` | Claude | `demo` |
| `CALENDAR_MODE` | Claude | `simulation` (nebo nenastavit) |
| `LOGIN_MODE`, `CALENDAR_ATTENDEES`, `APP_URL` omezené na větve | Claude | Odebrat |
| `DATABASE_URL`, `SESSION_SECRET`, `DEMO_ACCESS_CODE` | vlastník | Beze změny |

## Postup pro vlastníka

1. **Sloučit PR** s oddělením ostré Wiki a ukázky. Production se nasadí až po kroku 6.
2. **Neon:** organizace Neon je spravovaná přes Vercel Marketplace, přímé založení projektu API odmítá
   („organization is managed by Vercel“). Vlastník založí databázi ve Vercelu: projekt → Storage →
   Create Database → Neon, název `zbc-wiki-produkce`, region Frankfurt (`aws-eu-central-1`), připojit
   **jen k prostředí Production** (Preview dál používá stávající databázi ukázky). Vercel pak sám
   doplní `DATABASE_URL` pro Production. Zkontrolovat, že se nepřepsaly proměnné Preview.
3. **Tajemství Production** podle tabulky výše. Doporučeno nové `SESSION_SECRET` a `TOKEN_ENCRYPTION_KEY`,
   aby cookie ani tokeny z ukázky v ostré Wiki neplatily.
4. **Google Cloud Console** (OAuth klient): přidat přesměrovací adresy
   `<APP_URL>/api/google/prihlaseni/callback` a `<APP_URL>/api/google/kalendar/callback`. Souhlasová
   obrazovka v režimu Testing pouští jen přidané testovací uživatele (nejvýš 100) a propojení Kalendáře
   vyprší po 7 dnech. Pro firmu je potřeba ji zveřejnit.
5. **Vercel:** ochrana nasazení (Vercel Authentication) chrání i Production. Pro ostrou Wiki ji vypnout
   jen pro Production, nebo nechat a pouštět lidi přes Vercel. Ignored build step dnes produkci
   přeskakuje, pro první nasazení ho upravit. Hobby plán je podle podmínek Vercelu jen nekomerční.
6. **První nasazení a první správce:** otevřít produkční adresu, přihlásit se Googlem s adresou
   z `BOOTSTRAP_ADMIN_EMAILS`. Vznikne aktivní správce. Pak propojit Kalendář (Plán nabídne
   „Propojit Kalendář“) a ve Správě systému pozvat další lidi. Kdo se přihlásí bez pozvánky, čeká na
   schválení. Po založení správce lze `BOOTSTRAP_ADMIN_EMAILS` smazat, adresa, která už ve Wiki účet
   má, nic dalšího nezaloží.

## Zvací odkaz ukázky

`https://<adresa-preview>/vstup?pozvanka=<DEMO_ACCESS_CODE>`

Odkaz kód ověří (stejný limit 10 pokusů za 15 minut na IP jako ruční zadání), uloží podepsanou HttpOnly
cookie brány na 7 dní a přesměruje na `/vstup` už bez kódu v adrese. Návštěvník pak jen vybere roli.
Kdo přijde bez odkazu, zadá kód ručně, cookie dostane také. Změna `DEMO_ACCESS_CODE` zneplatní všechny
vydané cookie i staré odkazy. Odkaz obsahuje kód, sdílet ho proto jen s lidmi, kteří do ukázky smí.
