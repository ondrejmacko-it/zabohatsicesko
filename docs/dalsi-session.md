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

## Stav (relace 44)
- PR #94 draft; nová relace: subscribe_pr_activity #94, `npm ci`. Body 1–8 hotové (karta účasti, dialog omluvy,
  Kalendář, StatusBadge, náhled 1:1, e2e `ucast-karta.spec.ts`, screenshoty `docs/screenshots/ucast-karta/` + `pred/`).
- Bod 7 HOTOVÝ: `docs/matice-f01-f18.md` + opravené věty F04 v `docs/pozadavky-f01-f18.md` (d5379e7).
- Ověřeno: lint 0, tsc OK, vitest 628 OK, build OK. Celá e2e na d5379e7: 1468 OK, **2 chyby**, 291 skip, 6 nespuštěno:
  1) `[windows-1920] pristupnost.spec.ts:121` U08 Typ s Pro koho a Datum s časem vedle sebe
  2) `[telefon-390] ucast.spec.ts:93` F04 pozvánka v Kalendáři podle povinnosti, omluvy a přihlášky
- Návrh popisu PR #94 je v `docs/pr94-popis.md` (zatím NEnahrán do PR; soubor po nahrání z repa smazat).
- Preview b9721d8 READY (dpl_9da2u3g5bBVGmQCv87bRn6oMmiLK), CI na d5379e7 zelené.

## Další krok
1. Spustit jen 2 padající testy (`npx playwright test e2e/pristupnost.spec.ts:121 --project=windows-1920`,
   `e2e/ucast.spec.ts:93 --project=telefon-390`, `--trace off --reporter=line | tail -40`). Zjistit, zda jde o
   regresi z PR #94 (EventDialog/ParticipationPanel/calendar-note texty), opravit kořen + test, commit, push.
2. Doplnit výsledky do `docs/pr94-popis.md`, nahrát jako popis PR #94 (update_pull_request body), smazat soubor z repa.
3. Report vlastníkovi v chatu (česky, tykat): opravy, změněné soubory, screenshoty před/po, matice, testy vč.
   přeskočených, překážky se závažností, postup kontroly Preview (vše je v `docs/pr94-popis.md`).

## Otevřené (firma)
- C04: mazat vazby i při deaktivaci podřízeného? Mapování nadřízených a retence omluv.
