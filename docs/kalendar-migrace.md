# Přechod Kalendáře na organizátora · inventura a dry-run (PR B)

Závazné zadání je [plan-kalendar-pozvanky.md](plan-kalendar-pozvanky.md), bod 7. Tento PR jen připravuje.
**Nic se nepřepíná, nic se nemaže, žádné pozvánky.** Každý nevratný krok potřebuje výslovný souhlas vlastníka.

## Nástroje

- `src/server/calendar/migration.ts`
  - `migrationInventory(db)`: jen čte. Vrací počty a otisk (12 hex znaků), nikdy adresy.
  - `retireWikiCalendars(db, { approvedFingerprint })`: bez otisku dry-run, nic nevolá a nic nemaže.
    S otiskem smaže kalendáře „Vzdělávání ZBC“ v účtech uživatelů, zneplatní jejich tokeny a smaže řádky
    `personal_calendars`. Odmítne se, když běží `CALENDAR_DELIVERY=personal` (osobní režim by kalendáře
    založil znovu) nebo když otisk nesouhlasí se současnou inventurou (data se od schválení změnila).
    Vrací `{ removed, failed }`. Když Google smazání kalendáře odmítne (cokoli kromě 404 = už smazaný),
    token se neodvolá a řádek zůstane ve stavu `removal_failed` s `error_code`. Opakovaný úklid
    (nová inventura, nový otisk) to zkusí znovu, nic se neztratí. Stejně se chová úklid vypnutého účtu v osobním režimu.
- `scripts/kalendar-migrace.ts`: `inventura`, `smazat-kalendare` (dry-run), `smazat-kalendare --provest <otisk>`.
- Testy `tests/kalendar-migrace.test.ts`: inventura nic nezapisuje a neobsahuje adresy, dry-run nevolá Google,
  odmítnutí v osobním režimu a se špatným otiskem, odmítnuté smazání (403, 503) nechá token i řádek, 404 je úspěch,
  úklid se schváleným otiskem.

## Inventura produkce 17. 11. 2026 (jen čtení přes Neon SQL, počty)

| Položka | Počet |
|---|---|
| Budoucí zveřejněné nezrušené akce | 41 |
| Aktivní uživatelé | 3 |
| `personal_calendars` (všechny `active`, s kalendářem) | 2 |
| `personal_calendar_entries` (akce v osobních kalendářích) | 23 |
| `calendar_links` celkem / s `external_event_id` | 45 / 0 |

Počet pozvánek (akce × pozvaní) a tím reálných e-mailů závisí na skupinách aktivních účtů. Přesné číslo dá
`migrationInventory` v nasazené Wiki. Horní odhad: 41 akcí × 3 účty = **nejvýš 123 e-mailů** s pozvánkou
při prvním odeslání, pokud by všechny akce byly pro všechny. Každá další změna akce pošle pozvaným aktualizaci.

## Co přepnutí udělá (plán, neprovedeno)

1. Nastavit v Production `CALENDAR_DELIVERY=organizer` a připojit účet organizátora (kroky v
   [kalendar-organizator.md](kalendar-organizator.md)). Fronta pak pozve účastníky budoucích akcí.
   Před tím ověřit, že `calendar_links` na `primary` (45, bez `external_event_id`) nepatří k cizím událostem.
2. Spustit inventuru, ukázat ji vlastníkovi a s jeho schváleným otiskem smazat 2 kalendáře „Vzdělávání ZBC“.
   Mazání kalendáře neposílá e-maily (osobní kalendáře neměly hosty). Pozor: oba řádky mají `setup_code`
   `401_authError`, mazání přes rozsah `calendar.app.created` proto může selhat. Selhání se zaloguje a token
   se zneplatní i tak, kalendář pak uživatel smaže ručně (Kalendář Google → Nastavení → kalendář → Odstranit).
3. Odstranit kód osobního režimu (samostatný commit po přepnutí, viz níže). Tabulky `personal_calendars`
   a `personal_calendar_entries` smazat až pozdější migrací.

## Plán návratu

- Do kroku 2: vrátit `CALENDAR_DELIVERY=personal` ve Vercelu a znovu nasadit. Pozvánky už odeslané zůstanou,
  zrušit je jde zrušením akcí (organizátor pošle `cancelled`).
- Po kroku 2 je návrat do osobního režimu možný jen s novým souhlasem uživatelů (tokeny jsou zneplatněné).

## Odstranění kódu `personal*` (připraveno, neprovedeno)

Odstranit až po schváleném přepnutí produkce, jinak by produkce s `personal` přestala fungovat.

| Soubor | Co |
|---|---|
| `src/server/calendar/personal.ts`, `personal-api.ts`, `legacy-invites.ts` | smazat celé |
| `src/features/vzdelavani/components/PersonalCalendarStatus.tsx` | smazat celé |
| `src/server/config.ts` | `calendarDelivery`, `personalDelivery`, `personalSelfInvite`, `organizerDelivery` (vždy pravda) |
| `src/server/calendar/sync.ts`, `google-auth.ts`, `services/calendar-status.ts` | větve `personalDelivery()` |
| `src/app/api/google/prihlaseni/route.ts`, `callback/route.ts` | souhlas `calendar.app.created` při přihlášení |
| `src/app/(wiki)/page.tsx`, `sprava/page.tsx`, `vzdelavani/harmonogram/page.tsx`, `features/sprava/actions.ts` | karty a akce osobního kalendáře |
| `src/server/calendar/migration.ts` | `retireWikiCalendars` po provedení úklidu |
| `tests/kalendar-osobni.test.ts`, `tests/kalendar-uklid.test.ts` | smazat, části v ostatních testech upravit |
| `.env.example`, README | `CALENDAR_DELIVERY`, `CALENDAR_PERSONAL_NOTIFY` |
| Vercel Production | proměnné `CALENDAR_DELIVERY`, `CALENDAR_PERSONAL_NOTIFY` smazat (vlastník) |

## Otevřené

- **Kde úklid na produkci spustit.** Produkční `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY` a klíče Googlu jsou ve
  Vercelu jako sensitive a nejdou stáhnout, skript proto lokálně proti produkci nepoběží. Návrh: tlačítko pro
  hlavního správce ve Správě (inventura → potvrzení s otiskem), nebo chráněný endpoint s otiskem schváleným
  v proměnné prostředí. Rozhodne vlastník.

## Aktivace účasti nad existujícími pozvánkami (PARTICIPATION=on)

Po zapnutí účasti se už vydané pozvánky samy nepřepočítají (změní se až při další úpravě akce nebo účasti).
Řízený postup, Google se při něm nevolá, výstup obsahuje jen počty (žádné adresy ani důvody omluv):

1. Před zapnutím: `npx tsx scripts/kalendar-migrace.ts aktivace-ucasti` – počet dotčených akcí, kolik hostů se
   přidá (povinní, přihlášení) a odebere (omluvení, nepřihlášení dobrovolní, neaktivní účty) a otisk.
   Výsledek a otisk schvaluje vlastník.
2. Zapnout `PARTICIPATION=on` (migrace 0016 a 0017 musí být provedené).
3. `npx tsx scripts/kalendar-migrace.ts synchronizovat-ucast --provest <otisk> --davka 20` – vrátí do fronty
   nejvýš 20 dotčených akcí. Bez otisku jen dry-run; bez zapnuté účasti nebo s jiným otiskem se odmítne.
   Opakovat po zpracování fronty, dokud `remaining` není 0; akce ve stavu `attention` řešit ručně.
4. Ručně přidaní hosté a RSVP zůstávají, omluvenému Wiki nenastavuje `declined`, jen ho přestane zvát.
   Rollback (vypnutí přepínače) hosty akcí s uloženou účastí nemění.

Živý test jen se schválením vlastníka, na samostatném testovacím kalendáři a s povolenými testovacími účty.
