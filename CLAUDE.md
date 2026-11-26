# Za bohatší Česko · pravidla pro Claude Code

## Začátek a rozsah

Repo obsahuje samostatné demo modulu Vzdělávání pro firemní Wiki Za bohatší Česko. Pracuje výhradně s fiktivními daty a označenými režimy integrací. Zadání a pracovní podklady (PDF, video, snímky) se do repa nedávají. Pokud se dvě instrukce o větvích nebo ochraně liší, platí tento soubor.

## Podmínka pro každou relaci a každý prompt

- Výsledek musí maximálně splnit zadání. Má být co nejpřehlednější a zároveň co nejsilnější: umět vše, co zadání vyžaduje.
- Pokud něco nevíš nebo si nejsi jistý (výklad zadání, rozsah, dopad změny, stav integrace), zeptej se uživatele dřív, než budeš pokračovat. Nedomýšlej si a nejistotu neschovávej.
- Větší změny nejdřív navrhni a projdi s uživatelem, teprve potom je prováděj.

## Komunikace s uživatelem

- Piš přátelsky a neformálně, uživateli tykej. Věcnost a přesnost zůstávají: stav, rizika a neověřené věci říkej narovinu.
- Tykání platí pro konverzaci. Texty v UI, dokumentaci, commitech a PR zůstávají ve stávajícím stylu repa.
- Když uživatel řekne „pokračuj“, pokračuj na dalším kroku z `docs/dalsi-session.md` a zvol nejméně invazivní variantu, kterou jde později přepnout. Otevřené otázky shrň na konci, práci kvůli nim nezastavuj, pokud nejde o nevratný krok.
- Nastavení, která jdou udělat přes dostupné API (například nesecretní proměnné prostředí preview), udělej sám. Uživateli nech jen to, co udělat nemůžeš: tajemství a klikání v cizích konzolích.

## Git

- Před každou sérií změn ověř stav, aktivní větev a základ. Pro změny založ vlastní větev z dohodnutého základu. Nikdy nepřepisuj cizí necommitnutou práci. Při souběžné práci použij oddělený worktree, pokud je dostupný.
- Používej české názvy bez diakritiky. Příklady `funkce/vzdelavani-harmonogram`, `integrace/google-kalendar`, `oprava/opravneni-nahravek`. Pokud cloud vyžaduje prefix, například `claude/`, ponech českou část za ním.
- Na `main`, `master` ani výchozí produkční větev necommituj, nepushuj a nemerguj. Nevytvářej ani nespouštěj automatický merge, merge queue, přímé změny přes API, produkční deploy ani obejití ochrany. Uživatel ručně schválí a provede finální merge přes PR. Na pracovní větev můžeš uložit a pushnout změny v rámci zadaného úkolu a připravit draft PR, pokud to přístupy dovolují.
- Prověř přesný diff před commitem a pushem. Přidávej jen soubory k úkolu, bez násilného přidání ignorovaných souborů. Žádné přepisování vzdálené historie. Repo settings, pravidla main, produkční přístupy, tajemství a nasazení spravuje uživatel.

## Kód a ověření

- Používej stávající komponenty, oprávnění, databázové migrace, validaci a testovací nástroje. Preferuj jednoduché, čitelné funkce a názvy, které vystihují účel. Komentář vysvětluje rozhodnutí nebo nestandardní omezení. Drž se stylu existujícího repa. UI, commit a PR popisy piš česky. Nové identifikátory v kódu veď podle konvencí repa, ve vlastním demu anglicky.
- Veď jasnou hranici mezi UI, doménovými pravidly a integracemi. Validuj vstupy a ověřuj přístupy na serveru. U zápisu a opakování zkontroluj souběhy, oprávnění a konzistenci dat. Ošetři chyby a udrž provozní logy bez citlivého obsahu.
- Přístupy produkce, záznamy klientů a firemní podklady nepatří do pracovního kódu, historie Gitu ani veřejného buildu. Pro práci stačí fiktivní seed. Při objevení možného tajemství hodnotu nezobrazuj, zapiš pouze cestu a typ problému a pokračuj bezpečně dostupnou prací. Změny oprávnění záměrně neoslabuj.
- Před předáním spusť dostupný lint, typovou kontrolu, testy, build a scénáře v 04 a 06. Přidej cílené testy nových oprávnění a integrací tam, kde existující sada riziko nepokrývá. Výsledky a stav simulace oproti živému testu popiš v draftu PR.

## Úspora tokenů a navazující relace (závazné)

Limit relace je **170 tis. tokenů kontextu (±10 tis.)**. Hlídá ho hook `scripts/limit-kontextu.py` (v `.claude/settings.json`):
od 140 tis. upozorňuje, od 170 tis. dovolí jen předání (git, zápis `docs/dalsi-session.md`, GitHub, založení relace).
Limit se neobchází ani nezvyšuje. Kvalita má přednost před rychlostí, ale ne před limitem: radši menší hotový krok
než velký rozdělaný.

Začátek relace:
- Čti jen `docs/dalsi-session.md`, pak cíleně soubory, které měníš. `README.md` jen když předávka nestačí.
  Nečti zadání, reporty v `docs/`, celé soubory ani celé složky. Napřed `grep`/`Glob`, pak čti jen potřebné řádky.
- Ověř větev a `git log -3`. Na stav z předávky se spolehni, znovu neaudituj hotové věci.

Během relace:
- Práci dělej po malých uzavřených jednotkách (jednotka = změna + cílený test + commit). Po každé jednotce push.
- Výstupy příkazů zkracuj (`| tail`, `| head`, `--reporter=dot`, `-q`). Testy spouštěj cíleně (soubor, `-g`),
  celou sadu jen jednou před předáním. Žádné opakované čtení nezměněných souborů ani opakované běhy stejného příkazu.
- Subagenty jen na velké nezávislé hledání, s úzkým zadáním a stručným výstupem.
- Od 140 tis. nezačínej nový velký krok. Dokonči rozdělanou jednotku a připrav předání.

Konec relace (nejpozději při 170 tis., jinak po dokončení úkolu):
1. Commitni a pushni hotovou práci na pracovní větev.
2. **Přepiš** `docs/dalsi-session.md` (nepřidávej historii, max. ~50 řádků): cíl a rozsah, větev a HEAD, PR, hotovo
   (jen co ovlivní další krok), ověřené testy s commitem, přesný další krok, otevřené otázky.
3. Založ navazující relaci (`create_session` nebo `spawn_task`, podle dostupnosti) s promptem
   „Pokračuj podle docs/dalsi-session.md na větvi …“. Když nástroj není dostupný, dej uživateli ten prompt jako
   jeden blok ke zkopírování. Pak relaci ukonči.
