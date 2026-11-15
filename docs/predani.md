# Předání dema modulu Vzdělávání

Stav k 15. 11. 2026. Spuštění, proměnné prostředí a architektura jsou v [README](../README.md),
oddělení ostré Wiki od ukázky a kroky nasazení v [nasazeni.md](nasazeni.md).

## Ostrá Wiki a ukázka

- **Production** (`WIKI_MODE=production`): vstup jen účtem Google, vlastní databáze, která při prvním
  spuštění dostane jen pravidelný týden, skutečný čas, Google Kalendář se skutečným publikem. Prvního
  správce založí přihlášení s adresou z `BOOTSTRAP_ADMIN_EMAILS`, další lidi zve Správa systému.
  Bez textů a prvků ukázky (odznak, fiktivní role, neaktivní hledání, Knihovna a další kulisy).
  Nahrávky zatím jako v ukázce.
- **Preview** (ukázka): fiktivní role, simulace Kalendáře, vstup zvacím odkazem `/vstup?pozvanka=<kód>`
  nebo ručním kódem. Přihlášení Googlem se v ukázce nenabízí.

## Stav integrací

| Integrace | Režim v demu | Co je ověřeno | Co ověřeno není |
|---|---|---|---|
| Google Kalendář | **Simulace** se stejným rozhraním jako budoucí adaptér | Identita pozvánky, zachování hostů, RSVP a odkazu na schůzku, jedno oznámení na změnu, opakování bez duplicit, pořadí revizí, výpadek, odvolaný přístup, ruční změna mimo Wiki, zrušení jednoho termínu | Zápis do skutečného Google účtu. Simulovaný krok **nebyl** ověřen proti Google. |
| Google Kalendář, ostrá Wiki | **Zapnutý v ostré Wiki** (`CALENDAR_MODE=google-test`, kalendář `primary`, pozvánky podle skupiny akce) | Testy proti napodobenému HTTP: vytvoření bez duplicit, úprava jen spravovaných polí, jeden výskyt série, odmítnutí zápisu do série a do cizí pozvánky, povolené kalendáře a příjemci, šifrování a obnova tokenu, odvolaný přístup, chybějící přístup ke kalendáři. Živě: test 12. 11. 2026 (záznam v [google-kalendar.md](google-kalendar.md)) a provoz od 15. 11. 2026 (vazby synchronizované) | Dlouhodobý provoz s větším počtem příjemců. |
| Přihlášení Google identitou | **Jediný vstup ostré Wiki** (`LOGIN_MODE=google-test`, pozvánka na jedno zařízení), v ukázce se nenabízí | Proti napodobenému Googlu: podpis, vydavatel, příjemce, platnost, nonce a ověřený e-mail v ID tokenu, vazba na stabilní `sub`, odmítnutí účtu mimo pozvánku a záměny účtu, okamžité ukončení session po odebrání, zákaz přepínání rolí. Živě: přihlášení správce v ostré Wiki (aplikace Google v režimu In production) | Postup je v [google-prihlaseni.md](google-prihlaseni.md). Seznam účtů v proměnné prostředí je jen pro test, ostrá Wiki ho ignoruje. |
| Přepis a zápis | **Ukázkový**: zná jen přiloženou syntetickou nahrávku (podle otisku SHA-256) | Celá cesta nahrání → zpracování → kontrola → oprava → zveřejnění, opakované doručení úlohy, nahrazení audia, výpadek a opakování | Skutečný přepis a shrnutí. Jiný soubor skončí čitelnou chybou „nepodporovaný soubor“. |
| Úložiště nahrávek | Soukromé, v databázi, vydávání jen přes autorizovanou cestu | Přístup vedoucího, zamítnutí účastníka a kolegy mimo publikum, přístup správce, i přímým odkazem | Uchovávání a mazání podle pravidel firmy. |

Přepínače chybových stavů jsou v *Vzdělávání → Integrace* (jen správce). V produkci neexistují.

## Ověřené scénáře

Automaticky: `npm test` (přes 170 testů nad skutečnou databází PGlite, včetně adaptéru Google Kalendáře proti napodobenému HTTP), lint, typová kontrola a produkční build.
Ručně v prohlížeči (Chromium, desktop 1440 px a iPhone 13) celý průchod podle části 04:

1. Špatný přístupový kód i zvací odkaz se špatným kódem jsou odmítnuty, platný odkaz pustí k výběru role bez psaní kódu. Bez přihlášení vede stránka na vstup a API vrací 401.
2. Domov → „Co tě čeká“ → Harmonogram listopadu: dny út–pá, svátek 17. 11., zrušený trénink 4. 11.,
   mimořádné akce (Setkání týmu, dvoudenní školení 20.–21. 11., AI workshop v pondělí 30. 11. ve svém týdnu).
3. Správce upraví téma Tréninku RM 12. 11.: uložený návrh změny přežije obnovení stránky a kolegové
   vidí původní verzi. Po zveřejnění se upraví **stejná** pozvánka (`demo-existing-rm-1112`), host a jeho
   RSVP i odkaz na schůzku zůstanou, odejde jedno oznámení, stav přejde Čeká → Synchronizováno.
4. Mobil: agenda bez posunu do strany, detail stejného termínu.
5. Účastník označí zájem o téma a navrhne nové téma.
6. Vedoucí nahraje testovací nahrávku k tréninku 11. 11. (před potvrzením vidí název a termín akce),
   zpracování → Ke kontrole → oprava → zveřejnění. Audio přehraje.
7. Účastník čte zveřejněný zápis, pracovní přepis ani audio nevidí.
8. Kolega mimo publikum dostane „Záznam neexistuje nebo k němu nemáte přístup“ i přes přímý odkaz a API.
   Člen týmu bez role vedoucího nebo kontrolora audio nezíská, správce ano.

## Rozdíly oproti referenci

- **Shell** je reprodukovaný podle onboardingového videa: horní lišta, tmavé levé menu se sticky polohou,
  okrová aktivní položka, světlý panel, karty a tlačítka. Typografie odpovídá Wiki ve videu (Inter +
  Newsreader, obě hostované s aplikací). PDF používá pro text DM Sans; nové obrazovky přebírají jeho barvy
  a strukturu harmonogramu. Pixelovou shodu nelze ze střihu videa potvrdit.
- **Ostatní sekce Wiki** (Knihovna dokumentů, Moje role, Jak pracujeme, Správa systému, Moje cesta) jsou jen
  kulisy bez interního obsahu. Na Domově je jen karta „Co tě čeká“.
- **Formát data a času** v polích formuláře určuje prohlížeč uživatele.
- **Střídání typů** ve slotu šablony (např. trénink poradců / portfolio) je zatím podle lichého a sudého
  týdne. Ze vzoru v Numbers pevné pravidlo nevyplývá, správce může každý termín změnit ručně.

- **Předvyplnění témat** při generování měsíce se týká jen firemního vzdělávání FP a RM. Tréninkům,
  Portfolio týmu a Action time téma určuje vedoucí. Rozsah je potřeba potvrdit s firmou.

## Před pilotem s lidmi (harmonogram)

1. **Přístupy a hosting.** Ostrá Wiki je oddělená od ukázky (vlastní databáze, jen účty Google,
   správa uživatelů ve Wiki), kroky jsou v [nasazeni.md](nasazeni.md). Aplikace Google je v režimu
   In production (bez vlastní domény a bez ověření aplikace, do 100 uživatelů). Zbývá plán Vercelu
   pro komerční provoz, zálohy a obnova.
2. **Google Kalendář** běží v ostré Wiki. Živý test 12. 11. 2026 a postup jsou v
   [google-kalendar.md](google-kalendar.md).
3. **Rozhodnutí s firmou:** kdo vlastní současné pozvánky a ke kterému kalendáři má Wiki zapisovat; zda se
   série převádí, nebo se nové akce zakládají od domluveného data; jak se střídají typy po výjimce.

**Vypnutí integrace:** odpojení oprávnění zastaví zápisy. Změny zůstanou ve Wiki uložené a akce ukáže stav
„Změna se nepropsala“. Po opětovném připojení správce spustí „Zkusit synchronizaci znovu“ a odešle se
nejnovější zveřejněná verze, starší revize se nepošle.

## Před klientskými nahrávkami

Nahrávky se v produkci zapnou až po potvrzení těchto podmínek:

- schválený poskytovatel přepisu a shrnutí, umístění zpracování (EU), podmínky uchování dat u poskytovatele;
- úložiště souborů pod účtem firmy, doba uchování audia, přepisu a zápisu včetně záloh, postup smazání;
- kdo je kontrolor zápisů, zda citlivé zápisy procházejí redakcí a kdo smí zápis zveřejnit;
- zda „kdo tam byl“ znamená všechny pozvané, nebo jen přítomné;
- limity pro reálné nahrávky (délka, formát, dělení dlouhých souborů) a cíl „zápis do druhého dne“.

Skutečný poskytovatel implementuje rozhraní `TranscriptionProvider` v
`src/server/recordings/transcription.ts`. Výstup modelu prochází validací schématu stejně jako dnes.
