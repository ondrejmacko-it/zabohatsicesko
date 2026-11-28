# Ověření PR #97 před mergem

Stav 28. 11. 2026, větev `claude/oprava-kalendare-a-prehled-ucasti` (= `claude/gallant-knuth-ydgzxz`).
Produkce, produkční proměnné, Neon `main` ani skutečné kalendáře se neměnily. Hodnoty tajemství se nečetly,
u šifrovaných proměnných je známý jen název a cíl. Seznam všech proměnných: `docs/promenne-prostredi.md`.

## 1. Implementováno a ověřeno živě

Živě znamená proti skutečné službě, ne simulaci.

- **Plánovač GitHub Actions (K1/K8):** v logu běhu 46148649291 ověřeno, že bez `WIKI_URL`
  a `CALENDAR_WORKER_TOKEN` krok dřív skončil úspěchem. Po opravě 739187b chybějící konfigurace běh shodí,
  záměrné vypnutí jde jen přes `CALENDAR_QUEUE_SCHEDULER=off` (viditelné varování).
- **Konfigurace Vercelu a Neonu (K1–K9, jen čtení přes API):** viz kapitola 5 a 7.
- **Google Kalendář a přihlášení Googlem: nic živě neověřeno.** Chybí testovací účty a izolované prostředí
  (kapitola 6).

## 2. Implementováno a ověřeno automatickými testy

Lokálně nad HEAD relace 107 (`a53c972`, bez změny kódu aplikace po něm):

| Sada | Výsledek |
|---|---|
| ESLint, `tsc --noEmit` | 0 chyb |
| Vitest (unit + integrační nad PGlite) | 668 / 668 |
| `next build` | OK |
| Playwright, plné `npm run e2e` (Chromium, Firefox, WebKit, telefon, tablet, zápisy) | 1660 passed, 745 skipped (záměrně jen v jednom projektu), 0 failed, 14,8 min |

CI PR #97 (běh 46163734788): lint, typy, testy, build, audit závislostí, citlivé cesty a smoke E2E zelené.
Vizuální regrese: viz kapitola 5, bod R1.

Pokryté oblasti:
- **Účast (V1, c5db69d):** tabulka na 768 a 1024 px v posuvném obalu, bez vodorovného posunu stránky,
  regresní test ve třech prohlížečích.
- **Témata (ffcca12):** výchozí filtr „Všechna“ pro všechny role, „Pro mou roli“ jako volba.
- **Mobilní navigace:** černé menu na telefonu je mřížka 3 položek (4 se Správou), stejná šířka a výška,
  dotyková plocha ≥ 40 px, žádná osamocená položka na 12 šířkách 320–900 px (`e2e/menu-telefon.spec.ts`).
  Účet, Google Kalendář a Odhlásit jsou v menu Účet, na telefonu jako okno (`e2e/menu-ucet.spec.ts`).
  Hamburger se nezaváděl: při 3–4 položkách by přidal klepnutí navíc a skryl hlavní odkazy, což je proti
  dřívějšímu zadání mřížky. Všechny funkce zůstávají dostupné, styl a barvy Wiki beze změny.
- **Oprávnění a přímá volání API (relace 105):** účast, omluvy, role, detail účasti a historie člověka
  podle rozsahu (správce, určený nadřízený, člen); server odmítá volání mimo oprávnění.
- **Osobní kalendář, logika synchronizace:** fronta, opakování, idempotence, úklid při odpojení, čtení
  událostí se stránkováním a chybami 404/503 (`tests/kalendar-osobni-cteni.test.ts`).
- **Vizuální regrese (aa63cb7):** 5 stránek × 390/1024/1440 px, `toHaveScreenshot` v CI.

## 3. Ověřeno pouze simulací

- Celý tok Google Kalendáře v e2e a preview (`CALENDAR_MODE=simulation`): přihlášení/odhlášení, omluva
  a její zrušení, změny akce, zrušení akce, více účastníků. Chování skutečného Google API (latence, rate limit,
  odvolaný token, časová pásma na straně Googlu) tím ověřené není.
- Přihlášení Googlem (demo režim s fiktivními účty).
- Make (zpětná vazba) – v testech vypnutý webhook, živě nevoláno.

## 4. Opravené chyby

| Commit | Chyba |
|---|---|
| c5db69d | V1: tabulka Účasti na 768/1024 px přetékala kartu, stránka se posouvala o 18/26 px. |
| ffcca12 | Témata otevírala filtr „Pro mou roli“ místo „Všechna“. |
| 739187b | GitHub plánovač při chybějící konfiguraci hlásil úspěch, výpadek nebyl vidět (K8). |
| aa63cb7, 55acd35 | Chyběla trvalá vizuální regrese; workflow `vizualni-reference.yml` generuje reference na runneru CI. |

## 5. Zbývající chyby a rizika

| # | Nález | Závažnost |
|---|---|---|
| K1 | Production nemá `CRON_SECRET` ani `CALENDAR_WORKER_TOKEN`: `/api/kalendar/fronta` odmítá každé volání (401). Záložní plánovače v produkci dnes nic nezpracují; běžná synchronizace stojí jen na okamžitém `after()` po akci. | vysoká (provoz) |
| K8 | GitHub cron `*/10` reálně běží 2–4× denně. Je to jen záloha; spoléhá se na `after()` + Vercel cron 5:17. Oba plánovače ponechány: jsou nezávislé a fronta je idempotentní, souběh neškodí. | střední |
| K2 | Preview PR #97 má `PARTICIPATION` vypnuté (proměnná jen pro starou větev), změny v něm nejde proklikat. | střední (test) |
| K6 | `FEEDBACK_WEBHOOK_URL` (Make) je i v Preview; testovací větev ho musí přepsat prázdnou hodnotou. | střední (izolace) |
| R1 | Vizuální regrese v CI: reference z cloudového kontejneru se liší fonty od ubuntu-latest (~1 % pixelů na každém snímku, 15/15 FAIL). Nejde o regresi UI. Řeší workflow `vizualni-reference.yml` (stav viz popis PR). | nízká |
| R2 | Skript `scripts/overeni-kalendare-google.ts` (porovnání Wiki ↔ Google API, měření latence) je napsaný a typově ověřený, ale nikdy neběžel proti Googlu. | střední |

## 6. Blokované testy

Všechny scénáře bodu 5 zadání, protože chybí testovací účty Google a izolované prostředí:
přihlášení Googlem; připojení osobního kalendáře; zveřejnění akce; přihlášení → událost v kalendáři;
odhlášení, omluva → odstranění; zrušení omluvy → obnovení; povinná/dobrovolná účast; změna role a povinnosti;
změna názvu, času, data, místa, popisu, odkazu; zrušení a opětovné zveřejnění; více účastníků; opakované akce;
opakování stejné operace, rychlé změny, souběh více uživatelů; odpojení a znovupřipojení; vypršení a odvolání
OAuth; nedostupnost Google API, rate limiting, opakování a fronta po výpadku; duplicity; časové pásmo
a přechod letního času; izolace mezi uživateli; latence Wiki → Google; pravdivost stavů „ve frontě/selhalo“.

Připraveno: postup níže a skript R2 (`--sledovat=N` měří dobu do souladu kalendáře s Wiki přímo přes API).

## 7. Potřebná rozhodnutí nebo přístupy od vlastníka

Izolovaný test je schválený. Claude po dodání nastaví nesecretní proměnné a provede scénáře.

1. **3 testovací Google účty** (1 správce, 2 členové), ne firemní, přidané jako testovací uživatelé
   souhlasové obrazovky.
2. **Samostatný testovací OAuth klient** (Google Cloud) s redirect URI
   `<alias>/api/google/prihlaseni/callback` a `<alias>/api/google/kalendar/callback`, kde alias je
   `zbc-vzdelavani-demo-git-test-zive-overeni-kalendare-maci.vercel.app`. Produkční klient beze změny.
3. **Neon:** souhlas se založením větve *schema-only* (bez dat) v `neon-zbz-vzdelavani-demo`; `main` se nemění.
4. **Vercel, Preview omezené na větev `test/zive-overeni-kalendare`** – tajemství zadá vlastník:
   `DATABASE_URL` (testovací větev Neon), `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `CALENDAR_WORKER_TOKEN`
   (≥ 32 znaků), `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET` testovacího klienta, `BOOTSTRAP_ADMIN_EMAILS`,
   `GOOGLE_ALLOWED_ATTENDEES`. Nesecretní nastaví Claude: `WIKI_MODE=production`, `LOGIN_MODE=google-test`,
   `CALENDAR_MODE=google-test`, `CALENDAR_DELIVERY=personal`, `CALENDAR_ATTENDEES=allowlist`,
   `PARTICIPATION=on`, `APP_URL=<alias>`, `APPROVED_MIGRATIONS`, `FEEDBACK_WEBHOOK_URL=` (prázdné).
5. **Ochrana nasazení:** bypass secret pro automatizaci (Playwright a volání endpointu fronty na preview).
6. **Produkce (až po živém testu, samostatné rozhodnutí):** `CRON_SECRET` v Production (K1), pro GitHub
   plánovač secret `CALENDAR_WORKER_TOKEN` a proměnnou `WIKI_URL`.
7. **Proxy prostředí Claude:** povolit host blob storage GitHubu (artefakty CI, např. snímky rozdílů).
8. **Make:** testovací scénář/webhook, pokud se má ověřit i živě.

Po testu: smazat proměnné větve, větev Neon, testovací větev v Gitu a události v testovacích kalendářích.

## 8. Připravenost na produkční nasazení

**Není připraveno na ostrý provoz.** Kód je ověřen automatickými testy a simulací, ale integrace s Google
Kalendářem a přihlášení Googlem nebyly ani jednou ověřeny živě a produkční záložní plánovač je bez
`CRON_SECRET` nefunkční (K1). Podmínky: provést blokované scénáře kapitoly 6 v izolovaném prostředí, nastavit
K1, zelené CI včetně vizuální regrese, poté ruční merge vlastníkem přes PR.
