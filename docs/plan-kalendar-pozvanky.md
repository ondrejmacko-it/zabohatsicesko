# Plán: jeden centrální Kalendář s pozvánkami (schváleno 17. 11.)

Uživatel schválil plán a doplnil podmínky. Tento soubor je závazné zadání pro PR A až D. Pokud se liší
od starších předávek, platí tento soubor, aktuální kód a ověřený stav produkce.

## Výsledek
Jedna kalendářová integrace: samostatný organizátor (dedikovaný účet Google, pilot bez Workspace) zapisuje
zveřejněné akce do svého kalendáře a zve účastníky podle skupin. Žádný osobní kalendář, self-invite, SMTP ani Resend.

## Stav před začátkem (17. 11.)
* `main` = f3f18ca (#51, #52, #53). #54 = jen dokumentace, nahrazuje ji tento soubor (zavřít po souhlasu).
* Production: `CALENDAR_DELIVERY=personal`, `CALENDAR_PERSONAL_NOTIFY=off` (bylo `self-invite`),
  `CALENDAR_ATTENDEES=audience`, `CALENDAR_MODE=google-test`. Vercel projekt `prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`,
  team `team_PtkXmFd9hI7UeUYovGkbwZQG` (MCP Vercelu projekt nevidí, funguje `curl https://api.vercel.com/...`
  přes proxy; hodnoty tajemství nečíst). Hobby plán: cron jen 1× denně.
* Neon `bitter-breeze-02749976` (jen čtení): 2 `personal_calendars` `active`, `setup_code` všude `401_authError`
  (`calendarList` s rozsahem `calendar.app.created` nejde); `personal_calendar_entries` 19 + 4; `calendar_links`
  45 na `primary`, žádná s `external_event_id`.
* Potvrzené chyby: `src/server/calendar/google.ts:154` (každé 403 kromě kvót = odvolání), `TopicsSection.tsx:21`
  (Doporučené = první 3 nenaplánovaná i s nulovým zájmem). Repo je veřejné.

## Podmínky uživatele (nepřekračovat)
1. **Pozvánky:** skutečné pozvánky Google, stabilní ID události (odvozené z akce), `sendUpdates=all`,
   `guestsCanSeeOtherGuests=false`, `guestsCanModify=false`, `guestsCanInviteOthers=false`, `Europe/Prague`.
   Zrušení = `status: cancelled` na původní události. Úprava mění jen spravovaná pole a spravované hosty, nikdy
   `responseStatus`. Odmítnuto = nezvat znovu, dokud se akce nezmění.
   **Neslibovat** automatické přidání dalších pozvánek po první (záleží na nastavení příjemce, „známý odesílatel“).
   Wiki musí fungovat i v režimu, kdy uživatel odpovídá na každou pozvánku.
2. **Stavy RSVP:** `needsAction` čeká na odpověď, `accepted` přijata, `tentative` možná, `declined` odmítnuto,
   **stav nelze ověřit** (Google nedostupný). Přijetí ≠ ověřené přidání do osobního kalendáře.
3. **syncToken:** počáteční úplná synchronizace, stránkování, token uložený v DB, při `410 Gone` úplná
   synchronizace znovu. Čtení RSVP nikdy nezapisuje do Googlu (žádné pozvánky, žádné změny odpovědí).
4. **Upozornění v UI:** jedna seskupená karta na Úvodu; červeně jen blížící se akce bez odpovědi (např. do 7 dní),
   vzdálené neutrálně. Odkaz „Otevřít Gmail“ = vyhledávání podle odesílatele včetně Spamu (`in:anywhere`), ne vymyšlený
   odkaz na zprávu. Stav se obnoví bez přihlášení (návrat do okna, mírný interval), bez agresivního pollingu.
5. **Pravidelný běh:** GitHub Actions co 10 min jen jako dočasné řešení pro test. Vyřešit: zpoždění/výpadek,
   vypnutí plánovače po 60 dnech neaktivity veřejného repa, uložení posledního úspěšného běhu, upozornění správci
   (ve Správě) při výpadku, ověření požadavku (tajný token v hlavičce, porovnání v konstantním čase), opakování bez
   duplicit (zámky, idempotence). Denní cron Vercelu jako záloha nestačí sám. **Navrhnout dlouhodobý provoz**
   (např. Vercel Pro cron, nebo jiný hosting) s náklady, nic placeného neaktivovat.
6. **Trvalá fronta (outbox):** záznam ve stejné transakci jako zveřejněná revize; nejnovější revize vyhrává;
   opakování s prodlevou; rozlišení konfigurace / přístupu / dočasné chyby; upozornění správci při dlouhé chybě.
7. **Migrace:** nejdřív nový systém, test na testovacích účtech, dry-run. Před přepnutím ukázat uživateli: počet
   budoucích událostí, počet pozvaných, kolik reálných e-mailů změna vyvolá, které staré kalendáře/události se
   odstraní, plán návratu. **Bez schválení:** žádné produkční přepnutí, hromadné pozvánky, mazání osobních
   kalendářů, destruktivní migrace DB, placené služby, merge do `main`.
8. **Organizátor:** dedikovaný účet (ne osobní účet zaměstnance). Kód a testy bez znalosti adresy; připojí se
   až před živým testem.
9. **UX (PR C):** projít každou obrazovku a roli zvlášť a aktivně zjednodušovat (duplicity, texty, technické stavy,
   zbytečné ovladače), zachovat vizuální styl a funkce. Kontrola testovacích názvů, překryvů, doporučování témat.

## Rozdělení
* **PR A** `claude/kalendar-pozvanky-organizator`: adaptér organizátora (oprava 403, ochrana odpovědí, soukromí hostů,
  zrušení), outbox + zpracování (po zveřejnění, při návštěvě, endpoint pro GitHub Actions, denní cron), RSVP přes
  syncToken (tabulka stavů, 410), karta pozvánek na Úvodu, stav běhu a upozornění ve Správě, testy chyb 401/403/404/
  409/410/429/5xx a scénářů. Osobní režim zatím zůstává v kódu, ale nový režim ho vylučuje (žádný souběh).
* **PR B:** inventura a dry-run migrace, skript pro smazání kalendářů Wiki (spustit jen po schválení),
  odstranění `personal*`, `legacy-invites`, `PersonalCalendarStatus`, `CALENDAR_DELIVERY`, `CALENDAR_PERSONAL_NOTIFY`.
  Tabulky smazat až pozdější migrací.
* **PR C1** Úvod a Plán, **PR C2** Přidat akci, Příprava měsíce, Témata, Správa, Zápisy.
* **PR D:** celkové testy (320–1920 px, axe, klávesnice, modální okna, únik dat), screenshoty v ZIPu mimo repo,
  živý test Googlu podle 10 bodů zadání (zapsat přesné výsledky), plán hostingu, předávka.

## Hlídat
* Při slučování `main` do větví kontrolovat zdvojené importy a deklarace (#53 kvůli tomu spadl build).
* e2e nespouštět z worktree se symlinkem `node_modules`; porty 3310/3311 předem uvolnit; `playwright install` ne.
