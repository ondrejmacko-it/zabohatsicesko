# Zpětná vazba (brouček)

Plovoucí tlačítko vpravo dole (počítač i telefon) a položka „Zpětná vazba“ v levém menu na všech šířkách.
Převzato a zjednodušeno z Novi AI Tutor. Hlášení jde ze serveru do webhooku Make.com, Wiki ho neukládá do databáze.

## Jak to funguje

1. Okno ve třech krocích: typ (Chyba, Vzhled / ovládání, Nápad, Ostatní) → popis, u chyby „Co by mělo fungovat
   jinak?“, nepovinně „Označit místo“ (klik na prvek nebo tažením obdélník, max. 10) → kontrola se souhrnem.
   Značka nese jen strukturální popis (druh prvku + místo, např. „Karta v harmonogramu“, „Tlačítko v okně“,
   „Označená oblast“) a selektor z tagů a `:nth-of-type`. Žádný text stránky, `aria-label`, `title`, id, třídy
   ani `data-*`. Server přijme jen popisy ze seznamů v `src/lib/feedback.ts` a selektor podle
   `FEEDBACK_SELECTOR_PATTERN`.
2. Snímek obrazovky je nepovinný a pořídí se až tlačítkem „Pořídit snímek“ v kontrole. Uživatel ho vidí před
   odesláním a může ho odebrat. Snímek se nabízí jen na ověřených stránkách (pozitivní seznam
   `FEEDBACK_SHOT_PAGES`: Úvod, Harmonogram, Témata). Tyto stránky vykreslí serverovou komponentu `ShotGrant`
   s podepsaným povolením (HMAC ze `SESSION_SECRET`, vázané na účet a stránku, platnost 12 h,
   `src/server/feedback-grant.ts`). Server snímek bez platného povolení odmítne; na cestě z klienta nezáleží.
   Poctivě: obsah obrázku server ověřit neumí, povolení jen dokládá, že uživatel měl otevřenou povolenou stránku.
   Text hlášení jde odeslat vždy, i bez snímku.
3. Ochrana snímku: okno, brouček ani vrstva označování se do snímku nedostanou. V kopii stránky se vymažou hodnoty
   polí a skryjí zápisy, přepisy, nahrávky a údaje účtu (`[data-feedback-redact]` přidá další). Po vykreslení se
   pole a tyto části ještě neprůhledně přetřou. Omezení: lepkavé prvky (levé menu) se v kopii vykreslí na přirozeném
   místě, ne tam, kde je uživatel vidí. Na povolených stránkách se text karet harmonogramu nepřetírá (stránky
   s ukázkovými daty jsou ověřené); jméno přihlášeného na Úvodu přetřené je.
   Snímek je jen viditelná část okna, škálovaná podle hustoty displeje (nejvýš 2×, delší strana ≤ 2000 px).
   Plné vykreslení stránky je omezené na 16 Mpx a 16 000 px výšky (Safari), při velikosti nad 500 kB se snižuje
   kvalita a pak rozměr (×0,75, nejvýš 3×). Značky se dokreslí posunuté podle rolování.
4. Úspěch se ukáže až po `ok: true` ze serveru. Při chybě text zůstane v okně a jde to zkusit znovu. Zavření
   během odesílání okno jen schová, odeslání doběhne. Když Make neodpoví do 10 s, výsledek je `uncertain`
   („hlášení nejspíš dorazilo“): ochrana dvojího odeslání zůstává, opakování vrátí „už bylo odesláno“.
5. Brouček jde přetáhnout (přichytí se k bližšímu okraji), posunout šipkami, schovat k okraji (jazýček) nebo skrýt
   úplně. Skrytého vrátí položka v menu. Poloha se pamatuje v `localStorage` (`zbc-broucek`). Schová se při otevřeném
   okně a během přesunu akce, uhýbá hlavním tlačítkům (`.btn-primary`, `[data-bug-avoid]`, výběrová lišta).
6. Telefon a dotyk (`(max-width: 900px), (pointer: coarse)`): 48 px, 12 px od okraje, respektuje safe-area,
   uhýbá `.quick-actions` a panelu přesunu. Klepnutí otevře okno, podržení 400 ms spustí přesun, švihnutí nic
   neudělá. Panel označování je na úzké obrazovce přes celou šířku dole a jde přepnout nahoru.

## Server

`src/app/(wiki)/feedback-actions.ts` → `src/server/feedback.ts`:

* zod validace konceptu (text 2000, očekávání 1000, max. 10 značek se strukturálním popisem), snímek WebP nebo
  JPEG ověřený podle bajtů, max. 500 kB; rozměry přečtené z hlavičky obrázku (JPEG SOF, WebP VP8/VP8L/VP8X)
  musí odpovídat deklarovaným a být nejvýš 2000 × 2000 px, nečitelná hlavička = `invalid`;
* snímek jen s platným podepsaným povolením stránky (viz výše); do Make se povolení neposílá;
* tělo server action omezuje stávající `bodySizeLimit: "4200kb"` v `next.config.ts`;
* limit 10 pokusů za hodinu na účet (`rate_limits`, klíč `feedback:<id>`) a ochrana dvojího odeslání
  (`feedback-once:<hash>`, po HTTP chybě nebo chybě spojení se uvolní, po vypršení času ne). Bez migrace;
* POST JSON na `FEEDBACK_WEBHOOK_URL` s hlavičkou `x-zbc-feedback-secret: <FEEDBACK_WEBHOOK_SECRET>`, timeout 10 s,
  bez přesměrování. Do logu jde jen kód (`feedback.webhook http_500`), nikdy text ani snímek;
* bez obou proměnných vrací `not_configured` a nic neodešle.

## Tvar payloadu (`schemaVersion: 1`)

```json
{
  "schemaVersion": 1, "source": "zbc-wiki", "id": "uuid", "createdAt": "2026-11-20T10:00:00Z",
  "type": "bug | ui | idea | other", "text": "…", "expected": "… | null",
  "marks": [{ "kind": "element | rect", "description": "tlačítko „Uložit“ v sekci „Akce“", "selector": "… | null",
              "box": { "x": 0, "y": 0, "width": 0, "height": 0 } }],
  "screenshot": { "mime": "image/webp", "width": 1280, "height": 800, "base64": "…" } ,
  "context": { "path": "/vzdelavani/harmonogram", "viewport": { "width": 1280, "height": 800 }, "pixelRatio": 2,
               "appVersion": "abc1234 | null", "userAgent": "…", "wikiMode": "demo | production",
               "preview": { "key": "skupina-fp", "label": "Finanční poradci" } },
  "reporter": { "ref": "pseudonym (hash id účtu)", "role": "member", "signedInWith": "demo | google" }
}
```

`screenshot` i `preview` mohou být `null`. Jméno ani e-mail se neposílají; `reporter.ref` je stálý pseudonym účtu.

## Nastavení Make.com (dělá správce)

1. Scénář → modul **Webhooks › Custom webhook**, zkopírovat adresu (`https://hook.eu1.make.com/…`).
2. Hned za něj **filtr**: hlavička `x-zbc-feedback-secret` se rovná tajemství (vygenerovat `openssl rand -base64 48`).
   Bez shody scénář dál nepokračuje.
3. Další moduly podle potřeby (např. Google Sheets řádek, e-mail týmu, uložení snímku z `screenshot.base64`
   jako soubor na Disk). Webhook odpovídá 200 („Accepted“), jinak Wiki ukáže chybu doručení.
4. Ve Vercelu nastavit `FEEDBACK_WEBHOOK_URL` a `FEEDBACK_WEBHOOK_SECRET` (Preview, případně Production) a znovu nasadit.
5. Uložená hlášení (tabulka, Disk) mazat po 12 měsících; obsahují popis od zaměstnanců a snímky obrazovky.

## Testy

* Unit `tests/zpetna-vazba.test.ts`: validace, typ snímku, `not_configured`, konfigurace URL, payload bez jména,
  dvojí odeslání a opakování po chybě, limit, log bez obsahu, poloha broučka.
* E2E `e2e/zpetna-vazba.spec.ts` proti falešnému webhooku z `e2e/server.mjs` (`127.0.0.1:3312`, tajemství jen pro test).
  Falešný webhook umí `SIMULOVAT-POMALU` (3 s) a `SIMULOVAT-TIMEOUT` (11 s, hlášení uloží). Testy pokrývají
  citlivou fixturu (popisy, selektory, JSON i pixely snímku), dlouhou a posunutou stránku, podvržené povolení,
  dvojklik, zavření během odesílání, vypršení času, Escape a telefon 390 / 320 px.
  Živý Make.com se v testech nevolá.
