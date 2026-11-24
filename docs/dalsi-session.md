# Navazující relace (stav 24. 11. 2026, UX rework)

Limit relace: **200 tis. tokenů tvrdě** (pokyn vlastníka). Při přiblížení commit, push, předávka, nová relace.

## Stav
- Větev `claude/oprava-ux-vyber-ucast-nahled` (z `main` po merge PR #87). Zadání: prompt „ZBČ – cílený UX/UI rework“
  (P0 výběr návrhů, účast, náhled 1:1; P1 záhlaví, Topbar, témata, výzvy, formuláře, mobil). Nic nemergovat/nenasazovat.
- **Hotovo P0-1 (výběr návrhů, commit 791840a):** jedna karta návrhu změny, `data-pick-reason`, lišta „Vybráno N z M“,
  e2e `vyber-navrhu.spec.ts`.
- **Hotovo P0-3 (náhled 1:1, commit 0be4d99):** `withOwnParticipation`/`ownParticipationDetail` v náhledu počítají
  `actions` jako pro kolegu (`readOnly: !enrollment`); `ParticipationPanel preview: "person"|"group"` vykreslí stejná
  tlačítka `disabled` + „Náhled je jen ke čtení…“ (`data-testid=ucast-zamcena`), skupina má poznámku „bez individuálních
  přihlášek a omluv“. Témata: `InterestButton`/`ProposeTopicDialog` `locked` (disabled, title `PREVIEW_READ_ONLY` z
  `lib/labels.ts`). Zápisy: `listMissingMinutes(viewer)`, K dokončení disabled. `TasksCard readOnly` = disabled tlačítka.
  **Serverová pojistka centrálně v `runAction`**: při `currentPreview(user)` vrací `preview_read_only` (nový DomainErrorCode).
  Testy, které volají akce, mockují `next/headers` cookies. Vědomý rozdíl 1:1: osobní pozvánky (Gmail/Kalendář kolegy)
  náhled nenačítá. Ověřeno: eslint 0, tsc OK, vitest 582/582, e2e nahled+ucast (1280, 390) 31+19 passed.

## Zjištěné příčiny (ověřeno)
- Demo `zbc-vzdelavani-demo.vercel.app` = Vercel **production** s `WIKI_MODE=production` → `participationEnabled()`
  vždy false (záměrná pojistka), proto chybí Přihlásit/Omluvit. Preview: `WIKI_MODE=demo`, `PARTICIPATION` nenastaveno,
  migrace 0016/0017 (a 0015 neomezená garance) mají `approval: true`, na vzdálené DB se spustí jen přes `APPROVED_MIGRATIONS`.
  Lokálně/E2E (`PARTICIPATION=on`, PGlite) účast funguje (e2e/ucast.spec.ts). Nic na Vercelu/Neonu neměněno.

## Hotovo v relaci 3 (24. 11.)
- Krok 2 záhlaví harmonogramu (2a020c6): Měsíc/Seznam = `.segmented` s ikonami `calendar`/`list`; filtr účasti
  je `lead` v `PlanFilters` (jeden řádek s Filtry/štítky). Test geometrie zahrnuje i `.plan-filters`, nový test účastníka.
- Krok 3 Topbar (ea343ff): mřížka značka | Pohled | účet (≥641 px), <1440 kratší tlačítko role, <1200 bez podtitulu,
  641–999 Pohled na 2. řádku. Optgroupy Skupina/Kolega už existovaly. Test `nahled.spec.ts` „lišta s pohledem na počítači“.
- Krok 4+6 (c8538ae): `PageCall` tokeny `--call*` (zelenošedý). Kolize v Připravit měsíc jmenuje akci a čas
  (`slotConflictWith`, `MonthDraft.clashWith`) + rada. Krok 5: pokryto vitestem `temata-priority.test.ts:226` (4 garantovaná).
- Lint 0, tsc OK, vitest 583/583, cílené E2E (rozložení, účast, náhled, příprava měsíce) prošly.

## Další krok
1. Výsledek celé sady `npx playwright test --reporter=line --trace off` (spuštěno, viz report v PR); případné pády opravit.
2. Draft PR do main s reportem A–G.

## Pozn.
- Nový kontejner: nejdřív `npm ci`. Snímky: dočasný spec v `e2e/` (necommitovat) s `authFile(role)`, `settle(page)`,
  `page.screenshot` do scratchpadu; běh `npx playwright test <spec> --project=windows-1280 --project=telefon-390
  --reporter=line --trace off` (webServer si udělá build sám, ~1 min).
- Snímky obrázků stojí hodně kontextu: číst jen nezbytné, nejlépe 1–2 na krok.
- Ve stávající sadě dříve padaly 4 testy (stranky.spec.ts:32, temata-planovani.spec.ts:455) – nezkontrolováno znovu.
