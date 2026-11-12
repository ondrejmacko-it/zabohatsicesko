# Google Kalendář · testovací režim

Stav k 12. 11. 2026: adaptér prošel testy proti napodobenému HTTP (`tests/google-calendar.test.ts`)
a **živým testem proti skutečnému Googlu** na preview (výsledky níže). Výchozí režim dema zůstává
simulace, testovací režim zapíná `CALENDAR_MODE=google-test`.

## Jak to funguje

- `CALENDAR_MODE=google-test` zapne adaptér `src/server/calendar/google.ts`. Jakákoli jiná hodnota
  znamená simulaci. Neúplná konfigurace integraci nespustí, do simulace se nevrací a nic nezapisuje.
- Připojuje se **jeden účet za organizaci**: organizátor ve *Vzdělávání → Integrace* připojí účet, který
  vlastní kalendář vzdělávání. Přihlášení uživatelů do Wiki je na tom nezávislé.
- Wiki žádá jen o rozsah `calendar.events`. Obnovovací token se ukládá šifrovaně (AES-256-GCM, klíč
  `TOKEN_ENCRYPTION_KEY` mimo databázi), přístupový token žije jen v paměti serveru.
- Úprava posílá jen název, popis s odkazem na Wiki, začátek, konec a stav, vždy se `sendUpdates=all`.
  Hosté, RSVP a odkaz na schůzku se neposílají, takže zůstanou.
- Nová pozvánka má ID odvozené z klíče akce. Opakované vytvoření po nejasném výsledku skončí u Googlu
  odpovědí 409 a Wiki použije existující událost.
- Opakovaná událost: ke spárování se nabízejí jednotlivé výskyty, vazba si uloží `recurringEventId` a
  `originalStartTime`. Zápis do hlavní události série adaptér odmítne.
- Wiki mění jen originál organizátora. Kopie cizích pozvánek ke spárování nenabízí.
- Seznam povolených kalendářů a testovacích příjemců ověřuje server před každým voláním. V testovacím
  režimu jde nová pozvánka **jen testovacím příjemcům**, skutečné publikum akce se neosloví.
- Odvolání přístupu u Googlu integraci odpojí i ve Wiki. Akce ukáže „Vyžaduje pozornost“ a po novém
  připojení se nejnovější zveřejněná verze odešle sama (`resumeAfterReconnect`). Akce zastavené jinou
  chybou, například ruční změnou v Kalendáři, dál rozhoduje organizátor.
- Obnova ukázkových dat připojení Kalendáře ani vazby na Google účty nemaže.

## Co nastavit po dodání přístupů

1. V Google Cloud založit projekt pro test, zapnout Google Calendar API a vytvořit OAuth klienta typu
   webová aplikace. Souhlasová obrazovka v režimu testování, testovací uživatel je účet organizátora.
2. Přesměrovací adresa klienta: `<APP_URL>/api/google/kalendar/callback`. U preview na Vercelu použít
   stálou adresu větve, ne adresu jednoho nasazení.
3. Proměnné prostředí (jen Preview, tajemství jako sensitive):

| Proměnná | Význam |
|---|---|
| `CALENDAR_MODE` | `google-test` |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth klient pro test. Produkce dostane vlastního. |
| `GOOGLE_CALENDAR_ID` | Testovací kalendář, do kterého Wiki zapisuje. |
| `GOOGLE_ALLOWED_CALENDAR_IDS` | Povolené kalendáře oddělené čárkou. Musí obsahovat `GOOGLE_CALENDAR_ID`. |
| `GOOGLE_ALLOWED_ATTENDEES` | Celé adresy testovacích příjemců oddělené čárkou. |
| `TOKEN_ENCRYPTION_KEY` | 32 náhodných bajtů v base64 (`openssl rand -base64 32`). |
| `APP_URL` | Veřejná adresa nasazení, ze které se skládá přesměrovací adresa i odkaz v pozvánce. |

4. Po nasazení obnovit ukázková data (v testovacím režimu vzniknou akce bez vazby na pozvánku) a ve
   *Vzdělávání → Integrace* připojit účet organizátora.

## Živý test (část 02 zadání)

Organizátor a jeden testovací příjemce. Každý krok zapsat jako ověřený, nebo s rozdílem.

1. V testovacím kalendáři existuje pozvánka na čt 12. 11. 2026 s příjemcem, známým RSVP a odkazem na
   schůzku. V detailu Tréninku RM ji spárovat.
2. Změnit téma a zveřejnit. Zkontrolovat stejné ID události, pohled organizátora i příjemce, zachované
   RSVP a odkaz na schůzku.
3. Změnit čas a zveřejnit. Příjemce dostane oznámení podle svého nastavení.
4. Uložit totéž znovu a spustit synchronizaci podruhé. V kalendáři je stále jedna pozvánka.
5. Opakovaná akce: spárovat jeden výskyt týdenní série, změnit jeho téma a potom ho zrušit. Sousední
   výskyty i série zůstanou beze změny.
6. Vytvořit novou pozvánku pro akci bez vazby. Hostem je jen testovací příjemce.
7. Upravit název přímo v Google Kalendáři. Wiki ukáže rozdíl a nabídne přepsání.
8. V nastavení Google účtu odebrat aplikaci přístup. Další synchronizace skončí stavem „Vyžaduje
   pozornost“ s výzvou k připojení, po připojení projde.

## Výsledek živého testu 12. 11. 2026

Preview větve `ccr-2d4283fa-slno9d`, účet organizátora `zbc.test.spravce`, příjemce `zbc.test.uzivatel`,
testovací kalendář „Vzdělávání test“. Wiki ovládal Playwright, Google kontroloval uživatel.

| # | Krok | Výsledek |
|---|---|---|
| — | Připojení OAuth, šifrovaný token, kontrola seznamů | Ověřeno. Pomohlo vynucení výběru účtu (`prompt=consent select_account`). |
| 1 | Spárování pozvánky s Tréninkem RM | Ověřeno. Stejné ID, host, přijaté RSVP i Meet zůstaly, popis má odkaz na Wiki. |
| 2 | Změna tématu | Ověřeno. Stejná pozvánka, příjemci přišlo oznámení. |
| 3 | Změna času | Ověřeno, s rozdílem: **Google při změně termínu vynuluje RSVP** a žádá o novou odpověď. Text ve Wiki upraven. |
| 4 | Stejné zveřejnění znovu | Ověřeno. Jedna pozvánka, žádné další oznámení. |
| 5 | Výskyt série: spárovat, změnit, zrušit | Ověřeno. ID výskytu `…_20261113T153000Z`, ostatní termíny beze změny. Spárování přepíše čas výskytu časem z Wiki. |
| 6 | Nová pozvánka | Ověřeno. Google přijal vlastní ID z Wiki, hostem je jen testovací příjemce, Meet se nezakládá. |
| 7 | Změna názvu v Googlu | Ověřeno. „Vyžaduje pozornost“ s rozdílem, přepsání hodnotami z Wiki prošlo. |
| 8 | Odebrání přístupu | Ověřeno. Wiki se odpojila a ukázala výzvu k připojení. Po novém připojení bylo nutné ruční opakování, opraveno. |

Nalezené chyby (opravené na téže větvi, s testy): obnova ukázkových dat mazala připojení Kalendáře
(`TRUNCATE … CASCADE` přes cizí klíč na uživatele) a po novém připojení se zastavené akce samy
neodeslaly. Na preview živě ověřeno: obnova dat nechá Kalendář připojený. Automatické odeslání po novém
připojení zatím jen testy proti napodobenému Googlu.

## Co testy proti napodobenému HTTP neříkají

Skutečné chování Googlu u těchto bodů potvrdí až živý test: přijetí vlastního ID události, oznámení
a jejich doručení, podoba výskytů série a výjimek, chování `If-Match`, přesné kódy a důvody chyb,
limity a obsah souhlasové obrazovky.
