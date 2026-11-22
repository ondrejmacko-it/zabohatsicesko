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
