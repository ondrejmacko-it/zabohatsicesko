# Živé ověření PR #97 před mergem (rozpracováno)

Stav 28. 11. 2026. Nad HEAD PR #97 `e3c92b3`. Jen čtení konfigurace, nic se neměnilo. Hodnoty tajemství
se nečetly, u šifrovaných proměnných je známý jen název a cíl.

## Ověřené skutečnosti (Vercel API, projekt `zbc-vzdelavani-demo`)

| # | Nález | Závažnost |
|---|---|---|
| K1 | Production nemá `CRON_SECRET` ani `CALENDAR_WORKER_TOKEN`. `/api/kalendar/fronta` proto odmítne každé volání (401, `worker-auth.ts`). Denní cron Vercelu i GitHub plánovač nic nezpracují a slib PR „plánovač dožene čekající kalendáře“ v produkci neplatí. Oprava: vlastník nastaví `CRON_SECRET` (≥ 32 znaků) v Production, pro GitHub plánovač secret `CALENDAR_WORKER_TOKEN` a proměnnou `WIKI_URL`. | vysoká (provoz) |
| K1b | GitHub (ověřeno, běhy #31–#35 `kalendar-fronta.yml`): repo nemá proměnnou `WIKI_URL` ani secret `CALENDAR_WORKER_TOKEN` (v logu prázdné), krok skončí větví „Plánovač není nastavený… nic se nevolá“ a `exit 0`. Všech 35 běhů je proto zelených, i když nic nezpracovaly. Zelený stav zakrývá nenastavený plánovač. Minimální oprava: po nastavení K1 běh ověřit v logu („HTTP 200“); volitelně při `schedule` bez konfigurace vypsat `::warning::`, aby to bylo vidět v přehledu Actions. | střední (provoz) |
| K1c | Plán `*/10 * * * *` GitHub fakticky pouští zhruba 3× denně (28. 11. 04:19, 13:14; 27. 11. 04:44, 14:24, 22:48 UTC). Plánovač z GitHubu tedy nedává slibovaný ~10min interval, reálnou zálohou zůstává zpracování při návštěvě Wiki a denní cron Vercelu. Oprava není v kódu: v reportu PR a nápovědě Správy uvádět „zpoždění až hodiny“, nebo použít externí plánovač (vlastník). | střední (očekávání) |
| K2 | Preview PR #97 (`zbc-vzdelavani-demo-eedvobxq1-maci.vercel.app`, READY) běží v `WIKI_MODE=demo`, `CALENDAR_MODE=simulation`. `PARTICIPATION=on` je v Preview jen pro starou větev `claude/festive-sagan-lilorz`, takže preview PR #97 účast vůbec nezapíná a změny PR v něm nejde proklikat. | střední (test) |
| K3 | Přihlášení Googlem běží jen při `WIKI_MODE=production`. Dnešní Preview proto proti skutečnému Googlu otestovat nejde, potřebuje vlastní konfiguraci omezenou na větev. | blokuje živý test |
| K4 | Preview sdílí jednu ukázkovou databázi (`DATABASE_URL` pro všechny větve). Živý test na ní by smíchal skutečné účty Google s fiktivním seedem. | blokuje živý test |
| K5 | `APPROVED_MIGRATIONS` Production obsahuje 0015–0019, PR #97 je bez migrací. Preview má schválení jen pro jednu starou větev. Připravenost schématu testovací DB se ověří až po jejím založení. | info |
| K6 | `FEEDBACK_WEBHOOK_URL` (Make) je nastavené i v Preview. Testovací větev ho musí přepsat prázdnou hodnotou, jinak by zpětná vazba z testu spustila Make. | střední (izolace) |
| K8 | Neon (jen čtení): projekt `neon-zbz-vzdelavani-demo` má větve `main` (produkční větev Vercelu, chráněná proti smazání), `overeni-ucast-0016-0018` a `zaloha-pred-0015-2026-11-19`. Samostatnou Preview DB jsem nenašel, takže „ukázková DB Preview“ z K4 je buď jiný projekt (`neon-novi-db*`), nebo `main`. Testovací větev proto zakládat jako *schema-only* z `main` (Neon `init_source: schema-only` data nekopíruje) a stará ověřovací větev `overeni-ucast-0016-0018` (kopie dat z 24. 11.) k testu nepoužívat. Nic se nezakládalo. | střední (izolace) |
| K7 | Vercel cron běží jen nad Production. Na preview je plánovač jen ruční volání endpointu s tokenem (a bypass ochrany nasazení). | info |

## Navržený postup izolovaného živého testu (čeká na schválení vlastníka)

Jediná nová věc je testovací větev s proměnnými omezenými na ni. Production a ostatní preview zůstanou beze změny.

1. Větev `test/zive-overeni-kalendare` = HEAD PR #97 (jen push, bez změn kódu). Alias
   `zbc-vzdelavani-demo-git-test-zive-overeni-kalendare-maci.vercel.app` (ověřit po prvním deployi).
2. Databáze: nová větev Neon z Preview DB v režimu *schema-only* (bez seedu, bez produkčních dat).
   `DATABASE_URL` pro Preview + git větev = připojení k ní (zadá vlastník, je to tajemství).
3. Proměnné Preview omezené na testovací větev. Nesecretní nastaví Claude po schválení:
   `WIKI_MODE=production`, `LOGIN_MODE=google-test`, `CALENDAR_MODE=google-test`, `CALENDAR_DELIVERY=personal`,
   `CALENDAR_ATTENDEES=allowlist`, `PARTICIPATION=on`, `APP_URL=<alias>`, `APPROVED_MIGRATIONS=<všechny do 0019>`,
   `FEEDBACK_WEBHOOK_URL=` (prázdné). Tajemství zadá vlastník: nové `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`,
   `CALENDAR_WORKER_TOKEN` (≥ 32 znaků), `BOOTSTRAP_ADMIN_EMAILS` = testovací účet správce,
   `GOOGLE_ALLOWED_ATTENDEES` = testovací účty.
4. Google Cloud Console: přidat redirect URI `<alias>/api/google/prihlaseni/callback` a
   `<alias>/api/google/kalendar/callback`, testovací účty mezi testovací uživatele souhlasové obrazovky.
5. Plánovač: ruční `POST <alias>/api/kalendar/fronta` s `Authorization: Bearer` a hlavičkou bypassu ochrany.
6. Po testu: smazat proměnné větve, větev Neon, testovací větev v Gitu a události v testovacích kalendářích.

## Živé scénáře (připraveno, neprovedeno)

Každý krok: akce ve Wiki → čas do objevení/zmizení události v Google Kalendáři testovacího účtu (stopky) →
kontrola duplicit (hledat název akce v kalendáři „Vzdělávání ZBC“) → stav v panelu účasti.
První přihlášení správce a člena; přihlášení/odhlášení dobrovolné akce; omluva a zrušení omluvy; změna role,
více rolí současně; změna času a zrušení akce; připomínky (7 d a 1 d e-mail, 60/30/10 min); ruční smazání
události v Googlu a další synchronizace; chyba a opakování (dočasně odvolaný token); odvolání oprávnění
v účtu Google; odebrání přístupu ve Správě (úklid jen událostí Wiki v kalendáři „Vzdělávání ZBC“).

## Neověřeno

Všechny živé scénáře, OAuth, plánovač, vizuální sada na šířkách 320–3440 px a WebKit/Firefox
(v kontejneru je jen Chromium, `npx playwright install webkit firefox` zkusit v další relaci).
