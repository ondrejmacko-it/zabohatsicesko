# Pracovní role, individuální účast a viditelnost akcí (PR1)

Doménový základ pro F01, F02, F03 a F05. PR1 nemění chování aplikace: nové funkce zatím volají jen testy,
přepínač viditelnosti je ve výchozím stavu vypnutý a Kalendář se nemění.

## Zdroj pravdy

1. **Poslední zveřejněný snímek akce** (`events.published`). Rozpracovaný návrh nikdy.
2. **Členství člověka** v `users.groups`: pracovní role `fp`, `rm` (a připravená `vedouci-tymu`) a starší skupina `tym-a`.
3. **Výslovný záznam** v `event_participation`: dobrovolná přihláška, nebo omluva. Žádný řádek = účast podle rolí.

Technická role (`admin | organizer | member`) do účasti nevstupuje. Pracovní role nikdy nedává právo plánovat ani
spravovat. `tym-a` není „vedoucí týmu“. `vsichni` platí pro každého aktivního, i bez uloženého `vsichni`.

## Kód

| Místo | Co dělá |
|---|---|
| `src/lib/types.ts` | `WORK_ROLES`, `ParticipationState`, `ParticipationKind`, `EXCUSE_REASONS`, `EXCUSE_NOTE_MAX` |
| `src/server/domain/participation.ts` | čistá pravidla: `isRequiredForUser`, `participationState`, `effectiveParticipation`, `participationTransition`, `canVoluntarilyJoin`, `canExcuse`, `parseExcuse`, `desiredGuestIds` |
| `src/server/services/participation.ts` | `changeOwnParticipation` (jen vlastní účast, zámek akce, idempotence, audit bez důvodu), `ownParticipationRecords` |
| `src/server/policy.ts` | `visibleEvent` + `publishedEventVisibleToMember` (režim viditelnosti), `canReadExcuseDetails` |
| `src/server/config.ts` | `eventVisibility()`, proměnná `EVENT_VISIBILITY` |
| `src/server/db/migrations.ts` | `0016_event_participation` (`approval: true`) |
| `tests/ucast-role.test.ts`, `tests/migrace-0016.test.ts` | matice rolí, přechody, viditelnost, DB omezení, souběh, migrace |

## Stavy účasti

| Stav | Kdy | Pozvánka (`calendarGuest`) |
|---|---|---|
| `required` | publikum = Všichni nebo shoda s členstvím | ano |
| `optional` | akce je vidět, člověk není přihlášený | ne |
| `voluntary_enrolled` | výslovná přihláška k nepovinné akci | ano |
| `excused` | omluva z povinné akce, platí hned, bez schvalování | ne |
| `cancelled` | zrušená akce | ne |
| (null) | návrh, svátek, neaktivní účet | ne |

Změny (`enroll`, `withdraw`, `excuse`, `revoke_excuse`) jdou jen před začátkem akce. Opakování téže změny je bez účinku.

**Výchozí interpretace k potvrzení před releasem:**
- Omluva se uplatní jen u povinné akce. Když povinnost zanikne (změna rolí nebo publika), záznam zůstane, ale neplatí.
  Po návratu povinnosti začne platit znovu.
- Dobrovolná přihláška povinnost nemění. U povinné akce je nadbytečná, po zániku povinnosti zase platí.
- Odvolání omluvy a odhlášení řádek smažou (minimalizace údajů o zdraví). Historie zůstává v `audit_log` jen jako
  akce `participation.*` bez důvodu a poznámky.
- Změny jdou do začátku akce. Zpětnou omluvu (např. nemoc v den akce) zatím nepovolujeme. To je otevřená otázka.

## Tři různé věci, které se nesmí zaměnit

1. **Účast ve Wiki**: stav výše. Autoritativní, platí hned.
2. **Doručení do Kalendáře**: zda Wiki pozvánku poslala nebo odebrala (`calendar_links`, fronta, stav `pending/synced/attention`).
3. **Odpověď v Googlu (RSVP)**: `needsAction | accepted | declined | tentative`, Wiki ji jen čte (`calendar_responses`).
   Pozvaný je `needsAction`, ne „přihlášený“. Odebrání omluveného z hostů **není** jeho `declined`.

## Soukromí omluv

Důvod je jen kategorie (Nemoc / Dovolená / Jiné), poznámka je volitelná, nejvýš 280 znaků, bez řídicích znaků.
Nejde do logů, auditu, Kalendáře, obecného API ani UI kolegů. `canReadExcuseDetails` ji zatím povolí jen omluvenému
samotnému. Správce ani „vedoucí týmu“ ji automaticky nevidí (O03).

## Viditelnost akcí (F02)

`EVENT_VISIBILITY=all-published` ukáže každému přihlášenému všechny **zveřejněné** akce. Výchozí `audience` = dosavadní
chování. V ostré Wiki (`WIKI_MODE=production`) se přepínač ignoruje, dokud PR2 nedokončí přihlášky a omluvy. Pro
Preview s fiktivními daty ho jde nastavit jako nesecretní proměnnou prostředí, ale jen po dohodě (PR1 ho nikde nezapnul).

Nezávisle na přepínači zůstává: nahrávka a pracovní zápis (`canHandleRecording`), zveřejněný zápis
(`canReadPublishedMinutes`, dál podle publika, X02), témata a zájemci (`canSeeAudience`), stav Kalendáře a formuláře jen
pro správce. Ověřeno testy pro seznam měsíce, detail, panel nahrávky a nahrání.

Pro aktivaci v ostré Wiki: odstranit pojistku `isLiveWiki()` v `eventVisibility()` až s hotovým PR2, nebo přepnout
výchozí hodnotu. Do té doby nic.

## Migrace 0016

Jen `CREATE … IF NOT EXISTS`: unikátní indexy `(org_id, id)` na `users` a `events` (umožní cizí klíče v rámci
organizace, `id` je už primární klíč), tabulka `event_participation` s PK `(org_id, event_id, user_id)` a index podle
uživatele. `approval: true`: na vzdálené DB neběží bez ID v `APPROVED_MIGRATIONS` (dokud ho nikdo nepřidá, nespustí se
ani žádná další migrace). PR1 nespustil migraci na žádné vzdálené DB a nezměnil žádnou proměnnou prostředí.

Protože tabulka na vzdálené DB zatím není, nesmí ji číst ani zapisovat žádná běžná cesta aplikace. To platí: služba
`participation.ts` je volaná jen z testů. Obnova dema (`resetDatabase`) ji neuvádí jmenovitě, vyprázdní ji `TRUNCATE …
CASCADE` přes cizí klíče.

**Rollback:** tabulka nic nemění na stávajících datech. Vrácení = `DROP TABLE event_participation; DROP INDEX
users_org_id_id_key, events_org_id_id_key;` a odstranění řádku ze `schema_migrations` (jen po schválení).

## Smlouva pro PR2

- **Výchozí povinnost:** `isRequiredForUser` / `participationState` nad zveřejněným snímkem.
- **Uložení výjimky:** jen `changeOwnParticipation(viewer = skutečná session, ne náhled)`. Akce formuláře v PR2 ji obalí
  validací (`parseExcuse`) a limitem četnosti.
- **Pozvaní bez duplicit:** `desiredGuestIds` (povinní − omluvení + dobrovolní). PR2 jím nahradí výběr v
  `audienceAttendees` / `planGuests` a zachová ručně přidané hosty a RSVP ostatních.
- **Změna „Pro koho“:** projeví se až zveřejněním, protože pravidla čtou jen `events.published`.
- **Selhání Googlu:** omluva ve Wiki platí dál, Kalendář dostane vlastní stav (`pending / attention`), retry přes frontu.
- **Oprávněný manažer:** doplnit do `canReadExcuseDetails` podle schváleného mapování (O03).

## PR2: přihlášky a omluvy v UI (za přepínačem `PARTICIPATION=on`)

Celá funkce je za serverovým přepínačem `participationEnabled()` (`PARTICIPATION=on`), výchozí vypnuto. Vypnuto =
aplikace se chová jako před PR2 a tabulku `event_participation` nečte (test přejmenuje tabulku a stránky dál fungují).
V ostré Wiki (`WIKI_MODE=production`) se přepínač ignoruje, dokud uživatel neschválí 0016 a pojistku vědomě neodstraní.
Zapnutá účast znamená i `EVENT_VISIBILITY=all-published`.

| Místo | Co dělá |
|---|---|
| `changeParticipationAction` (`features/vzdelavani/actions.ts`) | Přihlásit se / Odhlásit se / Omluvit se / Zrušit omluvu. Id ze session (`runAction`), `parseExcuse`, limit `PARTICIPATION_LIMIT` (30/h) |
| `ParticipationPanel.tsx` | panel „Tvoje účast“ v okně akce a v detailu, potvrzení v `ConfirmDialog`, omluva Nemoc/Dovolená/Jiné + poznámka |
| `withOwnParticipation`, `ownParticipationDetail` | štítky „Povinné pro tebe / Můžeš se přihlásit / Přihlášeno / Omluveno“ na serveru, jen vlastní záznamy; v náhledu jen z rolí, bez akcí |
| `isMine` + `?ucast=moje` | přepínač Moje / Všechny vedle Měsíc / Seznam (na telefonu zůstává vidět) |
| `eventAttendees` (`calendar/attendees.ts`) | hosté pozvánky podle `desiredGuestIds`; změna účasti vrátí pozvánku do fronty; ruční hosté a RSVP zůstávají |

**O04 (ověřeno v dokumentaci Google Calendar API, 21. 11. 2026):** `attendees[].responseStatus` je zapisovatelné, ale
dokumentace nikde neříká, že organizátor smí nastavit `declined` za jiného účastníka. Uvádí, že předvyplněná odpověď se
může vrátit na `needsAction`, a nastavení RSVP popisuje jen přes kalendář účastníka (s právem zápisu do něj). Wiki proto
`declined` nenastavuje. Omluvený se jen přestane zvát a Wiki ukazuje pravdivý stav („Odebrání z pozvánky v Kalendáři čeká na odeslání.“, potom „Wiki tě na tuto akci do Kalendáře nezve.“).
Živý test v Googlu neproběhl.

**Zvolené výchozí varianty (otevřené otázky, jdou později přepnout):**
- O02: „vedoucí týmu“ zůstává jen připravená pracovní role, nic neodemyká.
- O03: důvod a poznámku omluvy vidí jen omluvený sám (`canReadExcuseDetails`).
- O08: poznámky se automaticky nemažou. Návrh retence: smazat `excuse_note` (a případně `excuse_reason`) 90 dní po konci
  akce úlohou v obnově, nebo už při zveřejnění zápisu. Čeká na rozhodnutí.
- Zpětná omluva: jen před začátkem akce (`effectiveParticipation.open`).

**Známé mezery:** okno dopadu změny publika (`impact.ts`) dál počítá hosty podle publika, ne podle omluv. Omluva a přihláška
do Kalendáře se propíšou až další synchronizací (fronta). Živé pozvánky se v testech neposílají, ověřeno jen fake Googlem.

## PR3: „Pro koho“ v přípravě měsíce (F01)

Sloupec Skupina v okně Připravit měsíc je teď „Pro koho“ a nabízí Všichni / Finanční poradci / Relationship manažeři
(`PLANNED_AUDIENCES`, `audienceOptions` v `features/vzdelavani/prepare-month.ts`). Starší skupina `tym-a` zůstane v nabídce
jen u návrhu, který ji už má, aby se při uložení potichu nezměnila. Server (`publishMonthAction`) dál přijímá všechny
hodnoty `GROUPS`, nic se tím neoslabuje ani nemigruje. Povinnost účasti z publika počítá `isRequiredForUser` (PR1).

Varianta k pozdějšímu přepnutí: úplně skrýt `tym-a` i v editoru akce a v šabloně (typ „akce“ má dnes výchozí `tym-a`,
`domain/generation.ts`). Bez zadání F01 v plném znění se to neměnilo.

## PR4: Témata (F10–F12)

* **Viditelnost:** `canSeeTopic(viewer, audience, mode)` v `server/policy.ts`. V režimu `all-published` (stejný
  přepínač jako u akcí, `PARTICIPATION=on` ho zapíná, ostrá Wiki ignoruje) vidí každý přihlášený všechna
  nearchivovaná témata a může u nich dát zájem. Jinak platí `canSeeAudience` jako dřív. Navrhnout téma jde jen pro
  vlastní skupinu, jména zájemců vidí jen správce.
* **Filtr Pro mou roli / Všechna:** `isTopicForRoles` používá `isRequiredForUser` (téma pro všechny + členství,
  víc rolí = sjednocení). Technická role se nepočítá. Kolega ho vidí jen v režimu `all-published`, správce vždy.
* **Pořadí:** úchyty, čísla pořadí a správa pořadí jen pro správce nad celým seznamem (filtr Všechna). Změny
  pořadí dál ověřuje server (`moveTopic`, `placeTopic`, `setTopicPriority`, `resetTopicOrder`: jen správce).
* **Testy:** `tests/temata-f10-f12.test.ts`, e2e `e2e/temata-planovani.spec.ts` (správce, účastník) a
  `e2e/ucast.spec.ts` (režim všech zveřejněných, FP a RM).

