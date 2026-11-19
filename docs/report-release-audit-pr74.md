# Release audit PR #74 (fáze A)

Větev `claude/finalni-kontrola-novy-pr-g2r2wd`, draft PR #74 do `main`. Stav k 19. 11. 2026 (relace 13–14).
Fáze B (zpětná vazba „brouček“) není součástí tohoto PR a přijde v novém PR po merge.

## 1. Co bylo ověřeno

| Oblast | Prostředí | Výsledek | Stav |
|---|---|---|---|
| Lint, typová kontrola | lokálně | `eslint .`, `tsc --noEmit` bez chyb | ověřeno |
| Unit testy | Vitest | 44 souborů, 421 testů, 0 selhání (včetně nového `tests/csp.test.ts`) | ověřeno |
| Produkční build | `next build` | viz bod 6 | ověřeno |
| Celé e2e Chromium (výchozí projekty 320–1920, Windows/macOS UA) | Playwright Chromium | viz bod 6 | ověřeno |
| Chromium 768 a 1024 | Playwright Chromium | 7d124c3: 402 passed / 50 skipped / 0 failed; po změnách testů znovu v běhu níže, 0 selhání | ověřeno |
| Firefox 1280 a telefon 390 (úzké okno s dotykem) | Playwright Firefox 1543 | celé e2e: 0 selhání | ověřeno |
| WebKit 1440 Retina, iPhone 13 (390), iPhone SE (320) | Playwright WebKit 2359 přes HTTPS | první běh 16 selhání, všechna jsou rozdíly prohlížeče v testech (bod 2). Po úpravě testů opakovány dotčené soubory: 45 passed / 22 skipped / 0 failed | ověřeno (Playwright WebKit) |
| Skutečný Safari na macOS a iPhonu, skutečný Android | zařízení | nespuštěno | **neověřeno** |
| Produkční DB | Neon `zbc-wiki-produkce` | jen SELECT: schéma 0001–0014, data pro 0015 sedí (bod 4) | ověřeno |
| Preview DB | Neon (Preview) | 0015 aplikována, aplikace s ní běží | ověřeno |

Souhrnný běh projektů WebKit, Firefox a Chromium 768/1024 (`E2E_WEBKIT=1`, 1318 testů):
1169 passed / 133 skipped / 16 failed. Všech 16 selhání bylo jen ve WebKitu a týkalo se tří testových příčin
z bodu 2. Po opravě testů prošly všechny dotčené soubory ve všech třech projektech WebKit.

Přeskočené testy jsou záměrné: klávesnice a axe jen na počítači, zapisující testy jen v jednom projektu, dotyk
přes CDP jen v Chromiu.

## 2. Nálezy z prohlížečů a jejich zařazení

| # | Nález | Příčina | Zařazení | Řešení |
|---|---|---|---|---|
| 1 | WebKit a Firefox: stránka se na `http://localhost` nenačte (TLS handshake) | CSP `upgrade-insecure-requests` povýší localhost na https. Chromium localhost vyjímá, ostatní ne | jen testovací prostředí, produkce běží na https | `CSP_UPGRADE_INSECURE=0` nastavuje jen `e2e/server.mjs`. Produkce a Preview direktivu mají dál, hlídá to `tests/csp.test.ts` (bba0adb) |
| 2 | WebKit: přihlášený uživatel vidí vstupní bránu | WebKit na `http://localhost` neposílá cookie `Secure` (`__Host-zbc_session`) | jen testovací prostředí | WebKit projekty jdou přes lokální HTTPS proxy s jednorázovým certifikátem, aplikace i cookie beze změny (06cbf23) |
| 3 | WebKit: `pageerror … _rsc=… due to access control checks.` | WebKit hlásí prefetch Next.js, který přeruší další `page.goto`, jako nezachycenou chybu. Funkční kontroly testů prošly | rozdíl prohlížeče, P2: ověřit konzoli na skutečném Safari | filtr jen pro WebKit, jen `_rsc=` a jen tuto hlášku (`e2e/support.ts`, 5ecbcc6) |
| 4 | WebKit: testy tažení prstem (`Plán na telefonu: přesun úchytem`) | dotyk posílá CDP, který má jen Chromium | omezení nástroje | ve WebKitu přeskočeno, na iPhonu **neověřeno** (5ecbcc6) |
| 5 | WebKit: `page.goto` přerušilo jiné navigování (Témata, předvyplněné téma) | po Esc se adresa upravuje klientsky, test šel dál dřív | závod v testu | test čeká na adresu bez `akce=` (5ecbcc6) |

Chyba aplikace (P0 ani P1) se v žádném prohlížeči nenašla. Cílená kontrola CSS: `:has()` (Safari 15.4+,
Firefox 121+), `100dvh` vždy s fallbackem `100vh`, `field-sizing` s fallbackem `rows` (Firefox ho nemá),
sticky, `safe-area`, nativní pole data a času a vrstvení dialogů (`showModal`) prošly e2e ve všech třech jádrech.

## 3. Bezpečnost a oprávnění

* Globální pohled (`preview-context.ts`, `nahled-actions.ts`): cookie `zbc_nahled` je vázaná na účet, ověřuje se při
  každém požadavku, `startPreview` vyžaduje správce, návrat jen na cestu Wiki. Podvržená cookie účastníka nic
  nemění (e2e `nahled.spec.ts` ve všech jádrech).
* CSP v produkci beze změny, výjimka pro e2e jen přes proměnnou, kterou nastavuje testovací server.
* Žádná tajemství v diffu, CI kontrola citlivých cest zelená.

## 4. Migrace 0015 (`0015_topic_priority_unlimited`)

Co dělá: zruší CHECK `topics_priority_rank_check` (1–3), změní `priority_rank` ze `smallint` na `integer` a přidá
`topics_priority_rank_positive CHECK (priority_rank >= 1)`. Unikátní index `topics_priority_rank_unique` se nemění,
nic se nemaže ani nepřepisuje. Starší kód s novým schématem funguje dál.

Stav produkce (jen SELECT, relace 13): migrace 0001–0014, CHECK je přesně `((priority_rank >= 1) AND
(priority_rank <= 3))`, sloupec `smallint`, 15 témat, 3 garantovaná, max pořadí 3. Kontrola na začátku 0015 tedy projde.

Schvalování: 0015 má `approval: true`. Bez `APPROVED_MIGRATIONS=0015_topic_priority_unlimited` se na ostré DB
nespustí (log `[db] migrace … čeká na schválení`). Proměnná je teď jen pro Preview a větev PR #74, Production ji nemá.
Do schválení aplikace v produkci běží dál a u pokusu o 4. garantované téma vrátí srozumitelnou chybu
`priority_pending_migration`. **Merge PR tedy produkční DB nemění.**

Riziko: když kontrola na začátku 0015 selže (`RAISE`), shodí transakci `prepareDatabase` a aplikace nenastartuje.
Data zůstanou beze změny, náprava = smazat proměnnou a redeploy.

### Postup nasazení

1. Merge PR #74 do `main` (ručně uživatel). Vercel nasadí kód, 0015 čeká na schválení.
2. Ověřit produkci: přihlášení, Plán, Témata (3 garantovaná), log bez chyb kromě „čeká na schválení“.
3. Záloha: v Neonu vytvořit větev z produkce (např. `pred-0015`). PITR (6 h) je záloha navíc.
4. Ve Vercelu přidat pro **Production** `APPROVED_MIGRATIONS=0015_topic_priority_unlimited` a udělat redeploy.
5. Ověřit (jen čtení): `SELECT id FROM schema_migrations WHERE id LIKE '0015%'` vrátí řádek; `SELECT conname,
   pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'topics'::regclass AND contype = 'c'` ukáže
   `topics_priority_rank_positive`; v UI jde nastavit 4. garantované téma.

### Rollback

* Aplikace nenastartuje po kroku 4: smazat `APPROVED_MIGRATIONS` v Production a redeploy (transakce se vrátila, DB beze změny).
* Vrácení kódu: Vercel „Instant Rollback“ na předchozí produkční nasazení. Starý kód s novým schématem funguje,
  pokud jsou garantovaná pořadí jen 1–3.
* Vrácení schématu (jen když `SELECT max(priority_rank) FROM topics` ≤ 3):
  `ALTER TABLE topics DROP CONSTRAINT topics_priority_rank_positive;`
  `ALTER TABLE topics ADD CONSTRAINT topics_priority_rank_check CHECK (priority_rank BETWEEN 1 AND 3);`
  `DELETE FROM schema_migrations WHERE id = '0015_topic_priority_unlimited';` a smazat proměnnou, jinak se 0015
  při dalším startu spustí znovu. Typ `integer` může zůstat.
* Když už existují pořadí nad 3: buď je nejdřív v UI zrušit, nebo obnovit z Neon větve `pred-0015` (ztratí změny
  po záloze).

## 5. Go/No-Go

| Priorita | Položka | Stav | Verdikt |
|---|---|---|---|
| P0 | Funkční chyby (Připravit měsíc, garantovaná témata, přetažení témat) | opraveno v PR, e2e ve třech jádrech zelené | Go |
| P0 | Oprávnění a únik dat (pohled, RSC, e-maily) | e2e a unit zelené | Go |
| P0 | Bezpečná migrace | merge DB nemění, 0015 jen po schválení, postup a rollback popsané | Go |
| P1 | Vzhled a ovládání 320–1920 px, Chromium, Firefox, WebKit | e2e zelené | Go |
| P1 | CI na posledním commitu | viz popis PR | Go, pokud je zelené |
| P2 | Skutečné zařízení (Safari macOS, iPhone, Android), dotyk prstem v Safari | neověřeno | nebrání merge, ručně na Preview |
| P2 | Hláška WebKitu u přerušeného prefetchu | jen konzole, bez dopadu | sledovat |

**Doporučení: PR #74 převést z Draft na Ready a mergnout ručně.** Migraci 0015 na produkci spustit až po merge
podle bodu 4.

## 6. Výsledky finálního ověření (relace 14)

Doplněno níže po doběhu.
