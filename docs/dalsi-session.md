# Navazující relace (stav 26. 11. 2026, relace 9 zadání „Finální dokončení po PR #92“)

Větev `claude/festive-sagan-lilorz` z main 2703a0b (PR #92 v main). Limit relace 170 tis. (start v cloudu zabere
~120 tis., na práci zbývá málo: čti cíleně, výstupy zkracuj). Nic nemergovat/nenasazovat, žádné vzdálené migrace,
změny produkčního Vercelu/Neonu ani Google pozvánky bez schválení vlastníka. Před testy `npm ci` (node_modules chybí).

## Zadání
Plné znění: první zpráva uživatele s nadpisem „ZBČ – FINÁLNÍ DOKONČENÍ PROJEKTU PO PR #92“ v relaci
session_01HpUiryLcisq3sp1bDNE1U2. `list_events` kinds=["user"], limit 100, `before_id=ce15ad91-6fd8-49f9-b71c-5b737056552a`
(výsledek jde do souboru; text vytáhni pythonem a grepni nadpis fáze, např. „Fáze D“). Čti jen svou fázi.
Fáze: A audit stavu · B účast + garantovaná témata na izolovaném Preview · C01–C06 (hotovo) · D náhled 1:1 ·
E hromadný výběr (bod 9) · F Zápisy (bod 11) · G celkové UI (bod 13) · H Témata a barvy účasti · I Google Kalendář F04 ·
J matice F01–F18, D01–D07 · K UX/regresní audit + smoke E2E v CI · L release checklist · výstup: report + draft PR.

## Hotovo (fáze C)
- C01 a029755, C02 e1f654d, C03 910e0dc, C04 8e78cea+f3b85cf (`managedExcusesAt` jen platné omluvy), C05 jen zjištění,
  C06 e4b6a8f (texty zápisů). tsc OK; celá sada, celý eslint a e2e zatím ne.

## Fáze A (hotovo, relace 5, jen čtení)
- Produkce Vercel READY = main 2703a0b. Neon produkce: migrace 0001–0014 (chybí 0015–0018), účty 12 (origin invite:
  2 admin, 3 organizer, 7 member). Neon branch br-wandering-paper-b9ef86og (projekt still-shadow-86247101): 0001–0018,
  5 demo účtů (1 admin, 1 organizer, 3 member). Otevřená PR: žádná. Preview DATABASE_URL: sdílená, cíl neověřen.

## Fáze B (rozpracováno)
- Vercel env `PARTICIPATION=on` jen preview + gitBranch `claude/festive-sagan-lilorz` (id 0jS10jzE1PjjGqaB).
- Relace 6 (0db222c): lokálně `e2e/ucast.spec.ts` windows-1280 9/9 OK (+ zapis-temat). `callAction` v
  `src/components/ActionForm.tsx`: síťová chyba akce = zpráva u tlačítka místo chybové stránky (ActionForm,
  omluva v ParticipationPanel), test `tests/sit-akce.test.ts`. E2E garantovaných témat stabilizován (počet Ostatních
  se ověřuje po každém návrhu). Doménu (zrušená/proběhlá akce, změna publika, souběh) kryjí unit testy
  `ucast-prihlasky`, `dopad-zmeny-ucast`. V e2e chybí: opětovné přihlášení po odhlášení (jen tlačítko), reload,
  Úvod, proběhlá/zrušená akce v UI, výpadek sítě v prohlížeči (`page.route` abort) – doplnit, pokud zbude kapacita.
- Čeká na vlastníka: Preview env `DATABASE_URL` (sensitive, preview, gitBranch claude/festive-sagan-lilorz) =
  connection string branche br-wandering-paper-b9ef86og; pak redeploy větve. Bez toho nejde živé Preview ověření.

## Fáze D (relace 7)
- Zadání D: náhled 1:1 (rozložení, data, navigace, tlačítka, štítky, filtry, formuláře, úkoly, stavy účasti, oprávněné
  admin možnosti); jediný rozdíl = akční tlačítka na stejném místě zamčená; informační dialogy povolené; bez soukromých
  důvodů omluv, Google dat, tajemství, cizích přístupů, citlivých přepisů (zástupný stav). Náhled skupiny modelový.
  Testy: FP, RM, FP+RM, vedoucí akce, kontrolor, nadřízený, správce vedle sebe; mutace odmítne server.
- Hotovo (commit po 3bdc576): `tests/nahled-mutace.test.ts` volá všechny exporty `features/vzdelavani/actions.ts`
  a `features/sprava/actions.ts` s cookie náhledu → `preview_read_only` (2/2; bez kontroly v `runAction` padá).
  Mimo `runAction`: `submitFeedback` (zpětná vazba správce pod vlastní identitou, záměrně), `app/vstup/actions.ts`
  (vstup/persona/odhlášení, cookie náhledu je vázaná na id účtu), API routy jen přihlášení/pozvánka/cron. Žádná
  datová mutace nejde obejít. Pozn.: informační akce `previewImpactAction`, `previewCancelAction`, `previewMoveAction`,
  `topicPlanOptionsAction` náhled taky blokuje (tlačítka k nim budou zamčená, takže nevadí).
- Návrh UI SCHVÁLEN vlastníkem celý (D1, 26. 11.), provést po jednotkách:
  1. Klientský kontext `PreviewLock` (provider v `app/(wiki)/layout.tsx` při aktivním náhledu); `ActionForm`,
     `InterestButton` a další submit tlačítka ho čtou → `disabled` + `aria-disabled` + title „V náhledu jen ke čtení“.
  2. Stránky místo skrývání (`organizer && !preview`) renderují podle `isOrganizer(viewer)`: detail akce (editační
     formulář, `akce/[id]/page.tsx:49,62`), Plán `managing` (`harmonogram/page.tsx:58`), Zápisy `canAdd`
     (`zapisy/page.tsx:44`), `TopicsSection` readOnly → nástroje viditelné, zamčené. Citlivé části (nahrávka/přepis
     handlera, důvody omluv, osobní Kalendář) zůstávají zástupným stavem.
  3. `previewApplies` (`PreviewSwitch.tsx`) rozšířit na Moje role a Správu (podle oprávnění zobrazeného), Integrace
     = zástupný stav bez Google dat.
  4. E2E: pro 7 rolí porovnat sadu nadpisů/tlačítek reálného účtu a náhledu (stejná data, 1280).

## Fáze D – průběh (relace 8–9)
- 4a754a1 D1 hotovo: `src/components/PreviewLock.tsx` (`PreviewLockProvider`, `usePreviewLock`, `lockedProps`,
  nově `LockedLink` = odkaz-akce jako zamčené tlačítko). Test `tests/nahled-zamek.test.ts` 4/4.
- b93bd2f D2 detail akce: „Upravit akci“ zamčené. 9ddf21b D2 Plán: `managing = organizer && (!preview || planView)`,
  `ChangeBanner` „Zveřejnit změny…“ přes `LockedLink`, `cardActions` v náhledu správce stejné položky
  (`status.ts`, nahrávka dál ne), `CardMenu` akční položky zamčené (čtecí jen details/minutes),
  `loadPreviewCalendarStatus` (simulace, bez Googlu), v náhledu bez `MoveDropZone` a bez `syncPublished`.
  Testy: nahled-zamek 4/4, rychle-akce OK, tsc + eslint změněných OK.
- Zbývá D2: Zápisy `canAdd` (`zapisy/page.tsx:44`), `TopicsSection` readOnly → zamčené nástroje; spouštěcí
  type="button" tlačítka (EventMenu trigger, TopicManage, „Vybrat návrhy“ SelectToggle) přes `lockedProps`.
  Ověřit v Plánu náhledu: CancelDialog volá `previewCancelAction` (v náhledu blokované) – nedostupné, trigger zamčen.
- Předem existující pád: `tests/audit-ucast-nahledy.test.ts` „náhled skupiny (production)…“ (`futurePublishedId`
  nenajde budoucí akci v seedu k dnešnímu datu). Opravit (datum v testu / seed).

## Další krok
1. Dokončit D2 (Zápisy, Témata, spouštěcí tlačítka), každá jednotka s testem a pushem; pak D3 (`previewApplies`
   Moje role, Správa, Integrace zástupný stav) a D4 (e2e 7 rolí, 1280).
2. Opravit pád audit-ucast-nahledy (datum).
3. Až vlastník nastaví DATABASE_URL: Playwright proti Preview URL větve (scénáře účasti z fáze B).

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sám sebe jako nadřízeného kohokoli a pak číst jeho důvody omluv (audit
  `excuse_managers.changed` zapíše, kdo koho změnil). Varianty: (a) zakázat nastavení sebe (musí jiný správce),
  (b) povolit, ale zvlášť auditovat a ukázat ve Správě. Doporučení: (a), pokud firma má víc správců.
- C04: deaktivace nadřízeného vazby nemaže (po reaktivaci platí znovu). Má se mazat?
- C05 `vedouci-tymu`: (a) zachovat při uložení účtu, (b) přidělitelná kvalifikace ve Správě, (c) odstranit. Doporučení (a).
- Zvýšení hooku limitu na 200 tis. musí udělat vlastník (`scripts/limit-kontextu.py`, `CLAUDE.md`).
- Preview s DB izolovaného branche (tajemství), schválení migrací 0015–0018 na `zbc-wiki-produkce`.
- Význam role `vedouci-tymu`, skutečné vztahy nadřízených, doba uchování omluv (firma).
