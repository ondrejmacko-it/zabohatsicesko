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

## Otevřené otázky pro uživatele

* Které z akcí výše jsou testovací celé (zrušit), a u kterých jen opravit téma?
* Je „Návaznost po konzultaci“ a „Tym A“ skutečné téma?
* Smí se kolegům odeslat e-mail o změně nebo stornu z Google Kalendáře?

## Fiktivní seed ukázky

`src/server/seed.ts` + `demo/seed.json`: témata „Otevřené otázky na schůzce“, „Příprava na úvodní schůzku“,
„Týmové priority“, „Návaznost po konzultaci“; role s názvy rolí, e-maily `@example.invalid`. Seed je v ostré
Wiki zakázaný (`isLiveWiki()` → chyba při seedu i obnově), ostrá Wiki dostane jen pravidelný týden. Úprava
seedu není potřeba.
