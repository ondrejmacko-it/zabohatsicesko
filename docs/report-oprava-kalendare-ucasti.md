# Report: opravy po živém testování, synchronizace Kalendáře a správa účasti

Větev `claude/oprava-kalendare-a-prehled-ucasti` ze `main` `fa5e67f`. Bez migrací databáze, bez nových závislostí.
Vše ověřeno na fiktivních datech a simulovaném Googlu. Živý Google, Make a produkční data se netestovaly.

## Co se změnilo

| Bod | Změna | Hlavní commity |
| --- | --- | --- |
| 1 Osobní Kalendář podle účasti | Výběr akcí přes doménové `participationState()`: povinná bez omluvy, dobrovolná jen po přihlášce. Omluva nebo odhlášení událost odebere, zrušení omluvy ji vrátí. | `44597e5` |
| 2 Synchronizace | Změna účasti i rolí zapíše požadavek na synchronizaci v téže transakci, pak se cíleně synchronizuje jen dotčený člověk. Plánovač v osobním režimu dožene čekající kalendáře (opakování po chybě bez návštěvy). První synchronizace hned po propojení účtu. | `957f67a`, `4c7fbf6` |
| 3 Připomínky | 7 dní a 1 den e-mailem, 60/30/10 minut oznámením (limit Googlu je 5). `EVENT_FORMAT = 4` přepíše existující budoucí události. | `3664e50` |
| 4 Stav synchronizace | Panel účasti ukazuje stav akce v osobním Kalendáři. Správce vidí počet problémů za akci (sloupec a filtr v Účasti). | `947da93`, `891f3e3` |
| 6 Záložka Účast | Přehled podle akcí a lidí, detail akce podle stavu, historie člověka z auditu. Důvod omluvy vidí jen určený nadřízený. Odkaz v menu jen pro správce a určené nadřízené. Telefon s popisky počtů. | `d223146`, `c26af99`, `e7a38c6`, `d5f66ff`, `2fcd34f`, `5bef7f7` |
| 7 Nadřízení | Správce smí být nadřízeným pro omluvy jiných lidí, nikdo sám sobě. | `cff1a77` |
| 8 Účet a oslovení | Menu Účet ukotvené CSS (PC nabídka pod tlačítkem, telefon samostatné okno), nezavře ho klávesnice, Esc a křížek vrací fokus, neuložené oslovení přežije změnu výšky okna. Oslovení bez ohledu na velikost písmen a Unicode normalizaci, v náhledu za kolegu jeho uložená podoba. Sekce Google Kalendář se stavem propojení a ruční synchronizací. | `5905210`, `10195c2`, `fc05f98`, `7f02d0e` |
| 9 Barvy Správy | Zelená přidává a vrací přístup, modrá odkaz a kopírování, červená odebírá (i v menu, kde dřív byla černá). | `24c01c3` |
| 10 Filtry Témat | Pro mou roli / Všechna a hledání v jedné liště. Na PC jeden řádek, na telefonu dvě řady přes celou šířku. Opravena chyba, kdy pravidlo Plánu filtr na telefonu skrylo. | `b1082c8` |

## Ověření

- ESLint a `tsc --noEmit` bez chyb.
- Vitest: 75 souborů, 665 testů prošlo (nové: `kalendar-osobni-ucast`, `ucet-kalendar`, `osloveni`, testy přehledu a detailu účasti).
- Build `next build` OK.
- Playwright nad buildem, všechny projekty (PC, telefon 390/360, setup): 1639 prošlo, 703 přeskočeno
  (testy vyřazené pro daný projekt značkami, např. `@desktop` na telefonu), 0 selhalo, 16,7 min.

## Simulace oproti živému testu

- Google Kalendář: jen simulovaný klient a fiktivní účty. Skutečné zápisy, připomínky a limity API se musí ověřit
  na preview s testovacím účtem.
- Demo server nemá `CALENDAR_DELIVERY=personal`, sekce Google Kalendář v menu Účet je proto ověřená renderem
  komponenty, ne e2e přihlášením přes OAuth.
- Proměnné nasazení (`CALENDAR_DELIVERY`, účast) nejsou ověřené proti preview ani produkci, hodnoty tajemství
  se nečetly.

## Dopad na nasazení

- Bez migrací. Po nasazení se budoucí osobní události přepíšou na nový formát (připomínky), jednorázově.
- Návrat: revert PR. Chování starší verze nad událostmi ve formátu 4 jsem neověřoval.
