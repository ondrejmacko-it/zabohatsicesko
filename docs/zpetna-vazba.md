# Zpětná vazba (brouček)

Plovoucí tlačítko vpravo dole (jen počítač s myší, šířka od 900 px) a položka „Zpětná vazba“ v levém menu.
Převzato a zjednodušeno z Novi AI Tutor. Hlášení jde ze serveru do webhooku Make.com, Wiki ho neukládá do databáze.

## Jak to funguje

1. Okno ve třech krocích: typ (Chyba, Vzhled / ovládání, Nápad, Ostatní) → popis, u chyby „Co by mělo fungovat
   jinak?“, nepovinně „Označit místo“ (klik na prvek nebo tažením obdélník, max. 10) → kontrola se souhrnem.
2. Snímek obrazovky je nepovinný a pořídí se až tlačítkem „Pořídit snímek“ v kontrole. Uživatel ho vidí před
   odesláním a může ho odebrat. Na `/sprava` a `/vzdelavani/integrace` se snímek nenabízí a server ho odmítne.
3. Ochrana snímku: okno, brouček ani vrstva označování se do snímku nedostanou. V kopii stránky se vymažou hodnoty
   polí a skryjí zápisy, přepisy, nahrávky a údaje účtu (`[data-feedback-redact]` přidá další). Po vykreslení se
   pole a tyto části ještě neprůhledně přetřou. Omezení: lepkavé prvky (levé menu) se v kopii vykreslí na přirozeném
   místě, ne tam, kde je uživatel vidí.
4. Úspěch se ukáže až po `ok: true` ze serveru. Při chybě text zůstane v okně a jde to zkusit znovu.
5. Brouček jde přetáhnout (přichytí se k bližšímu okraji), posunout šipkami, schovat k okraji (jazýček) nebo skrýt
   úplně. Skrytého vrátí položka v menu. Poloha se pamatuje v `localStorage` (`zbc-broucek`). Schová se při otevřeném
   okně a během přesunu akce, uhýbá hlavním tlačítkům (`.btn-primary`, `[data-bug-avoid]`, výběrová lišta).

## Server

`src/app/(wiki)/feedback-actions.ts` → `src/server/feedback.ts`:

* zod validace konceptu, snímek WebP nebo JPEG ověřený podle bajtů, max. 500 kB;
* limit 10 pokusů za hodinu na účet (`rate_limits`, klíč `feedback:<id>`) a ochrana dvojího odeslání
  (`feedback-once:<hash>`, po chybě doručení se uvolní). Bez migrace;
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
  Živý Make.com se v testech nevolá.
