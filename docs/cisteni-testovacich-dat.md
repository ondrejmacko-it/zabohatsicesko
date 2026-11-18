# Testovací data v ostré Wiki: inventura a návrh vyčištění

Stav k 17. 11. 2026. Inventura vznikla **jen čtecími dotazy (SELECT)** nad produkční databází
(Neon projekt `zbc-wiki-produkce`, výchozí větev). Nic se nemazalo ani neupravovalo.
**Bez výslovného schválení uživatele se produkční data nemění.**

## Co v databázi je

Témata (tabulka `topics`, 8 řádků; sloupec `archived_at` inventura nečetla):

| Téma | Publikum | Zájemci | Akce s tématem | Posouzení |
|---|---|---|---|---|
| Návaznost po konzultaci | Všichni | 3 | 4 | Věcný název, ponechat (rozhodne uživatel) |
| Test | RM | 2 | 1 | Testovací |
| Něco | Všichni | 2 | 1 | Testovací |
| Ahoj | Všichni | 1 | 2 | Testovací |
| Ahojda | FP | 1 | 1 | Testovací |
| Tos | FP | 1 | 1 | Testovací |
| Ahojky | RM | 0 | 0 | Testovací, bez vazeb |
| Tym A | Tým A | 0 | 0 | Pravděpodobně testovací, bez vazeb |

Akce s testovacím tématem (všechny **zveřejněné a s vazbou na Google Kalendář**, bez nahrávek a zápisů):

| Datum | Akce | Téma | Publikum |
|---|---|---|---|
| 17. 11. 2026 9:00 | Jiná akce | Ahoj | Všichni |
| 11. 12. 2026 8:30 | Firemní vzdělávání FP | Něco | FP |
| 18. 12. 2026 8:30 | Firemní vzdělávání RM | Test | RM |
| 8. 1. 2027 8:30 | Firemní vzdělávání RM | Ahoj | RM |
| 15. 1. 2027 8:30 | Firemní vzdělávání FP | Ahojda | FP |
| 29. 1. 2027 8:30 | Firemní vzdělávání FP | Tos | FP |

Další podezřelé ruční akce (k posouzení uživatelem, nemusí jít o test):

* 16. 11. 2026 21:00 Jiná akce · Návaznost po konzultaci · Všichni (neobvyklý čas).
* 17. 11. 2026 9:00 Jiná akce bez tématu · Všichni a 17. 11. 9:00 Trénink RM · Návaznost po konzultaci · Všichni
  (tři akce ve stejný čas včetně „Ahoj“ výše).
* 18. 11. 2026 9:00 Action time · Návaznost po konzultaci · Tým A.

Celkem 53 akcí mimo svátky: 8 návrhů (3.–13. 11., už proběhlé, nikdy nezveřejněné), zbytek zveřejněný se
synchronizací do Kalendáře. Nahrávky ani zápisy v produkci nejsou.

## Proč ne přímé mazání v databázi

Zveřejněné akce mají pozvánky v Google Kalendáři. Smazání řádku v databázi by pozvánky u kolegů nechalo
viset a Wiki by o nich přestala vědět. Úprava tématu nebo zrušení přes Wiki naopak pošle přes Kalendář
změnu, případně storno (`sendUpdates=all`), tedy **e-mail pozvaným**. Proto každý krok níže potřebuje
schválení.

## Navržený postup (po schválení, vše přes UI Wiki jako správce)

1. **Témata bez vazeb** (`Ahojky`, případně `Tym A`): v Témata → Archivovat. Žádný dopad na Kalendář.
2. **Budoucí akce s testovacím tématem** (11. 12., 18. 12., 8. 1., 15. 1., 29. 1.): v okně akce smazat
   téma nebo ho nahradit skutečným a dát Zveřejnit změny. Okno před zveřejněním ukáže dopad
   („Změníte téma akce pro N lidí“). Kolegové dostanou e-mail o změně. Pokud jde o celé testovací akce,
   místo úpravy je Zrušit (storno pozvánky) – rozhodne uživatel.
3. **Proběhlé akce** (16.–17. 11.): pozvánka už nic neřeší. Doporučení nechat beze změny, nebo je zrušit
   bez dopadu na budoucí plán. Rozhodne uživatel.
4. Po kroku 2 testovací témata (`Test`, `Něco`, `Ahoj`, `Ahojda`, `Tos`) archivovat v Témata. Zájmy
   (`topic_interests`) zůstanou u archivovaného tématu, nic se nemaže.
5. Kontrolní SELECT (stejný jako inventura) potvrdí, že v plánu žádné testovací téma nezůstalo.

Volitelně před krokem 2 vytvořit v Neonu snapshot / větev produkce jako zálohu (nedestruktivní).

## Před čištěním: ověřit režim Kalendáře a dopad na každou akci (doplněno 17. 11. 2026)

Stav: **jen návrh, nic neprovedeno.** Na stránce Správa je režim osobních kalendářů (`CALENDAR_DELIVERY=personal`).
V tomto režimu Wiki pozvánky ani e-maily neposílá: zrušení akce se jen promítne do kalendářů „Vzdělávání ZBC“
u propojených uživatelů (`syncPersonalCalendars`) a vazby v `calendar_links` se označí za zpracované
(`markLinksDelivered`). Starší vazby z doby režimu organizátora ale mohou mít `external_event_id` na pozvánku
v kalendáři organizátora. Ta by se v osobním režimu nezrušila a v Google by zůstala.

Před každou operací, pouze read-only:
1. Ověřit skutečné proměnné produkce (Vercel, Production): `CALENDAR_MODE`, `CALENDAR_DELIVERY`, `CALENDAR_ATTENDEES`, `CALENDAR_PERSONAL_NOTIFY`.
2. Pro každou ze 6 zveřejněných akcí přečíst `calendar_links` (`external_event_id`, `calendar_id`, `sync_status`)
   a zjistit, kdo má propojený osobní kalendář (`personal_calendars`).
3. Do tabulky zapsat pro každou akci: vazba ano/ne, kalendář, očekávaný dopad (osobní kalendáře / pozvánka
   organizátora / nic) a zda může odejít e-mail (při `CALENDAR_PERSONAL_NOTIFY=self-invite` ano, vlastníkovi).
4. Teprve potom schválení uživatele a provedení přes UI.

## Read-only inventura 6 akcí a režimu Kalendáře (17. 11. 2026, večer)

Jen jeden `SELECT` v Neon `zbc-wiki-produkce` (výchozí větev) a výpis proměnných projektu Vercel
`zbc-vzdelavani-demo` bez dešifrování. Nic se neměnilo, žádné tokeny ani osobní údaje (jen počty).

**Režim Kalendáře (Production):** `CALENDAR_MODE=google-test`, `CALENDAR_ATTENDEES=audience` (obě čitelné),
`CALENDAR_DELIVERY` a `CALENDAR_PERSONAL_NOTIFY` jsou uložené jako šifrované, hodnota se nečetla. Nepřímý
důkaz osobního režimu z databáze: všechny vazby jsou `synced` bez pozvánky organizátora (podpis
`markLinksDelivered`) a existují záznamy `personal_calendar_entries`. Preview: `simulation`.

| Akce (ID) | Téma | Začátek (UTC) | Stav | Publikum | Vazba | Pozvánka organizátora | Osobní zápisy |
|---|---|---|---|---|---|---|---|
| ev-acc43d67… | Ahoj | 2026-11-17 08:00 | zveřejněno | Všichni | synced | ne | 2 |
| ev-7bf7ae02… | Něco | 2026-12-11 07:30 | zveřejněno | FP | synced | ne | 1 |
| ev-2d718009… | Test | 2026-12-18 07:30 | zveřejněno | RM | synced | ne | 0 |
| ev-31d566c5… | Ahoj | 2027-01-08 07:30 | zveřejněno | RM | synced | ne | 0 |
| ev-239d56fe… | Ahojda | 2027-01-15 07:30 | zveřejněno | FP | synced | ne | 1 |
| ev-9b32a6c1… | Tos | 2027-01-29 07:30 | zveřejněno | FP | synced | ne | 1 |

Dopad zrušení přes UI: žádná akce nemá pozvánku organizátora, takže nikomu nepřijde storno pozvánky.
Čtyři akce mají záznam v osobních kalendářích (celkem 5 zápisů), ty Wiki při další synchronizaci odebere
(při zapnutém `CALENDAR_PERSONAL_NOTIFY=self-invite` by Google dotčeným poslal e-mail o zrušení, hodnota
se neověřovala). Akce „Ahoj“ 17. 11. už proběhla. **Nic neprovedeno, čeká na schválení.**

## Otevřené otázky pro uživatele

* Které z akcí výše jsou testovací celé (zrušit), a u kterých jen opravit téma?
* Je „Návaznost po konzultaci“ a „Tym A“ skutečné téma?
* Smí se kolegům odeslat e-mail o změně nebo stornu z Google Kalendáře?

## Fiktivní seed ukázky

`src/server/seed.ts` + `demo/seed.json`: témata „Otevřené otázky na schůzce“, „Příprava na úvodní schůzku“,
„Týmové priority“, „Návaznost po konzultaci“; role s názvy rolí, e-maily `@example.invalid`. Seed je v ostré
Wiki zakázaný (`isLiveWiki()` → chyba při seedu i obnově), ostrá Wiki dostane jen pravidelný týden. Úprava
seedu není potřeba.

## Provedeno: čištění a vzorná data pro prezentaci (18. 11. 2026)

Na pokyn uživatele (data i kolegové fiktivní, e-maily ani kalendáře nevadí) přímo v Neon `zbc-wiki-produkce`,
výchozí větev `main`, **jedna transakce** (22 příkazů s pojistkami: transakce spadne, pokud nesedí 6 akcí
s testovacím tématem nebo pokud by testovací téma ještě mělo akci).

**Záloha:** Neon větev `zaloha-pred-cistenim-2026-11-17` (`br-shy-dawn-bafiido4`, bez compute, stav před změnou).
Obnova: v Neonu „Restore“ výchozí větve z této větve, případně porovnat přes `compare_database_schema`/SELECT.

**Smazáno:**
* 6 akcí z tabulky výše. Kaskádou `event_revisions`, `calendar_links`, nahrávky, přepisy a zápisy (žádné nebyly),
  ručně `calendar_responses` (0). Pro 5 vygenerovaných slotů zapsané `generation_exclusions`, jako to dělá
  `deleteDraft`, aby je generování měsíce nevrátilo.
* Témata Test, Něco, Ahoj, Ahojda, Tos, Ahojky, Tym A; zájmy kaskádou.
* Proběhlá akce 12. 11. Trénink RM měla téma „Tym A“: téma odebráno a zveřejněna revize 3 (snímek, `event_revisions`,
  vazba `pending`, audit `event.publish`), jinak by v plánu zůstal název smazaného tématu.
* Audit: `event.delete_test_data` ×6, `topic.delete_test_data` ×7 (aktér správce).

**`personal_calendar_entries` (5 řádků) záměrně nesmazané.** Odkazují na události v Google kalendářích
„Vzdělávání ZBC“. Při smazání by tam události zůstaly bez vazby. Osobní synchronizace (`syncPersonalCalendars`)
je pozná jako `stale`, smaže je v Googlu a pak smaže i řádky. Synchronizace je vyžádaná
(`personal_calendars.sync_requested_at = now()`), proběhne při návštěvě Wiki nebo denním cronu. Stav
18. 11. 5:25 UTC: 5 řádků a 10 vazeb `pending` ještě čeká.

**Založeno (vše jako `proposeTopic` / `createEvent(..., "publish")`):** 11 témat (proposed_by správce, zájem
navrhovatele + fiktivních kolegů podle skupiny, audit `topic.propose`) a 9 zveřejněných akcí (`origin=manual`,
`calendar_intent=create`, revize 1 = `published_revision`, `published` ve tvaru `snapshotOf`, shodný se snímkem
v `event_revisions` akce `publish`, vazba `calendar_links` `primary`/`pending`, audit `event.create_publish`).

| Datum (Praha) | Akce | Téma | Publikum | Vede |
|---|---|---|---|---|
| po 23. 11. 2026 9:00–10:30 | Setkání týmu | Roční revize finančního plánu klienta | Všichni | správce |
| st 25. 11. 2026 8:30–11:00 | Trénink poradců | Zajištění příjmu a finanční rezerva rodiny | FP | Ondra |
| pá 11. 12. 2026 8:30–10:30 | Firemní vzdělávání FP | Investiční dotazník a rizikový profil klienta | FP | Ondra |
| po 14. 12. 2026 9:00–10:30 | Setkání týmu | Refinancování hypoték v roce 2027 | Všichni | správce |
| pá 18. 12. 2026 8:30–10:30 | Firemní vzdělávání RM | Správa portfolia movitých klientů | RM | „Někdo random“ |
| pá 8. 1. 2027 8:30–10:30 | Firemní vzdělávání RM | Generační předání rodinného majetku | RM | „Někdo random“ |
| po 11. 1. 2027 9:00–10:30 | Setkání týmu | Penzijní spoření a DIP v praxi | Všichni | správce |
| pá 15. 1. 2027 8:30–10:30 | Firemní vzdělávání FP | Pravidelné investování pro mladé rodiny | FP | Ondra |
| pá 29. 1. 2027 8:30–10:30 | Firemní vzdělávání FP | Daňové souvislosti investic a pojištění | FP | Ondra |

Témata bez akce (zásobník na stránce Témata): Péče o klíčové klienty a pravidelný servis (RM), Komunikace s klienty
při výkyvech na trzích (Všichni). Zůstává původní „Návaznost po konzultaci“.

**Ověření:** kontrolní SELECT po transakci: 0 testovacích témat, 0 z 6 akcí, 0 akcí s názvem testovacího tématu
(ani ve snímku), 9 nových akcí `snap_ok=true`, `rev 1/1`. **V aplikaci ověřeno nebylo:** do ostré Wiki se agent
nepřihlásí (Google), lokální Wiki nad kopií (`overeni-po-cisteni-2026-11-18`, `br-bold-unit-baoj1w5m`, u kopie
přepnuté `users.origin='demo'`) se k Neonu nepřipojila, proxy cloudové relace hostitele Neon odmítá. Kopii lze smazat.

**Nechané beze změny (nebylo v zadání):** 16. 11. 21:00 Jiná akce, tři akce 17. 11. 9:00 (Trénink RM, Jiná akce
bez tématu), 18. 11. 9:00 Action time · Tým A, šablonové akce bez tématu.

**Doplněno 18. 11. 2026 (pokyn uživatele):** smazány i podezřelé ruční akce 16.–18. 11. (Jiná akce 16. 11. 21:00,
Trénink RM a Jiná akce bez tématu 17. 11. 9:00, Action time · Tým A 18. 11. 9:00), jedna transakce, audit
`event.delete_test_data` ×4, vyžádána osobní synchronizace. Ověřovací větev `br-bold-unit-baoj1w5m` smazána.
Prezentační plný plán (fiktivní kolegové, Kdo/Téma částečně vyplněné) se do ostré DB nahraje až po merge PR
`claude/doladeni-harmonogramu-a-temat`.
