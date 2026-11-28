# Živé ověření PR #97 před mergem

Stav 28. 11. 2026. Nad HEAD PR #97 `e3c92b3`. Jen čtení konfigurace, nic se neměnilo. Hodnoty tajemství
se nečetly, u šifrovaných proměnných je známý jen název a cíl.

## Ověřené skutečnosti (Vercel API, projekt `zbc-vzdelavani-demo`)

| # | Nález | Závažnost |
|---|---|---|
| K1 | Production nemá `CRON_SECRET` ani `CALENDAR_WORKER_TOKEN`. `/api/kalendar/fronta` proto odmítne každé volání (401, `worker-auth.ts`). Denní cron Vercelu i GitHub plánovač nic nezpracují a slib PR „plánovač dožene čekající kalendáře“ v produkci neplatí. Oprava: vlastník nastaví `CRON_SECRET` (≥ 32 znaků) v Production, pro GitHub plánovač secret `CALENDAR_WORKER_TOKEN` a proměnnou `WIKI_URL`. | vysoká (provoz) |
| K2 | Preview PR #97 (`zbc-vzdelavani-demo-eedvobxq1-maci.vercel.app`, READY) běží v `WIKI_MODE=demo`, `CALENDAR_MODE=simulation`. `PARTICIPATION=on` je v Preview jen pro starou větev `claude/festive-sagan-lilorz`, takže preview PR #97 účast vůbec nezapíná a změny PR v něm nejde proklikat. | střední (test) |
| K3 | Přihlášení Googlem běží jen při `WIKI_MODE=production`. Dnešní Preview proto proti skutečnému Googlu otestovat nejde, potřebuje vlastní konfiguraci omezenou na větev. | blokuje živý test |
| K4 | Preview sdílí jednu ukázkovou databázi (`DATABASE_URL` pro všechny větve). Živý test na ní by smíchal skutečné účty Google s fiktivním seedem. | blokuje živý test |
| K5 | `APPROVED_MIGRATIONS` Production obsahuje 0015–0019, PR #97 je bez migrací. Preview má schválení jen pro jednu starou větev. Připravenost schématu testovací DB se ověří až po jejím založení. | info |
| K6 | `FEEDBACK_WEBHOOK_URL` (Make) je nastavené i v Preview. Testovací větev ho musí přepsat prázdnou hodnotou, jinak by zpětná vazba z testu spustila Make. | střední (izolace) |
| K8 | GitHub plánovač `kalendar-fronta.yml` (ověřeno v logu běhu 46148649291, 28. 11.): `WIKI_URL` i `CALENDAR_WORKER_TOKEN` jsou prázdné, krok skončí „Plánovač není nastavený“ se stavem success, takže výpadek v Actions není vidět. Cron `*/10` GitHub reálně spouští jen 2–4× denně (35 běhů celkem). Jako náhrada desetiminutového plánovače nestačí. Minimální oprava: po nastavení K1 ověřit v logu „HTTP 200“; v kroku při chybějící konfiguraci vypsat `::warning::`, aby byl výpadek vidět v přehledu Actions; v textech nespoléhat na 10min interval. | vysoká (provoz) |
| K9 | Neon projekt `neon-zbz-vzdelavani-demo`: větev `main` je produkční větev Vercelu, dále `overeni-ucast-0016-0018` a `zaloha-pred-0015-2026-11-19`. Testovací větev pro bod 2 se proto musí zakládat jako *schema-only* (bez dat produkce), ne kopie `main`. Nic se nezakládalo. | info |
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

## Vizuální ověření (lokální build, fiktivní seed)

Playwright 1.63: Chromium, Firefox 155, WebKit. Každý prohlížeč 10 šířek (320, 360, 390, 430, 768, 1024, 1280,
1440, 1920, 3440) × role správce, účastník, host, celé stránky (110 snímků na roli a prohlížeč). Automatické
kontroly `scripts/vizualni-sada.mjs` (vodorovný posun, přetékající prvky, uříznutý text, chyby konzole) a ruční
prohlídka koláží 320, 768/1024 a 3440 px. WebKit jede přes TLS proxy (Secure cookie).

| # | Nález | Stav | Závažnost |
|---|---|---|---|
| V1 | `/vzdelavani/ucast` (Podle akcí), správce, 768 a 1024 px: tabulka 8 sloupců je širší než karta, sloupec Kalendář („Problémy: N“) leží za okrajem karty a stránka se posouvá vodorovně o 18 / 26 px. Reprodukce: viewport 1024×768, přihlásit správce, otevřít Účast. Příčina: `.table-stack` se skládá pod sebe jen do 480 px (`globals.css` ~4250) a tabulka nemá vodorovně posuvný obal. Minimální oprava: obalit tabulky v `ucast/page.tsx` do `<div class="table-scroll">` s `overflow-x: auto` (nebo posunout hranici skládání na ~1100 px jen pro tuto tabulku). | ověřeno ve všech 3 prohlížečích, stejné hodnoty | střední |
| – | Jiné nálezy: žádné. Všechny tři prohlížeče hlásí shodně jen V1 (4 řádky `nalezy.txt`). | ověřeno | – |
| – | Falešné kandidáty vyřazené ze skriptu: ikonová tlačítka ⋯ „Možnosti akce/účtu“ (ikona 16 px leží celá uvnitř 36px tlačítka, `scrollWidth` navyšuje jen rámeček, ověřeno na výřezu), `visually-hidden` label přepínače rolí, zavřené `<details>` filtru, očekávaná 404 na `/neexistuje`. | ověřeno | – |
| – | Na 3440 px má obsah na všech stránkách stejnou šířku (`main` 1236 px, změřeno), rozdíl v koláži byl jen měřítkem. | ověřeno | – |

## Návrh udržitelné vizuální regrese (k odsouhlasení, nic nezavedeno)

1. **Geometrické testy místo pixelů tam, kde jde o rozložení.** Repo už má `expectNoHorizontalScroll`
   a `lineCount` (`e2e/support`, `geometrie.spec.ts`). Pro V1 stačí test „Účast na 768 a 1024 px bez
   vodorovného posunu“; je stabilní napříč prohlížeči a fonty a nepotřebuje referenční obrázky.
2. **Malá sada `toHaveScreenshot`** jen pro 4–5 stránek s nejvyšším rizikem (Plán mřížka, Plán seznam, okno
   akce, Účast, Úvod) × 3 šířky (390, 1024, 1440), role správce. Pevný seed a výchozí demo hodiny (bez
   `DEMO_CLOCK=real`), `animations: 'disabled'`, `maskColor` na relativní časy, `maxDiffPixelRatio` ~0,01.
   Referenční snímky generovat a porovnávat jen v CI kontejneru (Linux Chromium), jinak se liší fonty.
3. **CI:** jen Chromium, samostatný projekt `vizualni` mimo `@smoke`, spouštět u PR měnících `src/**/*.css`
   nebo komponenty. Aktualizace referencí jen vědomě (`--update-snapshots`) v samostatném commitu s náhledy.
4. **WebKit a Firefox ručně před releasem:** `scripts/vizualni-sada.mjs` (několik minut na prohlížeč) a porovnat
   `nalezy.txt` s posledním během; prohlížet jen nové kandidáty a koláže.

## Souhrn stavu

- **Ověřeno:** konfigurace Vercelu a Neonu (K1–K9, jen názvy a cíle), běh GitHub plánovače (K8), vizuální sada
  ve 3 prohlížečích (V1), existující e2e sada nad buildem (předchozí relace, HEAD PR #97 `e3c92b3`).
- **Simulováno:** Kalendář a přihlášení v e2e a v preview běží v `CALENDAR_MODE=simulation` / demo režimu
  s fiktivními účty; chování proti skutečnému Google API tím ověřené není.
- **Předpoklad:** postup izolovaného testu (alias testovací větve, schema-only větev Neon, redirect URI) vychází
  z dokumentace a konfigurace, prakticky nevyzkoušený. Oprava V1 je navržená, ne napsaná.
- **Neověřeno:** všechny živé scénáře proti Google Kalendáři, OAuth přihlášení, plánovač fronty v produkci
  (dnes podle K1 odmítá volání). Vyžaduje schválení vlastníka a tajemství (viz Navržený postup).
