# Kalendář účastníků bez pozvánek (návrh 16. 11. 2026, k implementaci)

## Problém (ověřeno 16. 11.)

Synchronizace funguje: 27 akcí je v kalendáři `primary` účtu správce, hosté sedí, `sendUpdates=all`.
U účastníka (soukromý Gmail) ale pozvánky padají do **Spamu** jako „Invitation from an unknown sender“,
**jeden e-mail za každou akci**, a do Kalendáře se nepřidají (Google u neznámého odesílatele událost
nepřidá sám). Ovlivnit to jde jen v nastavení příjemce, Wiki to ze strany odesílatele nevyřeší.

## Varianty

| | (a) Vlastní kalendář účastníka (`calendar.app.created`) | (b) Sdílený kalendář přes ACL | (c) Odběr ICS adresy |
|---|---|---|---|
| Co udělá uživatel | Jednou na obrazovce Googlu při prvním přihlášení potvrdí zaškrtávátko Kalendáře | U každého sdíleného kalendáře (jeden na skupinu) klikne v e-mailu „Přidat kalendář“, nebo Wiki potřebuje jeho token se `calendar.calendarlist` | Jednou vloží tajnou adresu do Google Kalendáře „Z adresy URL“ |
| E-maily | Žádné (nejsou hosté, `sendUpdates=none`) | Jeden e-mail o sdílení na kalendář, může skončit ve Spamu | Žádné |
| Změny a rušení | Okamžitě (Wiki zapisuje přímo) | Okamžitě | Google obnovuje odběr až po hodinách (typicky 8–24 h) |
| Změna skupiny | Wiki přidá nebo smaže události v jeho kalendáři | Wiki přidá nebo odebere ACL, uživatel u nové skupiny znovu kliká | Automaticky, se zpožděním |
| Odvolání přístupu | Obnova tokenu vrátí `invalid_grant` → stav „odvoláno“, tlačítko „Propojit Kalendář znovu“ | ACL zůstane, dokud ho Wiki nesmaže | Adresu jde zneplatnit |
| Riziko | Rozsah možná citlivý (viz níže) | Víc kalendářů, ruční krok, e-mail ve Spamu | Neplní „samo se mění“, adresa je tajemství v URL |

**Rozhodnutí: (a).** Jediná varianta, která splní „nic nedělat, žádné e-maily, nic ve Spamu, samo se mění
a ruší“. Wiki vytvoří účastníkovi kalendář „Vzdělávání ZBC“ v jeho účtu a události do něj zapisuje bez hostů.
Rozsah `calendar.app.created` dovolí jen kalendáře, které Wiki sama vytvořila. Do ostatních kalendářů
uživatele Wiki nevidí.

## Stav implementace 16. 11. noc (draft PR, větev `claude/kalendar-ucastniku`)

Hotové serverové jádro, **vypnuté** (výchozí `CALENDAR_DELIVERY=invites`, merge nic nezmění):
* `src/server/config.ts` `calendarDelivery()`, migrace `0009_personal_calendars`, tabulky `personal_calendars`
  a `personal_calendar_entries` (bez FK na `users`, aby šel kalendář po smazání účtu uklidit).
* `src/server/calendar/personal-api.ts`: token uživatele, `calendars.insert` „Vzdělávání ZBC“, `calendarList.patch`
  (barva, připomínky e-mail 1 den + oznámení 30 min, upozornění eventCreation/Change/Cancellation/agenda e-mailem),
  insert/update/delete událostí s `sendUpdates=none`, bez hostů.
* `src/server/calendar/personal.ts`: šifrovaný token (`org:google-personal:<userId>`), zámek a opakování kola,
  rozdíly podle otisku (bez změn Google nevolá), změna skupiny smaže cizí akce, zrušená akce zmizí, `invalid_grant`
  = `revoked` + smazaný token, smazaný kalendář = `calendar_deleted`, vypnutý/smazaný účet = smazat kalendář,
  zneplatnit token, smazat řádky. Logy jen kód.
* Přihlášení: záměr `personal` (`calendar.app.created`, offline, consent), při pozvánce a zaváděcím správci rovnou,
  u známého zařízení jen bez aktivního kalendáře, `?kalendar=osobni` = tlačítko „Propojit Kalendář“, odškrtnutí =
  `declined` (Wiki se znovu neptá). V režimu `personal` se nežádá o kalendář správce a `syncEvent`/`syncPending`
  nezapisují do `primary` (vazby se jen označí za zpracované).
* Testy `tests/kalendar-osobni.test.ts` (napodobený HTTP).

**Chybí před zapnutím:** UI stavu (Úvod, Plán, sloupec ve Správě, tlačítko), úklid 27 pozvánek z `primary` správce
(jen události s `zbcKey`, `sendUpdates=none`, tlačítko ve Správě), spouštěč při otevření Úvodu, štítek
„Návrh, do Kalendáře zatím nejde“, e2e. Pak nastavit `CALENDAR_DELIVERY=personal` přes API Vercelu.

## Upozornění e-mailem od Googlu (ověřeno v dokumentaci 16. 11., živě ne)

* Discovery dokument Calendar API (revize 20261111): `calendarList.patch` i `calendars.insert/delete` povoluje
  `calendar.app.created`. Wiki tedy smí nastavit `notificationSettings` (eventCreation, eventChange,
  eventCancellation, agenda; metoda jen `email`) a `defaultReminders` (email/popup).
* Stránka „Reminders and notifications“ (aktualizace 2026-09-03): „Event change: The organizer modified an event
  that the user was invited to“, „Event cancellation: An event that the user was invited to is canceled“. Změna
  a zrušení se tedy týkají pozvánek. Když zapisuje aplikace tokenem uživatele, organizátorem je on sám, a e-mail
  o změně proto **s velkou pravděpodobností nepřijde**. Totéž u „Event creation“ (událost vytvořil on).
* Spolehlivě chodí: **připomínky e-mailem** (den předem, nastaveno výchozí) a **ranní přehled „agenda“**. Obojí
  Google posílá podle času, ne podle toho, kdo změnu zapsal. Změnu času proto uživatel uvidí v připomínce i přehledu.
* Živé ověření (po zapnutí): účastník propojí Kalendář, správce změní čas akce, účastník zkontroluje Gmail
  (i Spam) a druhý den ráno přehled.

## Klasifikace rozsahu: ověřeno 16. 11. večer

Uživatel přidal `calendar.app.created` v konzoli projektu `zbc-vzdelavani-test` a Google ho zařadil mezi
**non-sensitive scopes**: žádné varování o neověřené aplikaci, žádný limit 100. Nový požadavek: e-mailová
upozornění o nových, změněných a zrušených událostech přímo od Googlu (prověřit `calendarList.notificationSettings`).

### Původní poznámka

Oficiální stránka Googlu (`developers.google.com/workspace/calendar/api/auth`) se z prostředí relace
nenačetla (síť ji blokuje) a veřejné zdroje si odporují: jeden projekt uvádí, že konzole řadí
`calendar.app.created` mezi necitlivé rozsahy (bez varování a bez limitu 100 uživatelů), jiný píše, že
Google třídu nezveřejňuje a ukáže ji až konzole. **Rozhodne tvůj pohled do konzole (krok 1 níže).**

* Pokud je **necitlivý**: účastník uvidí jen běžnou obrazovku souhlasu se zaškrtávátkem Kalendáře.
* Pokud je **citlivý**: aplikace v režimu In production bez ověření ukáže „Google tuto aplikaci neověřil“
  (Rozšířené → Přejít do aplikace) a platí limit 100 uživatelů. Správce to dnes vidí už teď, protože
  `calendar.events` je citlivý. Ověření aplikace podle Trvalých faktů neřešíme, Wiki tedy pojede s varováním.

## Krok pro uživatele v Google Cloud Console (před nasazením)

1. Otevři https://console.cloud.google.com/ a nahoře vyber projekt `zbc-vzdelavani-test`.
2. Vlevo **Google Auth Platform** → **Data Access** (Přístup k datům).
3. Klikni **Add or remove scopes**.
4. Do filtru napiš `calendar.app.created`, zaškrtni řádek `.../auth/calendar.app.created` a dole **Update**.
5. Podívej se, do které tabulky se rozsah zařadil: **Your non-sensitive scopes** nebo **Your sensitive scopes**.
   Napiš mi, kde je. Dole klikni **Save**.

## Implementace (plán pro další relaci)

* **Přepínač** `CALENDAR_DELIVERY`: `personal` (výchozí pro `WIKI_MODE=production`) nebo `invites` (dnešní chování,
  výchozí pro ukázku). Nesecretní proměnná, nastavím ji přes API Vercelu.
* **Migrace**: `personal_calendars` (user_id PK, org_id, account_email, encrypted_refresh_token přes
  `sealSecret` a `TOKEN_ENCRYPTION_KEY` s kontextem `org:google-personal:<userId>`, scopes, calendar_id,
  status `active|declined|revoked|calendar_deleted`, error_code, sync_requested_at, synced_at, lease_until)
  a `personal_calendar_entries` ((user_id, event_id) PK, external_event_id, data_hash, status, error_code, attempts).
* **Souhlas**: `beginLogin` požádá o `calendar.app.created` (místo `calendar.events`) každého aktivního účtu bez
  aktivního kalendáře, i při prvním přihlášení z pozvánky (`scope.kind === "invite"`). Odškrtnutý rozsah =
  `declined`, Wiki se znovu neptá, jen ukáže tlačítko.
* **Synchronizace** (`src/server/calendar/personal.ts`): pro každého účastníka pod zámkem: obnova tokenu →
  případně `calendars.insert` „Vzdělávání ZBC“ → požadovaná sada = zveřejněné nesvátkové akce jeho skupin od
  dneška −60 dní → insert s ID z klíče (409 = už existuje → patch), patch jen při změně otisku, delete pro
  zrušené akce a akce mimo jeho skupiny, vše `sendUpdates=none`. Smyčka `sync_requested_at > started` zachytí
  změny během běhu. Spouštěče: stávající `syncEvent`, `syncPending`, `syncPublished` (v režimu `personal`
  zavolají `requestPersonalSync`) a přihlášení účastníka. Přechodné chyby se zopakují při dalším spouštěči,
  trvalé (`invalid_grant`, 404 kalendáře) změní stav účtu. Logy jen kód chyby a ID účtu Wiki.
* **Odebraný účet**: smazat jeho kalendář „Vzdělávání ZBC“, zneplatnit token, smazat řádky.
* **Úklid starých pozvánek**: jednorázově smazat z `primary` správce události s klíčem Wiki (`zbcKey`)
  s `sendUpdates=none` (žádné storno e-maily), vazby v `calendar_links` přepnout na souhrnný stav.
  Vlastní kalendář dostane i správce, takže po úklidu nic není dvakrát.
* **UI**: Úvod a Plán účastníka ukážou stav a jednu akci („Propojit Kalendář“ / „Propojit znovu“), Správa
  sloupec „Kalendář“ u každého účtu. Plán u návrhů: „Návrh, do Kalendáře zatím nejde“.
* **Testy**: vitest s napodobeným HTTP (souhlas, odmítnutí, odvolání, změna skupiny, zrušení akce, souběh, 409),
  e2e ostré Wiki s falešným Googlem (adresy Googlu přes proměnnou jen v testech).
* **Živé ověření**: po nasazení se účastník přihlásí, potvrdí Kalendář, v Google Kalendáři vlevo uvidí
  „Vzdělávání ZBC“ s akcemi své skupiny. Správce změní čas akce a účastník změnu uvidí do minuty.
