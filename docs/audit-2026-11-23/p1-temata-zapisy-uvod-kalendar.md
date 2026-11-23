# Audit P1 (§8–§12): témata, zápisy, Úvod, Google Kalendář, prohlídka UI (23. 11. 2026)

Větev `oprava/audit-p1-temata-zapisy-kalendar` nad `oprava/kompletni-audit-rozhrani-a-funkci` (draft PR do ní, ne do
`main`). Jen fiktivní data, Kalendář jen v simulaci (`CALENDAR_MODE` simulace, `sim_calendar_*`), žádná migrace proti
živé DB, žádné pozvánky skutečným lidem.

Stupně: P0 blokuje, P1 vážná chyba funkce nebo pravdivosti, P2 matoucí / riziko, P3 kosmetika.
Stav: **potvrzená** (reprodukovaná testem), **pravděpodobná**, **riziko**, **návrh**.

## Nálezy

| ID | P | Část | Stav | Důkaz | Dopad | Oprava | Test |
|---|---|---|---|---|---|---|---|
| P1-Z1 | P2 | §9 Zápisy, F15 | potvrzená | `MinutesSourceForm.tsx` tvrdil „Jména a kontakty klientů se … vynechají“, `RecordingSection.tsx` „Jména a kontakty klientů jsou vynechané“. `redactClientData` je podle vlastního komentáře „pojistka, ne záruka“ (heuristika). | Vedoucí může zveřejnit zápis se jménem klienta v domnění, že ho Wiki odstranila. | Texty říkají, že pravidla nepoznají každé jméno a návrh je nutné zkontrolovat; formulář navíc říká, že návrh skládá šablona přímo ve Wiki a text se nikam neposílá (žádné sliby AI, `LocalTemplateDrafter`). | e2e `zapisy-schvaleni.spec.ts` (znění `citliva-data`) |
| P1-Z2 | P2 | §9 Zápisy, okno | potvrzená | e2e: okno zápisu (`/vzdelavani/zapisy?zapis=…`), uložit návrh, Esc → „Neuložené změny“, i když je vše uložené. `Modal` bral otisk polí jen při otevření. | Falešné varování; uživatel se naučí klikat „Zahodit změny“ a pak opravdu přijde o rozepsaný text. | `Modal` nabízí `useMarkModalSaved()`, `MinutesEditor` po úspěšném uložení obnoví výchozí otisk. Ochrana rozepsaného textu zůstává (ověřeno v testu). | e2e `zapisy-bez-nahravky.spec.ts` › okno zápisu… (bez opravy padá, s opravou prochází) |
| U-1 | P2 | §12 Plán, karty | potvrzená | Snímek 768 px: „Povinné pro tebe“ vedle „Mimořádná“ přetéká přes pravý okraj karty, mřížka ho ořízne („Povi…“). `.meta` bez `flex-wrap`, `.badge` `nowrap`. | Štítek účasti z PR #86 je na tabletu nečitelný. | `.meta` zalamuje, štítek v kartě smí zalomit text (`schedule.module.css`). Lišta harmonogramu beze změny. | e2e `karty-stitky.spec.ts` (768/1024/1280) |
| P1-T1 | P3 | §8 Témata | potvrzená | Komentáře „pořadí 1–3“ v `schema.ts`, `domain/topics.ts`, `EventDialog.tsx`, `services/topics.ts`. Limit tří v DB, validaci, akcích, řazení, doporučení i generování měsíce už neplatí (migrace 0015, test „libovolný počet garantovaných“). | Jen zavádějící dokumentace kódu. | Komentáře srovnané na 1..n. | stávající `temata-priority.test.ts`, `temata-f10-f12.test.ts`, e2e `temata-planovani.spec.ts` |
| P1-K1 | – | §11 Kalendář | ověřeno, bez chyby | Hosté pozvánky jdou přes `desiredGuestIds` → `withdrawn` (Odhlášeno) pozvánku nedostane; opětovná přihláška hosta vrátí. | – | Doplněn chybějící test: přihlásit → odhlásit → přihlásit = host právě jednou; tři souběžné `syncEvent` = jedna vazba, žádná nová pozvánka, stejní hosté. | `kalendar-f04.test.ts` › odhlášení a nová přihláška… |
| P1-U1 | P1 | §10 Úvod | potvrzená, opravuje souběžná relace | `card.handler = canHandleRecording` je u správce `true` pro každou zveřejněnou akci → `isMine` → „Co tě čeká“ správce ukazovalo celofiremní akce včetně dobrovolných jako osobní. | Správce vidí cizí dobrovolné akce jako svůj plán. | Neopravováno zde: větev `oprava/audit-ucast-nahledy` (commit „Moje bez všech akcí správce“) mění `page.tsx`, `events.ts` i filtr Moje. Zdvojení by vedlo ke konfliktu. | v té větvi `tests/audit-ucast-nahledy.test.ts` |

## Ověřeno bez nálezu

* §8: oddělení Garantovaná (pořadí správce, `guaranteedTopics`) / Ostatní (ruční pořadí, pak zájem). Nejžádanější je
  štítek prvních tří podle zájmu napříč seznamem (`MOST_WANTED_COUNT = 3`, jen s ≥ 1 zájemcem), ne pevný limit
  garantovaných. Přesun mezi sekcemi, pořadí, archivace (zruší prioritu, sesype pořadí), filtr Pro mou roli / Všechna
  a role (jen správce) pokryté testy. `EventDialog` ukazuje 3 rychlé návrhy témat, celá nabídka je v seznamu.
* §9: schválit smí jen vedoucí zveřejněné akce (`canApproveMinutes`), kontrolor a správce jen upravují; bez vedoucího
  `no_lead`; prázdné Shrnutí neschválí (`minutesSchema`, `minutes_incomplete`); schvaluje se konkrétní verze
  (`expectedVersion`, zámek akce, `conflict`); úprava schváleného zápisu založí nový návrh a publikum dál čte schválenou
  verzi; nahrávka se nabízí jen s `RECORDING_DEMO` a je označená „(ukázka)“.
* §10: úkoly k zápisu jen vedoucímu (bez vedoucího správci), kontrolor jen kontrolu hotového návrhu (`minutesTaskRole`),
  strop 4 úkoly k zápisu, úkoly správce (Kalendář, garantovaná témata, žádosti) jen s oprávněním.
* §11: simulace je v panelu označená „simulace“; v testu Google UI výslovně říká, že doručení Google nehlásí; věty
  `calendar-note.ts` netvrdí doručení, jen stav pozvánky, který Wiki zná. Výpadek: test „když Kalendář selže, omluva ve
  Wiki platí dál a panel řekne pravdu“.
* §12: snímky 320 / 768 / 1920 px (Úvod správce i FP, Témata správce i FP, Zápisy, Integrace, Správa, Plán): bez
  vodorovného posuvu; jediný přesah obsahu = U-1.

## Otázky pro vlastníka → rozhodnuto (23. 11. 2026, předáno hlavní relací)

1. **Nejžádanější** zůstává samostatný štítek podle zájmu kolegů (nejvýš tři témata s nenulovým zájmem), nezávislý
   na garanci; garantované téma ho mít smí, žádná nová sekce. Hotovo: věta pod seznamem Témat
   (`nejzadanejsi-vysvetleni`), `title` štítku, nadpis garantovaných „Vybírá je správce“. Testy:
   `temata-doporuceni.test.ts` (garantované bez zájmu štítek nemá, se zájmem ano), e2e `temata-planovani.spec.ts`.
2. **Úkol nahrávky v ukázce** mluví pravdu: „Nahraj ukázkovou nahrávku z dnešní akce … Ukázka přepíše jen ukázkovou
   nahrávku z Wiki, jiný soubor nezpracuje.“ (`todayRecordingTask`). Dostane ho jen ten, kdo zápis píše
   (`minutesTaskRole` = write), kontrolor ne. Test: `tests/audit-p1-rozhodnuti.test.ts`.
3. **Ruční zápis na detailu akce** se při odchodu s neuloženými změnami ohlásí: `beforeunload` (zavření, obnovení
   karty) a klik na odkaz ve Wiki (potvrzení prohlížeče). Po uložení se nehlásí (uložený text = nový výchozí stav).
   Test: e2e `zapisy-bez-nahravky.spec.ts` › detail akce… Zbývající riziko: tlačítko Zpět v prohlížeči
   (Next klientská navigace) se nehlídá.

## Předchozí chyba testu (není z této větve)

* e2e `temata-planovani.spec.ts` › „Témata očima účastníka › F10–F12 …“ padá na řádku s „Pro mou roli“
  (očekává 0 odkazů, protože „bez režimu všech zveřejněných“). Ukázka po PR #86 běží v režimu všech zveřejněných,
  filtr se proto ukazuje. Logiky filtru se tato větev netýká. Očekávání jsem neměnil (pravidlo neoslabovat testy),
  musí ho srovnat ten, kdo vlastní změnu viditelnosti.

## Ověření

Viz souhrn v draftu PR (lint, `tsc --noEmit`, vitest, Playwright: stránky, přístupnost, okna, klávesnice, Úvod,
témata, zápisy na 1280 / 1920 / 320 / 390 px a nový test štítků).

Pozn. k běhu e2e: porty serverů (`e2e/constants.mjs`) jsou pevné a sdílené všemi worktree; souběžné relace se tak
navzájem blokují. Pro tento běh byly porty dočasně přesměrované lokálně (necommitnuto).
