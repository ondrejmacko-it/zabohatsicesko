# Navazující relace (stav 26. 11. 2026, relace 23 zadání „Finální dokončení po PR #92“)

Větev `claude/festive-sagan-lilorz` z main 2703a0b (PR #92 v main). Limit relace 170 tis. (start v cloudu zabere
~120 tis., na práci zbývá málo: čti cíleně, výstupy zkracuj). Nic nemergovat/nenasazovat, žádné vzdálené migrace,
změny produkčního Vercelu/Neonu ani Google pozvánky bez schválení vlastníka. Před testy `npm ci` (node_modules chybí).

## Zadání
Plné znění: první zpráva uživatele „ZBČ – FINÁLNÍ DOKONČENÍ PROJEKTU PO PR #92“ v relaci
session_01HpUiryLcisq3sp1bDNE1U2: `list_events` kinds=["user"], limit 100,
`before_id=ce15ad91-6fd8-49f9-b71c-5b737056552a` (výsledek jde do souboru; JSON za úvodní hlavičkou, najdi řetězec
obsahující „PO PR #92“ a „Fáze“, ulož do scratchpadu a čti jen řádky své fáze: E ř. 302–349, F 350–407,
G 408–484, H 485–535, I 536–556, J 557–583, K 584–637, L 638–656, výstup 657+).
Fáze: A audit · B účast na izolovaném Preview · C hotovo · D náhled 1:1 hotovo · E hromadný výběr (bod 9) ·
F Zápisy (bod 11) · G celkové UI (bod 13) · H Témata a barvy · I Google Kalendář F04 · J matice F01–F18, D01–D07 ·
K UX/regresní audit + smoke E2E v CI · L release checklist · výstup: report + draft PR.

## Hotovo
- A, B (Preview čeká na vlastníka: Preview `DATABASE_URL` = Neon branch br-wandering-paper-b9ef86og, pak redeploy),
  C01–C06, D1–D4, E1–E4, F1–F4 hotovo (viz git log).
- F1+F2 (82be4a1) okno K dokončení (Moje úkoly / Ostatní), F3 (d39fd02) upozornění na citlivá data nad polem.
  Zbytek F3 posouzen: struktura už odpovídá (hlavička stav + `ApproverNote`, upozornění nad polem, akce dole) – beze změny.
- F4 (b15660a + oprava typu): testy schvalování OK (`zapisy-f13-f15`, `zapisy-schvaleni`). `listTasks` nad limit
  `MAX_MINUTES_TASKS`=4 přidá souhrnný úkol `zapisy-dalsi` („Další zápisy k dokončení: N“, href
  `/vzdelavani/zapisy?pridat=1`, `count: N`); odznaky Čeká na tebe počítají `taskCount()` (journey.ts).
  Test `tests/k-dokonceni.test.ts` (5 OK). tsc OK.

- G1 (a93f0fb): lišta – na ≥1280 px Pohled geometricky uprostřed (mřížka 1fr auto 1fr), účet oddělený čarou
  a `role=group` „Přihlášený účet“, celý název pohledu v `title`. Snímky 1100/1280/1440 + náhled OK; e2e zahlavi,
  nahled, mobilni-ovladani 38 OK. Harmonogram prověřen snímky: účastník bez prázdného místa, Měsíc/Seznam odlišené.
- G2 (008c3e2): D03 vlastní oslovení – migrace 0019 `user_salutations` (approval), `salutationsEnabled()`,
  služba `services/salutation.ts`, akce `osloveni-actions.ts`, `SalutationForm` pod pozdravem na Domů.
  Testy: `tests/d03-osloveni.test.ts`, `e2e/osloveni.spec.ts` OK, tsc+eslint OK.

- G3 (viz git log): Domů – `.home-columns` align-items:start, štítek účasti `.brief-main > .badge`
  justify-self:start, `invitationTask` vrací `count` (test `tests/ukoly-uvod.test.ts`). Snímky 1280/390 OK.
- G4 (76a1bab): dialogy – `.dialog-head` lepivá (desktop i mobil), krátká okna (TopicActions, EventMenu,
  AccessForms) mají patičku `dialog-actions`; Nadřízený „Zrušit úpravy“, Navrhnout téma „Odesílám…“.
  Konvence: primární první; sekundární „Zrušit úpravy“ (formulář) / „Zpět“ (destruktivní) / „Zavřít“ (info).
  e2e okna 76 OK, tsc+eslint OK.

- G5 (bd3cf7e): texty – karty Plánu „Vede:“ místo „Kdo:“ (`status.ts`, `Schedule.tsx`, testy kdo-tema),
  TopicActions „Pro koho“ místo „Pro skupinu“. Průchod tykáním: žádné vykání v UI. G hotovo.
- H1 (d7fe624): Témata – hledání podle názvu v `TopicBoard` (`normalizeName`, bez diakritiky, při hledání
  řazení vypnuté), aktivní zájem `.interest-on` plný zelený. e2e `temata-hledani` + `temata-planovani` OK.

- H2 (relace 22): barvy účasti ověřeny čtením – tokeny `--ucast-*` (globals.css ~645–715) pokrývají všech 6 stavů,
  štítky jen přes `ParticipationBadge` (Schedule, ParticipationPanel, brief), filtry Povinné/Dobrovolné přes
  `data-ucast-filter` v harmonogramu; jiný paralelní systém není. PageCall: Témata, Zápisy a nově prázdný měsíc
  Harmonogramu (`PageCall` bez tlačítka, `children` volitelné). e2e priprava-mesice-f06-f09 51 OK, tsc+eslint OK.
  Správa (`InviteButton` v page-head) ponechána – není to výzva, ale akce stránky.

- H hotovo (relace 23): snímky Témata 390 px OK (dlouhé názvy se zalamují, PageCall odlišený), stoh návrhu
  vizuálně OK (vysunutí přes celou kartu, neprůhledný, bez kolize s buňkou, reduced-motion pokrývá
  `priprava-mesice.spec`; klávesnice/čtečky a dotyk přes okno akce). Bez změny kódu.
  Pozor: dočasný snímkový spec, který uloží návrh na ev-11-26, rozbije teardown `vyber-navrhu` (sám prochází).
- I1 (0889e6a): rollback `PARTICIPATION` – `participationSchemaReady()` (config.ts), `eventAttendees` při
  vypnutém přepínači a existujících záznamech akce počítá hosty dál ze záznamů. Test v `kalendar-ucast`
  („rollback přepínače…“). Kalendářové testy 61 OK, tsc+eslint OK.
- I pokrytí ověřeno čtením testů: pozvánka povinné (f04), omluva ihned + odebrání bez declined (f04, ucast),
  dobrovolný po přihlášení/odhlášení (f04, ucast), zrušení omluvy obnoví (ucast), role/deaktivace (ucast),
  bez duplicit (f04 souběh, ucast), ruční hosté+RSVP (ucast, google-calendar), chyba Googlu (f04).

## Další krok
- Zbytek I (zadání ř. 536–556): řízený postup synchronizace existujících akcí po aktivaci + vyhodnocení počtu
  a typu dotčených pozvánek před aktivací (inventura jen čte – inspirace `calendar/migration.ts` inventura;
  případně doplnit do docs release postupu). Živý test jen po schválení vlastníka (do otázek).
- Pak J (557–583), K (584–637), L (638–656), výstup (657+).
- Zadání: `list_events` výsledek → Python (`raw_decode` po `{`, rekurzivně řetězec s „PO PR #92“ a „Fáze“) do
  scratchpadu, pak `sed -n` jen řádky fáze.
- Celou vitest sadu spustit jednou před předáním (naposledy celá na 8546138: 611 OK).

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst jeho důvody omluv (audit to zapíše).
  Doporučení: zakázat nastavení sebe. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0019 na produkci.
- Zvýšení limitu relace (hook `scripts/limit-kontextu.py`) jen vlastník.
