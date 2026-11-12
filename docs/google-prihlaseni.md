# Přihlášení Google identitou · testovací režim

Stav k 12. 11. 2026: přihlášení je napsané a prošlo testy proti napodobenému Googlu
(`tests/google-login.test.ts`). **Proti skutečnému Googlu ověřeno nebylo.** Živé přihlášení čeká na
testovací účty a OAuth klienta. Výchozí režim dema zůstává vstup kódem a výběr fiktivní role.

## Jak to funguje

- `LOGIN_MODE=google-test` přidá na vstupní stránku tlačítko „Přihlásit se účtem Google“. Je to
  **druhý režim vedle fiktivních rolí**, vstup kódem zůstává. Neúplná konfigurace přihlášení nezapne
  a trasy `/api/google/prihlaseni` vrací 404.
- Tok OpenID Connect s autorizačním kódem, PKCE, stavem a nonce. Wiki žádá jen `openid email`.
  Žádný token Googlu se neukládá, po ověření identity se zahodí.
- ID token se ověřuje na serveru (část 02 zadání): podpis veřejným klíčem Googlu (pevně RS256),
  vydavatel, příjemce (`aud` a `azp` = náš klient), platnost, nonce této žádosti a `email_verified`.
- **Google říká jen, kdo se přihlásil.** Roli a skupiny čte Wiki z databáze při každém požadavku.
- Kdo smí dovnitř, určuje `GOOGLE_LOGIN_ACCOUNTS` (ověřený e-mail → uživatel Wiki). Při prvním
  přihlášení se účet sváže se stabilním `sub` (tabulka `user_identities`). Stejná adresa s jiným `sub`
  nebo stejný `sub` u jiného uživatele se odmítne.
- Odebrání adresy ze seznamu, smazání vazby nebo vypnutí režimu ukončí i běžící session, ne až po
  vypršení cookie.
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
| `GOOGLE_LOGIN_ACCOUNTS` | `adresa=id-uzivatele` oddělené čárkou, např. organizátor na `demo-organizator` a příjemce na `demo-ucastnik`. Každá adresa i každý uživatel jen jednou. |
| `APP_URL` | Veřejná adresa nasazení, ze které se skládá přesměrovací adresa. |

## Živý test

1. Účet ze seznamu se přihlásí a vidí Wiki v roli svého uživatele. V liště je „Přihlášení účtem
   Google“ a chybí přepínač rolí.
2. Účet mimo seznam skončí na vstupu se zprávou, že nemá přístup.
3. Zrušení souhlasu na obrazovce Googlu vrátí na vstup se zprávou o zrušení.
4. Po odebrání adresy z `GOOGLE_LOGIN_ACCOUNTS` a novém nasazení přestane běžící session platit.
5. Účastník přihlášený Googlem nevidí akce mimo své publikum a nedostane se k cizí nahrávce
   (stejná pravidla jako u fiktivní role).

## Co testy proti napodobenému Googlu neříkají

Potvrdí až živý test: skutečný tvar ID tokenu a hlaviček klíčů, střídání klíčů, obsah souhlasové
obrazovky, chování výběru účtu a chybové odpovědi token endpointu.

## Před produkcí

Seznam v proměnné prostředí je řešení pro test. V provozu ho nahradí správa uživatelů ve Wiki
(pozvání, vazba na `sub`, odebrání) a rozhodnutí, zda přístupový kód a fiktivní role zcela zmizí.
