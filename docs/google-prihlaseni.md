# Přihlášení Google identitou · testovací režim

Stav k 12. 11. 2026: přihlášení je napsané a prošlo testy proti napodobenému Googlu
(`tests/google-login.test.ts`). **Proti skutečnému Googlu ověřeno nebylo.** Živé přihlášení čeká na
testovací účty a OAuth klienta. Výchozí režim dema zůstává vstup kódem a výběr fiktivní role.

## Jak to funguje

- `LOGIN_MODE=google-test` přidá na vstupní stránku tlačítko „Přihlásit se účtem Google“. Je to
  **druhý režim vedle fiktivních rolí**, vstup kódem zůstává. Neúplná konfigurace přihlášení nezapne
  a trasy `/api/google/prihlaseni` vrací 404.
- Tok OpenID Connect s autorizačním kódem, PKCE, stavem a nonce. Wiki žádá jen `openid email profile` (jméno je jen popisek pro správce).
  Žádný token Googlu se neukládá, po ověření identity se zahodí.
- ID token se ověřuje na serveru (část 02 zadání): podpis veřejným klíčem Googlu (pevně RS256),
  vydavatel, příjemce (`aud` a `azp` = náš klient), platnost, nonce této žádosti a `email_verified`.
- **Google říká jen, kdo se přihlásil.** Roli a skupiny čte Wiki z databáze při každém požadavku.
- Kdo smí dovnitř, určuje **Správa systému** ve Wiki (`/sprava`, správce ZBC a organizátor):
  pozvánka na adresu Google, nebo schválení žádosti, která vznikne po prvním přihlášení neznámého účtu
  (nejvýš 20 čekajících). Roli správce přiděluje a správcům účty mění jen jiný správce, nikdo nemění sám sebe.
- `GOOGLE_LOGIN_ACCOUNTS` je jen volitelný zaváděcí seznam (adresa → uživatel, například fiktivní role).
- Při prvním přihlášení se účet sváže se stabilním `sub` (tabulka `user_identities`). Pak rozhoduje
  `sub`, ne adresa. Uživatel se svázaným účtem nedostane druhý účet Google.
- Odebrání přístupu ve Správě, smazání vazby nebo vypnutí režimu ukončí i běžící session, ne až po
  vypršení cookie. Výběr fiktivní role skutečné účty nenabízí a jejich session neotevře.
- Obnova ukázkových dat skutečné účty, jejich role a vazby zachová.
- Kdo se přihlásil účtem Google, nemůže přepínat fiktivní role. Vystupuje jen za sebe.
- Účet Google v přihlášení nemusí obcházet přístupový kód ukázky: dovnitř pustí jen účty ze seznamu.
- Do provozního logu jde u neúspěchu jen kód důvodu, nikdy adresa ani `sub`.
- Přihlášení uživatelů je nezávislé na připojení Kalendáře ([google-kalendar.md](google-kalendar.md)).
  Používá stejného OAuth klienta, ale jiný rozsah a jinou přesměrovací adresu.

## Co nastavit po dodání přístupů

1. V OAuth klientovi (stejný jako pro Kalendář) přidat přesměrovací adresu
   `<APP_URL>/api/google/prihlaseni/callback`. Testovací účty přidat mezi testovací uživatele
   souhlasové obrazovky.
2. Proměnné prostředí (jen Preview):

| Proměnná | Význam |
|---|---|
| `LOGIN_MODE` | `google-test` |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth klient pro test, sdílený s Kalendářem. |
| `GOOGLE_LOGIN_ACCOUNTS` | Volitelné. `adresa=id-uzivatele` oddělené čárkou, např. organizátor na `demo-organizator` a příjemce na `demo-ucastnik`. Každá adresa i každý uživatel jen jednou. |
| `APP_URL` | Veřejná adresa nasazení, ze které se skládá přesměrovací adresa. |

## Živý test

1. Účet ze seznamu se přihlásí a vidí Wiki v roli svého uživatele. V liště je „Přihlášení účtem
   Google“ a chybí přepínač rolí.
2. Neznámý účet skončí na vstupu se zprávou, že žádost čeká na schválení. Ve Správě (jako Správce ZBC
   ukázky) se objeví v čekajících žádostech. Po schválení s rolí a skupinami vstoupí.
3. Zrušení souhlasu na obrazovce Googlu vrátí na vstup se zprávou o zrušení.
4. Po „Odebrat přístup“ ve Správě přestane běžící session platit hned (bez nového nasazení).
5. Účastník přihlášený Googlem nevidí akce mimo své publikum a nedostane se k cizí nahrávce
   (stejná pravidla jako u fiktivní role).

## Co testy proti napodobenému Googlu neříkají

Potvrdí až živý test: skutečný tvar ID tokenu a hlaviček klíčů, střídání klíčů, obsah souhlasové
obrazovky, chování výběru účtu a chybové odpovědi token endpointu.

## Před produkcí

Správa uživatelů je ve Wiki. Wiki zatím neposílá e-mail s pozvánkou (správce pošle odkaz). Fiktivní role
a přístupový kód zůstávají jako přepínatelný ukázkový režim.
