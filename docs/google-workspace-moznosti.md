# Google Workspace a servisní účet · možnosti (návrh, nic z toho není naprogramováno)

Stav k 13. 11. 2026. Otázka: jak se zbavit jednorázového souhlasu organizátora ke Kalendáři a sedmidenní
platnosti propojení. Ověřeno ve výsledcích vyhledávání nad dokumentací Googlu (odkazy dole), plné znění stránek
se z pracovního prostředí otevřít nepodařilo. Před rozhodnutím si klíčové věty na odkazech přečíst.

## Proč to dnes vyprší

OAuth aplikace je typu External ve stavu Testing a žádá `calendar.events`. Google takové aplikaci vydává
obnovovací token na 7 dní. Výjimku mají jen aplikace, které žádají pouze jméno, e-mail a profil. Proto
přihlášení nevyprší a Kalendář ano. Testovacích uživatelů může být nejvýš 100.

## Možnosti

| | Co to je | Souhlas organizátora | 7 dní | Co je potřeba |
|---|---|---|---|---|
| A | Dnešní stav: External, Testing, osobní Gmaily | jednou, potom každých 7 dní | ano | nic |
| B | External přepnout na In production bez ověření | jednou, s varováním „neověřená aplikace“ | ne | klik v Google konzoli, strop 100 uživatelů |
| C | B a ověření aplikace Googlem | jednou, bez varování | ne | doména, zásady ochrany soukromí, řádově 10 pracovních dní |
| D | Google Workspace, aplikace Internal | jednou, bez varování | ne | firma má Workspace, projekt patří organizaci, účty jsou firemní |
| E | Workspace a servisní účet s delegováním pro celou doménu | žádný | ne | super správce Workspace povolí klienta a rozsah v Admin konzoli |

- **B** je nejmenší krok a jde s osobními Gmaily. Přihlášení (jen identita) varování neukazuje, varování uvidí
  jen ten, kdo propojuje Kalendář. Zda se `calendar.events` řadí mezi citlivé rozsahy, se ověřit nepodařilo,
  počítáme s tím, že ano.
- **D** odstraní Testing úplně: Internal aplikace nepotřebuje ověření ani seznam testovacích uživatelů, ale
  přihlásí se jen účty organizace. Osobní Gmaily by přestaly fungovat. Správce Workspace může navíc označit
  i externí aplikaci jako důvěryhodnou, což pro uživatele organizace ruší strop i 7 dní.
- **E** je jediná varianta úplně bez souhlasu. Servisní účet sám hosty zvát nesmí (účty založené po 2. 3. 2020
  jen přes delegování), musí tedy vystupovat za konkrétního uživatele, typicky vlastníka kalendáře vzdělávání.
  Delegování dává aplikaci přístup za kteréhokoli uživatele domény v povoleném rozsahu, je to tedy rozhodnutí
  firmy a jejího správce, ne nastavení dema. S osobními Gmaily nejde.

## Co by to znamenalo v kódu (odhad)

- B, C, D: žádná změna kódu, jen nastavení v Google konzoli. U D navíc firemní účty v `GOOGLE_LOGIN_ACCOUNTS`
  a ve Správě.
- E: nový způsob získání přístupového tokenu v `src/server/calendar/` (podepsaný JWT servisního účtu se
  `sub` vlastníka kalendáře) vedle dnešního OAuth, klíč servisního účtu jako tajemství, zmizí souhlas,
  úkol „Propojte Kalendář Google“ a šifrovaný obnovovací token. Adaptér a synchronizace zůstanou. Odhad jeden až dva dny
  včetně testů, živý test jen s Workspace.

## Doporučení

Teď pro demo **B** (odpadne sedmidenní vypršení, nic se neprogramuje). Až firma potvrdí, že má Workspace a kdo
vlastní kalendář vzdělávání, rozhodnout mezi **D** (jednodušší, jeden souhlas) a **E** (bez souhlasu, vyžaduje
super správce).

## K rozhodnutí

- Má firma Google Workspace? Kdo je super správce a kdo vlastní kalendář vzdělávání?
- Budou se lidé hlásit firemními účty, nebo zůstávají osobní Gmaily?

## Zdroje

- [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2) (platnost obnovovacího tokenu)
- [Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en) (Internal, External, Testing)
- [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [Unverified apps](https://support.google.com/cloud/answer/7454865?hl=en) a [When is verification not needed](https://support.google.com/cloud/answer/13464323?hl=en)
- [Using OAuth 2.0 for Server to Server Applications](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority)
- [Control API access with domain-wide delegation](https://support.google.com/a/answer/162106?hl=en)
- [Events: insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) a [Calendar API release notes](https://developers.google.com/workspace/calendar/release-notes) (servisní účet a hosté)
