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

## Stav (relace 39, bod 1 hotový v kódu)
- PR #94 draft; nová relace se přihlásí: subscribe_pr_activity #94. Na začátku `npm ci`.
- Bod 1 commitnut: `EventForm` má prop `afterFields` (mimo <form>, tlačítka Uložit/Zveřejnit s `form={formId}`,
  `publishButton` přes `actionsRef`); `EventPeek` předává participationPanel+managedPanel jako `afterFields`.
  Ověřeno: tsc, eslint, vitest 623/623. E2E pořadí/rozpracovaná editace zatím NEověřeno (bod 8).
- Bod 4 rozpracováno jen návrhem (necommitnuto): v `calendar-note.ts` věty „Kalendář: synchronizováno.“ /
  „Kalendář: synchronizace čeká.“ / „Kalendář: synchronizace selhala, Wiki ji zkusí znovu.“ / „Kalendář: Wiki tě
  na akci nezve.“ / „Kalendář: zatím tě Wiki nezve. Po přihlášení se synchronizuje.“ / „Kalendář: stav neznámý,
  Wiki tvoji pozvánku nespravuje.“; null (osobní režim) → „Kalendář: stav neznámý.“ místo null.
  Upravit i `tests/kalendar-f04.test.ts` (ř. 95–287) a `e2e/ucast.spec.ts` (ř. 100–119). Confirm texty enroll/
  withdraw/revoke v `ParticipationPanel.tsx` bez slibu pozvánky („Změna se uloží ve Wiki…“). Server zprávy:
  `PARTICIPATION_MESSAGES` v `src/features/vzdelavani/actions.ts` (~ř. 760) zkontrolovat.
- Pozor: úvodní kontext relace (definice nástrojů) zabere ~120 tis. → v relaci jen 1–2 malé jednotky, číst minimum.

## Zjištěno pro bod 1–4 (nemusíš znovu číst)
- (HOTOVO bod 1) `EventPeek.tsx`: správce → `EventWindow` (EventDialog.tsx:142) s `intro` = statusBand, preset, ChangeBanner,
  participationPanel, managedPanel; pak `EventForm` (ř. ~179). Ne-správce → RouteModal: statusBand, `dl.fact-list`,
  participationPanel, managedPanel, odkazy (pořadí tam už sedí).
- Návrh opravy: `EventForm` dostane prop `afterFields`; `<form id={formId}>` (ř. ~512) uzavřít před
  `div.dialog-actions.event-actions` (ř. ~624), mezi ně vložit `afterFields` (participation + managed), tlačítka
  Uložit/Zveřejnit dostanou `form={formId}` (submitter i Enter fungují). `publishButton()` (ř. 245) hledá přes
  `formRef.current.querySelector('.event-actions …')` → přepnout na ref akčního divu. EventWindow předá panel místo intro.
  Rozpracovanou editaci drží useState (key=revision); ověřit e2e: upravit pole, změnit účast, hodnota zůstane.
- `ParticipationPanel.tsx` (190 ř.): `section.section.participation-panel`, h2 „Tvoje účast“, StatusBadge, STATE_TEXT,
  `calendarNote()` z `src/lib/calendar-note.ts` (texty „Pozvánku máš v Kalendáři.“, „…čeká na odeslání.“ → bod 4
  přepsat na uloženo ve Wiki / synchronizace čeká / synchronizováno / selhalo / neznámý). Potvrzení enroll/withdraw/
  revoke slibují pozvánku („pozvánku dostaneš do Kalendáře“, „odebere z pozvánky“, „vrátí do pozvánky“) → opravit.
  Dialog omluvy: ř. ~165–185, hint „Důvod i poznámku vidíš jen ty…“ → přesný text z bodu 3.
- CSS: tokeny `--ucast-*`(-bg/-fg) v globals.css ~646–698 přes `[data-ucast=…]`; panel má `data-ucast-panel={state}`
  → podbarvení karty: `.participation-panel[data-ucast-panel=…]` s `--ucast-bg`/border-left `--ucast`
  (pozor: selektor `[data-ucast=…]` tokeny nastavuje jen pro atribut data-ucast, přidat i data-ucast-panel).
  Styl panelu globals.css ~5216. Layout desktop: hlavička flex (h2 + štítek), akce vpravo; mobil wrap.
- e2e: `e2e/ucast.spec.ts` (port UCAST 3313, projekty windows-1280/telefon-390, `openCard` dělá goto, ne klik).
  Pro bod 8 nový spec (např. `e2e/ucast-karta.spec.ts`): klik na kartu v harmonogramu, assert pořadí
  (`.event-form` / `.fact-list` před `[data-ucast-panel]` přes compareDocumentPosition), screenshoty na 7 šířkách
  (viewport v testu; projekty 768/1024 jen s E2E_WEBKIT, proto šířky nastavit `page.setViewportSize`).

## Otevřené (firma)
- C04: mazat vazby i při deaktivaci podřízeného? Mapování nadřízených a retence omluv.
