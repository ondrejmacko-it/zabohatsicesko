# Kalendář organizátora · provoz a nastavení

Závazné zadání je [plan-kalendar-pozvanky.md](plan-kalendar-pozvanky.md). Tento soubor popisuje, jak režim
organizátora (PR A) funguje, co stojí dlouhodobý provoz a co musí nastavit správce. Technické detaily
připojení Googlu jsou v [google-kalendar.md](google-kalendar.md).

## Jak to funguje

- **Jeden organizátor.** `CALENDAR_DELIVERY` prázdné nebo `organizer` (výchozí): Wiki zapisuje zveřejněné akce
  do kalendáře jednoho dedikovaného účtu Google a zve účastníky podle skupin skutečnou pozvánkou Google
  (`sendUpdates=all`). Hosté nevidí ostatní hosty, nemohou akci měnit ani zvát další. Časové pásmo `Europe/Prague`.
  `personal` je dočasný starý režim osobních kalendářů. Režimy se vylučují: v `personal` fronta organizátora nic nedělá.
- **Stabilní ID.** Událost má ID odvozené z akce. Opakované založení po nejasném výsledku skončí odpovědí 409 a Wiki
  použije existující událost, takže nevznikají duplicity.
- **Úpravy a zrušení.** Úprava mění jen spravovaná pole (název, popis, čas, stav) a hosty, které Wiki sama pozvala.
  Odpověď hosta (`responseStatus`) nikdy nepřepisuje. Zrušení nastaví původní události `status: cancelled`.
- **Fronta (outbox) v `calendar_links`.** Zveřejnění revize zapíše čekající změnu do vazby ve stejné transakci.
  Vždy se posílá nejnovější zveřejněná revize. Neúspěšné odeslání dostane `next_attempt_at`:
  - dočasná chyba (429, 5xx, timeout): po 3 rychlých pokusech 5, 10, 20 … min, nejvýš 6 h,
  - chyba přístupu (403 bez práva ke kalendáři): 60, 120 … min, nejvýš 6 h,
  - chyba nastavení nebo odvolané propojení (401 po obnově tokenu): bez opakování, vyřeší ji nové připojení,
    po kterém se fronta odešle sama.
- **Kdo frontu zpracuje.** Každé zpracování bere zámek na vazbu i na čtení odpovědí, souběh je proto bezpečný.
  1. hned po zveřejnění akce,
  2. při návštěvě Wiki (Úvod), nejvýš jednou za 5 minut,
  3. GitHub Actions, workflow „Fronta Kalendáře“ co 10 minut (dočasné řešení pro test),
  4. denní cron Vercelu v 5:17 UTC (záloha, plán Hobby víc nedovolí).

  Plánovače volají `/api/kalendar/fronta` s hlavičkou `Authorization: Bearer <token>`. Server porovná
  otisk sha256 v konstantním čase (`timingSafeEqual`), bez platného tokenu vrátí 401. Odpověď nese jen počty.
- **Záznam běhů v `calendar_worker_runs`.** Pro každý zdroj (`github`, `vercel-cron`, `visit`, `publish`) poslední
  začátek, poslední úspěch a kód poslední chyby.
- **Upozornění ve Správě** (sekce Kalendář):
  - žádný úspěšný běh GitHubu ani cronu Vercelu za posledních 30 minut znamená výpadek pravidelného běhu,
  - přechodná chyba fronty se hlásí až po hodině, chyba přístupu nebo nastavení hned.
- **60 dní neaktivity.** GitHub u veřejného repa vypne plánované workflow po 60 dnech bez commitu. Workflow se proto
  jednou denně samo znovu zapne přes API (`PUT …/enable`). **Neověřeno**, že tím odpočet skutečně začne znovu.
  Kdyby GitHub workflow přesto vypnul, Správa ohlásí výpadek a v Actions stačí kliknout na „Enable workflow“.

## Stavy odpovědí (RSVP)

Wiki čte odpovědi z kalendáře organizátora jen čtením (`events.list` se `syncToken`). Nic přitom do Googlu nezapisuje.
První čtení je úplné, další přírůstková. Po `410 Gone` proběhne úplné čtení znovu. Token je uložený v
`calendar_sync_state`, odpovědi v `calendar_responses`.

| Stav Googlu | Ve Wiki |
|---|---|
| `needsAction` | Čeká na odpověď |
| `accepted` | Přijata |
| `tentative` | Možná |
| `declined` | Odmítnuto. Wiki hosta znovu nezve, dokud se akce nezmění. |
| Google nedostupný nebo poslední úspěšné čtení starší 3 h | Stav nelze ověřit |

Přijetí neznamená ověřené přidání do osobního kalendáře. Podle nastavení příjemce se pozvánka do kalendáře
přidá sama, nebo až po odpovědi. Wiki funguje v obou případech.

Na Úvodu je jedna karta pozvánek. Červeně se zobrazí jen akce bez odpovědi, které začínají do 7 dní. Vzdálenější akce
jsou neutrální. „Otevřít Gmail“ otevře hledání `from:<účet organizátora> in:anywhere` (včetně Spamu). V simulaci
odkaz chybí. Stav se obnoví po návratu do okna (nejvýš jednou za minutu), jinak každých 5 minut.

## Dlouhodobý provoz a náklady

Nic placeného není aktivované. Doporučení: dokud běží pilot, **GitHub Actions + denní cron Vercelu** (0 Kč).
Pro ostrý provoz s garantovaným během **Vercel Pro**, nebo jako bezplatná náhrada **cron-job.org**.

| Varianta | Náklady | Spolehlivost | Poznámka |
|---|---|---|---|
| GitHub Actions co 10 min (nastaveno) | zdarma pro veřejné repo | Běh může mít zpoždění nebo vypadnout, hlavně ve špičkách. Po 60 dnech neaktivity riziko vypnutí. | Jen dočasně pro test. Plánovaný běh jede jen z výchozí větve (`main`). |
| Denní cron Vercelu (nastaveno) | zdarma (Hobby) | 1× denně, čas v rámci hodiny | Jen záloha. Vercel cron volá jen produkční nasazení. |
| Zpracování při návštěvě a po zveřejnění (nastaveno) | zdarma | Jen když někdo Wiki používá | Doplňuje plánovač, nenahrazuje ho. |
| Vercel Pro, cron po minutách | 20 USD/měs. za člena týmu (cca 480 Kč), v ceně kredit na využití | Spolehlivý, spravovaný Vercelem | Stačí v `vercel.json` změnit plán, například na `*/5 * * * *`. |
| cron-job.org | zdarma | Dobrá, nezávislá služba, interval od 1 min | Umí POST a vlastní hlavičku `Authorization`. Token je pak uložený u třetí strany. |

Ceny podle ceníků k 11/2026, před aktivací ověřit.

## Co musíš udělat ty (Windows)

Pořadí je důležité. Kroky 1–3 jsou příprava, kroky 4–6 zapnou plánovač. Produkce zůstává na
`CALENDAR_DELIVERY=personal`, dokud přepnutí výslovně neschválíš (PR B s dry-runem).

### 1. Založit dedikovaný účet Google organizátora

1. Otevři Chrome a stiskni `Ctrl+Shift+N` (anonymní okno, ať se nepřihlásí tvůj účet).
2. Jdi na `https://accounts.google.com/signup`.
3. Vyplň jméno, například „Vzdělávání“ a příjmení „ZBC“. Klikni **Další**.
4. Vyplň datum narození a pohlaví. Klikni **Další**.
5. Zvol **Vytvořit vlastní adresu Gmail** a zadej například `vzdelavani.zbc`. Klikni **Další**.
6. Zadej silné heslo (správce hesel) a klikni **Další**.
7. Telefon a záchranný e-mail: zadej svůj, ať jde účet obnovit. Dokonči registraci.
8. Na `https://myaccount.google.com/security` zapni **Dvoufázové ověření**.
9. Adresu účtu si poznač. Do repa ani do chatu ji nepiš.

### 2. Povolit účet v Google Cloud (jen pokud je souhlasová obrazovka v režimu Testing)

1. Otevři `https://console.cloud.google.com/` a vlevo nahoře vyber projekt Wiki.
2. Vlevo **Google Auth Platform** → **Audience** (dřív APIs & Services → OAuth consent screen).
3. V části **Test users** klikni **Add users**, vlož adresu organizátora a klikni **Save**.
4. V režimu Testing propojení po 7 dnech vyprší. Správa to ukáže a nabídne „Obnovit propojení“.

### 3. Připojit účet organizátora ve Wiki

1. V proměnných Vercelu nech `GOOGLE_CALENDAR_ID=primary` (hlavní kalendář připojeného účtu). Pokud tam je
   jiná hodnota, nastav `primary` a totéž přidej do `GOOGLE_ALLOWED_CALENDAR_IDS`.
2. Ve Vercelu (**Settings → Environment Variables → Add Environment Variable**) přidej **Key**
   `GOOGLE_ORGANIZER_EMAIL`, **Value** adresu účtu organizátora, **Environments** Production i Preview, **Save**.
   Bez ní režim organizátora pozvánky neposílá (fronta stojí a Integrace ukáže chybějící proměnnou).
3. Přihlas se do Wiki jako správce.
4. Otevři **Vzdělávání → Integrace**.
5. Pokud je připojený jiný účet, klikni **Odpojit Kalendář…** a v okně potvrď **Odpojit**.
6. Klikni **Připojit Google Kalendář**. Google rovnou nabídne účet organizátora; když ho v prohlížeči nemáš
   přihlášený, přihlas se jím.
7. Zaškrtni oprávnění ke Kalendáři a klikni **Pokračovat**.
8. Ve **Správě**, sekce **Kalendář**, zkontroluj, že je jako propojený účet uvedený organizátor.

Pojistka: Wiki po návratu z Googlu porovná ověřený e-mail z ID tokenu s `GOOGLE_ORGANIZER_EMAIL`. Jiný účet
(např. tvůj osobní) se neuloží, jeho oprávnění se u Googlu zneplatní a Integrace ukáže „Kalendář smí propojit
jen účet organizátora“. Přihlášení správce do Wiki se v režimu organizátora na Kalendář neptá.

### 4. Vygenerovat dva tokeny

1. Stiskni `Win`, napiš `PowerShell` a otevři **Windows PowerShell**.
2. Vlož tento příkaz a stiskni `Enter`:

   ```powershell
   $b = New-Object byte[] 48; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```

3. Výsledek (64 znaků) je `CALENDAR_WORKER_TOKEN`. Ulož si ho do správce hesel.
4. Spusť příkaz ještě jednou. Druhý výsledek je `CRON_SECRET`. Musí se lišit od prvního.

### 5. Nastavit tokeny ve Vercelu

1. Otevři `https://vercel.com/`, vyber tým a projekt Wiki.
2. Nahoře klikni **Settings**, vlevo **Environment Variables**.
3. Klikni **Add Environment Variable** (nebo **Add New**).
4. **Key:** `CALENDAR_WORKER_TOKEN`, **Value:** první token.
5. U **Environments** zaškrtni **Production** a **Preview**, Development nech prázdné.
6. Zapni **Sensitive** a klikni **Save**.
7. Opakuj body 3–6 pro **Key** `CRON_SECRET` s druhým tokenem.
8. Volitelně pro test na preview: **Settings → Deployment Protection → Protection Bypass for Automation**
   → **Add Secret** (pokud to plán nabízí). Hodnotu si zkopíruj pro krok 6.
9. Proměnné platí až pro nové nasazení: **Deployments** → u posledního nasazení dané větve **⋯** → **Redeploy**.

Vercel cron volá jen produkční nasazení, `CRON_SECRET` v Preview je jen pro shodu prostředí.

### 6. Nastavit GitHub Actions

1. Otevři `https://github.com/ondrejmacko-it/zabohatsicesko`.
2. Klikni **Settings** (vpravo nahoře v liště repa).
3. Vlevo **Secrets and variables** → **Actions**.
4. Záložka **Secrets** → **New repository secret**. **Name:** `CALENDAR_WORKER_TOKEN`, **Secret:** první token
   (stejný jako ve Vercelu). Klikni **Add secret**.
5. Jen pro preview za ochranou: ještě jednou **New repository secret**, **Name:** `VERCEL_AUTOMATION_BYPASS_SECRET`,
   **Secret:** hodnota z kroku 5.8. Klikni **Add secret**.
6. Záložka **Variables** → **New repository variable**. **Name:** `WIKI_URL`, **Value:** adresa Wiki bez lomítka
   na konci, například stálá adresa preview větve, nebo `https://zbc-vzdelavani-demo.vercel.app`. Klikni **Add variable**.

### 7. Ručně spustit workflow „Fronta Kalendáře“

GitHub zobrazí a plánovaně spouští jen workflow, které je ve výchozí větvi. Tlačítko se proto objeví až po merge PR A.

1. V repu klikni nahoře **Actions**.
2. Vlevo vyber **Fronta Kalendáře**.
3. Vpravo klikni **Run workflow**, větev nech `main` a klikni zelené **Run workflow**.
4. Po chvíli klikni na běh → **Zpracovat frontu** → krok **Zavolat Wiki**. Má tam být `HTTP 200`.
   - `HTTP 401`: token v GitHubu a ve Vercelu se liší, nebo Vercel ještě neběží s novým nasazením.
   - Stránka Vercelu s přihlášením nebo `HTTP 401` u preview: chybí bypass z kroku 5.8.
   - „Plánovač není nastavený“: chybí `WIKI_URL` nebo secret.
5. Ve Wiki otevři **Správa**, sekce **Kalendář**. U GitHubu má být čas posledního úspěšného běhu.

Na produkci s `CALENDAR_DELIVERY=personal` endpoint odpoví 200 a nic neudělá (režim organizátora je vypnutý).

## Co je ověřené

Zatím jen automatické testy proti napodobenému Googlu (`tests/fake-google.ts`, `tests/kalendar-organizator.test.ts`):
chyby 401/403/404/409/410/429/5xx, timeout, zachování odpovědí, soukromí hostů, nový zaměstnanec, změna skupiny,
zrušení, stavy RSVP, nedostupné RSVP, bez duplicit, čtení bez zápisu, endpoint bez tokenu, vyloučení souběhu s `personal`.
Nic neběželo proti skutečnému Googlu. Otevřené pro živý test (PR D):

- zda `sendUpdates=all` při pouhém přidání hosta pošle e-mail i ostatním hostům,
- zda denní `enable` workflow skutečně resetuje 60denní odpočet,
- skutečné zpoždění GitHub Actions a chování Gmailu (Spam, „známý odesílatel“).
