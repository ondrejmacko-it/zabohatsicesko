# Vlastní doména a zveřejnění aplikace u Googlu

Proč: souhlasová obrazovka v režimu **Testing** dává obnovovacím tokenům platnost 7 dní, takže se Kalendář každý týden
odpojí. Po přepnutí na **In production** (Publish app) tokeny přestanou po 7 dnech vypršet. Ověření aplikace u Googlu
(rozsah `calendar.events`) navíc odstraní varování „Google tuto aplikaci neověřil“, které vidí správce při propojení.
Ostatní lidé se přihlašují jen se základními rozsahy (`openid email profile`), varování se jich netýká.

Adresa `*.vercel.app` ověřit nejde (doména nepatří nám), proto je potřeba vlastní doména, například
`wiki.<firemni-domena>.cz`. V textu dál `<domena>`.

## Dopad změny adresy (důležité)

* Zařízení a přihlášení jsou vázané na adresu (cookie `__Host-`). Po přechodu na `<domena>` se **všichni přihlásí znovu**
  a každý člověk dostane **novou pozvánku** (Správa → menu u člověka → Nový odkaz). Hlavní správce se poprvé přihlásí
  přes `https://<domena>/vstup?spravce=1`.
* Propojení Kalendáře v databázi zůstává. Po zveřejnění aplikace ho ale správce jednou obnoví (token vydaný v režimu
  Testing si 7denní platnost nese dál).

## Pořadí kroků

1. Doména na Vercelu (uživatel)
2. Ověření domény v Google Search Console (uživatel)
3. Branding: název, logo, odkazy, autorizovaná doména (uživatel)
4. Nové přesměrovací adresy u OAuth klienta (uživatel)
5. `APP_URL=https://<domena>` v Production (Claude přes API), nové nasazení Production (uživatel)
6. Publish app (uživatel)
7. Obnovení propojení Kalendáře (správce ve Wiki)
8. `GOOGLE_OAUTH_PUBLISHED=1` (Claude přes API), nové nasazení Production (uživatel)
9. Žádost o ověření aplikace (uživatel, Google odpovídá dny až týdny)

## 1. Doména na Vercelu

1. Otevři `https://vercel.com` → tým **maci** → projekt **zbc-vzdelavani-demo**.
2. Nahoře **Settings** → vlevo **Domains** → vpravo **Add Domain**.
3. Napiš `<domena>` → **Save**. Pokud se Vercel zeptá na prostředí, nech **Production**. Nabídku přesměrování
   `www` u subdomény nezaškrtávej.
4. Vercel ukáže DNS záznam, který chybí (u subdomény **CNAME**, u hlavní domény **A**). Hodnotu zkopíruj přesně z Vercelu.
5. Přihlas se ke správci DNS domény (registrátor, kde je doména vedená) → DNS záznamy → **Přidat záznam**:
   typ a hodnota podle Vercelu, název = část před doménou (např. `wiki`) → Uložit.
6. Vrať se do Vercelu, u domény počkej na **Valid Configuration** (minuty až hodiny). Certifikát HTTPS Vercel vystaví sám.

## 2. Google Search Console

Použij **stejný účet Google**, který je vlastníkem projektu v Google Cloud.

1. Otevři `https://search.google.com/search-console` → vlevo nahoře výběr služby → **Přidat službu**.
2. Vlevo **Doména** → napiš hlavní doménu bez `wiki.` (např. `firemni-domena.cz`) → **Pokračovat**.
3. Google ukáže záznam **TXT** (`google-site-verification=…`) → **Kopírovat**.
4. U správce DNS → **Přidat záznam**: typ **TXT**, název `@` (nebo prázdný), hodnota vložená → Uložit.
5. Zpět v Search Console → **Ověřit**. Když to hned neprojde, zkus to za 10–60 minut znovu.

Když doménu spravuje firma a TXT záznam přidat nemůžeš, pošli jim hodnotu z bodu 3, případně ať tě přidají
jako vlastníka existující služby v Search Console (Nastavení → Uživatelé a oprávnění → Přidat uživatele → Vlastník).

## 3. Branding (název, logo, odkazy)

1. Otevři `https://console.cloud.google.com` → nahoře vyber projekt s OAuth klientem Wiki.
2. Vlevo menu ☰ → **Google Auth Platform** → **Branding**.
3. **App name**: `Firemní Wiki Za bohatší Česko` (nebo jak má aplikace u lidí vystupovat).
4. **User support email**: tvoje adresa.
5. **App logo**: čtverec **120 × 120 px**, PNG nebo JPG, do 1 MB. Logo spouští ověření značky, dokud neproběhne,
   Google ho nezobrazí.
6. **App domain**:
   * Application home page: `https://<domena>/soukromi`
   * Application privacy policy link: `https://<domena>/soukromi`
   * Terms of service: nech prázdné.
7. **Authorized domains** → **Add domain** → hlavní doména (např. `firemni-domena.cz`). Musí být ověřená v kroku 2.
8. **Developer contact information**: tvoje adresa → **Save**.

Stránka `/soukromi` je veřejná, popisuje účel Wiki i použití Kalendáře (Limited Use). Kdyby Google domovskou stránku
odmítl jako nedostatečnou, přidá Claude veřejnou stránku „O aplikaci“.

## 4. Přesměrovací adresy OAuth klienta

1. **Google Auth Platform** → **Clients** → klikni na klienta Wiki (typ Web application).
2. **Authorized redirect URIs** → **Add URI** dvakrát:
   * `https://<domena>/api/google/prihlaseni/callback`
   * `https://<domena>/api/google/kalendar/callback`
3. Staré adresy `zbc-vzdelavani-demo.vercel.app` zatím nech, dokud nová doména nefunguje. → **Save**.
   Změna se projeví do pár minut.

## 5. Nová APP_URL a nasazení

1. Napiš Claudovi doménu, nastaví Production `APP_URL=https://<domena>` přes API.
2. Vercel → projekt → **Deployments** → u posledního Production nasazení **⋯** → **Redeploy** → **Redeploy**.
3. Otevři `https://<domena>/vstup?spravce=1` → přihlas se. Zkontroluj, že Správa funguje.

## 6. Publish app

1. **Google Auth Platform** → **Audience**.
2. Publishing status: **Testing** → **Publish app** → **Confirm**.
3. Stav je teď **In production**. User type zůstává **External**. Neověřená aplikace s citlivým rozsahem má limit
   100 uživatelů, kteří rozsah udělí. Kalendář uděluje jen správce, takže to nevadí.

## 7. Obnovení propojení Kalendáře

1. Ve Wiki → **Vzdělávání** → **Integrace** → **Připojit znovu** (nebo Správa → Kalendář).
2. U Googlu se objeví „Google tuto aplikaci neověřil“: **Rozšířené** → **Přejít na … (nebezpečné)** → povol Kalendář.
   Varování zmizí po kroku 9.

## 8. GOOGLE_OAUTH_PUBLISHED

Napiš Claudovi, že je aplikace zveřejněná. Nastaví Production `GOOGLE_OAUTH_PUBLISHED=1` (Wiki přestane hlásit
7denní vypršení). Pak znovu **Redeploy** jako v kroku 5.

## 9. Ověření aplikace (rozsah calendar.events)

1. **Google Auth Platform** → **Data Access** → zkontroluj, že je v seznamu `.../auth/calendar.events`
   (Your sensitive scopes). Pokud chybí: **Add or remove scopes** → vyhledej `calendar.events` → zaškrtni → **Update** → **Save**.
2. U rozsahu vyplň zdůvodnění (anglicky), například: *The app creates, updates and cancels invitations for internal
   training events in the company calendar on behalf of the administrator who connects it. It does not read other events.*
3. Natoč krátké video (YouTube, neveřejné): adresa `https://<domena>` v prohlížeči, přihlášení správce, souhlasová
   obrazovka s viditelným názvem aplikace a rozsahem, zveřejnění akce ve Wiki a pozvánka v Google Kalendáři.
4. **Google Auth Platform** → **Verification Center** → **Prepare for verification** (nebo **Submit for verification**)
   → projdi kroky, vlož odkaz na video a zdůvodnění → **Submit**.
5. Google píše na kontaktní e-mail. Ověření značky trvá obvykle pár dní, citlivý rozsah dny až týdny. Na dotazy
   odpovídej v tom vlákně.
