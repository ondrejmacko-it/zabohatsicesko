# Report – finální dokončení PR #75 (zpětná vazba, brouček)

Stav k 20. 11. 2026, větev `claude/funkce/zpetna-vazba-broucek`. Make.com (scénář, webhook, hlavička
`x-zbc-feedback-secret`) se na pokyn uživatele neměnil. Všechna testovací data jsou fiktivní.

## A. Přehled oprav

| ID | Problém | Původní stav | Oprava | Ověření |
|----|---------|--------------|--------|---------|
| A1 | Únik textu stránky v popisu značky | Popis značky bral text prvku, `aria-label`, `title` | Jen strukturální popis (druh + místo), selektor z tagů a `:nth-of-type`; server přijme jen povolené popisy a selektor podle vzoru | unit, e2e „citlivé texty…“ (fixture fiktivních řetězců, JSON z webhooku je neobsahuje) |
| A2 | Na telefonu nebyl brouček | Jen `(min-width: 900px) and (pointer: fine)`, položka v menu skrytá ≤ 900 px | Brouček 48 px na dotyku, podržení 400 ms = přesun, uhýbá `.quick-actions`, safe-area; položka v menu na všech šířkách | e2e telefon-390 / telefon-320 (viditelnost, nezakrývá akce, celý průchod) |
| A3 | Snímek povolený podle cesty z klienta | `screenshotAllowed(context.path)` – cestu šlo podvrhnout | Pozitivní seznam stránek + podepsané povolení (HMAC, účet, stránka, 12 h) ze serverové komponenty | unit (podpis, účet, expirace, stránka), e2e „podvržené povolení…“ |
| A4 | Rozměry obrázku se neověřovaly | Jen magické bajty a velikost | Rozměry z hlavičky JPEG/WebP musí souhlasit s deklarovanými, max. 2000 × 2000 | unit (nesoulad, nečitelná hlavička) |
| A5 | Opakování po vypršení času = duplicita v Make | Timeout uvolnil ochranu dvojího odeslání | Timeout → `uncertain`, ochrana zůstává, hláška „nejspíš dorazilo“ | unit, e2e `SIMULOVAT-TIMEOUT` |
| A6 | Znovuotevření po úspěchu vracelo starý koncept | Druhé odeslání končilo „duplicate“ | Úspěch zůstane vidět, nový koncept až po „Hotovo“ nebo zavření | e2e |
| A7 | Změna typu mazala „Co by mělo fungovat jinak“ | Text se ztratil | Změna typu pole nemaže | e2e |
| A8 | Zahodit během odesílání | Šlo zahodit rozeslané hlášení | Zavření během odesílání okno jen schová, odeslání doběhne | e2e „dvojklik a zavření během pomalého odeslání“ |
| A9 | Značky po rolování posunuté ve snímku | Značky kreslené v souřadnicích okna při označení | Posun o rozdíl rolování, číslo uvnitř u horního okraje | e2e „dlouhá a posunutá stránka“ |
| A10 | Výkon a limity snímku na dlouhé stránce | Plné vykreslení bez meze, rozlišení bez DPR | Jen viditelná část, DPR ≤ 2, ≤ 2000 px, mez plného vykreslení 16 Mpx / 16 000 px, snižování kvality a rozměru do 500 kB, uvolnění canvasů | e2e dlouhá stránka (nejvýš 2000 px, bez selhání) |
| A11 | Panel označování na telefonu | Panel překrýval obsah | ≤ 760 px přes celou šířku dole, přepínač nahoru, `user-select: none` | e2e telefon, vizuální snímky |

## B. Bezpečnost

* Popisy a selektory značek: jen pevné seznamy, ověřené i na serveru (nespoléhá na klienta).
* Snímek: autorizace nezávislá na klientských metadatech (podepsané povolení, ověří podpis, účet, expiraci a
  stránku z pozitivního seznamu). Do Make se povolení neposílá, tvar payloadu beze změny.
* Obrázek: typ podle bajtů (WebP/JPEG), max. 500 kB, rozměry z hlavičky = deklarované, ≤ 2000 px.
  Tělo server action omezuje stávající `bodySizeLimit: "4200kb"`.
* Omezení (poctivě): obsah obrázku server ověřit neumí; povolení jen dokládá, že uživatel měl otevřenou povolenou
  stránku. Na povolených stránkách se text karet harmonogramu ve snímku nepřetírá (ukázková data, stránky ověřené),
  jméno na Úvodu přetřené je (ověřeno pixelově).
* Log bez obsahu hlášení (jen kód), reporter = hash id + role.

## C. UX/UI

* Tři kroky zachované (typ → popis → kontrola), bez redesignu, bez varovných pruhů.
* Zahození rozepsaného hlášení jen přes stávající ConfirmDialog; Escape zavírá jen nejvyšší okno; „Skrýt broučka“
  text neztratí.
* Telefon: brouček i položka v menu; nezakrývá `.quick-actions`; panel označování dole přes celou šířku.
* Otevřené (ne vada): po `uncertain` zůstává tlačítko Odeslat; druhý pokus bezpečně vrátí „už bylo odesláno“.

## D. Testy (skutečně naměřené)

VYPLNÍ SE

## E. Make.com

Beze změn (pokyn uživatele). Ve Vercelu (`zbc-vzdelavani-demo`, tým maci) existují `FEEDBACK_WEBHOOK_URL` (plain)
a `FEEDBACK_WEBHOOK_SECRET` (sensitive) pro Preview i Production – hodnoty nedešifrovány. Živé hlášení do Make
se z relace neposílalo; ověří uživatel testovacím hlášením z Preview (telefon i počítač).

## F. GitHub

VYPLNÍ SE
