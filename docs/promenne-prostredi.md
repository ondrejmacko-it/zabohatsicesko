# Proměnné prostředí a nastavení plánovačů

Přehled všech proměnných, které aplikace a workflow čtou. Hodnoty sem nepatří, jen názvy. Tajemství se
vytvářejí lokálně (`openssl rand -base64 48`, u `TOKEN_ENCRYPTION_KEY` přesně `openssl rand -base64 32`)
a vkládají rovnou do správce tajemství (Vercel → Settings → Environment Variables jako *Sensitive*,
GitHub → Settings → Secrets and variables → Actions). Nikdy do gitu, chatu ani logu.

Prostředí: **P** = Vercel Production, **Pv** = Vercel Preview (pro izolovaný test vždy branch-scoped na
testovací větev), **L** = lokálně / e2e, **GH** = GitHub Actions.

## Vercel (aplikace)

| Proměnná | Prostředí | K čemu | Ověření funkčnosti | Když chybí |
|---|---|---|---|---|
| `DATABASE_URL` (tajné) | P, Pv | Postgres (Neon). Pro Pv vlastní větev Neonu, nikdy `main`. | Wiki se načte, Správa → Provoz bez chyby DB. | Lokálně PGlite; na hostingu start selže. |
| `SESSION_SECRET` (tajné, ≥ 32 zn.) | P, Pv | Podpis session cookie. | Přihlášení přežije reload. | Na hostingu povinné, bez něj se nepřihlásí nikdo. |
| `DEMO_ACCESS_CODE` (tajné, ≥ 12 zn.) | Pv (demo) | Brána hostovaného dema. | Bez kódu přesměrování na bránu. | Lokálně bez brány. |
| `WIKI_MODE` | P | `production` = ostrá Wiki, zakáže fiktivní seed a obnovu dat. | Správa nenabízí obnovu ukázky. | Demo režim s fiktivními rolemi. |
| `APP_URL` | P, Pv | Veřejná adresa; odkaz v pozvánce, OAuth redirect. | Odkaz v události vede na Wiki; OAuth bez `redirect_uri_mismatch`. | Kalendář i Google přihlášení hlásí chybějící konfiguraci. |
| `DEMO_CLOCK` | P, Pv | `real` = skutečný čas. | Plán ukazuje dnešek. | Ukázkový čas ze seedu (12. 11. 2026 9:00). |
| `SIM_LATENCY_MS` | L, Pv | Zpoždění simulací v UI. | – | 1200 ms. |
| `CALENDAR_MODE` | P, Pv | `google-test` = skutečné Google API, jinak simulace. | Správa → Kalendář ukazuje režim Google. | Simulace, nic se do Googlu neposílá. |
| `CALENDAR_DELIVERY` | P, Pv | `organizer` (výchozí) / `personal` (osobní kalendáře). Izolovaný test: `personal`. | Profil nabízí připojení osobního kalendáře (personal). | `organizer`. |
| `CALENDAR_ATTENDEES` | P, Pv | `audience` = pozvaní podle publika akce; prázdné = jen `GOOGLE_ALLOWED_ATTENDEES`. | Hosté události odpovídají skupině. | Jen allowlist. |
| `CALENDAR_PERSONAL_NOTIFY` | Pv | `self-invite` = zkušební upozornění v osobním kalendáři. | – | Vypnuto. |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (tajné) | P, Pv | OAuth klient (Kalendář i přihlášení). Pro test samostatný testovací klient. | Souhlasová obrazovka Googlu se otevře. | Kalendář i Google přihlášení vypnuté s hlášením. |
| `GOOGLE_CALENDAR_ID`, `GOOGLE_ALLOWED_CALENDAR_IDS` | P, Pv | Cílový kalendář organizátora a povolené kalendáře. | Akce se objeví v cílovém kalendáři. | Konfigurace hlásí chybějící názvy. |
| `GOOGLE_ALLOWED_ATTENDEES` | Pv | Allowlist testovacích příjemců (povinný bez `audience`). | Pozvánky jen na testovací účty. | Konfigurace neúplná. |
| `GOOGLE_ORGANIZER_EMAIL` | P (organizer) | Jediný účet, který smí propojit kalendář organizátora. | Jiný účet je odmítnut. | Pozvánky se neposílají. |
| `GOOGLE_OAUTH_PUBLISHED` | P | `1` = souhlasová obrazovka zveřejněná. | Zmizí upozornění na vypršení po 7 dnech. | Upozornění, propojení v Testing vyprší za 7 dní. |
| `TOKEN_ENCRYPTION_KEY` (tajné, 32 B base64) | P, Pv | Šifrování OAuth tokenů v DB. Změna = nutné znovu propojit. | Propojení kalendáře projde. | Kalendář nelze propojit. |
| `LOGIN_MODE` | P, Pv | `google-test` = přihlášení Google identitou. | Tlačítko „Přihlásit Googlem“. | Jen fiktivní role / zařízení. |
| `GOOGLE_LOGIN_ACCOUNTS` | Pv | Zaváděcí seznam `adresa=id-uzivatele`. | Testovací účet se přihlásí jako správná role. | Jen `BOOTSTRAP_ADMIN_EMAILS` a existující účty. |
| `BOOTSTRAP_ADMIN_EMAILS` | P, Pv | Pojistka hlavního správce. | Adresa po ověření Googlem je správce. | Riziko zamčení správy. |
| `PARTICIPATION` | P, Pv | `on` = přihlášky a omluvy. Izolovaný test: `on`. | Na akci tlačítka Přihlásit / Omluvit. | Panel jen informativní. |
| `EVENT_VISIBILITY` | P | `audience` = nouzový návrat k filtru podle publika. | – | `all-published`. |
| `RECORDING_DEMO` | L, Pv | `on` = ukázka nahrávání nahrávek. | – | Skryté, server odmítne. |
| `APPROVED_MIGRATIONS` | P, Pv | Schválené migrace (čárkami). Účast potřebuje `0016_event_participation,0017_participation_withdrawn`. | Log `[db]` bez „čeká na schválení“. | Migrace a další po ní se nespustí. |
| `CSP_UPGRADE_INSECURE` | P | `0` vypne `upgrade-insecure-requests`. | – | Zapnuto. |
| `CALENDAR_WORKER_TOKEN` (tajné, ≥ 32 zn.) | P (+ Pv při testu) | Token plánovače GitHub Actions (POST `/api/kalendar/fronta`). Stejná hodnota jako GH secret. | Běh workflow „Fronta Kalendáře“ vrátí HTTP 200. | Endpoint vrací 401, GitHub běh skončí chybou. |
| `CRON_SECRET` (tajné, ≥ 32 zn.) | P | Vercel ho sám posílá svému cronu (GET, denně 5:17 UTC). | Vercel → Cron Jobs: poslední běh 200. | Denní cron dostane 401. |
| `FEEDBACK_WEBHOOK_URL`, `FEEDBACK_WEBHOOK_SECRET` (tajné) | P, Pv | Zpětná vazba do Make.com (jen https). | Brouček → odeslat → záznam v Make. | Okno řekne, že se nic neodeslalo. |

Kratší token než 32 znaků se nepřijímá. Bez `CALENDAR_WORKER_TOKEN` i `CRON_SECRET` endpoint odmítne
každý požadavek (fronta pak běží jen přes `after()` po akci v aplikaci a při návštěvě Wiki).

## GitHub Actions (workflow `kalendar-fronta.yml`, každých 10 min)

| Název | Typ | K čemu | Když chybí |
|---|---|---|---|
| `CALENDAR_QUEUE_SCHEDULER` | Variable | `off` = záměrně vypnuto (běh skončí úspěšně s oznámením). | Plánovač zapnutý. |
| `WIKI_URL` | Variable | Adresa Wiki (produkce nebo alias testovací větve). | Běh skončí `::error::` (exit 1). |
| `CALENDAR_WORKER_TOKEN` | Secret | Stejná hodnota jako ve Vercelu. | Běh skončí `::error::` (exit 1). |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Secret | Jen pro chráněný Preview (Deployment Protection). | U chráněného Preview HTTP 401/403 → error. |

Ověření: Actions → „Fronta Kalendáře“ → *Run workflow*; běh musí být zelený s `HTTP 200` v logu
(tělo odpovědi se nevypisuje); stav posledního běhu ukazuje Správa. Červený běh = chybná konfigurace nebo HTTP ≠ 200, nikdy tichý úspěch.

## Lokální skripty

| Proměnná | K čemu |
|---|---|
| `PGLITE_DIR` | Adresář lokální PGlite (výchozí `./.data/pglite`). |
| `OVERENI_CIL=izolovany-branch` | Pojistka skriptu `scripts/overeni-ucasti-db.ts`, běží jen nad izolovanou větví Neonu. |
