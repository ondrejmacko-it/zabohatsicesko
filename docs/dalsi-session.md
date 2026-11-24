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

## Další krok (pořadí)
2. P1 záhlaví harmonogramu (rozpracováno jen analýzou, kód nezměněn). Zjištěno ze snímků 1280: Měsíc/Seznam
   (`harmonogram/page.tsx` ~ř. 224, `.view-toggle .pill`) vypadají stejně jako filtr účasti Všechny/Povinné/… → udělat
   segmented control s ikonami (přidat ikonu `list` do `components/Icon.tsx`, `calendar` existuje), vizuálně odlišný.
   U účastníka visí „Filtry“ (`PlanFilters`, `.plan-filters-end`) sám na řádku pod filtrem účasti → spojit do jednoho
   řádku (např. prop `lead` do PlanFilters s navigací účasti, pozor na mobilní mřížku `.plan-filters` v globals.css ~4085
   a `data-items`). CSS: globals.css ř. 2900–3050.
3. Topbar (správce se láme na 2 řádky: Pohled vpravo nahoře, role pod ním) → grid, Pohled na střed, optgroupy.
4. `PageCall` vlastní tón (modro/zelenošedý) oddělený od okrových návrhů. 5. Témata: ověřit >3 garantovaná testem
   (vyžaduje 0015). 6. Formuláře/Příprava měsíce (vysvětlit kolizi). 7. Mobil 320–1920 + zoom.
8. Celá sada `npx playwright test --reporter=line --trace off`, draft PR s reportem A–G (tabulka problémů, změny,
   výsledky testů, snímky, bezpečnost/feature flagy, git, verdikt).

## Pozn.
- Nový kontejner: nejdřív `npm ci`. Snímky: dočasný spec v `e2e/` (necommitovat) s `authFile(role)`, `settle(page)`,
  `page.screenshot` do scratchpadu; běh `npx playwright test <spec> --project=windows-1280 --project=telefon-390
  --reporter=line --trace off` (webServer si udělá build sám, ~1 min).
- Snímky obrázků stojí hodně kontextu: číst jen nezbytné, nejlépe 1–2 na krok.
- Ve stávající sadě dříve padaly 4 testy (stranky.spec.ts:32, temata-planovani.spec.ts:455) – nezkontrolováno znovu.
