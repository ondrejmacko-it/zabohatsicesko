# Navazující relace (stav 24. 11. 2026, UX rework)

Limit relace: **200 tis. tokenů tvrdě** (pokyn vlastníka). Při přiblížení commit, push, předávka, nová relace.

## Stav
- Větev `claude/oprava-ux-vyber-ucast-nahled` (z `main` po merge PR #87). Zadání: prompt „ZBČ – cílený UX/UI rework“
  (P0 výběr návrhů, účast, náhled 1:1; P1 záhlaví, Topbar, témata, výzvy, formuláře, mobil). Nic nemergovat/nenasazovat.
- **Hotovo a ověřeno (P0-1 výběr návrhů):** `OriginalLayer` (druhá textová karta přes návrh změny) odstraněna; karta
  návrhu změny = jedna karta + štítek „Návrh změny“ + řádek „Mění …“ + decentní list za kartou (bez textu).
  Ve výběru nevybíratelné karty `data-pick-reason` (šedé, plný kontrast, opacity 1), klik neotevře okno, lišta ukáže
  důvod (`data-testid=duvod-vyberu`). Lišta: „Vybráno N z M“, „Vybrat všechny dostupné“, Zrušit výběr / Smazat vybrané /
  Zveřejnit vybrané, na telefonu 3 sloupce, safe-area. Nový test `e2e/vyber-navrhu.spec.ts` (běží v sériovém projektu
  `zapis-temat`, playwright.config.ts testMatch rozšířen) – prošel. Cílené E2E priprava-mesice + okna (1280, 390): 90 passed.
  Lint 0, tsc OK, vitest 581/581.
- Snímky před/po (lokální, mimo repo): /tmp/claude-0/shots/{before,after}/ — zmizí s kontejnerem; skript /tmp/claude-0/pw/shots.cjs.

## Zjištěné příčiny (ověřeno)
- Demo `zbc-vzdelavani-demo.vercel.app` = Vercel **production** s `WIKI_MODE=production` → `participationEnabled()`
  vždy false (záměrná pojistka), proto chybí Přihlásit/Omluvit. Preview: `WIKI_MODE=demo`, `PARTICIPATION` nenastaveno,
  migrace 0016/0017 (a 0015 neomezená garance) mají `approval: true`, na vzdálené DB se spustí jen přes `APPROVED_MIGRATIONS`.
  Lokálně/E2E (`PARTICIPATION=on`, PGlite) účast funguje (e2e/ucast.spec.ts). Nic na Vercelu/Neonu neměněno.
- Náhled 1:1: `ownParticipationView(..., {readOnly: true})` v náhledu maže `actions` → panel nevykreslí tlačítka;
  `TopicsSection readOnly` skrývá InterestButton/Navrhnout; `zapisy/page.tsx` `canAdd = !preview`, `missing` prázdné;
  Domů `TasksCard readOnly`. Server akce běží vždy pod session správce (ne kolegy) – žádná serverová pojistka náhledu.

## Další krok (pořadí)
1. P0-3 náhled 1:1: v `services/participation.ts` (withOwnParticipation, ownParticipationDetail) počítat v náhledu
   `actions` jako pro kolegu (`readOnly: !enrollment`), do `ParticipationPanel` přidat `locked` → stejná tlačítka
   `disabled` + „Náhled je jen ke čtení“; skupinový náhled označit „bez individuálních přihlášek“. Totéž Témata
   (InterestButton/Navrhnout disabled místo skrytí), Zápisy (canAdd pro viewer, disabled), TasksCard.
   Serverová pojistka: v `changeParticipationAction`, zájmu/návrhu tématu a úkolech odmítnout při `currentPreview(user)`
   (nový DomainErrorCode `preview_read_only`). Testy: vitest pro pojistku, e2e srovnání skutečný FP/RM/vedoucí vs. náhled.
2. P1 záhlaví harmonogramu (`PlanFilters.tsx`, harmonogram page): Měsíc/Seznam jako segmented s ikonami mimo filtry,
   bez prázdného slotu u účastníka. 3. Topbar grid (Pohled na střed, `.view-switch margin-left:auto`), optgroupy.
4. `PageCall` vlastní tón (modro/zelenošedý) oddělený od okrových návrhů. 5. Témata: ověřit >3 garantovaná testem
   (vyžaduje 0015). 6. Formuláře/Příprava měsíce (vysvětlit kolizi). 7. Mobil 320–1920 + zoom.
8. Celá sada `npx playwright test --reporter=line --trace off`, draft PR s reportem (tabulka A–G ze zadání).

## Pozn.
- Dev server pro snímky: /tmp/claude-0/dev.sh (port 3400, PGLITE_DIR=.data/ux-dev, PARTICIPATION=on).
- Ve stávající sadě dříve padaly 4 testy (stranky.spec.ts:32, temata-planovani.spec.ts:455) – nezkontrolováno znovu.
