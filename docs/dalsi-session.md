# FINÁLNÍ DOKONČENÍ PR #75 – RELACE 19 → 20 (20. 11. 2026) – začni tímto

Zadání beze změny (oddíly níže + úvodní zpráva). Relace 19 skončila na hooku kontextu (200 tis.). Šetři, nečti celé soubory.

* HOTOVO v relaci 19 (commity 7f5c9f5, 4e2e8f8; typecheck, eslint, unit `tests/zpetna-vazba.test.ts` 19/19 OK):
  - Krok 1 CSS: `.mark-toolbar` ≤ 760 px přes celou šířku dole, `.mark-toolbar-top` nahoře, `.mark-toolbar-flip` jen
    ≤ 760 px, `user-select: none` na vrstvě. Okno `.dialog` a pole 16 px na dotyku už splňovaly (beze změny).
  - Krok 2: `lib/feedback.ts` `FEEDBACK_ELEMENT_KINDS`/`FEEDBACK_ELEMENT_PLACES`/`FEEDBACK_SELECTOR_PATTERN`,
    `feedbackMarkIsStructural`; server `.refine` na každé značce; `page-context.ts` typovaný na tyto seznamy.
  - Krok 3: `FEEDBACK_SHOT_PAGES` (/, harmonogram, témata), `src/server/feedback-grant.ts` (HMAC `feedback-shot:`,
    token `stránka|exp|podpis`, 12 h), `src/components/feedback/ShotGrant.tsx` ve 3 stránkách; klient čte
    `[data-feedback-shot-grant]` při otevření okna, grant uloží se snímkem, FormData `screenshotGrant`; server
    `deps.grantSecret` = `config.sessionSecret`; `screenshotAllowed` odstraněn. Úvod: jméno v h1 `data-feedback-redact`.
  - Krok 4: `readScreenshotSize` (VP8/VP8L/VP8X, JPEG SOF) musí = deklarovaným; `FEEDBACK_SCREENSHOT_MAX_SIDE` 2000.
  - Krok 5: TimeoutError → `uncertain` (klíč zůstává), nová hláška v `FEEDBACK_ERROR_MESSAGE`. Unit test + souběh.
  - Krok 6: `screenshot.ts` značky posunuté o scroll, číslo uvnitř u horního okraje, DPR ≤ 2 a ≤ 2000 px, plné
    vykreslení omezené na 16 Mpx / 16 000 px (Safari), zmenšení ×0.75 až 3×, uvolnění canvasů.
  - Krok 7: e2e – nové testy (citlivá fixture + pixely, dlouhá stránka, jméno na Úvodu, podvržený grant, dvojklik
    s `SIMULOVAT-POMALU`, `SIMULOVAT-TIMEOUT`, Escape + Skrýt broučka, telefon viditelnost a celý průchod).
    `e2e/server.mjs` umí POMALU (3 s) a TIMEOUT (11 s, hlášení uloží).
    Běh windows-1280 + telefon-390 PŘED posledními opravami: 19 OK, 3 FAIL – opraveno v 4e2e8f8 (inline onsubmit
    ve fixture → CSP chyba; očekávaný popis karty = „Karta v harmonogramu“; „Skrýt broučka“ je jen v kroku 1).
    Po opravě NEspuštěno.
* DALŠÍ KROKY:
  1) `fuser -k 3310/tcp 3311/tcp 3312/tcp 3410/tcp`; `npx playwright test e2e/zpetna-vazba.spec.ts --project=windows-1280
     --project=telefon-390 --project=telefon-320 --trace off`; opravit, co padá (jen objektivní vady).
  2) Lint, typecheck, `npm test`, build, celé e2e na pozadí; WebKit/Firefox (E2E_WEBKIT=1), co nejde = „neověřeno“.
  3) Vizuální snímky (scale 1, scratchpad), `docs/zpetna-vazba.md` (grant, pozitivní seznam, uncertain, rozměry, mez
     obsahu obrázku, server action limit 4200kb je stávající), `docs/report-pr75.md` (A–F), popis PR #75, Vercel
     `get_project zbc-vzdelavani-demo` (team_PtkXmFd9hI7UeUYovGkbwZQG), zpráva uživateli.
* Otevřené: na povolených stránkách se text karet harmonogramu ve snímku nepřetírá (fiktivní ukázková data, stránky
  ověřené) – uvést v reportu; UI po `uncertain` nechává tlačítko Odeslat (druhý pokus vrátí „už bylo odesláno“).

# FINÁLNÍ DOKONČENÍ PR #75 – RELACE 18 → 19 (20. 11. 2026) – začni tímto

Zadání beze změny (oddíl „NOVÝ ÚKOL“ níže + úvodní zpráva relace). `add_repo` Novi znovu zamítl klasifikátor →
mobil podle popisu v oddílu níže, ne podle zdrojáku. Relace 18 skončila kvůli hooku kontextu (201 tis. hned po čtení).
Šetři: nečti znovu celé soubory, které jsou popsané tady.

* HOTOVO (commit 86afe20, typecheck + eslint + unit `tests/zpetna-vazba.test.ts` 15/15 OK, e2e NEspuštěno):
  - `page-context.ts` přepsán: popis = druh (`KINDS`) + místo (`PLACES`: „v okně / v nabídce / v tabulce /
    ve formuláři / v menu / v záhlaví“), karta `table a[href^='/vzdelavani/akce/']` = „Karta v harmonogramu“.
    Selektor jen tagy + `:nth-of-type`, max 8 úrovní. Žádný text, aria-label, title, id, třídy, data-*.
    `FEEDBACK_RECT_LABEL = "Označená oblast"` v `lib/feedback.ts`.
  - `bug-dock.ts`: `placeBug(dock, width, viewport, obstacles, { touch, insets })`, `BUG_SIZE_TOUCH` 48, okraj 12.
  - `BugButton.tsx`: bez omezení na desktop; `TOUCH_QUERY = "(max-width: 900px), (pointer: coarse)"`
    (useSyncExternalStore), podržení 400 ms + vibrate, švihnutí > 10 px nic, `onContextMenu` prevent, překážky
    + `.quick-actions`, safe-area přes pomocný prvek `measureInsets()`. CSS `.bug-dock-touch` 48 px, user-select none.
  - `MarkingLayer.tsx`: `ClientMark` (= FeedbackMark + `scroll`), `toFeedbackMark`, Menší/Větší (state `picked`),
    „Panel nahoru/dolů“ (`.mark-toolbar-top` – CSS ZATÍM CHYBÍ), preventDefault na pointerdown.
  - `FeedbackRoot.tsx`: zavření během odesílání jen schová (`sendingRef`), „sent“ zůstane po znovuotevření,
    změna typu nemaže `expected`.
  - CSS ≤ 900 px: `.sidebar` flex-wrap, `.sidebar-feedback` viditelná na telefonu. Sidebar komentář upraven.
* DALŠÍ KROKY (pořadí):
  1) CSS: `.mark-toolbar` na ≤ 760 px přes celou šířku dole (left/right 0, bottom safe-area), `.mark-toolbar-top`
     nahoře; `.mark-toolbar-flip` jen ≤ 760 px; `.mark-surface { user-select: none }`; okno na telefonu: šířka
     `calc(100vw - 1.75rem)`, max výška `calc(100dvh - 1.75rem)`, posuvné, textarea font-size ≥ 16 px (ověř `.dialog`).
  2) Server: validace `marks[].description` jen z povolených řetězců (KINDS × PLACES + rect) a `selector` regex
     `^[a-z][a-z0-9-]*(:nth-of-type\(\d+\))?( > [a-z][a-z0-9-]*(:nth-of-type\(\d+\))?)*$` → přesunout seznamy
     labelů do `lib/feedback.ts`, ať je sdílí klient i server. Unit test.
  3) Snímek – POZITIVNÍ seznam + autorizace nezávislá na `context.path` (navrženo, neimplementováno):
     server komponenta `ShotGrant` (renderuje `<span hidden data-feedback-shot-grant={token}>`) jen na ověřených
     stránkách: `/`, `/vzdelavani/harmonogram`, `/vzdelavani/temata` (Zápisy, detail akce, Správa, Integrace,
     Přehled, Moje cesta NE). Token = `${page}.${exp}.${HMAC(config.sessionSecret, "feedback-shot:"+userId+":"+page+":"+exp)}`
     (vzor `src/server/auth/gate.ts`), platnost 12 h. Klient: snímek nabídne jen když grant v DOM existuje, grant uloží
     se snímkem; draft `screenshot.grant`. Server ověří podpis, uživatele, expiraci a page ∈ seznam; odstraní refine
     `screenshotAllowed(context.path)` a `screenshotAllowed` vůbec; do payloadu Make grant NEposílat (tvar beze změny).
     Poctivě do docs: obsah obrázku server ověřit nemůže, token jen dokládá, že uživatel měl otevřenou povolenou stránku.
  4) Server: skutečné rozměry obrázku z hlavičky (JPEG SOF0–SOF15 mimo C4/C8/CC; WebP `VP8 ` LE16 na 26/28 & 0x3fff,
     `VP8L` bity od 21, `VP8X` 1+LE24 na 24/27) musí = deklarovaným, max 2000×2000; nečitelná hlavička = invalid.
  5) Timeout po přijetí (prokázaná chyba: retry po timeoutu = duplicita v Make): u `TimeoutError` klíč
     `feedback-once` NEuvolňovat a vrátit nový důvod `uncertain` („Odpověď se nepodařilo ověřit, hlášení nejspíš dorazilo,
     znovu ho neposíláme. Text zůstává v okně.“); u HTTP chyby a chyby spojení uvolnit jako dnes. Unit test s mock fetch.
  6) `screenshot.ts`: značky posunout o (mark.scroll − aktuální scroll), číslo uvnitř když y < 22, DPR škálování
     (min(DPR,2), delší strana ≤ 2000), při > 500 kB snižovat kvalitu a pak rozměr ×0.75 (max 3×), uvolnit
     `full.width = full.height = 0`. Výkon: změřit čas a velikost plného canvasu na harmonogramu (dlouhá stránka);
     přepnout na výřez jen při prokázaném problému.
  7) E2E `e2e/zpetna-vazba.spec.ts`: nahradit test „na telefonu není brouček“ → mobil (390/320) otevře broučka
     i položku v menu, vyplní, Zpět/Pokračovat, Zavřít s potvrzením, odešle (odeslání jen v projektech SENDING).
     Test označení: popisy teď „Nadpis stránky“ / „Označená oblast“ (dnes čeká „nadpis“ / „vyznačená oblast“).
     Nový test: fixture fiktivních citlivých řetězců vložená `page.evaluate` (karta, tabulka, dynamický h2, tlačítko
     s aria-label, input s hodnotou, vnořený span) → označit → odeslat → JSON z `/hlaseni` je nesmí obsahovat.
     Snímek: pixelová kontrola redakce (fixture `[data-feedback-redact]` s barevným pozadím → v PNG/WebP z base64
     dekódovat v prohlížeči přes canvas a ověřit, že oblast má barvu přetření #4a4642). Podvržená cesta/grant → invalid.
     Před e2e `fuser -k 3310/tcp 3311/tcp 3312/tcp 3410/tcp`.
  8) Lint, typecheck, `npm test`, build, celé e2e na pozadí; WebKit/Firefox dle relace 14 (co nejde = „neověřeno“).
  9) Vizuální snímky (scale 1, do scratchpadu), docs `docs/zpetna-vazba.md`, `docs/report-pr75.md` (A–F),
     popis PR #75, Vercel `get_project zbc-vzdelavani-demo` (team_PtkXmFd9hI7UeUYovGkbwZQG), zpráva uživateli.
* Inventura nálezů (pro report A): potvrzené – únik textu v popisech (opraveno 86afe20), mobil bez broučka
  (opraveno), snímek podle klientské cesty (krok 3), rozměry obrázku neověřené (krok 4), retry po timeoutu
  duplicita (krok 5), znovuotevření po úspěchu při skrytém okně vracelo starý koncept do kroku 1 → druhé odeslání
  = „duplicate“ (opraveno), změna typu mazala „Co by mělo fungovat jinak“ (opraveno), Zahodit během odesílání
  (opraveno). Potřebuje reprodukci: značky po rolování po označení (krok 6), výkon dlouhé stránky (krok 6).

# NOVÝ ÚKOL – FINÁLNÍ DOKONČENÍ PR #75 (relace 18 →, 20. 11. 2026) – začni tímto

Uživatel zadal „ZBČ – FINÁLNÍ DOKONČENÍ PR #75“ (plné znění v úvodní zprávě navazující relace). Upřesnění uživatele:
* **Make.com zůstává, jak je** – oddíly 7 (doručování, idempotence, autentizace Make) a 15 (předávka Make) se NEdělají.
  Scénář 8694292, webhook ani `x-zbc-feedback-secret` neměnit. Serverové limity velikosti (7/5) a autorizaci snímku
  (5) ale ověřit, to je kód Wiki.
* **Telefon: brouček i na mobilu podle Novi** (uživatel schválil návrh relace 17), ne jen položka v menu:
  - zrušit `(min-width: 900px) and (pointer: fine)` (BugButton.tsx:9) a skrytí `.sidebar-feedback` ≤ 900 px;
  - 48 px, 12 px od okraje, uhýbá `.quick-actions` (≤ 760 px), `.move-panel`, safe-area;
  - klepnutí = otevřít; podržení 400 ms = přesun (+ `navigator.vibrate?.(15)`); posun > 10 px před tím = švihnutí, nic;
    `touch-action: none`, `-webkit-touch-callout: none`, `user-select: none`, přichycení k okraji;
  - MarkingLayer: klepnutí označí prvek, tažení prstem obdélník; panel přes celou šířku dole (přepínač nahoru),
    Menší / Větší (rodič / potomek), Odebrat, Zrušit vše, Hotovo;
  - snímek jen viditelný výřez (viewport), škálování podle DPR, snižování kvality a pak rozměru do 500 kB, značky dokreslit;
  - okno: střed, šířka `calc(100vw - 1.75rem)`, max výška `calc(100dvh - 1.75rem)`, posuvný obsah, pole ≥ 16 px.
  Vzor: repo `ondrejmacko-it/novi-ai-tutor-app` (jen čtení): `src/components/feedback/{bug-button,marking-layer,
  feedback-root}.tsx`, `src/feedback/{bug-dock,screenshot,page-context}.ts`, `src/components/shell/novi-modal.tsx`.
  Nepřebírat průvodce broučkem ani jméno/e-mail.
* Po dokončení uživatel mergne na main sám. Žádný merge, produkční deploy ani migrace.

Ověřit „připojené správně“: Vercel konektor vidí v týmu maci (team_PtkXmFd9hI7UeUYovGkbwZQG) jen `novi-ai-tutor-app`,
`zbc-vzdelavani-demo` → 404 i po `authorize_team_access`. Zkusit znovu `get_project`; když 404, napsat uživateli:
odpojit a znovu připojit Vercel v claude.ai → Settings → Connectors a při souhlasu zvolit tým maci + všechny projekty.
Pak ověřit `FEEDBACK_WEBHOOK_URL`/`FEEDBACK_WEBHOOK_SECRET` (jen názvy a cíle, nedešifrovat) a Preview deploy PR #75.

# Prompt pro další session

**FÁZE B BROUČEK – RELACE 16 HOTOVO (20. 11. 2026, větev `claude/funkce/zpetna-vazba-broucek`, draft PR #75).**
* Klient `src/components/feedback/` (BugButton, FeedbackRoot, MarkingLayer, page-context, screenshot), položka
  „Zpětná vazba“ v Sidebar (jen ≥ 900 px), ikona `bug`, styly v globals.css, `FeedbackRoot` v `(wiki)/layout.tsx`.
  Snímek: celý `<html>` (u `<body>` knihovna posune o 8 px), filtr dialog/noscript/`data-feedback-ui`, citlivé části
  skryté už v kopii, pole přetřená. Omezení: sticky menu se v kopii vykreslí na přirozeném místě (docs).
* Novi repo NEŠLO připojit (add_repo zamítl klasifikátor), klient je napsaný podle specifikace z relace 15.
* Testy: unit `tests/zpetna-vazba.test.ts` 15, e2e `e2e/zpetna-vazba.spec.ts` (falešný webhook 127.0.0.1:3312
  v `e2e/server.mjs`, odeslání jen ve windows-1280 / webkit-1440 / firefox-1280 kvůli limitu 10/h).
  Před e2e `fuser -k 3310/tcp 3311/tcp 3312/tcp 3410/tcp`. Ověřeno: lint, typy, unit 436/436, build, Chromium e2e 1235/139/0, WebKit cíleně 0 failed; Firefox neověřen (není nainstalovaný).
* Docs `docs/zpetna-vazba.md` (Make scénář, payload, mazání po 12 měsících), README, `.env.example`.
**Další krok:** nic bez pokynu. Uživatel: Make scénář + filtr hlavičky, env `FEEDBACK_WEBHOOK_URL/SECRET` ve Vercelu
(Preview), ruční zkouška na Preview, review a merge PR. Otevřené: report B7 (feedback widget) zatím jen v popisu PR.

**FÁZE B BROUČEK – RELACE 15 → 16 (20. 11. 2026, větev `claude/funkce/zpetna-vazba-broucek` z main 4699a60).**
Zadání: user zpráva „ZBČ: finální release audit + integrace zpětné vazby z Novi“ (session
`session_01HpUirygb1N8XmnorbnJSA8`, `list_events` kinds `["user"]`, stránka PŘED nejnovější, hledej „FÁZE B“), body B1–B7.
Rozhodnutí uživatele (relace 15): doručení = **webhook Make.com** (ne DB); snímek = **`modern-screenshot` 4.7.0** jako Novi.
Zdroj: `add_repo` ondrejmacko-it/novi-ai-tutor-app (read), klon `/home/user/novi-ai-tutor-app`; prostudováno:
`src/feedback/{bug-dock,model,submit,actions,page-context,screenshot}.ts`, `src/components/feedback/*`, `docs/FEEDBACK_MAKE_SETUP.md`.
* HOTOVO (WIP commit, typecheck OK, testy zatím žádné):
  - `package.json`: `modern-screenshot` 4.7.0 (MIT, bez závislostí).
  - `src/lib/feedback.ts`: typy (Chyba / Vzhled / Nápad / Ostatní), limity, chybové hlášky, `screenshotAllowed`
    (snímek zakázán na `/sprava` a `/vzdelavani/integrace`).
  - `src/lib/bug-dock.ts`: poloha, přichycení, šipky, `placeBug` (vyhnutí překážkám, jazýček), z Novi.
  - `src/server/feedback.ts`: zod validace, magické bajty snímku, DB rate limit `feedback:<user>` 10/h (`withinRateLimit`),
    ochrana dvojího odeslání `feedback-once:<hash>` (uvolní se při chybě), POST na Make s hlavičkou
    `x-zbc-feedback-secret`, timeout 10 s, `redirect: "error"`, log jen kódem. Reporter = hash id + role, bez jména/e-mailu.
  - `src/server/config.ts`: `feedbackWebhook()` (https nebo http jen localhost, secret ≥ 32), `FEEDBACK_ENV`.
  - `src/app/(wiki)/feedback-actions.ts`: server action `submitFeedback` (session, Pohled ze `currentPreview`).
  - Migrace NENÍ potřeba (rate limit i dedupe přes existující `rate_limits`).
* DALŠÍ KROKY:
  1) Klient `src/components/feedback/`: `BugButton` (44 px, vpravo dole, tažení + přichycení, šipky, jazýček, pozice
     v localStorage s try/catch, jen `(min-width: 900px) and (pointer: fine)`, skrýt při `dialog[open]` a `body[data-moving]`,
     překážky `[data-bug-avoid], .select-bar, .move-panel, .flash, .btn-primary`; BEZ setInterval, měření přes rAF na
     scroll/resize/MutationObserver), `FeedbackRoot` (okno přes `Modal` 3 kroky: typ → popis + „Označit místo“ + u chyby
     „Co by mělo fungovat jinak?“ → kontrola: souhrn, tlačítko „Pořídit snímek“, náhled jako data: URL (CSP img-src nemá
     blob:), „Odebrat snímek“, Odeslat; úspěch až po `ok: true`; chyba = data zůstanou; `hasUnsavedChanges`),
     `MarkingLayer` (prvek / obdélník, čísla, Odebrat, Zrušit vše, Esc, overflow hidden, `data-feedback-ui`),
     `page-context.ts` (popis značky BEZ hodnot polí), `screenshot.ts` (domToCanvas, filter `data-feedback-ui`,
     onCloneEachNode vymaže hodnoty input/textarea/select, po vykreslení přetřít neprůhledně boxy polí a
     `.minutes, .transcript, .recording, [data-feedback-redact], .account, .signed-in`; chyba = jen text).
     Položka „Zpětná vazba“ v `Sidebar` (desktop) otevře okno a vrátí skrytého broučka. Vložit `FeedbackRoot` do
     `src/app/(wiki)/layout.tsx`. Styly v `globals.css` tokeny ZBČ (okrová, žádná fialová), `prefers-reduced-motion`.
  2) Unit: `tests/zpetna-vazba.test.ts` (parse, mime, not_configured, rate limit, duplicate + uvolnění po chybě,
     payload bez jména/e-mailu, snímek na /sprava odmítnut, Pohled v kontextu) + `bug-dock`.
  3) E2E: falešný webhook v `e2e/server.mjs` (http://127.0.0.1:<port>, env `FEEDBACK_WEBHOOK_URL/SECRET` jen demo),
     `e2e/zpetna-vazba.spec.ts`: klik, tažení, jazýček, skrytí/obnova, neuložené změny, označení, snímek se souhlasem
     i bez, úspěch/chyba, mobil bez broučka. Pak lint, typecheck, unit, build, celé `npm run e2e` (před tím
     `fuser -k 3310/tcp 3311/tcp 3410/tcp`), WebKit dle relace 14 (`E2E_WEBKIT=1`).
  4) `docs/zpetna-vazba.md` (Make scénář, env, tvar payloadu, mazání po 12 měsících), README tabulka env,
     `.env.example`. Report feedback widgetu (B7). Draft PR podle šablony repa, předávka.
* Pravidla: žádný merge, deploy, migrace ani zápis do produkční DB.

**RELEASE AUDIT PR #74 (FÁZE A) – RELACE 14 HOTOVO (20. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`).**
* bba0adb: CSP `upgrade-insecure-requests` vypíná jen e2e server (`CSP_UPGRADE_INSECURE=0`), `tests/csp.test.ts`.
  06cbf23: WebKit projekty přes lokální HTTPS proxy (`DEMO_TLS_PORT` 3410, `e2e/server.mjs`), kvůli cookie `__Host-`.
  5ecbcc6: WebKit filtr přerušeného prefetch `_rsc=` (`e2e/support.ts`), dotyk přes CDP jen v Chromiu, čekání na
  zavření okna v `temata-planovani.spec.ts:155`. Chyba aplikace P0/P1 v žádném jádře nenalezena.
* Ověřeno: lint, typy, unit 421/421, build, celé Chromium e2e 1210/108/0, Firefox + Chromium 768/1024 bez chyb,
  WebKit po úpravě testů 0 failed. Report `docs/report-release-audit-pr74.md` (Go/No-Go, nasazení a rollback 0015).
  Skutečná zařízení neověřena. Uživatel dostal finální zprávu: PR #74 ready.
**Další krok:** nic bez pokynu. Uživatel převede PR #74 na Ready, mergne a schválí 0015 na produkci (report bod 4).
Po merge fáze B (feedback brouček z `novi-ai-tutor-app`) v NOVÉM PR.

**RELEASE AUDIT PR #74 (FÁZE A) – RELACE 13 → 14 (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`).**
Zadání: user zpráva „ZBČ: finální release audit + integrace zpětné vazby z Novi“ (session
`session_01HpUirygb1N8XmnorbnJSA8`, `list_events` kinds `["user"]`, poslední). Uživatel: NEJDŘÍV dokončit PR #74 (fáze A),
napsat mu, až bude ready; on mergne. Fázi B (feedback brouček z `novi-ai-tutor-app`) až potom v NOVÉM PR, teď ne.
* HOTOVO relace 13 (ověřeno):
  - A1: CI na 1e9ee58 zelené (lint/typy/testy/build, citlivé cesty, Vercel). main e27b631 je předek HEAD (bez
    konfliktů), review komentáře 0. Plné e2e Chromium 1210/108/0 (relace 12).
  - Pohled: `preview-context.ts` a `nahled-actions.ts` prošly kontrolou. Cookie je vázaná na účet a ověřuje se
    pokaždé, `startPreview` vyžaduje `isOrganizer`, `backPath` nedovolí cizí web. `currentPreview` se čte jen ve
    stránkách, ne v `actions.ts`.
  - A3 (jen SELECT): produkce `zbc-wiki-produkce` (bitter-breeze-02749976) má 0001–0014. CHECK je
    `((priority_rank >= 1) AND (priority_rank <= 3))`, takže sedí s kontrolou v 0015. Sloupec je smallint, index
    `topics_priority_rank_unique (org_id, priority_rank) WHERE … archived_at IS NULL`, 15 témat, 3 garantovaná, max 3.
    Preview (still-shadow-86247101) má 0015, `topics_priority_rank_positive`, integer, 2 garantovaná.
  - Vercel env: `APPROVED_MIGRATIONS` je JEN preview + git větev PR #74, produkce nemá. Před 0015 server u 4.
    garantovaného hlásí `priority_pending_migration` (topics.ts:248, kód 23514).
  - Riziko k reportu: selhání 0015 (RAISE) shodí `prepareDatabase`, takže aplikace nenastartuje (data beze změny).
  - A2: `playwright.config.ts` s `E2E_WEBKIT=1` přidá webkit-1440 (Retina),
    webkit-390 (iPhone 13), webkit-320 (iPhone SE), firefox-1280, firefox-390, chromium-768, chromium-1024.
  - V Default prostředí blokuje stažení prohlížečů síť (`cdn.playwright.dev`). Vzniklo osobní prostředí
    `zabohatsicesko` (env_01CUjMoUrHosAHXXVqx7UKmr), které ty hosty povoluje. Relace 14 běží na něm.
* DALŠÍ KROKY:
  1) `npm ci`; `npx playwright install webkit firefox`. Systémové knihovny: `npx playwright install-deps webkit
     firefox`, případně apt. Když nejde, zapsat „neověřeno“.
  2) `fuser -k 3310/tcp 3311/tcp`; na pozadí `E2E_WEBKIT=1 npm run e2e -- --project=webkit-1440 --project=webkit-390
     --project=webkit-320 --project=firefox-1280 --project=firefox-390 --project=chromium-768
     --project=chromium-1024`. Chyby roztřídit: skutečná chyba aplikace (P0/P1 opravit malým commitem a cíleným
     testem) vs. rozdíl prohlížeče v testu. Cíleně zkontrolovat CSS `:has()`, sticky, `100dvh`, `safe-area`,
     nativní date/time, vrstvení dialogů.
  3) Report `docs/report-release-audit-pr74.md`: ověřené testy (Chromium / Playwright WebKit / Firefox / skutečné
     zařízení = NEověřeno), chyby, opravy, migrace (výše) a přesný postup nasazení a rollbacku 0015:
     záloha = Neon větev produkce + PITR 6 h; schválení = přidat `APPROVED_MIGRATIONS=0015_topic_priority_unlimited`
     pro Production a redeploy; rollback = smazat proměnnou, `ALTER TABLE topics ADD CONSTRAINT
     topics_priority_rank_check CHECK (priority_rank BETWEEN 1 AND 3)`, jen když max ≤ 3, nebo obnova z větve.
     Plus tabulka Go/No-Go P0/P1/P2 a doporučení Draft → Ready.
  4) Lint, typecheck, unit, build a plné Chromium e2e (0 failed), commit, push, popis PR #74.
  5) FINÁLNÍ zpráva uživateli (česky, tykat): PR #74 ready ano/ne, Go/No-Go, co má udělat on (merge, migrace 0015
     na produkci až po jeho schválení). Fáze B až po merge.
* Pravidla: produkce jen SELECT, žádný merge, deploy ani migrace na produkci; P2 nerozšiřovat.

**SJEDNOCENÍ WIKI – RELACE 12 HOTOVO (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, PR #74).**
* 02109e7: `priprava-mesice.spec.ts:139` ukládal návrhy s předvyplněným garantovaným tématem → čtecí test Témat
  (`temata-planovani.spec.ts:84`) padal v plném běhu. Teď ukládá bez tématu (P5). Lint, typecheck, unit 419/419,
  build OK, celé e2e **1210 passed / 108 skipped / 0 failed**. Report bod 9 doplněn, popis PR #74 aktualizován,
  uživatel dostal finální audit relací 8–12 a seznam ručních kroků na Preview.
**Další krok:** nic bez pokynu; uživatel ručně zkouší Preview a merguje PR #74.

**SJEDNOCENÍ WIKI – RELACE 11 → 12 (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, PR #74).**
Zadání beze změny (viz blok relace 10 → 11 níže). P6 plné znění: soubor z `list_events` hledej „P6 – Kontrola konzistence“.
* HOTOVO relace 11: P2 dokončen (4e29d78): Domů, Témata (`TopicsSection readOnly`), Zápisy (`MinutesPeek previewLabel`)
  podle `currentPreview`; lišta na ≤640 px (Pohled na celou šířku, šipka ve výběru); `e2e/nahled.spec.ts` (6 testů,
  1280/320/390 zelené), unit `tests/nahled.test.ts` 9/9. Unit celkem 419/419, lint OK, typecheck OK. Report body 1–10
  sepsaný: `docs/report-opravne-kolo-pr74.md`, sekce „Relace 9–11“ (doplnit jen výsledky testů relace 11).
  Snímky `po-*` generuje dočasný `e2e/zz-snimky.spec.ts` (NECOMMITOVAT, po doběhu smazat).
* Relace 11 dál: snímky `po-*` commitnuté (88 ks, `zz-snimky` smazán). Build OK. CELÉ e2e: 1203 passed / 108 skipped /
  **7 failed** = jen `temata-planovani.spec.ts:75` na všech 7 projektech: ř. 84 `.topic-unscheduled` („ · bez termínu“)
  u „Otevřené otázky na schůzce“ chybí. Samostatně test PROJDE; v plném běhu `--project=windows-1280` selže taky →
  jiný (ne-@zapis-temat) test uloží akci/návrh s tímto garantovaným tématem (pravděpodobně Připravit měsíc nebo okno
  akce, kde se garantované téma předvyplní jako doporučené; hledej v `priprava-mesice`, `okna`, `doporucene-tema`,
  `rychle-akce`, `plan-planovani`, `mobilni-ovladani` uložení do sdílené DB). Oprava podle P5: ten zapisující test
  označit `@zapis-temat` NEBO ať ukládá bez tématu / s negarantovaným; NEpřidávat toleranci dvou stavů. Pak znovu
  celé e2e (0 failed) a doplnit výsledek do reportu (sekce „Relace 9–11“, bod 9).
* ZBÝVÁ (bez bodu 1–2 výše hotových): 2) celé e2e 0 failed (`fuser -k 3310/tcp 3311/tcp`,
  `npm run e2e` na pozadí, 0 failed) → výsledky do reportu; 3) popis PR #74 (aktualizovat, výsledky, simulace vs. živý
  test); 4) FINÁLNÍ zpráva uživateli: audit relací 8–11 (8: 7aa044e, 290ea09, 1033643, eb7e9ee; 9: df1d205, 419909c,
  22354d8, 618e18b, d1c7a42; 10: 3ee6f9f, 1eaaa7d; 11: 4e29d78 + další) a ruční kroky na Preview (níže v reportu bod 6).

**SJEDNOCENÍ WIKI – RELACE 10 → 11 (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, PR #74).**
Zadání beze změny. Plné znění: session `session_01HpUirwZ4XH6LuKaqHTR6A4`, `list_events` kinds `["user"]` s
`before_id` `0455a2be-3fb4-47ff-b406-24eb644cb310` (výsledek se uloží do souboru, hledej „ZBČ – PR #74: sjednocení“).
* HOTOVO relace 10 (3ee6f9f): P1 Zápisy – `.minutes-version` = štítek stavu `.minutes-state-{waiting,ok,draft}` +
  `.minutes-source` (text `data-testid="stav-verze"` beze změny), `.persona` bílá + okrový výběr + fokus (platí i
  pro vstup), kratší `draftHint`. Správa: ⋯ účtu `variant="card" className="menu-inline"`. Domů a detail akce
  prohlédnuty (1280 px), hierarchie OK, beze změny. P2 ROZPRACOVÁNO: `services/preview-context.ts`
  (`currentPreview`, cookie `zbc_nahled` = `userId|klíč`, HttpOnly, Lax, 12 h, ověřuje `resolvePreview`),
  `app/(wiki)/nahled-actions.ts` (`startPreview`/`endPreview`, návrat přes referer jen na cestu Wiki),
  `components/PreviewSwitch.tsx` (`PreviewSwitch` v `Topbar` jen pro správce, `PreviewBar` pod lištou,
  `previewApplies`), CSS `.view-switch`, `.preview-bar` na konci globals.css. Plán a detail akce čtou cookie,
  `?jako=` a výběr ve Filtrech odstraněny. Typecheck + eslint změněných souborů OK. NEOVĚŘENO: build, e2e, vzhled lišty.
* ZBÝVÁ (pořadí): 1) P2 dokončit: Domů (`app/(wiki)/page.tsx`: `viewer = preview?.viewer ?? user` pro
  `nextEventsFor`, `listTasks`, `listMonth` (planner podle diváka); v náhledu bez `loadPersonalCalendar`,
  pozvánek a `PersonalCalendarStatus`; `TasksCard readOnly`; nadpis „Vítejte, …“ ponechat), Témata
  (`TopicsSection` prop `readOnly`: bez `PageCall`/návrhu, bez `InterestButton` → jen stav, bez `TopicManage`,
  `sortable=false`, bez reset/obnovit; data `listTopics(viewer)`), Zápisy (`listPublishedMinutes(viewer)`,
  `canAdd=false`, `MinutesPeek` v náhledu převést panel handler → reader, ať nejsou formuláře). Zkontrolovat lištu
  na 320/390 px (`.account` + `.view-switch` se musí vejít) a Firefox ne. E2E nový `e2e/nahled.spec.ts`: správce
  zapne pohled skupiny FP → pruh na Domů/Plán/Témata/Zápisy, žádné „Přidat akci“, „Navrhnout téma“, „Mám zájem“
  tlačítko; Správa ukazuje pruh „tu neplatí“ a skutečný účet; Ukončit pohled vrátí vlastní pohled; účastník
  s podvrženou cookie `zbc_nahled` (`demo-…|skupina-rm`) nic nevidí jinak; unit pro `previewKeyFor`.
  2) P6 průchod textů. 3) lint, typecheck, unit, build, celé e2e na pozadí 0 failed (`fuser -k 3310/tcp 3311/tcp`
  předem). 4) snímky `po-*` (návod v bloku relace 9 níže; přidat pohled „nahled“ = aktivní náhled). 5) report body
  1–10 do `docs/report-opravne-kolo-pr74.md` (sekce Relace 10+). 6) popis PR #74. 7) FINÁLNÍ zpráva uživateli:
  audit relací 8–N s commity (relace 8: 7aa044e, 290ea09, 1033643, eb7e9ee; 9: df1d205, 419909c, 22354d8,
  618e18b, d1c7a42; 10: 3ee6f9f) + seznam ručních kroků na Preview (role, stránky, šířky).

**SJEDNOCENÍ WIKI – RELACE 9 → 10 (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, PR #74).**
Zadání beze změny (plné znění: `list_events` session `session_01HpUirwZ4XH6LuKaqHTR6A4`, kinds `["user"]`, stránka
před `757f686b-…`, zpráva „ZBČ – PR #74: sjednocení Wiki…“; uloží se do souboru, hledej text „ZBČ – PR #74: sjednocení“).
* HOTOVO relace 9: (a) test „více filtrů“ OVĚŘEN – skutečná chyba: `key` u `PlanFilters` v `harmonogram/page.tsx`
  obsahoval vybrané typy → komponenta se přemontovala a nabídka Filtry se po zaškrtnutí typu zavřela (22354d8);
  plan-planovani 46/46. (b) 618e18b: Filtry na 320/390 px přetékaly okno (panel teď kotvený k řádku filtrů);
  Připravit měsíc (kroky `.prepare-step` jako sekce s `.step-no`, hláška kroku 1 na vlastním řádku, `.publish-head`
  záhlaví sloupců, `.prepare-bulk` jako nástroj „Hromadně doplnit vedoucího“ – popisek pole teď „Vedoucí do
  prázdných polí“, krok 3 `publish-impact-count/state`, prázdný stav jen text); `.btn-primary:disabled` šedé;
  rozvrh (`.slot-day`, `.slot-time`, `.slot-types` + `.check-chip`, neaktivní den bez okrového pruhu); Témata (⋯
  `variant="card"` + `.menu-inline`, tlumenější zájemci/metadata, „bez termínu“ bez tučného); globálně `.item-title`
  650 a `.item-meta` muted. P4: `dialog[open]` fade+6 px 150 ms, rozbalení `.filter-menu-panel` a
  `.change-original-facts`, hover karet Plánu/agendy (stín + 1 px, ne stoh, ne `data-lifted`) a `a.item-card` (jen
  stín – transformace by rozbila pevně ukotvené menu ⋯, zachytil test Správa). Vše v `prefers-reduced-motion: no-preference`.
  Ověřeno: lint, typecheck, e2e (priprava-mesice, okna, plan-planovani, temata-planovani, zapisy-schvaleni,
  pristupnost) na windows-1280 + telefon-320: 99+92 passed, 0 failed. NEOVĚŘENO: unit, build, celé e2e, snímky po.
* Snímky PŘED: `docs/screenshots/sjednoceni-pr74/pred-*-{320,390,768,1280,1440,1920}.jpg` (13 pohledů). Skript
  NENÍ v repu (scratchpad); v další relaci ho znovu vytvoř: přihlášení jako správce (viz `scripts/audit-screenshoty.mjs`),
  návrh změny ev-11-26 pro stoh (viz `priprava-mesice.spec.ts` ř. ~269), pohledy domu, plan, lista (clip 160 px),
  temata, zapisy, zapis-editor (`/vzdelavani/akce/ev-11-10#nahravka`), sprava, filtry (stav=navrhy&stav=doplnit + 2 typy),
  karta-menu, stoh (hover `[data-original-of=ev-11-26]`, ≥768), pridat-akci, pripravit-mesic, rozvrh, nahled; JPEG q62.
* ZBÝVÁ (pořadí): 1) P1 zbytek – Zápisy (karty zdrojů `.persona` bílé + okrový výběr, stav/zdroj výrazněji v
  `RecordingSection`), Domů/Detail/Správa jen nadpis × metadata × stav × CTA; 2) P6 průchod textů; 3) P2 globální
  „Zobrazit jako“ podle návrhu v reportu (sekce Relace 8; cookie `zbc_nahled`, odstranit výběr z `PlanFilters`,
  e2e: náhled bez zapisujících tlačítek, Správa = skutečný účet, ne-správce cookie ignorována) – bezpečnostně citlivé,
  pokud by vyšel rozsáhlý, nejdřív sepsat dopad; 4) lint, typecheck, unit, build, celé e2e na pozadí (0 failed);
  5) snímky `po-*` stejným skriptem; 6) report body 1–10 do `docs/report-opravne-kolo-pr74.md`; 7) popis PR #74.
  Před e2e: `fuser -k 3310/tcp 3311/tcp`. Bez merge, deploye, migrací.
* Uživatel chce na konci AUDIT: co bylo uděláno + co má ručně vyzkoušet na Preview.

**SJEDNOCENÍ WIKI – RELACE 8 → 9 (relaci 9 zakládá uživatel ručně: limit hloubky řetězu relací) (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, PR #74).**
Zadání beze změny (blok níže; plné znění `list_events` session `session_01HpUirwZ4XH6LuKaqHTR6A4`, kinds `["user"]`,
poslední user zpráva „ZBČ – PR #74: sjednocení Wiki…“). Report: `docs/report-opravne-kolo-pr74.md`, sekce Relace 8.
* HOTOVO: P5 (7aa044e) – zapisující testy témat se značkou `@zapis-temat` běží jen v projektu `zapis-temat`, který
  je teardown projektu `prihlaseni` (běží po všech projektech; playwright.config.ts); tolerance z 434b3a7 vrácena na „ · bez termínu“. P3 (290ea09) –
  `filterCards({types, states})` NEBO v kategorii / A mezi, `filterValues` (opakovaný parametr i čárky), checkboxy
  v nabídce Filtry (router.push, nabídka zůstává otevřená), štítky typů s křížkem, „Zrušit filtry“; unit + e2e
  test „více filtrů…“ v `plan-planovani.spec.ts`. Ověřeno: typecheck, unit dokonceni, build OK; výsledek cílených
  e2e: temata-planovani 2× samostatně 45/45 passed (P5 OVĚŘENO). Test „více filtrů…“ padal na strict mode
  (`.plan-filters .filter-button` = 2 prvky, zřejmě i v rychlé nabídce); přidáno `.first()`, NEOVĚŘENO – nejdřív
  spusť `plan-planovani.spec.ts` (před během zabij servery na portech 3310/3311: `fuser -k 3310/tcp 3311/tcp`).
* P2: analýza a návrh v reportu (cookie `zbc_nahled`, `currentPreview`, lišta Účet vs. Pohled, okrový pruh, stránky
  Domů/Témata/Zápisy jen ke čtení). Návrh poslán uživateli v relaci 8, odpověď zatím žádná → implementuj až na konci,
  pokud uživatel nenamítne; při implementaci odstraň „Zobrazit jako“ z `PlanFilters` (je tam zatím dál).
* ZBÝVÁ: P4 (jen animace 1 hover karet – pozor na stoh `.stacked`/`.original` v schedule.module.css; 2 `.dialog[open]`
  fade + 4–8 px 150 ms; 3 `.flash` diskrétní; 4 `.topic-drag-overlay`/`.cardWrap[data-lifted]` zvednutí a dosednutí;
  7 `.filter-menu-panel`, `.change-original-facts` – vše s `prefers-reduced-motion`), P1, P6, P2, plné ověření
  (lint, typecheck, unit, build, celé e2e na pozadí 0 failed), snímky před/po 320–1920 (vlastní skript podle
  `scripts/audit-screenshoty.mjs`), report body 1–10, popis PR #74, `subscribe_pr_activity`.

**SJEDNOCENÍ WIKI, HIERARCHIE, FILTRY, GLOBÁLNÍ POHLED (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, PR #74, HEAD 4d83b3f+).**
Zadání: prompt uživatele „ZBČ – PR #74: sjednocení Wiki, vizuální hierarchie, filtry a globální pohled“ (P1 hierarchie podle
dialogu Přidat akci: Připravit měsíc, Nastavit pravidelný rozvrh, Zápisy, Témata, Domů/Harmonogram/Detail/Správa; P2 globální
„Zobrazit jako“ v horní liště – NEJDŘÍV analýza `Topbar.tsx`, `(wiki)/layout.tsx`, `PlanFilters.tsx`, `services/preview.ts`
a stránek, větší zásah nejdřív navrhnout; P3 vícenásobné filtry Plánu (OR v kategorii, AND mezi, chipy, URL); P4 jen animace
1 hover karet, 2 otevírání dialogů, 3 potvrzení uložení, 4 DnD zvednutí/dosednutí, 7 rozbalení – reduced-motion, bez knihovny;
P5 izolace e2e témat (oddělit zapisující a čtecí, žádné „přijmi oba stavy“ – vrátit dočasnou toleranci z 434b3a7);
P6 kontrola textů; plné ověření + snímky před/po 320–1920; finální report body 1–10). Plné znění: `list_events` session
`session_01HpUirwZ4XH6LuKaqHTR6A4`, kinds `["user"]`, poslední user zpráva. Bez migrací, bez merge, bez produkce.
Hotové funkce (stoh, ChangeBanner, PageCall, DnD témat, 0015, zápisy) nepřepisovat bez konkrétní regrese.

**ZPĚTNÁ VAZBA UŽIVATELE NA PREVIEW PR #74 (19. 11. 2026 večer, větev `claude/finalni-kontrola-novy-pr-g2r2wd`).**
Migrace 0015 na Preview PROBĚHLA 18:07:11 UTC (`topics_priority_rank_positive CHECK >= 1`, `integer`). Témata podle
uživatele fungují. Nové požadavky (větší změny nejdřív navrhnout uživateli, pak dělat; vše do PR #74, žádný merge):
1. Téma přiřazené jen do NÁVRHU akce ukazuje „bez termínu“ (červeně) → místo toho oranžově „v návrhu na <datum>“.
2. Smazat pomocné texty (např. „Při plánování se nabízejí jako první, v tomto pořadí.“ a podobné napříč modulem).
3. Hlavní výzva modulu výraznější (Témata: „Navrhněte téma nebo podpořte návrh kolegů.“ + „Navrhnout téma“) – pravidlo
   pro CELOU aplikaci: hlavní akce/účel stránky nesmí splývat se zbytkem (inventura stránek + návrh vizuálu).
4. Změna ZVEŘEJNĚNÉ akce uložená jen jako návrh: graficky jako návrh „nad“ originálem, rozkliknout originál, akce
   Zveřejnit změny / Zrušit návrh (nechat originál). Čistý nový návrh nic takového nemá. Ostatní návrhy nevidí
   (beze změny). Zjistit, jak dnes `events`/`event_revisions` drží rozpracovanou změnu zveřejněné akce, navrhnout UI.
**Relace 7 (d0e70f1):** body 1–4 HOTOVO. Stoh v mřížce (okrový návrh nad originálem, pruh „Zveřejněná verze“, hover
originál roztáhne přes kartu, reduced-motion bez animace, Agenda jen „Mění …“), unit `tests/navrh-zmeny.test.ts`,
e2e kontrola stohu v `priprava-mesice.spec.ts`. Report: sekce „Relace 6/7“ v `docs/report-opravne-kolo-pr74.md`
včetně tabulky návrhu dalších animací (NEIMPLEMENTOVÁNO, čeká na souhlas uživatele).
* Uživatel slíbil další rework → zapracovat do stejného PR (větší nejdřív krátce navrhnout).
**Další krok:** čekat na rework / souhlas s animacemi; nic nemergovat.

**PŘED MERGE PR #74 – RELACE 5 HOTOVA (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, draft PR #74).**
Report: `docs/report-opravne-kolo-pr74.md` (sekce Relace 5).
* HOTOVO: read-only ověření Preview DB (oddělená od produkce, omezení `topics_priority_rank_check` 1–3, poslední 0014,
  PITR 6 h + záložní Neon větev `zaloha-pred-0015-2026-11-19`); 0015 bezpečně selže bez očekávaného omezení (8c2fa73,
  `tests/migrace-0015.test.ts`); Vercel `APPROVED_MIGRATIONS=0015_topic_priority_unlimited` jen Preview + git větev PR #74,
  redeploy `dpl_Hc4z5f5w7z2x7QEa7bF2bNxa4M9X` READY. Lint, typecheck, unit 410/410, build, celé e2e 1178 passed /
  114 skipped / 0 failed (kód 8c2fa73). Snímky `po-*` prohlédnuty, regrese nenalezena (kód UI se neměnil, nepřegenerováno).
* ČEKÁ NA UŽIVATELE: 0015 se spustí až při prvním dotazu do DB na Preview; z cloudu Preview nedosáhneme (proxy 403,
  Vercel Authentication). Uživatel otevře preview PR #74, pak SELECT `schema_migrations` / `pg_constraint` na
  `still-shadow-86247101` a ověření 4–6 garantovaných témat v UI (přístupový kód ukázky má jen uživatel). Ruční merge.
* Produkce nemá `APPROVED_MIGRATIONS` → po merge 0015 na produkci nepoběží (log „čeká na schválení“), 4. garantované
  téma server odmítne čitelnou chybou. Spuštění na produkci je samostatné rozhodnutí uživatele.

**PŘED MERGE PR #74 (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, HEAD `4549f30`, CI zelené).**
Uživatel ověřil report opravného kola a před merge chce (jeho rozhodnutí, závazné):
1. **Migrace 0015 na Preview – SOUHLAS, ale nejdřív read-only ověřit:** (a) Preview DB je opravdu oddělená od produkční
   (Vercel env `DATABASE_URL` Preview × Production – jen metadata, nedešifrovat; Neon projekt/větve), (b) název CHECK
   omezení na `topics.priority_rank` (`pg_constraint`), (c) stav `schema_migrations`, (d) možnost obnovy Preview dat
   (Neon PITR / záložní větev). Pak **upravit migraci 0015**: chybějící očekávané omezení = bezpečné selhání
   (`DO $$ ... RAISE EXCEPTION`), ne tiché `DROP CONSTRAINT IF EXISTS`; unit/e2e na PGlite. Pak Preview migrace:
   nesecretní `APPROVED_MIGRATIONS=0015_topic_priority_unlimited` jen pro Preview (ideálně jen git větev PR #74),
   redeploy, ověřit runtime logy. **Žádná produkční migrace ani změna produkčních dat.** Po migraci na Preview ověřit
   4–6 garantovaných témat, přesun mezi sekcemi, pořadí po reloadu, doporučení při plánování (přihlášení na Preview
   vyžaduje přístupový kód ukázky – tajemství; když nejde ověřit UI, zeptat se uživatele nebo ověřit SELECTem).
   Logika schválení: `src/server/db/client.ts` (ř. ~36–54), `src/server/db/migrations.ts`.
2. **Výběr osob:** ponechat nativní select (žádný Combobox).
3. **Vedoucí a skupiny:** žádné tvrdé omezení příslušnosti; současná kontrola existence účtu a oprávnění správce zůstává.
4. **Testy:** po poslední změně kódu znovu KOMPLETNÍ e2e (`npx playwright test --trace off`, na pozadí, ~9 min),
   požadavek **0 failed na aktuálním HEAD**; plus lint, typecheck, unit, build.
5. **Vizuální kontrola** snímků `po-*` v `docs/screenshots/opravne-kolo-pr74/` (Quick Actions a umístění ⋯, DnD
   a zvýraznění témat, Připravit měsíc, výběr vedoucího). Opravit jen potvrzené regrese, žádný redesign. Snímky
   pořizuje `shots.js` (návod výše v relaci 3: `next start` s vlastním `PGLITE_DIR`, `DEMO_ACCESS_CODE` ≥ 12 znaků,
   persona „Správce ZBC ukázky“); po změně kódu snímky `po-*` přegenerovat.
6. **GitHub:** pokračovat v PR #74, aktualizovat report `docs/report-opravne-kolo-pr74.md`, popis PR a CI. Žádný merge
   do main, žádný produkční deploy.
**Finále:** poslat uživateli přehled: výsledky testů, stav Preview migrace, jasné doporučení, zda je PR připravené na merge.

**OPRAVNÉ KOLO PR #74 – HOTOVO, RELACE 4 (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, draft PR #74).**
Report: `docs/report-opravne-kolo-pr74.md` (body 1–10, sekce Relace 4). Snímky před/po: `docs/screenshots/opravne-kolo-pr74/`.
* Ověřeno na HEAD: lint, typecheck, unit 406/406, build, celé e2e 1176 passed / 114 skipped / 1 failed → oprava
  c36436b (fokus úchytu při přepisu pořadím ze serveru), po ní temata-planovani 3× 12/12. Popis PR #74 aktualizován.
* ČEKÁ NA UŽIVATELE (nic dalšího bez pokynu): migrace 0015 na Preview (`APPROVED_MIGRATIONS=0015_topic_priority_unlimited`
  + redeploy, předtím SELECT názvu omezení v `pg_constraint`); Combobox pro výběr osob (P1-4); kontrola příslušnosti
  vedoucího ke skupině; ruční merge PR #74.

**OPRAVNÉ KOLO PR #74 – RELACE 3 HOTOVA (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, draft PR #74).**
Zadání: `list_events` session `session_01HpUiruJkjFtPcUM3L92gGi`, kinds `["user"]`, před nejnovější stránkou (`before_id`
= `first_id`), user zpráva „ZBČ – Opravné kolo PR #74…“ (výsledek do souboru, `json.JSONDecoder().raw_decode`, klíče
`text`/`content`). Report: `docs/report-opravne-kolo-pr74.md` (tabulka + sekce Relace 3).
* HOTOVO: P1-1 (eda8a14) ⋯ vpravo nahoře s vyhrazeným místem, agenda bez `transform` (menu na telefonu mimo okno),
  dlouhé menu do okna + testy v `rychle-akce.spec.ts`. P1-3 cíleně (7f04ef9): Správa role štítkem, nulové počty
  v Připravit měsíc tiše, kratší úvod rozvrhu. P1-4 jen inventura + návrh (report), P1-5 beze změny.
* DALŠÍ KROK: 4) celé ověření na HEAD: lint, typecheck, `npm test`, build, celé e2e (`npx playwright test --trace off`,
  běží ~15–20 min, pustit na pozadí, číst jen souhrn). Pak screenshoty před/po 320/390/768/1280/1440/1920 do
  `docs/screenshots/opravne-kolo-pr74/` (`pred-*` = c4c3a9a přes `git worktree add`, `po-*` = HEAD): Domů, Plán,
  karta s ⋯ a otevřené menu, Připravit měsíc, Pravidelný rozvrh, Přidat akci, okno akce, Témata, Zápisy, Správa.
  Pomůcka: server `PGLITE_DIR=<tmp> SESSION_SECRET=<40 znaků> DEMO_ACCESS_CODE=<kód> NODE_ENV=production npx next
  start -p 3320`, přihlášení přes `/vstup` (kód, persona „Správce ZBC ukázky“, každý kontext jiné `x-forwarded-for`,
  jinak limit přihlášení). Na telefonu jsou karty v agendě (odkaz v mřížce skrytý → `:visible`). Snímky
  komprimovat (PNG, deviceScaleFactor 1), nepřidávat stovky MB.
  5) poslední relace: popis PR #74 (výsledky, simulace vs. živý test), CI, report uživateli body 1–10 + odkaz na
  preview (`zbc-vzdelavani-demo-git-claude-finalni-kontrola-nov-1082bb-maci.vercel.app`, ověřit v komentáři vercel[bot]).
* Otázky pro uživatele (poslední relace): migrace 0015 na Preview (nesecretní `APPROVED_MIGRATIONS=0015_topic_priority_unlimited`
  + redeploy, předtím SELECT názvu omezení v `pg_constraint`); vedoucí bez kontroly příslušnosti ke skupině;
  P1-4 výběr osob přes Combobox s vyhledáváním (zatím nativní select).

**OPRAVNÉ KOLO PR #74 – RELACE 2 HOTOVA (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, draft PR #74).**
Zadání: `list_events` session `session_01HpUiruJkjFtPcUM3L92gGi`, kinds `["user"]`, poslední user zpráva „ZBČ – Opravné kolo
PR #74…“ (výsledek se uloží do souboru, vytáhnout skriptem: `json.JSONDecoder().raw_decode`, klíče `text`/`content`).
Průběžný report: `docs/report-opravne-kolo-pr74.md`. Relace 1: P0-3 (0b1c0d2), P0-2 server + migrace 0015 (bea1c6c).
* HOTOVO P0-1 + P1-2 (ba4b169): `TopicBoard.tsx` nahradil `TopicOrderList.tsx` – jeden kontext tažení přes obě skupiny,
  DOM se během tažení nemění (zástupné místo, `fixed` náhled, linka vložení, cíl z rozměrů zachycených při startu),
  autoscroll u okraje (rAF) + přepočet na `scroll`, Esc (posluchač jen během tažení), ztráta zachycení = zrušení,
  po puštění jedna `placeTopicAction`, optimisticky + rollback, `aria-busy` při ukládání. Prázdná skupina = cíl
  (`.topic-drop-empty`, nahradila notice „Zatím nejsou nastavená…“). Šipky přes okraj skupiny = přesun do druhé.
  Barvy: garantovaná `--ochre-soft` podklad + okrový pruh + tmavší nadpis, nejžádanější mezi ostatními zelený pruh `--ok`.
  E2E `temata-planovani.spec.ts` (jen windows-1280, serial): 18 vlastních témat Tým A (ostatních 20+), o 1/3/5/6+,
  poslední→první a první→poslední s autoscrollem, Esc, ostatní↔garantovaná, prázdná skupina, klávesnice, souběh dvou
  oken, po archivaci, prst 390 px, úklid (archivace, Seřadit podle zájmu). Unit: přesuny v seznamech 1/3/10/25.
  Ověřeno: lint, typecheck, unit temata-priority 25/25, e2e 7 sad (temata, klavesnice, pristupnost, stranky,
  domu-ukoly, doporucene-tema, kdo-tema) na všech projektech 654 passed / 27 skipped.
* DALŠÍ KROKY: 1) **P1-1 Quick Actions** (`Menu.tsx`, `CardMenu.tsx`, `Schedule.tsx`, `schedule.module.css`): menší
  decentní ⋯, vyhrazené místo bez překryvu textu, hover/focus/open, dotyková plocha, menu v okně, destruktivní oddělené,
  test klik na ⋯ neotevře detail ani DnD. 2) P1-4/P1-3/P1-5 cíleně (texty kratší, hierarchie; hromadný vedoucí: Wiki
  výběr s ID jen pokud jasný přínos). 3) P2 jen s jasným přínosem. 4) celé ověření (lint, typecheck, unit, build,
  celé e2e) + screenshoty před/po 320/390/768/1280/1440/1920 do `docs/screenshots/opravne-kolo-pr74/` (před = c4c3a9a
  přes `git worktree`, hlavní obrazovky + otevřené nabídky). 5) poslední relace: popis PR #74, CI, report uživateli.
* Otázky pro uživatele (poslední relace): spustit 0015 na Preview (nesecretní `APPROVED_MIGRATIONS=0015_topic_priority_unlimited`
  v Vercel Preview env + redeploy, předtím SELECT názvu omezení v `pg_constraint`); vedoucí bez kontroly příslušnosti ke skupině.

**OPRAVNÉ KOLO PR #74 – RELACE 1 HOTOVA (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, draft PR #74).**
Zadání: `list_events` session `session_01HpUiruJkjFtPcUM3L92gGi`, kinds `["user"]`, poslední user zpráva „ZBČ – Opravné kolo
PR #74…“ (uložit do souboru v scratchpadu, číst odtud). Průběžný report: `docs/report-opravne-kolo-pr74.md`.
* HOTOVO P0-3 (0b1c0d2): příčina reprodukována v Chromiu – formulář Připravit měsíc přepočítával přehled na `input`,
  re-render vrátil řízený hromadný `<select>` na starou hodnotu před `change`. Oprava `readOnInput` (u selectů jen
  `change`). E2E se skutečnou klávesnicí, uložením a obnovením (měsíc 2027-05, jen windows-1280) – bez opravy padá.
  Unit: uložení bez zveřejnění, neznámá osoba (nic se neuloží), člen týmu nesmí, souběh revize.
* HOTOVO P0-2 server (bea1c6c): bez `MAX_PRIORITY`, `nextFreePriority` = konec, `recommendTopics` garantovaná vždy
  první, `placeInSections` (doména) + `placeTopic` (služba, jedna transakce, zámek, `expected` obou seznamů → `conflict`,
  audit priority_set/clear/move_to) + `placeTopicAction`. Migrace **0015 s `approval: true`**: na vzdálené DB jen
  s `APPROVED_MIGRATIONS=0015_topic_priority_unlimited` (migrace běží při startu, push by ji jinak spustil na Preview).
  Bez ní `priority_pending_migration` (čitelná chyba). „Nastaveno N ze 3“ pryč. Unit 405/405, lint, typecheck OK.
* DALŠÍ KROKY: 1) **P0-1 UI**: přepsat `TopicOrderList.tsx` na jeden DnD kontext přes obě sekce (TopicsSection předá
  oba seznamy jedné klientské komponentě): pointer events na úchytu, NEměnit DOM pořadí během tažení (overlay +
  indikátor místa vložení, výpočet cíle z obdélníků zachycených při startu), autoscroll u okraje okna, Esc zruší,
  po puštění jedno volání `placeTopicAction` (expectedGuaranteed/expectedOthers), optimisticky + rollback; klávesnice
  šipky v sekci (moveTopicAction) + přesun do druhé sekce (např. Alt+šipka nebo stávající Nastavit/Zrušit prioritu);
  prázdná sekce Garantovaná musí být cíl (zobrazit drop zónu i při 0 garantovaných, jen správci). E2E: 1→poslední,
  poslední→1, o 1/3/5, mezi sekcemi, do prázdné, Esc, dotyk, klávesnice, autoscroll, 20+ témat (seed v testu přes
  Navrhnout téma ve vlastním scénáři nebo unit). 2) P1-2 barvy (garantovaná okrový podklad tokeny, Nejžádanější zelený
  akcent jen štítkem u garantovaných). 3) P1-1 Quick Actions. 4) P1-4/P1-3/P1-5 cíleně (hromadný vedoucí: zvážit
  Wiki výběr osoby s ID). 5) P2. 6) celé ověření + screenshoty před/po 320/390/768/1280/1440/1920
  do `docs/screenshots/opravne-kolo-pr74/` (před = c4c3a9a přes `git worktree`).
* Otázky pro uživatele (poslední relace): spustit 0015 na Preview (= nastavit nesecretní `APPROVED_MIGRATIONS` v Vercel
  Preview env + redeploy; produkce až po merge a dalším souhlasu); vedoucí bez kontroly příslušnosti ke skupině
  (server ověří jen existenci účtu v organizaci, stejně jako okno akce) – ponecháno.

**OPRAVNÉ KOLO PR #74 (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd`, draft PR #74, CI zelené na c4c3a9a).**
Zadání: prompt uživatele „ZBČ – Opravné kolo PR #74: DnD témat, plánování, Quick Actions a finální vizuální hierarchie“
(P0-1 DnD témat i mezi sekcemi, P0-2 bez limitu 3 garantovaných + nová migrace jen na Preview, P0-3 reprodukce a oprava
hromadného vedoucího, P1-1 až P1-5, P2, povinné testy a screenshoty 320–1920). Plné znění: `list_events` session
`session_01HpUiruJkjFtPcUM3L92gGi`, kinds `["user"]`, poslední user zpráva.
* Text „Nastaveno N ze 3.“ z finální kontroly odstranit (P0-2).
* Relace samy zakládají navazující (`create_session`, `source_revision` i `outcome_branch` =
  `claude/finalni-kontrola-novy-pr-g2r2wd`), pushují do PR #74, uživateli se ozve až poslední s reportem a odkazem na preview.

**FINÁLNÍ KONTROLA A NOVÝ PR – RELACE 2 (19. 11. 2026, větev `claude/finalni-kontrola-novy-pr-g2r2wd` = opravná větev + main `e27b631`).**
Report: `docs/report-finalni-kontrola.md` (sekce Relace 2). Nový draft PR do main z této větve; PR #73 sloučený, jeho větev se nemění.
* HOTOVO: 4A neúplný návrh zápisu (`minutesDraftSchema`, `minutes_invalid`), 4B test historie, 4C zámek akce ve schválení
  a zápisu z nahrávky + reprodukční test; 2 `ActionForm` → `ConfirmDialog` (`urgent`/`busy`); 3 Combobox v Připravit měsíc
  (neřízený režim); 5 „Nastaveno N ze 3“ a „bez termínu“. 4D, 6, 9 jen zjištění v reportu.
* OTEVŘENÉ (čeká na uživatele): runtime logy migrací v produkci (bod 7), smazání/archivace „NJBJK“, úkol „Garantované
  téma nemá termín“, PDF/DOCX (návrh: nejdřív DOCX), DEP-01 migrace mimo start, Firefox/WebKit (neověřeno).
**Další krok:** nic bez pokynu; uživatel reviduje a merguje nový draft PR ručně.

**FINÁLNÍ KONTROLA A NOVÝ PR (19. 11. 2026, po relaci 1, větev `claude/focused-cerf-gr1tdi`).**
Zadání: dlouhý prompt uživatele „ZBČ – Finální kontrola, dokončení oprav a příprava nového PR“ (body 1–13). Plné znění:
`list_events` session `session_01HpUiryoWyPcP1uKF2Ws911`, kinds `["user"]`, poslední user zpráva. PR #73 je SLOUČENÝ
(main `e27b631` = strom `ff7ac54`), do jeho větve nepushovat. Průběžný report: `docs/report-finalni-kontrola.md`.
* HOTOVO relace 1: inventura Gitu (bod 1), migrace a DB read-only (bod 7: produkce má 0013/0014, 0 zápisů), NJBJK read-only (bod 10).
* DALŠÍ KROKY v pořadí (každý malý commit + cílené testy; větší změny nejdřív popsat v reportu):
  1. Bod 7 dokončit: runtime logy produkce kolem 07:46–07:50 UTC (chyby migrací), návrh rollbacku/zálohy (Neon branch/PITR 6 h).
  2. Bod 4A: `minutesSchema` vyžaduje Shrnutí i pro návrh → ověřit testem, případně oddělit schéma konceptu a schválení.
     4B/4C: souběh `approveMinutes` vs `createMinutesDraft`/`updateMinutes` (kontroly před transakcí?) → reprodukční test, oprava.
     4D: jen návrh PDF/DOCX do reportu.
  3. Bod 2: sjednotit potvrzení `ActionForm` (vlastní `Modal`) se `ConfirmDialog` – sdílený základ, `dialog` vs `alertdialog`,
     dvojí odeslání, Esc jen vnořené okno; regresní test eb67ebd existuje v `priprava-mesice.spec.ts`.
  4. Bod 3: `PrepareMonthDialog` `<datalist>` → Combobox (nekontrolovaná pole, bez překreslování měsíce); testy Comboboxu.
  5. Bod 5: garantovaná témata – stav „garantované bez termínu“ (návrh), 3 priority, archivace.
  6. Bod 6: datum/čas AM/PM (locale `cs-CZ` v Playwrightu? snímky ukazují 11/18/2026 a AM) – zjistit příčinu, nepřidávat datepicker.
  7. Bod 8: celé e2e + build + lint + typecheck + unit na finálním HEAD; Firefox/WebKit jen pokud jdou nainstalovat.
  8. Bod 9 bezpečnost, bod 11 nový PR do main (draft, bez merge), bod 12 finální report + zpráva uživateli.
* Pravidla: produkce jen SELECT; NJBJK nemazat; žádný merge/deploy; relace samy zakládají navazující (`create_session`,
  `source_revision` a `outcome_branch` = `claude/focused-cerf-gr1tdi`), uživateli se ozvat až v poslední.

**OPRAVNÉ KOLO UX/UI K PR #73 – HOTOVO (19. 11. 2026, relace 9, větev `claude/focused-cerf-gr1tdi` z `ff7ac54` = HEAD PR #73).**
Závěrečný report: `docs/report-ux-opravne-kolo.md` (shrnutí po oblastech, stav každého ID, před/po, testy, rizika, otázky).
Snímky před/po: `docs/screenshots/opravne-kolo/` (`pred-*` = ff7ac54, `po-*` = eb67ebd).
* Relace 9: build OK, celé e2e na 7a37622 **1162 passed / 111 skipped / 0 failed**; oprava eb67ebd (souhrn chyb pod
  potvrzením neuložených změn, `formIsValid` v `Modal`), po ní typecheck, lint, unit 395/395, build, e2e 5 sad
  (1280/390/320) 148 passed. Uživatel dostal závěrečnou zprávu s otázkou na push do PR #73.
* ČEKÁ NA UŽIVATELE (nic dalšího bez pokynu): push do větve PR #73 (`claude/rychle-akce-a-planovani-temat`); DEP-01
  (migrace 0013/0014 při startu); sjednocení potvrzení `ActionForm` na `ConfirmDialog`; combobox v `PrepareMonthDialog`;
  PDF/DOCX zdroj zápisu; vyčištění Preview DB („NJBJK“).
* Když uživatel push schválí: `git push origin claude/focused-cerf-gr1tdi:claude/rychle-akce-a-planovani-temat`
  (fast-forward, větev vychází z HEAD PR #73 – před pushem ověřit, že PR #73 mezitím nedostal nové commity), pak
  aktualizovat popis draft PR #73 (výsledky testů, simulace vs. živý test).

**RYCHLÉ AKCE, PLÁNOVÁNÍ TÉMAT, ZÁPISY SE SCHVÁLENÍM (18. 11. 2026, větev `claude/rychle-akce-a-planovani-temat` z main 59cadc0).**
Zadání uživatele: velké UX zadání (Quick Actions, garantovaná témata, Naplánovat téma, doporučení, Připravit měsíc,
zápisy z více zdrojů s povinným schválením vedoucím, dokumenty pro integraci). Plán a rozhodnutí: `docs/plan-rychle-akce-a-temata.md`.
Uživatel chce, aby relace pracovaly samostatně, samy zakládaly navazující relace a ozvaly se až na konci (finální relace = report + audit + draft PR).
* F1 HOTOVO (2968d2f, 0d38512, 59ed98f, 5e88242): `Menu` varianta `card`, `cardActions` ve `status.ts`, `CardMenu.tsx`,
  `PublishOneDialog` v `PlanSelection`, duplikace `?kopie=` (`duplicateFormValues`, `suggestedCopyDate` v `detail.ts`,
  server odmítne publish s `duplicateOf`), `e2e/rychle-akce.spec.ts`. Ověřeno: lint, typecheck, unit 339/339, build,
  e2e (rychle-akce, plan-planovani, mobilni-ovladani, klavesnice, pristupnost, okna) 317 passed / 81 skipped.
  Otevřené: zalomení času na 320 px u návrhu se štítkem; kopie z okna akce drží jen měsíc.
* F2 HOTOVO (1f27d10, 011263e, edf652b, d2c25e0): migrace 0013 (`topics.priority_rank` 1–3 + partial unique index,
  `topics.manual_rank`), seed 2 garantovaná (Otevřené otázky 1, Návaznost po konzultaci 2). Domény v
  `src/server/domain/topics.ts`: `recommendTopics` (garantovaná → skupina → zájem, sdílí formulář i `suggestTopics`),
  `planCandidates`, `guaranteedTopics`/`otherTopics`/`moveInOrder`/`nextFreePriority`. Služby (jen `canPlan`, audit):
  `setTopicPriority`, `moveTopic`, `resetTopicOrder`, `topicPlanOptions` (topics.ts), `assignTopicToDraft` (events.ts,
  přes `updateEvent`), `topicFormValues` (detail.ts, `?tema=`); okno akce s `?akce=&tema=` předvyplní téma (`saved`
  prop formuláře). UI: `TopicsSection` (Garantovaná/Ostatní, tichá poznámka ručního pořadí), `TopicManage` +
  `PlanTopicDialog` v `TopicActions.tsx`, štítky Garantované/Doporučené a upozornění na skupinu v `EventDialog`.
  Úkol správce „Nastavte garantovaná témata“ (`listTasks`), rozpočet dotazů Plánu 16 → 17. Ověřeno: lint, typecheck,
  unit 359/359, build, e2e (temata-planovani, doporucene-tema, kdo-tema, klavesnice, pristupnost, okna, stranky,
  rychle-akce, plan-planovani, domu-ukoly, unik-dat) 934 passed / 43 skipped + po opravě 320 px okna/pristupnost/
  temata-planovani 243 passed / 27 skipped. Otevřené: archivace prioritu ruší (obnova ji nevrací); nová témata při
  ručním pořadí na konec; okno Naplánovat téma nabízí max. 5 akcí (zveřejněné až za návrhy); typ nové akce k tématu
  pro „Všichni“/Tým A = Jiná akce; předvyplněné téma v okně akce se nehlásí jako neuložená změna při zavření (F3).
* F3 HOTOVO (03f753c, 9bd2e52, 8de1a72, 10591bb, 5b53068): `prepare-month.ts` (`draftGaps`, `prepareOverview`,
  `rowsMissingLead`, `fillEmptyLeads`); v `PrepareMonthDialog` přehled Připraveno/Chybí vedoucí/Chybí téma/Kolize/
  Vybráno s přechodem na pole a hromadné doplnění vedoucího jen do prázdných (uloží až Uložit/Zveřejnit, server beze
  změny). Přijmout/Změnit/Odmítnout jen vizuálně (Přijmout hlavní), sloučení by ztratilo funkci nebo audit. „Nastavit
  pravidelný rozvrh“ + vysvětlení. Okno akce: dotaz při zavření podle hodnot (`Modal.hasUnsavedChanges`), předvyplnění
  = výchozí stav. `.select-small` jediná menší varianta (lišta 30→32 px, filtry 34→32 px, dotyk 38 px/16 px).
  Ověřeno: lint, typecheck, unit 365/365, build, e2e (priprava-mesice, plan-planovani, okna, klavesnice, pristupnost,
  mobilni-ovladani, rychle-akce, temata-planovani, doporucene-tema) 397 passed / 87 skipped, stranky+kdo-tema 548
  passed. Otevřené: upozornit při zavření neuloženého duplikátu / předvyplněného tématu (teď ne); hromadné doplnění
  do všech prázdných, ne jen vybraných; okno akce nemá tlačítko Zrušit (zavírá Zavřít/Esc/klik mimo).
* F4 HOTOVO (85fffaa, 63ad8ed, 7bd3c89, 63f9eba): migrace 0014 (`minutes.recording_id`/`job_id` NULL, `source`
  recording/transcript/notes/file/manual s CHECK vazby na nahrávku, `approved_version/by/at`; stávající zveřejněné
  zápisy dostanou schválení své verze, nic se neskryje). `text-source.ts` (přípona TXT/MD/VTT/SRT, 1 MB, striktní
  UTF-8, titulky bez časů), `integrations/minutes-drafter.ts` (`MinutesDrafter`, lokální `draftFromText`).
  Služby: `createMinutesDraft` (zámek akce + `replaceId` proti souběhu), `updateMinutes` (beze změny obsahu žádná
  verze, změna schváleného ruší schválení + audit `minutes.approval_revoked`), `approveMinutes` (jen
  `canApproveMinutes` = vedoucí, kontrola verze, stáhne starší zveřejněný zápis akce). „Aktuální zápis“ = nejnovější
  mimo vyměněné nahrávky (panel, úkoly, počet, Kalendář). Úkol vedoucímu „Dokončit zápis“ (stejný klíč, bez
  duplicity), kontrolor „Zkontrolovat zápis“. UI: `MinutesSourceForm`, stav verze, Schválit a zveřejnit jen vedoucí,
  „Doplňte vedoucího akce“. Ověřeno: lint, typecheck, unit 380/380, build, e2e (zapisy-schvaleni, zapisy,
  rychle-akce, okna, pristupnost, domu-ukoly, unik-dat) 310 passed / 40 skipped, (stranky, mobilni-ovladani,
  klavesnice) 580 passed / 44 skipped. Otevřené: správce, který není vedoucí, neschválí ani při nepřítomnosti
  vedoucího (jen doplnit vedoucího); nahrání nahrávky nahradí textový návrh bez zvláštního potvrzení (jen upozornění);
  stav „návrh“ vs. „čeká na schválení“ = jeden stav (návrh čeká na schválení, po zrušení „čeká na nové schválení“);
  vedoucí může schválit i bez kontroly kontrolorem; čtenář nevidí číslo verze.
* F5 HOTOVO: lint OK, typecheck OK, unit 380/380, build OK, **celé e2e 1092 passed / 105 skipped / 0 failed** (7,1 min,
  na d78ce49), žádná regrese. Report `docs/report-rychle-akce-a-temata.md` (scénáře 04 → testy, scénáře 1–12
  rekonstruované z plánu, kroky před/po, otevřené otázky, migrace). Screenshoty v `docs/screenshots/` (rychle-akce-menu,
  garantovana-temata, naplanovat-tema, doporuceni-formular, pripravit-mesic-prehled, pravidelny-rozvrh, zapis-zdroj,
  zapis-schvaleni, rychle-akce-mobil). Dokončené `docs/integrace-do-firemni-wiki.md` a `docs/podklady-pro-sper.md`
  (migrace 0013/0014, nové akce, `canApproveMinutes`, `MinutesDrafter`; kdo je SPER dál neznáme). Část 06 zadání
  v repu nedohledána (otevřená otázka).
**Další krok:** draft PR #73 je založený, nic bez pokynu. Uživatel reviduje a merguje ručně.
* Po PR: sdílené Preview DB chyběl `demo-spravce` (seed z 12. 11., účet přibyl 15. 11.). Doplněn jen INSERT (souhlas uživatele),
  pojistka v `listPersonas` (82ecb48): bez něj výběr nabídne `demo-organizator`. Unit 381/381.
Pozor: migrace 0013/0014 se na Preview spustily po pushi, na produkci se spustí po merge.


**HLAVNÍ SPRÁVCE SI VYTVOŘÍ ODKAZ SÁM SOBĚ (18. 11. 2026, větev `claude/spravce-odkaz-sobe` z main 70c5f1f, draft PR).**
* „Odkaz“ = zvací odkaz pro přihlášení dalšího zařízení (`createLoginLink`). Rozhodnutí uživatele: ostatním ho dál
  přiděluje každý správce (beze změny), hlavní správce si ho nově vytvoří i sám sobě.
* `manageableUser(..., { ownPrimaryLink })` v `src/server/services/users.ts`: výjimka jen pro `createLoginLink` a
  `revokeLoginLink`, jen když hlavní správce pracuje s vlastním účtem. Jiný správce hlavnímu odkaz dál nevytvoří,
  zařízení hlavního správce neruší nikdo, účet nemění nikdo. `Account.ownPrimary`; Správa u něj ukáže jen
  „Nový odkaz pro další zařízení…“ (a zneplatnění čekajícího), bez odhlášení zařízení a úprav.
* Testy v `tests/pozvanky.test.ts` (3). Ověřeno: lint, typecheck, unit 327/327, build, celé e2e 995 passed / 89 skipped.
  NEOVĚŘENO: UI menu hlavního správce v ostré Wiki (e2e nemá jeho přihlášenou relaci), živá Wiki.
**Další krok:** nic bez pokynu; uživatel reviduje a merguje PR. PR #71 se nemění.

**FINÁLNÍ DOLADĚNÍ MOBILNÍHO OVLÁDÁNÍ – UZAVŘENO K REVIZI (18. 11. 2026, relace 2, větev `claude/finalni-doladeni-mobilniho-ovladani`, PR #71).**
* Hlášení „přidávání akcí odstraněno“: lokálně NEREPRODUKOVÁNO. Ukázka (správce, ref. čas 12. 11.) na 320/390/1280,
  Měsíc i Seznam: lišta Přidat akci, „+“ u dne (mřížka i agenda), rychlé „+“, Přejít na datum → Přidat akci na tento den
  otevřou okno se správným datem a akce se uloží. origin/main (8092e27) má na stejných šířkách tutéž lištu (screenshoty
  před/po). Vercel preview ani jeho logy z cloudu nejdou otevřít (proxy/403), ostrá 3311 vyžaduje Google přihlášení,
  živý iPhone/WebKit tu není. Uživatele se zeptat: URL, zařízení, role, šířka, co přesně chybělo.
* Opraveno: filtry 2 × 2 na 320 px (počet „11“ se zalamoval, prvky měly různou výšku 44/52 px).
* Nový `e2e/mobilni-ovladani.spec.ts` (CDP touch): přidání akce všemi cestami (telefon i desktop, zápis jen telefon-390),
  podržení a tažení na den v agendě i v `.move-panel`, swipe, puštění mimo, ťuknutí na kartu, picker, Vybrat návrhy
  skryje úchyty a „+“, potvrzený přesun (jen telefon-390, vlastní návrh v 10/2027), rychlé ovládání, Přejít na datum,
  filtry bez díry, bez vodorovného posunu.
* Ověřeno: lint, typecheck, unit 325/325, build, CELÉ e2e 995 passed / 89 skipped / 0 failed (6,8 min).
**Další krok:** nic bez pokynu; uživatel reviduje a merguje PR #71. Pokud přidávání na preview dál chybí, potřebujeme jeho popis.

**FINÁLNÍ DOLADĚNÍ MOBILNÍHO OVLÁDÁNÍ (18. 11. 2026, větev `claude/finalni-doladeni-mobilniho-ovladani` z main 8092e27, draft PR).**
Zadání: jen telefon (desktop beze změny kromě textu „Vybrat návrhy“). Merge dělá uživatel.
* HOTOVO: úchyt přesunu v agendě (`MoveHandle` v `Schedule.tsx`, logika v `MoveDropZone`: podržení 350 ms, zvednutí,
  okrové zvýraznění dne, posun u okraje, dočasný přehled dnů `MonthDays` dole během tažení, puštění mimo = nic,
  ťuknutí/Enter = výběr dne v okně, vždy `MoveConfirm`). „+“ u dne v agendě. `QuickActions` (+ a ⋯: Filtry,
  Vybrat návrhy, Přejít na datum, Skrýt) až po odjetí řádku filtrů; sdílené `ChipLinks`/`FilterFields` v `PlanFilters`.
  Filtry 2 × 2 (≤560 px), karta: stav vpravo na řádku času. Topbar Google na telefonu v jednom řádku. Štítek Nejžádanější nad názvem (≤640 px).
* OVĚŘENO: lint, typecheck, unit 325/325, e2e plán+okna+kdo-tema+klávesnice (1280/390/320) 107 passed / 2 skipped.
  Dotyk ověřen ručním skriptem přes CDP touch (podržení, tažení na prázdný den, mimo cíl, swipe bez přesunu).
* NEOVĚŘENO: celé e2e, e2e test dotykového přesunu v repu, živý telefon (iOS Safari), topbar ostré Wiki screenshotem.
**HLÁŠENÍ UŽIVATELE (po PR #71): „odstranil jsi úplně přidávání akcí“.** V kódu `EventDialog` (Přidat akci v liště) zůstal beze změny
(diff page.tsx se ho netýká). PRVNÍ KROK: ověřit na Vercel preview #71 telefon i desktop jako správce, kde přidávání chybí
(lišta, „+“ u dne v mřížce/agendě, rychlé „+“), najít příčinu a opravit. Pak teprve zbytek.
**Další krok:** doplnit e2e `e2e/mobilni-ovladani.spec.ts` (CDP touch), celé e2e, screenshoty 320–1280, pak PR ready.

**DOLADĚNÍ HARMONOGRAMU A TÉMAT (18. 11. 2026, řetězec 3 relací, větev `claude/doladeni-harmonogramu-a-temat` z main 506a2a6).**
Zadání: jen (1) doporučená témata v Připravit měsíc, (2) kolonky Kdo/Téma v kartách `Schedule.tsx`. Nic jiného neměnit
(nahrávky/přepisy/zápisy, layout, navigace, paleta, Kalendář, pozvánky…). PR až v relaci 3, merge dělá uživatel.
* RELACE 1 HOTOVO (d9269ea): bod (1). Rozhodnutí uživatele: Přijmout/Odmítnout se uloží hned (varianta A), spolu s
  úpravami ostatních řádků jako návrh, nic se nezveřejní. Evidence bez migrace: `event_revisions.action`
  `topic_accept` / `topic_reject` + audit `event.topic_accept|reject`. `suggestionPending(topicId, history)` v
  `src/server/domain/topics.ts`: čeká jen téma z revize `generate`, které se od té doby nezměnilo a nebylo přijato.
  `MonthDraft.suggestion` (vysvětlení z `rankTopics().reason`, jen pro správce přes `listMonthDrafts`).
  `publishDrafts` bere `topicDecision` (platí jen pro čekající doporučení a nezměněné pole). Akce
  `publishMonthAction`: tlačítko `topicDecision=accept:<id>|reject:<id>`. UI: okrový pruh `.topic-suggestion` přes
  celý řádek (štítek, název, „1 zájemce · zatím neproběhlo“, Přijmout/Změnit/Odmítnout), pole `data-suggested`.
  Změnit = vyprázdní pole a dá fokus (pak běžné Uložit změny). Text po doplnění upraven.
  Testy: `tests/doporucene-tema.test.ts` (8), `e2e/doporucene-tema.spec.ts` (leden 2027, zápis jen windows-1280;
  účastník nevidí). Ověřeno: lint, typecheck, unit 318/318 (před úpravou textu), build, e2e okna+plán+doporučení
  226 passed / 12 skipped na všech projektech. Screenshot 1280/390 prohlédnut. Celé e2e NEběželo (relace 3).
* Poznámka pro relaci 2: rozpracovaný návrh s doporučeným tématem má v kartě Plánu pro správce zatím jen běžný
  `topicTitle`. Pokud má karta u správce rozlišit doporučené téma, jde to přes `suggestionPending` (zeptat se uživatele).
* RELACE 3 HOTOVO: lint, typecheck, unit 325/325, build OK, CELÉ e2e 962 passed / 45 skipped / 0 failed (5,4 min).
  Screenshoty 1280/390/320 (plán správce, plán účastníka, doporučení v Připravit měsíc) prohlédnuty, necommitnuty.
  `docs/prezentacni-data.sql` + `.md`: prezentační data pro ostrou Wiki, NESPUŠTĚNO (až po merge). Rozhodnutí uživatele:
  doporučení živě (únor 2027 → Připravit měsíc), akce vedou jen fiktivní kolegové. Ověřeno nanečisto v PGlite.
  PR do main ready k revizi. **Další krok:** nic bez pokynu; uživatel mergne PR, pak případně spustí SQL podle doc.
* RELACE 2 HOTOVO: bod (2). `cardDetails(card, managing)` v `src/features/vzdelavani/status.ts` (Kdo, Téma;
  svátek a zrušená bez kolonek; prázdné = správce „— doplnit“, účastník „Bude upřesněno“, u proběhlé akce účastník
  prázdné pole nevidí; téma shodné s názvem se neopakuje; Action time = pracovní blok, Téma jen vyplněné, rozhodnuto
  po dotazu uživatele). `Schedule.tsx`: komponenta `CardDetails` v mřížce i agendě místo samotného topicTitle
  (třída `.topic`, popisek `.detailLabel` tlumeně, `data-detail`), na `.extra` tmavší #524c47 kvůli axe kontrastu.
  Karta s doporučeným nepřijatým tématem u správce zatím běžné „Téma: …“ (bez souhlasu uživatele neměněno).
  Ikonka „Chybí téma“ u Action time zůstává (beze změny, jen uvést v reportu).
  Testy: `tests/kdo-tema.test.ts` (7), `e2e/kdo-tema.spec.ts` (správce: vyplněné/doplnit/svátek/zrušená/Action time,
  klik do detailu, přesun @desktop; účastník bez „— doplnit“ a bez návrhů) na všech projektech 29/29.
  Ověřeno: lint, typecheck, unit 325/325, build, e2e plán+okna+doporučení+klávesnice 250 passed/12 skipped,
  stránky+přístupnost+kdo-tema 566 passed/18 skipped. Screenshoty 1280/390/320 prohlédnuty (lokálně, necommitnuto).
  „Bude upřesněno“ je pokryté jen unit testem (seed nemá zveřejněnou akci bez údajů). Celé e2e NEběželo.
**Další krok: RELACE 3** celé ověření (celé e2e), screenshoty 1280/390/320, PR ready k revizi (bez merge), report,
SQL prezentačních dat do docs (NESPOUŠTĚT; vzor v docs/cisteni-testovacich-dat.md na větvi `claude/cisteni-ostre-wiki`).


**#69 UZAVŘENO K REVIZI (17. 11. 2026, relace session_01HpUirvm4JFbBXo1Yy6bER1, větev `claude/focused-tesla-cw2jdt`).**
Body (0)–(7) zadání níže hotové. Merge dělá uživatel.
* (0) ac3ce6d: `personalEventDelivery` rozlišuje `current` / `outdated` / `missing` / `failing`, otisk přes
  sdílené `desiredEntry` + `eventsWithMinutes` (stejné jako `desiredEvents`), bez Google API. Popisek „Poslední běh
  synchronizace kalendářů“. Regresní testy v `tests/kalendar-osobni.test.ts` (změna termínu před/po sync, chybějící zápis).
* (1)–(3) Screenshoty 6 šířek × 8 obrazovek (vstup 3311, Témata, zrušená akce detail+okno, Kalendář simulace i osobní
  režim přes lokální instanci 3312, Zápisy + okno) prohlédnuté, bez vodorovného posunu. Sonda klávesnice: Enter/Esc,
  fokus zpět na spouštěč (Zápisy, Navrhnout téma, menu tématu), okno z adresy nechá fokus na stránce (záměr), prázdný
  a neplatný e-mail na vstupu zastaví nativní validace. Opravy: zrušená akce nenabízí „Vytvořit novou pozvánku“ ani
  párování (server `requestNewInvite`/`pairWithExisting` odmítá), u zrušené akce „zatím neurčeno“ místo „doplnit…“,
  okno Nedokončené zápisy pod 520 px tlačítko pod textem (f168660).
* (4) `docs/cisteni-testovacich-dat.md`: tabulka 6 akcí (jen SELECT) + režim. `CALENDAR_DELIVERY` je šifrovaná, nečetla
  se; osobní režim doložen nepřímo z DB. Nic nezměněno.
* (5) lint OK, tsc OK, unit 310/310, build OK, celé e2e 932 passed / 42 skipped / 0 failed (5,3 min).
**Další krok:** nic bez pokynu. Uživatel: merge #69, pak případně schválit čištění dat podle doc.

**ZADÁNÍ UŽIVATELE PRO UZAVŘENÍ #69 (17. 11. 2026, po 9c4bac1, CI na 9c4bac1 zelené).** Pokračovat na větvi
`claude/focused-tesla-cw2jdt`, PR #69, nic od začátku. Zákazy: žádný redesign, nová funkce, merge do `main`, úprava
produkčních dat, skutečné Google pozvánky ani změny konfigurace.
* (0) OPRAVA: `personalEventDelivery()` (`src/server/calendar/personal.ts`) počítá každý záznam `personalCalendarEntries`
  jako zapsaný bez ověření `dataHash`. Rozlišit: aktuální zápis / zastaralý (čeká na aktualizaci) / chybějící / chyba
  synchronizace. Otisk musí vznikat STEJNOU logikou jako `desiredEvents()` (obsah akce, `EVENT_FORMAT`, `guest` =
  `personalSelfInvite() ? accountEmail : undefined`, zápis z publikovaného zápisu `withMinutes`). Žádný duplicitní
  algoritmus: vytáhnout z `desiredEvents` sdílenou funkci (např. `desiredEntry(row, withMinutes, guest)` → {data, hash}
  a `eventsWithMinutes(db)`), použít v obou místech. Bez volání Google API. Popisek „Poslední srovnání“ v
  `PersonalSyncView` (`SyncPanelView.tsx`) neprokazuje aktuálnost akce: přejmenovat/upravit (např. „Poslední běh
  synchronizace kalendářů“) nebo odstranit. Regresní test v `tests/kalendar-osobni.test.ts`: zápis po sync = aktuální,
  změna termínu akce před sync = zastaralý, po `syncPersonalCalendar` = znovu aktuální.
* (1) screenshoty 320/390/768/1280/1600/1920 skutečně prohlédnout: přihlášení (ostrá 3311 `/vstup?spravce=1`), Témata,
  zrušená akce (detail + okno), diagnostika Kalendáře, Nedokončené zápisy + okno. (2)+(3) tab/klávesnice, pořadí tlačítek,
  návrat fokusu po zavření oken, chování při chybě. Opravit jen nalezené.
* (4) read-only inventura 6 akcí z `docs/cisteni-testovacich-dat.md` v Neon produkce (jen SELECT, bez tokenů a osobních
  údajů) + režim Kalendáře (CALENDAR_MODE/DELIVERY/ATTENDEES/PERSONAL_NOTIFY) přes Vercel bez dešifrování → tabulka do doc.
* (5) znovu: dotčené testy, lint, typecheck, unit, build, CELÉ e2e. (6) popis PR #69 podle `.github/pull_request_template.md`
  s nejnovějšími výsledky + finální report sem. (7) subscribe na PR, zelené CI na posledním commitu → Ready for review.
  Merge dělá uživatel.

**OPRAVY PŘED MERGE #69 (17. 11. 2026, relace session_01HpUirux5ZWx5eUkrUCJ17V, větev `claude/focused-tesla-cw2jdt`).**
Uživatel opravy schválil, pokračovat bez ptaní až do ověřeného PR. Merge dělá uživatel.
* HOTOVO (commit 2b57702, pushnuto): (1)+(2) osobní režim Kalendáře podle evidence: `syncStatus: "personal"` na kartě
  (`events.ts`), `statusAdvice` → null; `SyncPanel.status "personal"` + `personalDelivery` (`personalEventDelivery` v
  `src/server/calendar/personal.ts`: publikum, zapsáno z `personal_calendar_entries`, čeká, nepropojeno, chyby po lidech)
  a `legacyInviteId`; `personalSyncPanel` v `detail.ts` nevolá Google, nepáruje, nenabízí pozvánku. `SyncPanelView`:
  `PersonalSyncView`. Testy v `tests/kalendar-osobni.test.ts` (3) a `tests/google-calendar.test.ts` (2).
  (3) `GoogleStart` posílá e-mail `fetch` POST (JSON, stejný původ, 403 jinak) na `/api/google/prihlaseni`, server vrátí
  URL Googlu (login_hint), klient `location.assign`; GET e-mail z URL nečte; form `method="post"` (bez hydratace nic
  neuteče do URL). Testy `tests/prvni-prihlaseni.test.ts` (10) + e2e „ručně zadaný e-mail není v žádné URL Wiki“.
  (6) ukázkový přepis označen u návrhu zápisu, „Pracovní přepis (ukázka)“, `unsupported_fixture` texty (labels, journey, MinutesPeek).
* Ověřeno na 2b57702: lint OK, typecheck OK, unit 307/307, build OK, CELÉ e2e 932 passed / 42 skipped / 0 failed (4,9 min).
**Další krok (v tomto pořadí):** (b) screenshoty 320/390/768/1280/1600/1920 (Playwright, `node e2e/server.mjs`, ostrá instance port 3311 `/vstup?spravce=1`;
ukázka 3310): Témata, zrušená akce detail+okno, technický detail Kalendáře, Nedokončené zápisy + okno; pořadí tlačítek,
návrat fokusu, klávesnice, chyba; opravit jen nalezené. (c) bod 5: read-only inventura 6 akcí z `docs/cisteni-testovacich-dat.md`
v Neon produkce (jen SELECT, bez tokenů) + proměnné CALENDAR_* přes Vercel bez dešifrování → tabulka do doc. NIC neměnit.
(d) popis PR #69 podle šablony s důkazy, subscribe na PR, zelené CI, případně Ready for review. Zapsat sem stav.

**POSLEDNÍ OPRAVY UX, PŘIHLÁŠENÍ A ZÁPISŮ (17. 11. 2026, relace session_01HpUirxUSjYc9wbogeZGpqN, větev `claude/focused-tesla-cw2jdt` z main 80513a1).**
Rozhodnutí uživatele: e-mail ověřit až po Googlu (bez předkontroly), „Nejžádanější“ nahrazuje „Doporučené“, sekundární řazení
abecedně + ID, ruční zápis jen jako návrh (`docs/rucni-zapis-navrh.md`).
* (1) Přihlášení: nové zařízení zobrazí prázdné pole E-mail (`src/app/vstup/GoogleStart.tsx`, navigace přes `location`
  kvůli CSP). Route nebere `invite.email`, jen ručně zadanou adresu jako `login_hint` (`typedLoginHint`). Nové zařízení se
  souhlasem ke Kalendáři posílá `prompt=select_account consent`. Ověření identity, PKCE, stav i vazba pozvánky beze změny.
  Testy: `tests/prvni-prihlaseni.test.ts`, e2e „nové zařízení: prázdné pole E-mail“.
* (2) Témata: `sortByInterest` a `mostWantedIds` v `src/server/domain/topics.ts` (jen prezentace, `rankTopics` pro plánování
  beze změny), zelený štítek a pozadí, ostatní řádky teplé `--beige`.
* (3) Kalendář: místo tlačítka „Stav v Kalendáři“ jen „Opravit v Kalendáři“ při chybě, jinak tichý odkaz „Technické
  informace“. Panel v detailu je sbalený, pokud není potřeba zásah. Osobní režim: `SyncPanel.personal`, chybějící vazba
  = „synced“ (bez nabídky pozvánky s e-mailem), text „Pozvánky ani e-maily se neposílají“.
* (4) Zrušené akce: `lifecycleStatus` + `detailBadges` (dřív stránka detailu u zrušené akce neukázala žádný štítek),
  nahoře upozornění s důvodem. Testy `tests/stav-akce.test.ts`.
* (5) Zápisy: bez „Otevřít celou akci“, „Vedoucí neurčen“ + správci „Přiřadit vedoucího“ (Plán s otevřenou akcí), kratší
  texty, výměna nahrávky sbalená, když zápis existuje. Text u nahrávání: přepis umí jen ukázkovou nahrávku.
* (7) `docs/cisteni-testovacich-dat.md`: doplněn postup ověření režimu a vazeb pro každou akci. **Nic neprovedeno.**
* Ověřeno: lint, tsc, unit 299/299, build OK. E2E: viz popis PR. **Neověřeno:** screenshoty na více šířkách, plné e2e,
  bod 6 (drobnosti) prošel jen částečně (pořadí tlačítek, fokus po zavření nekontrolován).
**Další krok:** prohlédnout screenshoty (Témata, detail zrušené akce, /vstup?spravce=1, okno zápisu) na 390/1280,
projít bod 6, plné `npm run e2e`, draft PR připravit k revizi. Read-only ověření 6 akcí podle doc (7) až s pokynem.

**BODY 1–3 (17. 11. 2026, relace session_01HpUiryLTnYTDVdKXExXTxz, větev `claude/awesome-dijkstra-yc1boc`).**
* (1) Okna akcí hotová (a27f734): bez nápovědy pod „Pro koho“ (`GROUP_HINTS` smazané), bez kroku Kontrola v Přidat
  akci, příjemci pozvánky jen tlumený sbalený řádek (0 příjemců = krátká poznámka, u proběhlé akce nic), návrh bez
  opakované rady, detail bez duplicitního typu/publika, Připravit měsíc s kratšími texty (potvrzení zachována).
* (2) Inventura produkce read-only (Neon `zbc-wiki-produkce`): `docs/cisteni-testovacich-dat.md`. Testovací témata
  Test/Něco/Ahoj/Ahojda/Tos/Ahojky (+ Tym A?) a 6 zveřejněných akcí s Kalendářem. **Nic nesmazáno, čeká na schválení.**
  Seed ukázky je profesionální a v ostré Wiki zakázaný, beze změny.
* (3) lint, tsc, unit 279/279 OK; screenshoty 6 šířek prohlédnuté, #mesic 0 px od středu (320/390: −0,01 px),
  bez vodorovného posunu. Kompletní e2e 918 passed / 42 skipped / 0 failed (po opravě axe štítků filtrů, 9644b40).
* Draft PR [#68](https://github.com/ondrejmacko-it/zabohatsicesko/pull/68) do main, CI zelené, Vercel preview Ready.
**Další krok:** nic bez pokynu. Uživatel dá #68 Ready for review a sloučí. Čištění produkčních dat jen po schválení
podle `docs/cisteni-testovacich-dat.md` (otázky tam).

**URGENTNÍ UX/UI OPRAVY (17. 11. 2026, relace session_01HpUiryXvc6ixD5KrHNTanQ, větev `claude/awesome-dijkstra-yc1boc` z main 6eb778e).**
Hotovo (jedna větev, bez PR – uživatel PR zatím nechtěl):
* Plán: lišta jako mřížka 3 zón (`.plan-head` + container query), měsíc 27 px přesně uprostřed (změřeno 0 px odchylky
  při 1280/1440/1600/1920/320/390; dřív −154 až −194 px). Vpravo Připravit měsíc + Přidat akci; „⋯“ zrušeno,
  Pravidelný týden je v okně Připravit měsíc (krok 1).
* Filtry: jeden řádek pod lištou (Návrhy, Chybí údaje, vybraný typ s křížkem | Filtry ▾ = Typ akce + Zobrazit jako
  s krátkou nápovědou | Vybrat akce). Staré konfliktní CSS `.schedule-toolbar/.month-nav/.plan-filters/.topic-list` sjednocené.
* Výběr přímo v Plánu (`PlanSelection.tsx`, `DraftSelection.tsx` smazán): checkbox na kartách návrhů (mřížka i seznam),
  klik/Enter na kartu označí, mezerník na checkboxu, Esc ukončí, tažení vypnuté, lišta „Vybráno X“ se Zveřejnit/Smazat/
  Zrušit výběr a potvrzením. Označit jde každý nikdy nezveřejněný návrh (i proběhlý – jen smazat, potvrzení to řekne);
  zveřejní se jen budoucí (`listMonthDrafts`); návrhy změn jen v okně akce. Serverové akce beze změny.
* Karty: jeden štítek (`cardStatus`) + ikona „Chybí téma a vedoucí“ (`missingDetails`), žádné „Bez tématu/Bez vedoucího“.
* Témata: jeden sloupec kompaktních řádků, archiv stejné řádky tlumeně bez vysvětlující věty. Správa: panel Kalendáře
  nadpis vlevo, štítek a šipka vpravo (`::after`, rotace).
* Texty: `statusAdvice` bez „přes Upravit“ a zkrácené.
* Ověřeno: lint, tsc, unit 279/279, build, e2e okna+klávesnice+přístupnost+plan-planovani 263 passed/27 skipped/0 failed
  (po opravě názvu skupiny štítků). Screenshoty před/po prohlédnuté. **Kompletní e2e neběželo.**
**Rozhodnutí uživatele (17. 11.):** nejdřív dodělat body 1–3 níže, pak JEDEN draft PR do main (z této větve), pokračovat bez
ptaní a při limitu kontextu založit další relaci. Zastavit se až na úplném konci s PR připraveným ke sloučení (zelené CI,
popis PR podle šablony). Merge dělá uživatel.
**Další krok:** (1) okna akcí: duplicitní texty; (2) inventura testovacích dat; (3) kompletní `npm run e2e`; pak draft PR; projít okna akcí (EventDialog/EventPeek) – duplicitní texty o publiku a pozvánkách
(„Akci uvidí skupina…“, „Pozvánku nedostane nikdo“) ještě NEJSOU upravené; inventura testovacích názvů v produkční DB
(„Ahoj“, „Něco“, „Test“, „Ahojda“, „Tos“) – jen read-only dotaz a návrh, nic nemazat bez schválení; pak draft PR.

**#65 PŘIPRAVENÝ KE SLOUČENÍ (18. 11. 2026, relace session_01HpUirxBmt1Vh8n8CDU9bEP).** #67, #63 a #64 jsou v `main`.
Do `claude/final-zapisy-temata` sloučen `origin/main` merge commitem c16a852 (bez konfliktů, bez force). Lokálně: lint, tsc,
unit **279/279**, `npx tsx scripts/audit-plny.ts` projde jen se známou výjimkou GHSA-fc5q-39xc-vjpf (picomatch). Na c16a852
„Citlivé cesty v PR“ zelené a Vercel preview Ready; „Lint, typy, testy a build“ běžel při zápisu. Tento zápis je jen dokumentace.
PR je ještě draft.
**Další krok:** ověřit zelené CI na hlavě PR (oba joby); pak uživatel dá #65 „Ready for review“ a sloučí přes „Create a merge
commit“ a ověří Production nasazení.
Otevřené zůstávají přepis dlouhých nahrávek a ostrý Google Kalendář (beze změny).

**BEZPEČNOSTNÍ ÚPRAVA #67 (18. 11. 2026).** Na pokyn uživatele: plný audit už není `continue-on-error`. #67 (480e814):
`scripts/audit-plny.ts` + `scripts/audit-vyjimky.ts` + `scripts/audit-vyjimky.json` – blokuje vše kromě GHSA-fc5q-39xc-vjpf
v `picomatch` do 31. 12. 2026; chyba auditu blokuje; produkční audit beze změny; testy `tests/audit-vyjimky.test.ts` (7).
Zkušební sloučení #67+#63+#64+#65 bez konfliktu, unit 279/279. Uživatel nechce další funkční ani vizuální úpravy.
**Další krok:** nic bez pokynu; uživatel slučuje #67 → #63 → #64 → #65 (vždy Update branch + zelené CI).

**OVĚŘENÍ PŘED PŘEDÁNÍM HOTOVO (18. 11. 2026, relace session_01HpUiruuQL3xe1DCLQTCGbo).**
* CI #67 zelené (oba joby + citlivé cesty). #63/#64/#65 padají jen na plném `npm audit` (picomatch, dev), vyřeší sloučení #67.
* Popisy #63 (U08 v 1127481) a #64 (U08 hotové, pořadí sloučení) aktualizované.
* Kombinace #63+#64+#65 (`claude/final-zapisy-temata`): lint, tsc, unit **272/272** (+2 testy souběhu hromadného mazání
  v `tests/pevne-svatky.test.ts`, commit 1c99f77), build OK, úplné e2e **918 passed / 42 skipped / 0 failed**.
* Screenshoty 328 (5 rolí + host × 8 šířek) bez vodorovného posunu; prohlédnuté montáže správce 320/1280/1920, role 390,
  vstup 360, RM 768. Nové nálezy: žádné.
* Finální report uživateli odeslán. **Další krok:** nic bez pokynu uživatele. Sloučení: #67 → #63 → (merge main do #64, CI)
  #64 → (merge main do #65, CI) #65. Otevřené zůstávají přepis dlouhých nahrávek a ostrý Google Kalendář.

**FINÁLNÍ SJEDNOCENÍ PŘED PŘEDÁNÍM (18. 11. 2026) – navazuje na FINAL POLISH níže.**
Uživatel 18. 11. potvrdil: všechny 3 věty z `/vstup` pryč (už se neptat). Schválil rozdělení auditu a přenos U08 do #63.
Zákazy: nemergovat do `main`, nepřepínat produkční Kalendář, nerozesílat pozvánky, nemazat produkční data, neměnit tajemství,
žádné placené služby. Neimplementovat znovu hotové funkce, opravovat jen konkrétní nálezy.

**Hotovo v této relaci:**
* **Draft PR [#67](https://github.com/ondrejmacko-it/zabohatsicesko/pull/67)** (`claude/ci-audit-produkce`, base main, 46c2eed): job „Lint, typy,
  testy a build“ má `npm audit --omit=dev --audit-level=moderate` (blokuje), nový neblokující job „Bezpečnostní report – všechny
  závislosti“ (plný audit, varování + souhrn). Evidence `docs/bezpecnost-zavislosti.md`, issue [#66](https://github.com/ondrejmacko-it/zabohatsicesko/issues/66).
  Ověřeno lokálně: produkční audit 0, `npm ls picomatch --omit=dev` prázdné, přibalený picomatch v Next jen pro `next/image` (nepoužíváme).
  **Musí se sloučit první**, jinak CI #63–#65 dál padá na plném auditu (workflow se bere z merge ref PR).
* **U08**: cherry-pick 44df29e → #63 jako 1127481 (`claude/final-akce-navrhy`), pak merge #63 → #64 (775d696) a #64 → #65
  (e866d69, prázdný diff, bez konfliktu). Bez force. `e2e/pristupnost.spec.ts` na #63 i #64: 22 passed / 18 skipped / 0 failed.
  V historii #65 jsou dva commity se stejnou změnou (44df29e a 1127481); bez přepsání historie to nejde, diff PR je bez duplicity.

**Další kroky (nová relace):**
1. Subscribe #63, #64, #65, #67; zkontrolovat CI #67 (oba joby). Popis #64 a #63 aktualizovat: U08 už opraveno v #63 (1127481).
2. Na `claude/final-zapisy-temata` (= #63+#64+#65): lint, tsc, unit, `npm run build`, úplné `npm run e2e` (dřív 918/42/0).
3. Cíleně projít: přístupnost, klávesnice, formuláře, okna, chyby, prázdné stavy; oprávnění správce/vedoucí/FP/RM/host;
   screenshoty 320–1920 (`node e2e/server.mjs` + `node scripts/audit-screenshoty.mjs . <scratchpad>`; po změně CSS server
   restartovat a zabít i `next-server`); texty (překlepy, duplicity, technické formulace, zbytečné ovládací prvky);
   hromadné Zveřejnit/Smazat vybrané návrhy včetně potvrzení a souběhu (`deleteDrafts`, testy `tests/pevne-svatky.test.ts`,
   `e2e/okna.spec.ts`, `e2e/plan-planovani.spec.ts`; doplnit test souběhu, pokud chybí).
4. Opravy jen nalezených problémů na `claude/final-zapisy-temata` (nebo do větve, kde chyba vznikla, a pak merge dál bez force).
5. Finální report uživateli (tykat): hotové/funkční; ukázka/simulace; kontroly prošlé/neprošlé; zbývající problémy; co
   potřebuje jeho schválení; **pořadí sloučení: #67 → #63 → (merge main do #64, CI) #64 → (merge main do #65, CI) #65**;
   jak ověřit nasazení po sloučení. Zvlášť: přepis dlouhých nahrávek (`docs/nahravky-moznosti.md`) a ostrý Google Kalendář
   jsou samostatné otevřené body.

**FINAL POLISH (18. 11. 2026).** Zadání „ZBČ WIKI · FINAL PRODUCT POLISH“ je v první zprávě relace
session_01HpUiru5P4yB2SxRCiVSjHt. Uživatel dal plné právo pokračovat bez ptaní, zakládat nové relace a připravit draft PR
(merge do main dělá on, Kalendář nepřepínat, produkční data nemazat).

**Hotovo:**
* **Draft PR [#63](https://github.com/ondrejmacko-it/zabohatsicesko/pull/63) „Final A“** (`claude/final-akce-navrhy`): jednotné okno
  akce, Úvod otevírá akci v okně, filtr „Návrhy“, pevné svátky (UI + server), zamčený termín proběhlé akce. Sledovaný.
* **Draft PR [#64](https://github.com/ondrejmacko-it/zabohatsicesko/pull/64) „Final B“** (`claude/final-hromadne-navrhy`, stojí na #63,
  sledovaný): Vybrat návrhy (výběr, Zveřejnit/Smazat vybrané, server `deleteDrafts` v jedné transakci); lišta Plánu (Měsíc/Seznam
  vlevo, měsíc uprostřed, Přidat akci · Připravit měsíc · Vybrat návrhy · ⋯ vpravo, filtry ve 2. řádku, „Zobrazit jako“ s nápovědou);
  **oprava chyby**: „Zpět“ v potvrzovací liště odeslal formulář (React znovu použil tlačítko) – lišty mají `key` (i `EventDialog`),
  po Zpět se fokus vrátí; výběr návrhů se při zavření neptá na rozepsané změny. E2e okna/plán (1280, 1920, 320) prošly, unit 270/270,
  screenshoty 320–1920 lišty prohlédnuté (bez vodorovného posunu).
* **Draft PR [#65](https://github.com/ondrejmacko-it/zabohatsicesko/pull/65) „Final C“** (`claude/final-zapisy-temata`, base main,
  stojí na #64, sledovaný): `/vstup` bez 3 vět (slogan „Plán…na jednom místě“, „Heslo… nikdy nevidí“, notice „Pozvánka je
  ověřená…“ v ukázce); Zápisy: okno „Nedokončené zápisy“ / „Moje zápisy k dokončení“, „Odpovědný: jméno“, seed zveřejněného
  zápisu ev-11-6; Témata: archiv jako karty s Obnovit; **Správa** (e0f2c65): menu účtu Upravit přístup… / skupina „Přihlašování
  se zařízeními“ (Nový odkaz pro další zařízení, Zneplatnit čekající odkaz, Odhlásit <zařízení>… po řádcích) / Odebrat přístup…;
  zařízení v kartě po řádcích (`accessLines`); panel Kalendář jednotná stavba v obou režimech. Lint, tsc, unit 270/270, build OK.
  Screenshoty prohlédnuté (ostrá Správa přes lokální `next start` s fiktivním správcem: skript ve scratchpadu, v repu není;
  Témata-archiv, Zápisy, `/vstup` 390/1280).

* **E2E U08 opraveno v #65** (44df29e): `pristupnost.spec.ts` počítal se starým dialogem akce (před jednotným editorem z #63):
  „Název“ → „Název akce“, „Uložit návrh“ → „Uložit jako návrh“, na počítači je v řádku Typ + Pro koho a Datum + Od (dřív Typ + Datum).
  Úplné e2e na e0f2c65: 913 passed / 42 skipped / 5 failed (jen U08). Na #63 a #64 samotných tyto testy dál padají (oprava jen v #65,
  do jejich větví se nepushuje bez svolení). Úplné e2e na 44df29e: **918 passed / 42 skipped (záměrně jen jeden projekt) / 0 failed**.

* **Screenshoty (18. 11.)**: úplný audit 5 rolí × 8 šířek (320–1920) na e46ce35 bez vodorovného posunu, montáže prohlédnuté.
  Opraveno (99a6c76): Zápisy na telefonu od 360 px mají „Hledat“ vedle pole (`.filter-grow` 180 px). Cílené e2e zapisy+stranky
  531 passed / 3 skipped / 0 failed, lint, tsc, unit 270/270. Popis #64 doplněn o úplné e2e a U08 (cherry-pick 44df29e do #63,
  nebo sloučit #63–#65 dohromady). Závěrečný report uživateli odeslán.

**Další kroky:**
1. Nic dalšího bez pokynu uživatele. Čeká se na jeho kontrolu #63–#65 a odpovědi na otevřené body.
2. Otevřené: výklad „3 nadbytečné věty na /vstup“ (potvrdit); U08 na #63/#64 (cherry-pick 44df29e?); dlouhé nahrávky jen jako
   otevřený bod `docs/nahravky-moznosti.md`. **CI červené jen kvůli `npm audit`**: advisory GHSA-fc5q-39xc-vjpf (picomatch, všechny verze, bez opravy, jen
   dev nástroje; `--omit=dev` = 0). Komentář na #65. Rozhodnutí o CI auditu (počkat / `--omit=dev`) je na uživateli.
   Pozn.: e2e server je produkční build, po změně CSS ho restartovat (zabít i `next-server`).

Kontext limit: na začátku čti jen tento blok, README a měněné soubory.

---


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

**Stav 17. 11. večer, C3 jako draft #61, PR D rozpracovaný (poslední):** #56–#59 v `main`, #60 čeká na merge (CI zelené).
* **C3 = draft [#61](https://github.com/ondrejmacko-it/zabohatsicesko/pull/61)** (`claude/ux-temata-sprava`, stojí na #60). Úplné e2e
  899 passed / 36 skipped (záměrně jen jeden projekt) / 0 failed, unit 265/265, lint, tsc, build. Po sloučení #60 sloučit
  `origin/main` do C3 (bez force).
* **PR D = draft [#62](https://github.com/ondrejmacko-it/zabohatsicesko/pull/62)** (`claude/ux-zaverecny-audit`, stojí na #61; e2e 899/36 skip/0 fail, unit 265, build): úplný audit 328 screenshotů (8 šířek × 5 rolí) bez vodorovného
  posunu. Opraveno: nepoužité styly pryč; navigace na ≤380 px „Správa“ (zbytek názvu jen pro čtečku); rada „nemá pozvánku v
  Kalendáři“ jen u neproběhlé akce a bez odkazu „níže“; Integrace bez technických pojmů; 404 ve stejném rámci jako `/vstup`
  (`src/components/GateShell.tsx`); na tabletu skrytý podtitulek značky.
* **Hotovo, závěrečné shrnutí odeslané.** Další krok: po sloučení #60 → #61 → #62 vždy sloučit `origin/main` do další
  větve (bez force), sledovat CI. Nic dalšího bez pokynu uživatele.
* CI na `main` nemá běhy (workflow běží jen na PR), dřívější „červené main“ proto ověřit nejde; příčina byla opravená v #60.

**Stav 17. 11. odpoledne, #60 ověřené, C3 rozpracované (předchozí):** #56–#59 sloučené v `main`.
* **#60 (PR C2b, `claude/ux-formular-akce`)**: hotové. Úplné e2e na ba4682e 891 passed / 33 skipped (záměrně jen na jednom
  projektu) / 0 failed, unit 263/263, lint, build. Opraven test `tests/kalendar-migrace.test.ts` (chyběl
  `GOOGLE_ORGANIZER_EMAIL` po #57; chování beze změny). Popis PR aktualizovaný, položka e2e zaškrtnutá.
* **C3 (`claude/ux-temata-sprava`, pushnuté, PR zatím NENÍ)**: sloučený #60 (merge, bez force) + commit „C3: průchod zápisu…“:
  ukázková nahrávka ke stažení přímo u nahrávání, pole souboru „Soubor s nahrávkou“ (dřív stejné jméno jako tlačítko),
  nabídka ⋯ jen u zveřejněného zápisu; `/vstup` bez pozvánky má vlastní hlášky (`NO_INVITE_RESULTS`) a ukáže i
  „Žádost o přístup je odeslaná“; telefon: odznak Ukázka v řádku se značkou, výběr role + „Změnit“ + Odhlásit v jednom řádku;
  persona vedoucího „nahrává nahrávky“; integrace bez slova „token“. Nové e2e `e2e/zapisy.spec.ts` (vedoucí nahraje →
  návrh → zveřejní; FP vidí, RM ne) a test hlášek nepozvaného účtu v `ostra-wiki.spec.ts`. Cílené e2e (zapisy, ostra-wiki,
  okna; 1280 + 320) 74 passed / 2 skipped; unit 265/265; lint a tsc čisté. Audit skript má skutečné chybové stavy vstupu.
* **Ověřeno screenshoty:** `/vstup` (ukázka, ostrá, správce, nepovolený, čeká, vypršelo) 390; Témata a Správa 390/1280
  (Přidat přístup, menu u účtu, sbalený technický stav); RM na `/sprava`, `/vzdelavani/integrace` a cizí akci dostane 404.
* **Další krok C3:** (1) prohlédnout přehled rolí 390 (vedoucí, FP, RM: úvod, plán, akce, zápisy, témata, moje cesta) –
  pořiď znovu `ROLE=vedouci,ucastnikFp,ucastnikRm SIRKY=390,1280 node scripts/audit-screenshoty.mjs . <scratchpad>`,
  zmenšené montáže; (2) Správa na telefonu: tlačítko ⋯ u karty člověka stojí samo na řádku (dát vpravo nahoru);
  (3) prázdné stavy (Témata bez témat, Zápisy bez zápisů – ten je ověřený); (4) úplné `npm run e2e` z `/home/user/...`
  hlavního checkoutu (ne worktree se symlinkem), pak draft PR C3 do `main` podle šablony (v popisu: stojí na #60).
  Pak PR D a velké závěrečné shrnutí (zadání v promptu relace).
* Vyčištění testovacích témat („Test“, „Něco“, „Ahoj“): jen návrh uživateli (archivovat přes Témata → ⋯ → Archivovat);
  produkční DB nečíst ani neměnit. Duplicitní názvy server už odmítá (`DomainError("duplicate")`, bez ohledu na velikost písmen).

**Stav 17. 11. pozdě večer, C2 dokončené jako nový draft PR (předchozí):** #56, #57, #58, #59 jsou **sloučené v `main`** (#59 na d2d0a9d).
Zbytek C2 je ve větvi `claude/ux-formular-akce` (sloučený `origin/main`, merge d2554bd) jako nový draft PR do `main` („PR C2b“, číslo v GitHubu).
* Hotovo v C2b: `slotConflict` (6d3a6d5); `MonthDraft.clash` v `listMonthDrafts` + štítek `.publish-clash` a věta v kroku „2. Zkontrolovat“;
  Enter v Připravit měsíc nic neodešle (`ignoreEnter`); okno `Modal wide="extra"` (1120 px, návrh na jednom řádku od ~800 px);
  pravdivé hlášky po uložení/zveřejnění (`src/lib/invite-mode.ts`: simulace / čeká na Kalendář / testovací adresy / odesílá se)
  a `FlashMessage` v `(wiki)/layout.tsx` (potvrzení přežije zavření dialogu a přesměrování); testy `tests/doplneni-mesice-scenare.test.ts`
  (svátek, smazaný a přesunutý termín, zveřejněná a zrušená akce, souběh), e2e `okna.spec.ts` (Enter, potvrzení návrhu).
  Lint, tsc, `npm test` 254/254, cílené e2e `okna`+`pristupnost` (1280, 320) 62 passed / 3 skipped (desktop testy na telefonu).
  **Neověřeno: úplné e2e** (zastaveno kvůli limitu kontextu) – spustit na začátku další relace a výsledek zapsat do popisu PR C2b.
* Screenshoty dialogů prohlédnuté (390, 1280): formulář, souhrn chyb („Doplňte nebo opravte: Název“), potvrzení dopadu i chyba
  „Nezveřejněno, chybí téma… hodnoty zůstaly“ odpovídají chování. Skript: `node <scratchpad>/dialogy.mjs` není v repu; použij
  `scripts/audit-screenshoty.mjs` (teď s `locale: 'cs-CZ'`). Návrh 30 termínů: na desktopu ~75 px na řádek, na telefonu delší seznam
  se svislým posunem v okně a pevnými tlačítky dole – přijatelné, bez wizardu.
* **Další krok: C3** ve větvi `claude/ux-temata-sprava` (commit 5d56e60 na d2d0a9d): `git merge origin/claude/ux-formular-akce` (bez force),
  pak body C3 níže, draft PR C3 do `main`. Pak PR D a velké závěrečné shrnutí (viz zadání uživatele v promptu).
* Vyčištění testovacích témat („Test“, „Něco“, „Ahoj“): jen návrh uživateli (archivovat přes Témata → Správa), produkční DB nečíst ani neměnit.

**Stav 17. 11. večer, C2 doplněné, C3 rozpracované (předchozí):** uživatel poslal podrobné zadání „Dokončení UX/UI: C2 → C3 → D“
(platí nadále, shrnutí níže). Kalendář, #56 a #57 stranou.
* **C2** (`claude/ux-formular-akce`, draft #59, base `main`, stojí na #58): navíc commity d2d0a9d (Připravit měsíc na celou šířku,
  „Chybí téma a vedoucí“ u termínu místo souhrnného seznamu, texty bez „šablona“) a 6d3a6d5 (`slotConflict` v `domain/generation.ts`:
  termín přeskočí jen akce stejné skupiny s časovým překryvem, akce „vsichni“ nebo stejný typ ve stejný den = návrh vznikne
  + varování v hlášce; `generateMonth` vrací `{ created, withTopic, skipped, review }`; testy `tests/obsazeni-terminu.test.ts`
  a v `tests/hromadne-zverejneni.test.ts`). Lint, tsc, `npm test` 249/249. **Neověřeno: build a úplné e2e na posledním commitu.**
* **Zbývá v C2 (podle zadání uživatele):** (1) varování z `review` ukázat i v kroku „2. Zkontrolovat“ (teď jen ve zprávě po doplnění);
  (2) testy pro svátek/výjimku, přesunutý termín z Pravidelného týdne, zveřejněnou akci, zrušenou ruční akci (pravidlo už to pokrývá,
  chybí scénáře v DB); (3) projít `EventDialog.tsx` texty o pozvánkách (rozlišit uloženo / zveřejněno ve Wiki / čeká na Kalendář /
  chyba; žádný falešný úspěch), Enter nesmí zveřejnit, zachování hodnot při chybě; (4) Připravit měsíc s 0, 1, 5, 15, 30 návrhy
  (seed nebo test fixture), případně sbalit skupiny; (5) screenshoty: Přidat akci, Upravit akci, rozbalené možnosti, potvrzení,
  Připravit měsíc prázdný / více návrhů / neúplné / připravené, chyba validace; 320, 390, 1280 + tablet a 1920. Skript na dialogy:
  viz `scripts/audit-screenshoty.mjs` (rozšířit o dialogy, nebo vlastní skript ve scratchpadu); (6) čistý build + úplné e2e, aktualizovat
  popis #59 (base můžeš přepnout na `claude/ux-uvod-plan`, aby diff byl jen C2).
* **C3** (`claude/ux-temata-sprava` z C2, commit „C3 (rozpracováno)“, PR zatím není, před pokračováním rebase na nový C2 bez force:
  `git merge origin/claude/ux-formular-akce`): hotové `isRecommendable` (doporučení jen s ≥1 zájemcem, i ve formuláři a `suggestTopics`,
  test `tests/temata-doporuceni.test.ts`), kratší úvod Témat, Správa bez štítku „Aktivní“ a řádku „Fiktivní role ukázky“,
  Kalendář + diagnostika v `<details class="admin-tech">` „Kalendář a technický stav“, otevře se sám jen při problému
  (`calendarExpiresSoon` v `CalendarStatusLine.tsx`), Zápisy bez nepravdivého „Vyhledávejte“ v prázdném stavu, prázdný stav pro vedoucího,
  `UploadForm` říká, že přepis je zatím jen ukázka. **Neověřeno:** screenshoty po změně (pořízené v `scratchpad/a2`, neprohlédnuté),
  e2e. Zbývá: přihlášení `/vstup` (první dojem, chyby, nepozvaný účet, bez oprávnění), celý průchod zápisu (nahrát → návrh → kontrola →
  zveřejnit → účastník vidí), karty témat a archiv, návrh vyčištění testovacích témat (jen návrh), jednotná čeština (vykání, role,
  tlačítka, bez technických pojmů), pak draft PR C3.
* **PR D:** audit všech rolí a šířek 320–1920 (`scripts/audit-screenshoty.mjs`), oprava nálezů, úplné e2e a přístupnost, pak velké
  závěrečné shrnutí pro uživatele (9 bodů z jeho zadání: změny po stránkách, odstraněné duplicity, opravené průchody, co je funkční,
  co demo, PR a testy, screenshoty desktop/mobil, zbývající nedostatky, produkční kroky čekající na schválení) včetně #56–#59.

**Stav 17. 11. odpoledne, C1 a C2 jako drafty (předchozí):** draft [#58](https://github.com/ondrejmacko-it/zabohatsicesko/pull/58)
= PR C1 (`claude/ux-uvod-plan` → `main`), draft [#59](https://github.com/ondrejmacko-it/zabohatsicesko/pull/59) = PR C2
(`claude/ux-formular-akce`, stojí na C1, base `main`, mergovat po #58). Obě: lint, tsc, test (C2 239/239), e2e zelené.
* C1 navíc: Správa v navigaci jen pro oprávněné, filtry Plánu na 768–1100 vlevo a bez přetečení na 320, kontrast `.extra .line`,
  e2e `domu-ukoly.spec.ts` (RM má jediný úkol = pozvánky).
* C2: jiná akce bez výchozího názvu, pole Název nahoře (`labelInMain` v `EventDialog.tsx`), kratší texty, bez `notice-ok`.
  Připravit měsíc: kroky „1. Doplnit termíny / 2. Zkontrolovat / 3. Zveřejnit“, `PairingOverview` a `pairing` smazané.
  `generateMonth` přeskočí slot překrytý ruční akcí (test v `tests/hromadne-zverejneni.test.ts`).
* **Neověřeno vizuálně:** screenshoty dialogů C2 (formulář akce, Připravit měsíc) na 320/390/1280 – udělat na začátku C3.
* **Další krok: PR C3** nová větev `claude/ux-temata-sprava` z `claude/ux-formular-akce`. (1) Doporučovat jen témata s ≥1 zájemcem:
  `TopicsSection.tsx:21` (`t.interestCount > 0`) a návrhy ve formuláři `EventDialog.tsx` (`suggestions`, filtr na `interestCount`),
  zvážit i `suggestTopics` v `generateMonth`. (2) Návrh vyčištění testovacích názvů témat („Test“, „Něco“, „Ahoj“) jen jako
  návrh uživateli, nic nemazat. (3) Správa: lidé, role, skupiny, přístupy, zařízení nahoře; integrace a diagnostika seskupené
  a sbalené (sem případně přehled párování s Kalendářem). (4) Zápisy a nahrávky: stavy, prázdné stavy, přepis = demo.
  (5) Přihlášení `/vstup`: první dojem a chybové stavy. Pak PR D (audit všech rolí a šířek) a velké shrnutí pro uživatele.
* Otevřené pro uživatele: přehled párování s Kalendářem jsem z Připravit měsíc vyndal (diagnostika); pokud ho chce zpět, říct.

**Stav 18. 11. večer, PR C1 rozpracovaný (předchozí):** větev `claude/ux-uvod-plan`, commit „PR C1 (rozpracováno)“.
Lint, tsc a `npm test` 238/238 prošly. **Neověřeno:** `npm run build` mimo e2e server a `npm run e2e`, PR zatím není.
* Hotovo: Úvod bez Moduly, vypnutého hledání a úspěšného stavu Kalendáře (`PersonalCalendarStatus` vrací null bez akce).
  Pozvánky bez odpovědi = jeden úkol v „Čeká na vás“ (`src/features/vzdelavani/invitations.ts`, test `tests/ukoly-uvod.test.ts`),
  `InvitesCard` smazaná, `TaskRow` má volitelné `href`, `newTab`, `urgent`. Plán: karty název + téma + čas + `cardBadges`
  (`status.ts`), legenda pryč, jeden řádek nástrojů, stav měsíce jako štítky `PlanFilters` (`group` „Čeká na vás v tomto
  měsíci“), typ a pohled jako malé selecty, vlastní úkoly v `<details class="plan-tasks">`. e2e upravené: `domu-ukoly.spec.ts`,
  `pristupnost.spec.ts` (štítky místo panelu). Skript `scripts/audit-screenshoty.mjs` umí `ROLE`, `SIRKY`, `STRANKY`.
* **Další krok:** (1) prohlédnout screenshoty `uvod`/`plan`/`plan-seznam` na 320, 390, 768, 1024 pro správce a FP
  (zkontrolovat zalomení řádku nástrojů na 768–1024 a štítky v seznamu na 320), opravit. (2) Účastníkovi skrýt v navigaci
  neaktivní „Správa systému“ (`Sidebar.tsx`, dnes šedá kulisa). (3) `npm run e2e` na pozadí (porty uvolnit `fuser -k 3310/tcp 3311/tcp`),
  opravit pády. (4) Draft PR C1 do `main` podle šablony. Pak C2, C3, D.
* Otevřené pro uživatele: kulisy shellu ukázky („Moje role“, „Jak pracujeme“, Dokumenty) nechávám, ostrá Wiki je nemá.
  V kartách Plánu nechávám téma (bez něj by se čtyři „Trénink poradců“ nedaly rozlišit), vedoucí je až v náhledu.

**Stav 18. 11. odpoledne, Kalendář pozastaven, začíná UX (předchozí):** obě opravy Kalendáře jsou hotové jako drafty.
* #56 (PR B, `claude/kalendar-migrace-dry-run`, base přepnut na `main`): `removePersonalCalendar` při odmítnutém smazání
  (kromě 404) nechá token i řádek ve stavu `removal_failed` + `error_code`, `retireWikiCalendars` vrací `{ removed, failed }`,
  inventura `removalFailed`, migrace `0012` jen rozšíří CHECK. Lint, tsc, test 241/241, build. Popis PR aktualizovaný.
* #57 (`claude/kalendar-ucet-organizatora` z `main`): `GOOGLE_ORGANIZER_EMAIL` (povinná v režimu organizátora, jinak
  `googleCalendarConfig()` = null, fronta stojí, Integrace ukáže proměnnou), callback porovná ověřený e-mail z ID tokenu
  (`aud`, `email_verified`), nesoulad = token zneplatněn, nic neuloženo, Integrace „jiny-ucet“; přihlášení správce se
  v režimu organizátora na Kalendář neptá, `login_hint` = organizátor. Lint, tsc, test 238/238, build. e2e ne (simulace).
* **Další krok: PR C1** ve větvi `claude/ux-uvod-plan` (z `main`, zatím jen tento soubor). Úvod `src/app/(wiki)/page.tsx`:
  pryč blok Moduly a `PersonalCalendarStatus` ve stavu ok (ukazovat jen warn/alert), nejbližší akce a úkoly vedle sebe
  (`home-columns` vždy, pod sebou na mobilu). Pak Plán. Nejdřív výchozí screenshoty: e2e server `node e2e/server.mjs`
  (porty 3310/3311), přihlášení `e2e/.auth/<role>.json` z `e2e/prihlaseni.setup.ts`, skript `scripts/audit-screenshoty.mjs`
  (rozšířit šířky na 320–1920 a role o nového uživatele a bez oprávnění), screenshoty jen do scratchpadu.
* Otevřené: nic blokujícího. Ověřit (jen čtením názvů/hodnot nesecretních proměnných), že produkce má `CALENDAR_DELIVERY=personal`
  (PR #57 to předpokládá).

**Stav 18. 11., ZMĚNA PRIORIT (předchozí):** #55 (PR A) je sloučené v `main` (849f139). #56 (PR B, větev
**Stav 18. 11., ZMĚNA PRIORIT (poslední):** #55 (PR A) je sloučené v `main` (849f139). #56 (PR B, větev
`claude/kalendar-migrace-dry-run`) zůstává draft. Nejvyšší priorita uživatele je teď **finální UX/UI a obsah celé Wiki**.
Kalendář: jen dvě opravy, pak pozastavit.
1. **Oprava v PR B:** `src/server/calendar/personal.ts` `removePersonalCalendar()`: když Google odmítne smazání kalendáře
   (CalendarError kromě 404 = už smazaný), NEodvolat token a NEmazat řádek. Nastavit stav `removal_failed` + `error_code`
   (rozšířit `PersonalCalendarStatus` v `schema.ts`, `stateOf`), aby šel úklid bezpečně zopakovat (sync volá
   `removePersonalCalendar` znovu u neaktivního účtu). `retireWikiCalendars` vrací `{ removed, failed }`. Testy.
2. **Pojistka účtu organizátora** (nová větev z `main`, např. `claude/kalendar-ucet-organizatora`): `GOOGLE_ORGANIZER_EMAIL`
   v konfiguraci; v callbacku propojení Kalendáře ověřit skutečnou identitu Googlu (id_token/userinfo, ne vstup uživatele);
   při nesouladu propojení odmítnout se srozumitelnou hláškou; v režimu organizátora nepovolit auto-propojení osobního účtu
   správce; v `WIKI_MODE=production`/`google-test` bez nastavené adresy organizátora neodesílat pozvánky (fronta stojí,
   Správa ukáže problém). Testy. Produkci nepřepínat.
3. **Pak UX/UI** podle zadání uživatele (níže), rozdělit na PR C1 (Úvod, Plán, navigace), C2 (Přidat/upravit akci,
   Připravit měsíc), C3 (Témata, Správa, Zápisy, přihlášení, texty), D (vizuální audit, screenshoty, předávka).
   Zásady: méně informací, každý prvek má účel, úspěšný technický stav neukazovat, problém jen když vyžaduje zásah,
   žádné duplicity (blok Moduly na Úvodu, „Čeká na vás“ na Plánu, „Kalendář propojen“), neslibovat neověřené
   (přepis nahrávek je demo), zachovat identitu (teplé světlé pozadí, bílé plochy, tmavá navigace, okrové akcenty).
   Úvod: nejbližší akce a úkoly vedle sebe na desktopu. Plán: karty jen název, čas, stav; chybějící téma/vedoucí
   jako malý štítek; filtry a nástroje správce přehodnotit; zachovat přidání z kalendáře, přetahování, seznam, detail.
   Formulář akce: hlavní pole nahoře, doplňky schované, bez technických bloků příjemců, uložit jako návrh,
   bez výchozího názvu „Jiná akce“. Připravit měsíc: Doplnit → Zkontrolovat → Zveřejnit, bez diagnostiky Kalendáře,
   duplicity ručních akcí a šablony. Témata: doporučovat jen s ≥1 zájemcem (`TopicsSection.tsx:21`), návrh vyčištění
   testovacích názvů („Test“, „Něco“, „Ahoj“) bez mazání produkce. Správa: lidé, role, skupiny, zařízení; integrace
   a diagnostika seskupené a sbalené. Role: správce, vedoucí, FP, RM, nový uživatel, bez oprávnění.
   Šířky 320, 360, 390, 768, 1024, 1280, 1440, 1920. Screenshoty (mimo repo, `scripts/audit-screenshoty.mjs`)
   sám prohlédnout a opravit. Pak lint, tsc, test, build, e2e. Málo dokumentace, hlavně reálné změny UI.
* Nesmí bez souhlasu: přepnout produkci, rozeslat pozvánky, mazat produkční data, merge, placené služby, produkční
  úklid Kalendáře (ani trvalé tlačítko pro něj).

**Stav 17. 11. noc 3, PR A a PR B jako drafty (předchozí):** PR A = draft #55 (`claude/kalendar-pozvanky-organizator` → `main`),
PR B = draft #56 (`claude/kalendar-migrace-dry-run` → větev PR A). PR A: lint, tsc, `npm test` 235/235, build, e2e 883 passed / 33 skipped.
PR B: lint, tsc, `npm test` 239/239, build (e2e ne, UI beze změny). Nic neběželo proti skutečnému Googlu.
* PR A navíc: `docs/kalendar-organizator.md` (provoz, RSVP, náklady, úplné kroky pro uživatele), README proměnné, workflow
  s volitelným secretem `VERCEL_AUTOMATION_BYPASS_SECRET` (preview je za Vercel Authentication, `all_except_custom_domains`).
* Vercel preview: `CALENDAR_MODE=simulation`, `CALENDAR_DELIVERY` nenastavené, `CALENDAR_ATTENDEES` jen v Production. Nic neměněno.
* PR B: `migration.ts` (`migrationInventory`, `retireWikiCalendars` s otiskem, odmítne v `personal`), `scripts/kalendar-migrace.ts`,
  `docs/kalendar-migrace.md` (inventura produkce: 41 akcí, 3 aktivní, 2 osobní kalendáře, 23 záznamů, 45 vazeb bez ext. ID).
* **Otevřené pro uživatele:** (1) kde spustit úklid na produkci (sensitive proměnné nejdou stáhnout: tlačítko ve Správě,
  nebo endpoint s otiskem), (2) pojistka proti propojení osobního účtu správce místo organizátora (proměnná s očekávaným
  účtem), (3) založit účet organizátora a tokeny podle `docs/kalendar-organizator.md`, (4) merge #55 a ruční běh workflow.
* **Další krok:** po odpovědích doplnit PR B (spouštění úklidu, pojistka účtu), pak PR C1, C2, D podle plánu.

**Stav 17. 11. noc 2, PR A téměř hotový (předchozí):** větev `claude/kalendar-pozvanky-organizator`, commit „PR A: RSVP, worker, endpoint…“.
Ověřeno v této relaci: `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm test` (235/235) prošly. **Neověřeno:** `npm run build`, `npm run e2e`.
* Hotové navíc proti WIP: `src/server/calendar/rsvp.ts` (`syncResponses` se zámkem, úplná/přírůstková, 410 → úplná, stránkování,
  jen GET; `invitationsFor`, `gmailSearchHref`), `worker.ts` (`runCalendarWorker`, `runWorkerIfDue` 5 min s atomickým nárokem,
  `workerHealth`), `worker-auth.ts` (sha256 + `timingSafeEqual`), endpoint `src/app/api/kalendar/fronta/route.ts` (GET cron, POST GitHub),
  `vercel.json` (cron `17 5 * * *`), `.github/workflows/kalendar-fronta.yml` (`*/10`, bez tajemství exit 0, denní `enable`),
  Úvod: `InvitesCard` + `RefreshOnReturn` + `after(runWorkerIfDue)`, Správa: `CalendarWorkerHealth`. `FakeGoogle` přesunutý do
  `tests/fake-google.ts` (umí syncToken, 410, `pageSize`). Testy `tests/kalendar-organizator.test.ts` (23, všechny scénáře ze zadání).
* **Zbývá v PR A:** (1) `docs/kalendar-organizator.md`: provoz, kroky pro uživatele (účet organizátora, OAuth, `CALENDAR_WORKER_TOKEN`
  a `CRON_SECRET` ve Vercelu, secret `CALENDAR_WORKER_TOKEN` a proměnná `WIKI_URL` v GitHub Actions, přesné kliky Windows),
  náklady (GitHub Actions zdarma pro veřejné repo; Vercel Pro 20 USD/měs. s cronem po minutách; cron-job.org zdarma), README tabulka
  proměnných (`CALENDAR_WORKER_TOKEN`, `CRON_SECRET`). (2) `npm run build`, `npm run e2e` (na pozadí, porty 3310/3311 uvolnit).
  (3) Preview proměnné na Vercelu: ověřit `GET /v9/projects/<prj>/env` (jen názvy), nesecretní nic nového nepotřebuje.
  (4) Draft PR (base `main`) s výsledky a upřímným přehledem simulace vs. živě. (5) PR B: jen příprava a dry-run.
* Otevřené pro živý test: zda `sendUpdates=all` při pouhém přidání hosta pošle e-mail i ostatním hostům; zda denní `enable`
  workflow skutečně resetuje 60denní odpočet.

**Stav 17. 11. noc, PR A rozpracovaný (předchozí):** větev `claude/kalendar-pozvanky-organizator`, commit „WIP PR A“.
Relace skončila na limitu kontextu. **Neověřeno:** v kontejneru chyběly `node_modules`, nejdřív `npm ci`, pak `npx tsc --noEmit`.
* Hotové v kódu (jen napsané): `CALENDAR_DELIVERY` = `organizer` (výchozí, `invites` = totéž) | `personal`, `organizerDelivery()`,
  `calendarWorkerTokens()` (`CALENDAR_WORKER_TOKEN`, `CRON_SECRET`, min. 32 znaků), `.env.example`. Migrace `0011_calendar_outbox_rsvp`
  (jen ADD: `calendar_links.next_attempt_at`, `failing_since`; tabulky `calendar_responses`, `calendar_sync_state`,
  `calendar_worker_runs`) + schéma + reset dema. `google.ts`: 401 po obnově a 403 už nejsou odvolání (`calendar_forbidden`,
  `ACCESS_403` → `calendar_no_access`, kvóty přechodné), `GUEST_PRIVACY` při založení i úpravě, `guestsPrivate`, `listChanges`
  (events.list, `showDeleted`, `syncToken`, stránkování, 410 → `null`). `simulated.ts`: `listChanges`. `sync.ts`: `errorKind`,
  `retryDelayMinutes`, `markAttention` plánuje `next_attempt_at` podle času DB, `syncPending` bere i splatné `attention`,
  srovná pozvánku bez soukromí hostů, `calendar_forbidden` v `FIXED_BY_RECONNECT`. Štítek `calendar_forbidden` v `labels.ts`.
  Test `google-calendar.test.ts`: 403 `forbidden` → `calendar_forbidden:permanent`.
* **Zbývá v PR A:** (1) `src/server/calendar/rsvp.ts`: `syncResponses(db)` (zámek na `calendar_sync_state`, úplná/přírůstková,
  410 → znovu úplná, mapování přes `calendar_links.external_event_id`, zrušená = smazat odpovědi, jen GET) a `invitationsFor(viewer)`
  (stavy čeká/přijata/možná/odmítnuto, „nelze ověřit“ při chybě nebo `synced_at` starším 3 h). (2) `worker.ts`:
  `runCalendarWorker(source)` (v `personal` nic nedělá), záznam běhu do `calendar_worker_runs`, `runWorkerIfDue("visit")` (5 min),
  `workerHealth()` (výpadek = žádný úspěch github/vercel-cron 30 min, chyby fronty starší 1 h podle druhu). (3) Endpoint
  `src/app/api/kalendar/fronta/route.ts`: GET = Vercel cron, POST = GitHub, `Authorization: Bearer`, porovnání sha256 + `timingSafeEqual`,
  odpověď jen počty, `no-store`. (4) `vercel.json` cron 1× denně; `.github/workflows/kalendar-fronta.yml` (`*/10`, `workflow_dispatch`,
  bez tajemství skončí 0, výstup curl do `/dev/null`, jednou denně `PUT …/actions/workflows/kalendar-fronta.yml/enable`
  s `permissions: actions: write` proti vypnutí po 60 dnech, neověřené). (5) Úvod: karta `InvitesCard` (červeně jen do 7 dní,
  „Otevřít Gmail“ = `https://mail.google.com/mail/u/0/#search/` + `from:<účet organizátora> in:anywhere`, v simulaci bez odkazu,
  souhrn vyřízených), klientský `RefreshOnReturn` (návrat do okna, max. 1×/min, jinak 5 min), `after(runWorkerIfDue)`.
  (6) Správa: stav běhů a upozornění při výpadku/chybách. (7) Testy `tests/kalendar-organizator.test.ts` (FakeGoogle z
  `google-calendar.test.ts`): 401/403/404/409/410/429/5xx, timeout, zachování `responseStatus`, soukromí hostů, nový zaměstnanec,
  změna skupiny, zrušení `cancelled`, RSVP stavy, nedostupné RSVP, bez duplicit, čtení RSVP bez zápisu, endpoint bez tokenu 401,
  souběh s `personal` vyloučen. Upravit `plan.test.ts` jen pokud spadne kvůli frontě. (8) `docs/kalendar-organizator.md` (provoz,
  náklady: GitHub Actions zdarma pro veřejné repo, Vercel Pro 20 USD/měs. s cronem po minutách, alternativa cron-job.org zdarma),
  README tabulka proměnných. (9) lint, tsc, test, build, e2e, draft PR (base `main`), pak PR B jen příprava a dry-run.
* Otevřené pro živý test: zda `sendUpdates=all` při pouhém přidání hosta pošle e-mail i ostatním hostům (dokumentace to neříká).

**Stav 17. 11. pozdě, schválený plán Kalendáře (předchozí):** závazné zadání je `docs/plan-kalendar-pozvanky.md`
(jeden organizátor s pozvánkami, RSVP, outbox, úklid osobního režimu, UX). #53 je v `main`, self-invite vypnutý.
* **Další krok:** implementovat PR A ve větvi `claude/kalendar-pozvanky-organizator` podle plánu, pak PR B, C1, C2, D.
  Produkční přepnutí, pozvánky, mazání a destruktivní migrace jen po výslovném souhlasu uživatele.

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


**Stav 16. 11. noc 3, kalendář 401 (poslední):** #47–#50 jsou v `main`. Draft [#51](https://github.com/ondrejmacko-it/zabohatsicesko/pull/51) z větve `claude/oprava-kalendare-401`:
`calendarList.get` → `update` → `patch` varianty, 401 už neukončí nastavení (důvod do `setup_code`), `selected/hidden`,
`EVENT_FORMAT = 3`, kontrola odvolání po 10 min (Úvod čeká max. 2,5 s), „Kalendář odpojen“ + „Připojit Kalendář znovu“
na Úvodu, v Plánu a ve Správě. Podrobnosti a kroky v `docs/kalendar-ucastniku.md`, část „Po merge #47: 401…“.
* **Další krok 1:** po merge a nasazení přečíst (jen čtení) `select status, event_format, setup_code, error_code, synced_at
  from personal_calendars`, zapsat do `docs/kalendar-ucastniku.md`. `event_format < 3` → uživatel otevře Úvod.
  `setup_code` bez `full` → navrhnout zapnutí self-invite (zapnutí potvrdí uživatel).
* **Další krok 2 (čeká na souhlas uživatele s návrhem):** Plán „+“ na dni a přesun tažením s potvrzením
  (`claude/plan-pridani-a-presun`), „Čeká na vás“ na Úvodu (`claude/domu-ceka-na-vas`). Návrhy jsou v odpovědi relace
  a zkráceně tady:
  - „+“: tlačítko v rohu buňky dne (`ScheduleGrid`), jen `canPlan`; viditelné při `:hover`/`:focus-within`, na
    `(hover: none)` vždy. Odkaz na stávající dialog „Přidat akci“ s `?den=YYYY-MM-DD`, server datum validuje stejně.
  - Přesun: HTML5 drag and drop na bloku akce (jen `canPlan`), drop na den → potvrzovací dialog → serverová akce
    `moveEventAction(eventId, dateKey, revision)` = úprava akce se stejným časem (stejná validace, oprávnění, revize).
    Bez myši: v detailu akce „Přesunout na jiný den“ (pole data). Na dotyku jen tato cesta.
  - „Čeká na vás“: společná komponenta `TasksCard` pro Plán i Úvod; 1280 px dva sloupce (Nejbližší akce | Čeká na vás),
    320 px pod sebou (Čeká na vás první), odkaz „Celý plán“ u obou.

**Stav 16. 11. noc 2, audit (poslední):** #47, #48, #49 nebyly v `main` (ověřeno `git merge-base --is-ancestor`).
Blok „Stav 16. 11. noc, notifikace“ je v předávce větve #49.
* #47: text ve Správě podle `personalSelfInvite()`, lint/typy ok, vitest 202/202, e2e 788 ok + 30 přeskočeno.
  Popis PR doplněný. V `docs/kalendar-ucastniku.md` (větev #47) je část „Po merge #47“: výklad `setup_code`, kroky Vercelu, živý test.
* Neon (jen čtení, před merge): oba kalendáře `active`, `synced_at` 19:39 UTC, sloupce `event_format`/`setup_code` zatím nejsou.
* Draft #50 `claude/audit-drobne-opravy`: Témata a Integrace na 320 px, `docs/audit-zaverecny.md`. e2e 788 ok.
  ZIP screenshotů poslán uživateli (mimo repo).
* **Další krok:** po merge #47 a nasazení číst `select status, event_format, setup_code, synced_at from personal_calendars`.
  `event_format = 0` → uživatel otevře Úvod. Pak self-invite podle `docs/kalendar-ucastniku.md` a výsledek tam zapsat.
* Otevřené: nálezy 3 a 4 z auditu (useknuté menu a zástupný text na 320 px), rozhodne uživatel.
* Při merge #49 a #50 se může střetnout tento soubor (obě větve sem přidávají blok), ponechat oba bloky.

**Stav 16. 11. večer, připomínky (poslední):** #45 je v `main`. Propojení živě funguje (oba účty `active`). Google ale odmítá

**Stav 16. 11. noc, notifikace (poslední):** relace skončila na limitu kontextu (200 tis.). #45 a #46 jsou v `main`,
#46 je na Production od 19:41 UTC. Akce se ale naposledy přepsaly 19:39 UTC, takže připomínky z #46 v kalendářích nejsou.
* Draft #47 `claude/vynuceny-prepis-akci`: migrace `0010` (`personal_calendars.event_format`, `setup_code`).
  Úvod spustí přepis, když je `event_format < EVENT_FORMAT`, a jednou za verzi znovu zkusí `calendarList.patch`
  ve 4 variantách. Výsledek se ukládá jako strojový kód do `setup_code` (dřív 404 prošla tiše). K tomu zkušební
  režim `CALENDAR_PERSONAL_NOTIFY=self-invite` (výchozí vypnuto, uživatel ho zvolil: jen Google, nic externího):
  host akce = účet účastníka, `sendUpdates=all`. Vitest 201/201 + nové testy, e2e v této větvi nespuštěné.
* Draft #48 `claude/vstup-mobil`: bez „Použít jiný účet“ (i `?jiny=1`), karta uprostřed i na mobilu. e2e 788 ok.
* Draft #49 `claude/unik-dat-a-design`: e2e `unik-dat.spec.ts` (HTML i RSC bez tajemství, člen max. 1 e-mail,
  pravé tlačítko neblokované), Správa: „Připojit Kalendář znovu“ jako tlačítko v kartě. Kód: tokeny do klienta
  nejdou, cookies HttpOnly, e-maily členů vidí jen správce (příjemci pozvánek).
* **Další krok 1:** po merge #47 přečíst v Neonu (jen čtení) `select status, event_format, setup_code, synced_at from
  personal_calendars` a podle `setup_code` určit důvod odmítnutí. Pak s uživatelem zapnout `self-invite`
  (proměnná na Vercelu, Production, redeploy) a živě ověřit e-mail o nové/změněné/zrušené akci (Gmail i Spam).
  Pozor na text ve Správě „Pozvánky ani e-maily o pozvání se neposílají“: v režimu self-invite neplatí, upravit.
* **Další krok 2:** úkol 5, závěrečný audit `docs/audit-zaverecny.md`. Skript `node scripts/audit-screenshoty.mjs <repo> <výstup>` (běžící `node e2e/server.mjs`, sezení z `e2e/.auth`, adresáře role/ a host/ založit předem)
  (role × 1280/390/360/320 × klíčové stránky, JPEG q60, kontrola posunu), ZIP ≤ 30 MB mimo repo, poslat přes SendUserFile.
  Screenshotovat stav po sloučení #47–#49 (lokální integrační větev, nepushovat).

**Stav 16. 11. večer, připomínky (předchozí):** #45 je v `main`. Propojení živě funguje (oba účty `active`). Google ale odmítá

`calendarList.patch` (audit `setup_none`), takže kalendář nemá výchozí připomínky ani e-mailová upozornění. Draft PR
z větve `claude/pripominky-v-akcich`: připomínky přímo v každé akci (e-mail den předem, oznámení 30 min), přepis všech
akcí při dalším přihlášení nebo zveřejnění. Lint/typy/vitest cíleně ok, celé e2e v této větvi nespuštěné.
* **Další krok 1 (uživatel říká „klíčové“):** e-mail o nové, změněné a zrušené akci. Google ho u vlastního kalendáře
  nepošle. Navrhnout uživateli (nejdřív se zeptat, větší změna):
  (a) Wiki posílá e-maily sama přes poskytovatele (např. Resend, tajemství přidá uživatel, doména/odesílatel),
      souhrn změn za akci, odhlášení, logy bez obsahu;
  (b) zpět k pozvánkám (`invites`), kde Google e-maily posílá, ale je to dnešní problém s pozvánkami;
  (c) zjistit důvod 403 `calendarList.patch` z logu Vercelu (uživatel: Vercel → projekt → Logs → filtr
      `google.personal` → kód `configure_full_http_403_…`) a podle něj zapnout aspoň ranní přehled.
  Nejdřív (c), protože je zadarmo, a souběžně se rozhodnout mezi (a) a (b).
* **Další krok 2–4:** únik dat do klienta, jednotný design (role × 1280/390/360/320), závěrečný audit
  `docs/audit-zaverecny.md` se screenshoty v jednom ZIPu ≤ 30 MB mimo repo. Každý v samostatné relaci (limit kontextu).

**Stav 16. 11. oprava kalendáře (předchozí):** #44 je v `main`, `CALENDAR_DELIVERY=personal` je na Vercelu zapnuté.
Živé propojení selhalo: 403 na `calendarList.patch` se tvářilo jako odvolání, ID kalendáře se neuložilo a každý pokus
založil další „Vzdělávání ZBC“. Draft PR z větve `claude/oprava-osobniho-kalendare` (base `main`): oprava (ID hned po
založení, 403 ≠ odvolání, znovupoužití kalendáře, první zápis v callbacku), lidské texty stavu, „Celý plán“ v hlavičce
sekce na Úvodu, nová vstupní stránka `/vstup`. Podrobnosti `docs/kalendar-ucastniku.md`, „Oprava propojení 16. 11. večer“.
* **Další krok 1:** po merge živé ověření podle kroků v PR. Když propojení zase nepůjde, přečíst v Neonu
  `personal_calendars.error_code` (`forbidden_<důvod>`) a `audit_log` (`calendar.personal.setup_basic|setup_none`).
* Stará data: oba účty jsou v DB `revoked` bez `calendar_id`. Opravené propojení je přepíše samo, zápis do DB není třeba.
  Duplicitní kalendáře (`calendarList.list` rozsah nepovoluje) smaže uživatel ručně.
* Runtime logy Vercelu relace nepřečte (MCP 403, CLI zakázané kontrolou oprávnění).
* **Další krok 2–4:** beze změny (únik dat do klienta, jednotný design, závěrečný audit).

**Stav 16. 11. pozdě v noci (předchozí):** #43 je v `main`. Draft [#44](https://github.com/ondrejmacko-it/zabohatsicesko/pull/44) z větve `claude/kalendar-ucastniku-ui`
(base `main`): UI stavu osobního kalendáře (Úvod, Plán, Správa), spouštěč na Úvodu, úklid starých pozvánek
ve Správě, štítek u návrhů, testy. Podrobnosti `docs/kalendar-ucastniku.md`, část „Doplněno 16. 11.“.
* `CALENDAR_DELIVERY=personal` na Vercelu **nenastaveno**: zápis přes API zamítla kontrola oprávnění relace.
  Nastaví uživatel ručně (Production, projekt `zbc-vzdelavani-demo`), nebo povolí volání a další relace ho udělá.
  Pozor: platí od nasazení Production. Nastavit až těsně před merge tohoto PR (jinak by redeploy `main` zapnul
  režim bez UI).
* **Další krok 1:** živé ověření podle kroků v PR (propojení, kalendář „Vzdělávání ZBC“, změna času, Gmail i Spam,
  ranní přehled, úklid starých pozvánek). Zápis do produkční DB přes Neon jen po výslovném souhlasu.
* **Další krok 2–4:** beze změny (únik dat do klienta, jednotný design, závěrečný audit), každý v samostatné relaci.
* Otevřené: odpojit i spárované cizí události při úklidu (zvoleno: ano, nemažou se), štítek „Návrh“ v seznamu
  nese plný text jen jako nápovědu (plný text je v okně akce a legendě).

**Stav 16. 11. noc (předchozí):** relace skončila na limitu kontextu. #41 a #42 jsou v `main`.
* Draft [#43](https://github.com/ondrejmacko-it/zabohatsicesko/pull/43) z větve `claude/kalendar-ucastniku` (base `main`): serverové jádro Kalendáře účastníků, **vypnuté**
  (`CALENDAR_DELIVERY` výchozí `invites`). Podrobnosti a co chybí: `docs/kalendar-ucastniku.md`, sekce „Stav
  implementace“ a „Upozornění e-mailem od Googlu“. Lint, typy, 189/189 vitest, e2e 786 prošlo + 18 přeskočeno.
* Uživatel 16. 11. povolil v prostředí hosty `developers.google.com` a `support.google.com` (dokumentace Googlu).
* **Další krok 1:** UI stavu osobního kalendáře (Úvod + Plán: stav a jedno tlačítko → `/api/google/prihlaseni?kalendar=osobni`;
  Správa: sloupec „Kalendář“ z `personalCalendarStates`), spouštěč `after(syncPersonalCalendars)` při otevření Úvodu,
  úklid 27 pozvánek z `primary` správce (tlačítko ve Správě, jen `zbcKey`, `sendUpdates=none`, vazby přepnout),
  štítek „Návrh, do Kalendáře zatím nejde“, e2e. Pak `CALENDAR_DELIVERY=personal` přes API Vercelu a živé ověření.
* **Další krok 2–4 (neudělané):** kontrola úniku dat do klienta/HTML a hlaviček, jednotný design (odkaz „Připojit
  Kalendář znovu“ ve Správě → tlačítko v kartě; role × 1280/390/360/320), závěrečný audit `docs/audit-zaverecny.md`
  se screenshoty v ZIPech ≤ 30 MB mimo repo. Na limit kontextu dávat každý úkol do samostatné relace.

**Stav 16. 11. večer (poslední):** relace skončila na limitu kontextu (200 tis.).
* Draft [#41](https://github.com/ondrejmacko-it/zabohatsicesko/pull/41) `claude/uklid-readme`: README (tabulka příkazů), souhrn auditu, zjištění 16. 11., návrh `docs/kalendar-ucastniku.md`.
* Draft [#42](https://github.com/ondrejmacko-it/zabohatsicesko/pull/42) `claude/pozvanka-po-prihlaseni` (úkol 2): pozvánka se spotřebuje až po přihlášení pozvaným účtem
  (`checkInvite` bez zápisu, cookie `zbc_invite` 30 min, scope `invite`, `claimInvite(..., userId)` v callbacku).
  Lint, typy, 184/184 vitest, e2e 786 prošlo + 18 přeskočeno. Živě neověřeno.
* **Další krok 1 (hlavní):** implementovat Kalendář účastníků podle `docs/kalendar-ucastniku.md` (varianta a,
  `calendar.app.created`, vlastní kalendář „Vzdělávání ZBC“, bez pozvánek). Nejdřív se zeptat, kam konzole
  zařadila rozsah (necitlivý/citlivý), krok 1 v tom souboru.
* **Další krok 2:** úkol 3 (krátká kontrola, že tokeny a cizí data nejdou do klienta ani HTML; žádné blokování
  pravého tlačítka), úkol 4 (jednotný design, začít odkazem „Připojit Kalendář znovu nebo jiným účtem“ ve Správě →
  tlačítko v kartě; projít role a šířky 1280/390/360/320). Obojí zatím neuděláno.
* Pozor: e2e ve zvláštním worktree potřebuje `cp -al node_modules` (symlink Turbopack odmítne).

**Stav 16. 11. (poslední, jen zjištění, kód beze změn):** #39 (PR 7) a #40 (PR 8) jsou sloučené v `main` (`7c72b91`)
a nasazené na https://zbc-vzdelavani-demo.vercel.app (ostrá Wiki, Neon `zbc-wiki-produkce`, projekt `bitter-breeze-02749976`).
Uživatel ověřil hlavičky (nosniff, X-Frame-Options DENY, Referrer-Policy same-origin). Relace skončila na limitu kontextu
při průzkumu, opravy čekají. Zjištěno (Neon jen čtením, žádný zápis):
1. **Pozvánka**: odkaz pro ondrasssssko@ se spotřeboval hned prvním otevřením (12:31, vzniklo zařízení v anonymním okně),
   druhé otevření v běžném okně server odmítl (`invite.rejected` 12:33), přihlášení Googlem proběhlo jen na tom zařízení.
   Cizí účet Google se k pozvánce nepřihlásí (`scopedAccount`: `wrong_account`). **Skutečná slabina:** kdo otevře odkaz první,
   ho spálí (zařízení vznikne dřív než přihlášení), pozvaný pak potřebuje nový odkaz. **Oprava (další krok, větev
   `claude/pozvanka-po-prihlaseni`):** `/api/pozvanka` jen ověří platnost (bez zápisu) a uloží HttpOnly cookie `zbc_invite`
   s tokenem (30 min, lax); `/api/google/prihlaseni` bez zařízení vezme scope `{ kind: "invite", userId }` + login_hint;
   `scopedAccount` ho vyhodnotí jako `device` (shoda e-mailu); callback teprve po úspěchu zavolá `claimInvite` s kontrolou
   `invite.userId === result.userId` v transakci, založí zařízení, smaže `zbc_invite`. Špatný účet = pozvánka zůstane platná.
   `LiveGate` ukáže tlačítko Google i s platnou `zbc_invite`. Testy do `tests/pozvanky.test.ts` (cizí účet nespálí, druhé
   použití neplatí, souběh) a e2e ostré Wiki. Zařízení d-4f01ed32 (ondrasssssko, Opera) je v pořádku, nerušit.
2. **Kalendář**: synchronizace **funguje**. 27 zveřejněných akcí má `sync_status = synced`, bez chyb, kalendář `primary`
   účtu zbc.test.spravce@, skuteční hosté v `managed_attendees` (FP → ondrasssssko@, RM → zbc.test.uzivatel@), API volá
   `sendUpdates=all`. Nesynchronizované jsou jen svátky (záměr) a **8 listopadových návrhů** (nezveřejněné, do Kalendáře
   nejdou). Akce `tym-a` mají prázdné hosty (skupina bez členů). Příčina „nic v Kalendáři“ je tedy nejspíš u příjemce:
   pozvánka od neznámého odesílatele (Google Kalendář → Nastavení → Obecné → Události z pozvánek „jen od známých
   odesílatelů“), Spam v Gmailu, nebo kontrola jiného účtu (ondra.macko1@ není ve Wiki). Neověřeno živě: přístup do
   schránek příjemců nemám. Ověření: detail akce jako správce ukazuje hosty načtené přímo z Googlu. Do UI doplnit:
   v Plánu u návrhů „Návrh, do Kalendáře zatím nejde“, u účastníka v detailu „Pozvánku posílá kalendář Wiki
   (zbc.test.spravce@) na vaši adresu“. Účastník oprávnění ke Kalendáři nepotřebuje, pozvánku posílá správcův kalendář.
3. **Vzhled** (odkaz „Připojit Kalendář znovu“ mimo kartu), 4. **pravé tlačítko** (nejdřív navrhnout uživateli, DevTools
   nejde zablokovat), 5. **kompletní průchod**: zatím neudělané.
* **Otevřená otázka (16. 11.):** uživatel chce, aby akce byly v Kalendáři účastníka „automaticky od prvního přihlášení“
  a myslí, že k tomu chybí žádost o Kalendář při přihlášení. Navrženo: A) ponechat pozvánky ze správcova kalendáře
  (nic od účastníka, jen ověřit Spam a nastavení „Přidávat pozvánky: Od všech“), B) žádat při přihlášení každého
  účastníka o `calendar.events` a zapisovat do jeho kalendáře (citlivý rozsah: Google bez ověření aplikace ukáže
  varování „neověřená aplikace“, ověření je mimo rozsah podle Trvalých faktů, víc tokenů a odvolání). Doporučeno A.
  Před prací na B počkat na rozhodnutí uživatele.
* `README.md` má po merge #39/#40 rozbitou tabulku příkazů (řádek `npm test` dvakrát a prázdné řádky). Opravit v prvním PR.
* `docs/audit-ukoly.md`: hotovo vše kromě A07; zbývá jen 69 přepisů z `textove-upravy.csv` (potřebuje audit ZIP).

**Stav 15. 11. noc 5:** #38 (PR 6) je v `main`. Otevřené drafty, oba base `main`, mergovat nezávisle:
* PR 7 [#39](https://github.com/ondrejmacko-it/zabohatsicesko/pull/39) (`claude/pripravit-mesic`): okno „Připravit měsíc“ (G6). Tlačítko vždy pro správce, doplnění termínů,
  párování nadcházejících akcí, živé mezery, sloupce datum/skupina/téma/vedoucí, „Uložit změny“ (nic neodešle) a „Zveřejnit“.
  176/176 vitest, e2e 772 prošlo + 18 přeskočeno.
* PR 8 [#40](https://github.com/ondrejmacko-it/zabohatsicesko/pull/40) (`claude/bezpecnost-rychlost`): hlavičky i pro statické soubory (HSTS v produkci), limit akcí
  120/min v `runAction`, Plán v jedné paralelní vlně dotazů + rozpočet dotazů v testu, `logError` jen bezpečný kód,
  `npm audit` 0. 178/178 vitest, e2e 775 prošlo + 18 přeskočeno.
* Po merge obou se střetne řádek s počtem testů v `README.md` (správně 180) a sekce PR 7/8 v `docs/audit-ukoly.md`.

**Další krok:** po merge #39 a #40 kompletní kontrola celého výtvoru na preview (role správce, vedoucí, účastník FP a RM;
1280/390/360/320), hlavičky na preview (F12 → Network), okno Připravit měsíc živě s Google Kalendářem. Zbývá jen A07 (rozhodne firma).

**Stav 15. 11. noc 4:** PR 6 dokončený jako draft z větve `claude/pristupnost-u03-u08` (base `main`):
U03, U04 (kotva `#zadosti`), U05, U07 (menu jako disclosure), U08 (souhrn chyb, fokus, pole podle šířky formuláře,
320×256). Testy `e2e/pristupnost.spec.ts` a `tests/journey.test.ts`. Draft PR [#38](https://github.com/ondrejmacko-it/zabohatsicesko/pull/38).
**PR 7 rozpracovaný** na větvi `claude/pripravit-mesic` (z `main`, bez PR, commit `b895da1`): hotová jen serverová
část `publishDrafts` (ruční datum v témže měsíci a v budoucnu, publikum, `{ publish: false }` = uložit bez
zveřejnění, chyba `outside_month`). Zbývá: `publishMonthAction` (pole `date-<id>`, `aud-<id>`, `intent=save`),
přestavět `PublishMonthDialog` na okno „Připravit měsíc“ (tlačítko vždy pro správce, uvnitř „Doplnit chybějící
termíny“ = `generateMonthAction`, přehled mezer a stavu párování z `monthCards[].syncStatus`, sloupce datum
a skupina, „Uložit změny“ a „Zveřejnit“), vitest pro `publishDrafts` (datum mimo měsíc, minulost, uložení bez
zveřejnění nic neodešle) a e2e okna. Pak PR 8 podle `docs/audit-ukoly.md`.

**Stav 16. 11. noc 4, Plán a Úvod (poslední):** #51 (`claude/oprava-kalendare-401`) zatím NENÍ v `main`
(ověřeno `git merge-base --is-ancestor`), čtení Neonu proto čeká. Blok „Stav 16. 11. noc 3“ je v předávce větve #51.
* Draft PR z `claude/plan-pridani-a-presun`: „+“ na dni v měsíčním Plánu (`?den=`), přesun tažením s potvrzením,
  „Přesunout na jiný den“ v náhledu i detailu. Server `planMove` (events.ts) + `previewMoveAction`/`moveEventAction`.
  Vitest 209/209 (nové `tests/presun.test.ts`), e2e `e2e/plan-planovani.spec.ts`.
* Draft PR z `claude/domu-ceka-na-vas`: `TasksCard` + `orderTasks` (Plán i Úvod), Úvod 2 sloupce / pod sebou.
  e2e `e2e/domu-ukoly.spec.ts`.
* **Další krok 1:** po merge #51 a nasazení číst (jen čtení) `select status, event_format, setup_code, error_code,
  synced_at from personal_calendars` a postupovat podle `docs/kalendar-ucastniku.md`, část „Po merge #47: 401…“.
* **Další krok 2:** po merge PR Plánu živě vyzkoušet přesun zveřejněné akce na ostré Wiki (Kalendář účastníků).
* Otevřené: přesun mimo měsíc a do minulosti je odmítnutý (pravidlo z Připravit měsíc), proběhlou akci přesunout
  nejde; zveřejněná akce s rozpracovaným návrhem se přesune jen v návrhu. „+“ jen u dnů od dneška.

**Stav 15. 11. noc 3:** #34, #35 a #36 se sloučily jen do svých základních větví, ne do `main`. Jejich obsah jde do
`main` draft PR [#37](https://github.com/ondrejmacko-it/zabohatsicesko/pull/37) z `claude/testy-desktop-macos`. Další práci
stavět z `main` až po sloučení #37. U dalších PR v řetězu dávat base `main` (ne předchozí větev) a mergovat postupně.

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
