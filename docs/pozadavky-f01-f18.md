# Požadavky zadavatelky F01–F18 a rozhodnutí D01–D07

Závazné znění finálního feedbacku zadavatelky a dodatečná rozhodnutí zadavatele projektu (uživatel dodal 22. 11. 2026).
Tento soubor je zdroj pravdy pro body F01–F18. Na jejich znění se uživatele znovu neptej.

## Úvodní vyjádření zadavatelky

Celkově je to dost povedené. Shrnu to tedy dohromady včetně toho, co jsem psala. Nic z toho nemusí být doslovné,
navrhněte podle vás. Něco z toho doplnil asistent, nechávám vše ke zvážení. Většina věci se myslím ukáže a projeví při
prvním testu.

## Hlavní věc: povinné × dobrovolné

**F01.** U každé akce nastavit „Pro koho“ (FP / RM / všichni). Pro tyhle role je povinná, pro ostatní dobrovolná. Pole
„Pro koho“ v detailu už je, chybí ale v přípravě měsíce, kde je jen „Skupina: Tým A“.

**F02.** V seznamu akcí štítek „Povinné pro tebe“ / „Můžeš se přihlásit“ a přepínač Moje / Všechny.

**F03.** Tlačítka Omluvit se (nemoc / dovolená / jiné + poznámka, vidí manažer) a Přihlásit / Odhlásit.

**F04.** Kalendář přes pozvánky: povinná akce přijde jako pozvánka a omluva ji odmítne. Dobrovolná se přidá až po
přihlášení.

**F05.** Kdo má víc rolí, má povinné akce všech svých rolí. (Může být například Finanční poradce a Vedoucí týmu.)

## Plán

**F06.** V prázdném měsíci jedno hlavní tlačítko „Připravit měsíc“. Teď jsou tam tři podobná a prázdný stav se ukazuje
dvakrát.

**F07.** V průvodci ukázat všechny kroky dopředu, ne jen „1“. „Zavřít“ stačí jednou.

**F08.** Hromadně doplňovat i téma, nejen vedoucího. Kliknutí na štítek („Chybí téma“) by mělo filtrovat řádky.

**F09.** U šedého „Zveřejnit“ napsat proč: „Doplň téma a vedoucího u 18 akcí.“

## Témata

**F10.** Krátce vysvětlit, co jsou „Garantovaná témata“. Přidat filtr „Pro mou roli / Všechna“.

**F11.** Úchyty pro přetahování (≡) a pořadí ukazovat jen správci.

**F12.** Vynechat „zatím neproběhlo“, je skoro všude. „v návrhu na…“ přepsat na „termín se potvrzuje“.

Upřesnění F10–F12 od uživatele (22. 11. 2026):

* F10: krátké a srozumitelné vysvětlení garantovaných témat; filtr „Pro mou roli / Všechna“; u člověka s více
  pracovními rolemi témata pro všechny jeho role; zachovat existující funkce a pořadí témat; neměnit současný počet
  povolených garantovaných témat bez schválení.
* F11: úchyty a správu pořadí vidí jen správce; běžní uživatelé vidí přehledný seznam bez editačních prvků; zachovat
  přetahování myší, dotykem a klávesnicí; všechny změny pořadí ověřované na serveru.
* F12: odstranit opakující se „zatím neproběhlo“; „v návrhu na…“ nahradit „Termín se potvrzuje“; zachovat důležité
  informace o skutečně naplánovaných a proběhlých akcích; zkrátit nadbytečné texty, odstranit duplicity.
* Společné: jednotné tykání, stávající vizuální styl Wiki, mobilní responzivita, přístupnost, nezasahovat zbytečně do
  ostatních modulů, důkladné testy včetně rolí a oprávnění.

## Zápisy

**F13.** Napsat, kdo zápis schvaluje. Úkol „napsat zápis“ má mít vedoucí akce nebo správce, ne účastník.

**F14.** Méně voleb: jedno pole „Vlož přepis nebo poznámky“ a „nebo nahraj soubor“. Skrýt „Nahrávka (ukázka)“, dokud
nefunguje.

**F15.** Citlivá data: přepisy mohou obsahovat jména klientů. AI by je měla vynechat a AI služba nesmí data používat
k trénování.

## Obecně

**F16.** V náhledu za jiného člověka ukazovat jeho jméno, ne „Vítejte, Anna“. „Správa systému“ v pohledu poradce skrýt.

**F17.** Tykat jako ve wiki („Ahoj, Anno“, „Co tě čeká“). Až se modul spojí s Moje ZBČ, musí to být jednotné.

**F18.** Na užším okně se záhlaví rozpadá (jméno a „Odhlásit“ jsou pod sebou).

## Dodatečná rozhodnutí zadavatele projektu

Nejsou součástí doslovného textu zadavatelky, platí společně s body F01–F18.

**D01 – Okamžitá omluva:** Omluva z povinné akce platí ihned, bez schvalování manažerem. Manažer může zobrazit její
důvod a případnou poznámku v rámci svých oprávnění.

**D02 – Jednotné tykání:** Celá aplikace, včetně budoucího Moje ZBČ, používá tykání. Vykání v komunikaci mezi členy
vývojového týmu není požadavkem na texty aplikace.

**D03 – Správná oslovení:** Implementovat centrální systém správného oslovování jmény, zejména český pátý pád.
Preferovat malý slovník jmen a uživatelsky nastavitelnou podobu oslovení. Pokud správný tvar není známý, použít
původní podobu jména nebo neutrální oslovení.

**D04 – Zachování designu:** Zachovat základní vzhled, barevnost, rozvržení a funkčnost současné Wiki. Úpravy mají být
především funkční a zaměřené na zjednodušení používání.

**D05 – Pořadí vývoje:** Nejdříve dokončit všech 18 bodů v samostatném modulu Vzdělávání. Až potom integrovat modul do
Moje ZBČ podle skutečných technických podkladů.

**D06 – Bezpečné nasazování:** Pracovat v samostatných větvích a PR. Bez výslovného schválení neprovádět merge do main,
produkční nasazení, produkční migrace ani živé operace s Google Kalendářem.

**D07 – Dokončení:** Každý bod F01–F18 musí být ověřený a otestovaný, než se označí jako hotový. Rozpracovaný základ
nestačí.

## Poznámka k F06–F09

Uživatel 22. 11. 2026: F06–F09 jsou součástí PR3 (#79). PR3 je draft, body nejsou finálně schválené. V dalších PR je
neopravuj mimo jejich rozsah; konečné ověření proběhne v závěrečném auditu (PR7).

## Bod → konkrétní testy (PR8, 22. 11. 2026)

Každý bod má aspoň jeden cílený test. Unit = `tests/` (Vitest), e2e = `e2e/` (Playwright). Názvy jsou názvy testů
(`describe` › `test`).

| Bod | Unit | E2E |
|---|---|---|
| F01 | `priprava-mesice.test.ts` › Pro koho v přípravě měsíce (F01) › nové plánování nabízí jen Všichni, FP a RM; `ucast-role.test.ts` › matice F01/F05 › FP: FP povinná, RM dobrovolná; RM naopak | `okna.spec.ts` › Připravit měsíc: kroky, sloupce, mezery a uložení bez změn (Pro koho) |
| F02 | `ucast-role.test.ts` › viditelnost zveřejněných akcí (F02, přepínač); `ucast-prihlasky.test.ts` › štítky a filtr Moje | `ucast.spec.ts` › přepínač Moje/Všechny, štítky, přihlášení, odhlášení, omluva a její zrušení |
| F03 | `ucast-prihlasky.test.ts` › akce formuláře: přechody (přihlásit…, omluva s důvodem a poznámkou…), oprávnění, soukromí a souběh | `ucast.spec.ts` › přepínač Moje/Všechny, …, omluva a její zrušení; soukromí omluvy › poznámka kolegy není v HTML jiného uživatele |
| F04 | `kalendar-f04.test.ts` › F04: povinná akce přijde po zveřejnění jako pozvánka; F04 + D01: omluva pozvánku odmítne a platí ihned (2 testy); F04: dobrovolná akce se přidá až po přihlášení; F04 nad ukázkovými daty (2 testy); F04: okno akce v Plánu ukazuje stav vlastní pozvánky; calendarNote; `kalendar-ucast.test.ts` › pozvánky podle účasti (fake Google) | `ucast.spec.ts` › F04: pozvánka v Kalendáři podle povinnosti, omluvy a přihlášky |
| F05 | `ucast-role.test.ts` › FP+RM: obě povinné, pozvaný jen jednou; FP + vedoucí týmu | `ucast.spec.ts` › víc pracovních rolí (F05) › vedoucí s rolemi FP i RM má povinné akce obou rolí |
| F06 | `priprava-mesice-f06-f09.test.ts` | `priprava-mesice-f06-f09.spec.ts` › F06: jedno hlavní tlačítko Připravit měsíc a prázdný stav jen jednou |
| F07 | `priprava-mesice-f06-f09.test.ts` | `priprava-mesice-f06-f09.spec.ts` › F07: průvodce ukáže všechny tři kroky dopředu a Zavřít je jen jedno |
| F08 | `priprava-mesice-f06-f09.test.ts` › hromadné doplnění tématu (F08); štítek přehledu filtruje řádky (F08) | `priprava-mesice-f06-f09.spec.ts` › F08: hromadně doplnit téma…; F08: klik na Chybí téma vyfiltruje řádky… |
| F09 | `priprava-mesice-f06-f09.test.ts` › proč je Zveřejnit šedé (F09) | `priprava-mesice-f06-f09.spec.ts` › F09: šedé Zveřejnit říká proč a s potvrzením se odemkne |
| F10 | `temata-f10-f12.test.ts` › F10 filtr Pro mou roli / Všechna: pravidla; F10 a F11 na serveru | `temata-planovani.spec.ts` › F10–F12 (správce i kolega); `ucast.spec.ts` › témata v režimu všech zveřejněných (F10, F11) |
| F11 | `temata-f10-f12.test.ts` › F11: pořadí mění jen správce… | `temata-planovani.spec.ts` › F10–F12; `ucast.spec.ts` › … pořadí kolega měnit nemůže |
| F12 | `temata-f10-f12.test.ts` › F12 texty | `temata-planovani.spec.ts` › F10–F12 … bez „zatím neproběhlo“ |
| F13 | `zapisy-f13-f15.test.ts` › F13: kdo zápis schvaluje a kdo má úkol ho napsat (4 testy) | `zapisy-schvaleni.spec.ts` › vložit text → upravit → vedoucí schválí → zveřejněno… (`schvaluje`) |
| F14 | `zapisy-f13-f15.test.ts` › F14: méně voleb, nahrávka skrytá, dokud nefunguje (3 testy) | `zapisy-bez-nahravky.spec.ts` › nahrávka se nenabízí, jedno pole, jména a kontakty klientů v návrhu nejsou |
| F15 | `zapisy-f13-f15.test.ts` › F15: jména klientů vynechat, AI bez trénování (4 testy) | `zapisy-bez-nahravky.spec.ts` › (stejný test, jména klientů) |
| F16 | `nahled.test.ts` › F16: náhled kolegy nese jeho jméno a oprávnění kolegy… | `nahled.spec.ts` › pohled kolegy: úvod nezdraví správce a Správa systému v navigaci chybí (F16) |
| F17 | `osloveni.test.ts` › oslovení jménem (5. pád, neutrální „Ahoj“, vlastní podoba) | `domu-ukoly.spec.ts` › „Co tě čeká“; `nahled.spec.ts` › neutrální „Ahoj.“ |
| F18 | (jen rozvržení, unit test nedává smysl) | `zahlavi.spec.ts` › účet je na jednom řádku a lišta nepřetéká (F18) |

**F04 v simulaci (PR8):** povinná akce = pozvánka po zveřejnění (hosté = povinní − omluvení + přihlášení); omluva platí
ve Wiki hned (D01) a hned po odpovědi (`after(() => syncEvent)` v `changeParticipationAction`) Wiki omluveného z hostů
odebere, Google mu pošle zrušení. `declined` za něj Wiki nenastavuje (O04). Karta „Tvoje účast“ v detailu akce i v okně akce v Plánu (PR #94: až po obsahu akce) říká stav synchronizace
s Kalendářem, ne slib doručení pozvánky (`calendarNote` v `src/lib/calendar-note.ts`, `ownCalendarState`):
„Kalendář: synchronizováno.“, „Kalendář: synchronizace čeká.“, „Kalendář: synchronizace selhala, Wiki ji zkusí znovu.“,
„Kalendář: zatím tě Wiki nezve. Po přihlášení se synchronizuje.“, „Kalendář: Wiki tě na akci nezve.“,
„Kalendář: stav neznámý, Wiki tvoji pozvánku nespravuje.“ Kde stav Wiki nezná (osobní kalendáře, pevný seznam
testovacích příjemců, výpadek), karta řekne „Kalendář: stav neznámý.“ U zrušené akce věta o Kalendáři není.

**Stav F04: hotovo v simulaci** (unit `kalendar-f04.test.ts` 18/18, e2e `ucast.spec.ts` › F04 na windows-1280 i
telefon-390, celé e2e 1333 OK / 213 přeskočeno / 0 chyb). Živý test s Googlem dál čeká na schválení (D06).

**O09 vyřešeno (finální integrační kolo, 23. 11. 2026):** věty panelu netvrdí nic, co Wiki neví. U hosta mimo
spravované hosty (ruční host spárované pozvánky) panel neříká, že pozvánku nemá ani že ji omluva „odmítla“. Test
`kalendar-f04.test.ts` › O09. Podrobnosti v `docs/report-finalni-integracni-opravy.md`.

**Zbývá pro živý test (vyžaduje schválení uživatele, D06):** účet organizátora v Google, `CALENDAR_MODE=google-test`,
`CALENDAR_DELIVERY=organizer`, `CALENDAR_ATTENDEES=audience`, `PARTICIPATION=on` na preview; ověřit, že pozvaný dostane
e-mail s pozvánkou, že odebrání z hostů po omluvě Google doručí jako zrušení a pozvánka zmizí z kalendáře účastníka, že
přihláška přidá a odhlášení odebere; zda organizátor smí nastavit `declined` (O04, varianta k přepnutí).
