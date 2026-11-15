# Zveřejnění aplikace u Googlu (bez vlastní domény)

Proč: souhlasová obrazovka v režimu **Testing** dává obnovovacím tokenům platnost 7 dní, takže se Kalendář každý týden
odpojí. Po přepnutí na **In production** (Publish app) tokeny po 7 dnech nevyprší. Vlastní doména ani ověření aplikace
u Googlu k tomu potřeba nejsou. Rozhodnuto 15. 11.: vlastní doménu zatím neřešíme, firma Wiki ještě nemá.

Neověřená aplikace má dvě omezení. Správce při propojení Kalendáře uvidí varování „Google tuto aplikaci neověřil“
a rozsah `calendar.events` smí udělit nejvýš 100 uživatelů. Kalendář propojuje jen správce, takže to nevadí. Ostatní
se přihlašují jen se základními rozsahy (`openid email profile`), varování se jich netýká.

## Kroky

1. `https://console.cloud.google.com` → nahoře vyber projekt Wiki.
2. Menu ☰ → **Google Auth Platform** → **Audience**.
3. U Publishing status (**Testing**) klikni **Publish app** → **Confirm**. Stav je **In production**.
4. Ve Wiki → **Vzdělávání** → **Integrace** → **Připojit znovu**. Token z režimu Testing si 7 dní nese dál, proto se
   propojení jednou obnoví. Na obrazovce „Google tuto aplikaci neověřil“: **Rozšířené** → **Přejít na … (nebezpečné)**
   → povolit Kalendář.
5. Claude nastaví Production `GOOGLE_OAUTH_PUBLISHED=1` (Wiki přestane hlásit 7denní vypršení).
6. Vercel → projekt **zbc-vzdelavani-demo** → **Deployments** → u posledního Production **⋯** → **Redeploy** → **Redeploy**.

Pokud Google zveřejnění odmítne (například kvůli adresám `*.vercel.app`, které nejde přidat mezi autorizované domény),
zůstává režim Testing: Wiki dva dny před vypršením nabídne „Obnovit propojení“ a stačí jedno potvrzení týdně.

Vlastní doména, logo a ověření aplikace přijdou na řadu, až je firma bude chtít.
