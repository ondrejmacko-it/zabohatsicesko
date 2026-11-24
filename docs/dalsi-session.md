# Navazující relace (stav 24. 11. 2026, finální dokončení F01–F18 po PR #91)

Limit relace: **200 tis. tokenů tvrdě**. Zadání: prompt „ZBČ – FINÁLNÍ DOKONČENÍ F01–F18, AKTIVACE ÚČASTI A SJEDNOCENÍ UI
PO PR #91“ (body 0–19). Větev `claude/nice-lamport-vjfy87` (z main a30605c). Nic nemergovat/nenasazovat, žádné
vzdálené migrace ani změny Vercel proměnných bez schválení.

## Ověřený stav databází (jen čtení, 24. 11.)
- Demo `zbc-vzdelavani-demo.vercel.app` → Neon `zbc-wiki-produkce` (bitter-breeze-02749976): migrace 0001–0014,
  **chybí 0015, 0016, 0017** (+ nová 0018). 12 uživatelů, 143 akcí. Běží `WIKI_MODE=production`.
- Neon `neon-zbz-vzdelavani-demo` (still-shadow-86247101, fiktivní data, Preview): 0001–0015 (+ cizí 0007_invite_hold,
  0008_access_links z jiných větví), chybí 0016–0018.

## Hotovo v této relaci (commit 1 pushnutý, commit 2 viz git log)
- `participationEnabled()`: `PARTICIPATION=on` platí i v ostré Wiki, ale jen když DB má 0016+0017
  (`markParticipationSchema` v `prepareDatabase`, `participationReadiness()` = on/off/missing-schema, varování v logu).
  Integrace (správce) ukazují stav „Přihlášky a omluvy“. Test `tests/ucast-aktivace.test.ts`.
- `ParticipationBadge` + tokeny `--ucast-*` v globals.css; Plán, seznam, Úvod (NextEventsList), panel účasti, filtry
  Povinné/Dobrovolné (`.pill[data-ucast]`). `participationTone` odstraněn.
- `EventPeek`: panel Tvoje účast i v editačním okně správce (v `intro` nad formulářem).
- E2E `stranky.spec.ts` + `temata-planovani.spec.ts:455` upraveny podle rozhodnutí vlastníka (zveřejněné akce/témata
  všem), přidán negativní případ „Nezveřejněný návrh“ (`ev-11-13`) jen pro správce.
- Manažer a omluvy (rozpracováno, commit 2): migrace `0018_excuse_managers` (approval), schéma `excuseManagers`,
  `src/server/services/excuse-managers.ts` (managedEmployeeIds, list/setExcuseManagers jen správce, managedExcusesAt
  nikdy v náhledu), `canReadExcuseDetails(viewer, subject, managedIds)`, `ManagedExcuses` v detailu akce,
  `EXCUSE_REASON_LABELS` přesunuto do `lib/labels.ts`. tsc + eslint OK.

## Relace 2 (hotovo, pushnuto)
- E2E stranky/temata-planovani/ucast/nahled (1280+390): 191/191 po opravě filtru (`data-ucast-filter`).
- 0018 dokončeno: Správa (menu účtu „Nadřízený pro omluvy…“, okno s checkboxy aktivních účtů, řádek „Omluvy čte: …“,
  `setExcuseManagersAction`), `ManagedExcuses` i v `EventPeek`. Vitest `tests/omluvy-nadrizeny.test.ts` (5/5),
  e2e `ucast.spec.ts` „nadřízený pro omluvy“ (jen 1280, po sobě uklidí). Plná vitest sada 586/586 před změnami.
- Izolovaný Neon branch `overeni-ucast-0016-0018` (br-wandering-paper-b9ef86og) v `neon-zbz-vzdelavani-demo`:
  migrace 0016–0018 provedeny přes Neon MCP (stejné příkazy jako `prepareDatabase`, PG 18) a zapsány do
  `schema_migrations`. SQL kontroly (vrácené zpět): withdrawn, unikát účasti, omluva bez důvodu/poznámka mimo omluvu
  odmítnuty, vazba nadřízeného, ne sám sobě, FK; 0015 garantovaných 4/5/10/20 OK. Aplikaci proti branchi odsud
  spustit nejde: proxy cloudu nepodporuje WebSocket (driver `@neondatabase/serverless` Pool). Skript
  `scripts/overeni-ucasti-db.ts` (aplikační ověření, jen `OVERENI_CIL=izolovany-branch`, ne v ostré Wiki) spustí
  vlastník lokálně nebo jde ověřit přes Vercel Preview s DATABASE_URL branche (vyžaduje schválení změny proměnných).
  Branch nechán pro Preview test; smazat po ověření (free limit 10 branchí).

## Hotovo v relaci 3 (commit 3972475)
- Náhled 1:1 očima kolegy-správce: `planView = isOrganizer(viewer)` v `harmonogram/page.tsx` (filtr stavů,
  `monthSummary`/štítky, `nextEvent`), `Schedule.tsx` (prop `planView` pro `CardMeta`/`CardDetails`), `EventPeek`
  a `akce/[id]` (advice, `fillable`, technický odkaz). Zápisové prvky dál na `managing`. E2E `nahled.spec.ts`
  „náhled kolegy-správce 1:1“: celý soubor 60/60 prošel (všechny projekty). vitest nahled + audit-ucast-nahledy OK.
- `ucast.spec.ts` (verze z relace 2) celý prošel 1280+390 (22 passed, 1 skip) – ověřeno v relaci 3 před resetem
  na vzdálenou větev; po něm neověřeno znovu, spustit v kroku 2.

## Další kroky (pořadí)
1. UX body: animace původní verze návrhu změny (bod 8), hromadný výběr počítadla (bod 9), Zápisy k dokončení UX
   (bod 11), Topbar jméno (bod 13), dvakrát Zavřít v Navrhnout téma. Přesné znění bodů je jen v zadání – pokud
   v docs (`pozadavky-f01-f18.md`, `audit-2026-11-23/`) chybí, zeptat se uživatele, nedomýšlet.
2. Celá sada: lint, tsc, vitest, build, e2e všech projektů.
3. Release návod (bod 17: ověřit Vercel Git integraci – nasazuje merge do main produkci?; aktualizovat
   `docs/navod-merge-f01-f18.md`), report F01–F18 (18 řádků, bod 19), draft PR do main, screenshoty.

## Otevřené otázky pro vlastníka
- Schválení migrací 0015–0018 na `zbc-wiki-produkce` a `PARTICIPATION=on` na produkci (až po Preview testu).
- Skutečné mapování nadřízených a doba uchování omluv (firma).
