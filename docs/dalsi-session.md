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

## Další kroky (pořadí)
1. E2E (stranky, temata-planovani, ucast, nahled; 1280+390): 191/191 OK po opravě filtru (`data-ucast-filter`). Celou sadu spustit až na konci.
2. Dokončit 0018: UI ve Správě (u účtu „Nadřízený pro omluvy“, checkboxy aktivních účtů, akce `setExcuseManagersAction`
   v `features/sprava/actions.ts` přes `runAction`), ManagedExcuses i v `EventPeek`; vitest: nadřízený vidí důvod,
   jiný kolega/správce/náhled ne, bez 0018 nic; e2e scénář 4.
3. Izolovaný Neon branch z `neon-zbz-vzdelavani-demo` (fiktivní data) → lokální build s `DATABASE_URL` branche,
   `APPROVED_MIGRATIONS=0016_event_participation,0017_participation_withdrawn,0018_excuse_managers`, `PARTICIPATION=on`
   → ověřit účast a 0015 (4/5/10/20 garantovaných) na skutečném Postgresu. Connection string nevypisovat.
4. Náhled 1:1 pro správce-kolegu (`managing = organizer && !preview` v EventPeek/harmonogram/akce) – read-only správa.
5. Animace původní verze návrhu změny (bod 8), hromadný výběr počítadla (bod 9), Zápisy k dokončení UX (bod 11),
   Topbar jméno (bod 13), dvakrát Zavřít v Navrhnout téma.
6. Release návod (bod 17: ověřit, zda merge do main nasazuje produkci – Vercel Git integrace), report F01–F18 (bod 19),
   draft PR, screenshoty (lokální/Preview označit).

## Otevřené otázky pro vlastníka
- Schválení migrací 0015–0018 na `zbc-wiki-produkce` a `PARTICIPATION=on` na produkci (až po Preview testu).
- Skutečné mapování nadřízených a doba uchování omluv (firma).
