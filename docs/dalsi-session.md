# Zadání vlastníka 26. 11. (relace 37): dokončení UI účasti a finální kontrola PR #94

Větev `claude/gallant-bohr-m1lyna`, draft PR #94 (nezakládat další, nemergovat, žádná produkce/DB/Google pozvánky).

1. P0 EventPeek: `EventPeek.tsx` se v PR nezměnil; u správce je `participationPanel` v `intro` před `EventForm`.
   Pořadí: 1 nadpis, 2 stav akce + upozornění, 3 obsah a údaje, 4 samostatná karta vlastní účasti, 5 správa
   účastníků/omluv dle oprávnění, 6 další možnosti správce. Upravit `EventPeek.tsx`, příp. `EventDialog.tsx`.
   Oddělené formuláře, žádné vnořené <form>, změna účasti nesmí uložit editaci akce; ošetřit rozpracovanou editaci
   + změnu účasti. Varianty: správce, organizátor, vedoucí, účastník, náhled osoby, náhled skupiny, stránka detailu,
   okno v harmonogramu; zrušená, proběhlá, budoucí akce.
2. P0 ParticipationPanel: skutečná samostatná karta v designu Wiki: nadpis „Tvoje účast“, jeden stavový štítek,
   max. jedna hlavní věta, akční tlačítko, info o synchronizaci s Kalendářem, vlastní důvod omluvy (jen oprávněný).
   Desktop: stav vedle nadpisu, tlačítko vpravo, využít šířku; mobil zalomit. Jemné podbarvení podle stavu stávajícími
   tokeny: povinná okrová, dobrovolná modrošedá, přihlášeno zelená, omluveno vlastní klidná, zrušeno tlumená červená,
   neutrální/historické neutrál. Barva není jediný nositel významu; kontrast, a11y; žádný nový design systém.
3. P0 Dialog omluvy: jasný nadpis, volby Nemoc / Dovolená / Jiné, nepovinná poznámka, krátké soukromí, Zpět + Omluvit se,
   bez odstavců. Text „Důvod i poznámku vidíš jen ty“ nahradit přesně: „Důvod a poznámku vidíš ty a tvůj oprávněný
   nadřízený. Do Google Kalendáře se neposílají.“ Ověřit proti oprávněním: správce bez oprávnění nevidí důvod/poznámku
   v HTML, RSC, API, náhledu, diagnostice ani zpětné vazbě. Omluva platí hned, bez schvalování.
4. P0 Kalendář v potvrzeních: neslibovat doručení pozvánky. Rozlišit: uloženo ve Wiki / synchronizace čeká /
   synchronizováno / selhalo / stav neznámý (osobní režim, výpadek). Zachovat bezpečnostní pravidla.
5. P1 Konzistence StatusBadge: Domů, měsíc, seznam, detail, EventPeek, filtry, vlastní účast, náhledy, přehled omluv,
   mobil. Stejný význam = stejný název/barva/styl/místo. Oddělit životní stav akce od osobní účasti, neopakovat štítky.
6. P1 Náhled 1:1: stejné komponenty; náhled osoby = individuální stavy a zamčená (ne odstraněná) tlačítka; náhled
   skupiny jen stav z rolí; serverový zákaz mutací zůstává; soukromá data výjimkou.
7. P1 Nová matice F01–F18 podle `docs/pozadavky-f01-f18.md` + kódu (neopisovat starou): implementováno / auto test /
   vizuálně / skutečný PostgreSQL / Preview / produkce / čeká na integraci či firmu. Zvlášť: ≥5 garantovaných témat
   přes UI + reload, animace původní verze při najetí na návrh, hromadný výběr návrhů, kolize v přípravě měsíce,
   zápisy a schvalování, filtry a počítadla, oslovení, horní lišta, mobil. F04 jen simulace; F15 jen heuristika.
8. P0 Ověření: lokálně PARTICIPATION=on, izolovaná DB (e2e/server.mjs, port UCAST). Playwright: otevřít akci KLIKEM
   v harmonogramu. Screenshoty: správce povinná/dobrovolná, účastník povinná, formulář omluvy, omluveno, před
   přihlášením, přihlášeno, potvrzení odhlášení, zrušená, proběhlá, náhled kolegy, náhled skupiny, stránka detailu.
   Šířky 320/390/768/1024/1280/1440/1920. Přetékání, mezery, kontrast, sticky, scroll modalu, fokus, klávesnice,
   dotyk, ztráta rozpracovaných dat. Trvalý regresní test: karta účasti AŽ PO obsahu akce. Celá sada testů.
9. Zachovat C04/C05; nevymýšlet nadřízené ani retenci; nemazat Neon zálohu ani test branch; žádná produkce.
10. Výstup: aktualizovat PR #94 a předávku; seznam oprav, změněné soubory, screenshoty před/po, matice F01–F18,
    výsledky testů vč. přeskočených, překážky se závažností, postup kontroly Preview před merge.
Další související chybu opravit a doložit regresním testem. Cíl: funkční, bezpečné, sjednocené, ne jen zelené CI.

## Stav (relace 43, HEAD viz git log)
- PR #94 draft; nová relace: subscribe_pr_activity #94, `npm ci`. Úvodní kontext ~120 tis. → 1–2 malé jednotky/relace.
- Body 1–6 hotové; bod 8 HOTOVÝ: `e2e/ucast-karta.spec.ts` (+ karta se musí dát doscrollovat do zobrazení),
  screenshoty PO 24 PNG `docs/screenshots/ucast-karta/` (cb655cc), PŘED 24 PNG `…/pred/` z 948ea18 (15fc144;
  pořízeno kopií specu s expect.soft – před úpravou: karta nad formulářem, bez podbarvení, bez info o Kalendáři).
  Správce je ve všech skupinách → „správce dobrovolná“ v seedu nejde (uvést v reportu).
- Ověřeno na cb655cc/15fc144: lint 0 chyb, tsc OK, vitest 69 souborů / 628 testů OK, build OK,
  ucast-karta 15 passed. Celá e2e (1767 testů): E2E_VYSLEDEK.
- Matice bod 7 rozpracovaná (nic necommitnuto): mapování F01–F18 → testy v `docs/pozadavky-f01-f18.md` ř. 106–130
  platí (soubory existují); POZOR texty F04 v ř. 132–140 jsou zastaralé (bod 4 změnil `calendar-note.ts`).
  Zvlášť nalezeno: hromadný výběr `priprava-mesice.spec.ts:142`, F08 `…f06-f09.spec.ts:67/93`; souběh výběru
  `vyber-kontext.spec.ts:75`; filtry `plan-planovani.spec.ts:148`, `harmonogram-rozlozeni.spec.ts:87`,
  `mobilni-ovladani.spec.ts:312`; oslovení `osloveni.spec.ts:7`; lišta `zahlavi.spec.ts:23`, `nahled.spec.ts:221`;
  mobil `mobilni-ovladani.spec.ts`. NENALEZENO grepem názvů testů: ≥5 garantovaných témat přes UI + reload,
  animace při najetí na návrh, kolize v přípravě měsíce (hledat v tělech testů: `garant`, `priority`, `animation`,
  `kolid`, `collision` v e2e/ a tests/). Chybějící doplnit krátkým e2e/unit testem, nebo v matici uvést „netestováno“.
- Další krok: (d) dopsat matici jako `docs/matice-f01-f18.md` (sloupce: implementováno / auto test / vizuálně /
  PostgreSQL / Preview / produkce / čeká na integraci-firmu; F04 jen simulace, F15 jen heuristika) + opravit
  zastaralé texty F04; (e) bod 10: update popisu PR #94 (opravy, soubory `git diff --stat main...HEAD`, odkazy na
  screenshoty před/po, matice, testy vč. přeskočených, překážky se závažností, postup kontroly Preview před merge)
  a report vlastníkovi v chatu (česky, tykat) – jen v poslední relaci.

## Otevřené (firma)
- C04: mazat vazby i při deaktivaci podřízeného? Mapování nadřízených a retence omluv.
