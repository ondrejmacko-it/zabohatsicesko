# Navazující relace (stav 26. 11. 2026, relace 2 zadání „Finální dokončení po PR #92“)

Větev `claude/festive-sagan-lilorz` z main 2703a0b (PR #92 v main). Limit relace 170 tis. (start v cloudu zabere
~120 tis., na práci zbývá málo: čti cíleně, výstupy zkracuj). Nic nemergovat/nenasazovat, žádné vzdálené migrace,
změny produkčního Vercelu/Neonu ani Google pozvánky bez schválení vlastníka.

## Zadání
Plné znění: první zpráva uživatele s nadpisem „ZBČ – FINÁLNÍ DOKONČENÍ PROJEKTU PO PR #92“ v relaci
session_01HpUiryLcisq3sp1bDNE1U2 (`list_events`, kinds=["user"]). Čti jen fázi, na které pracuješ.
Fáze: A audit stavu (deploymenty, migrace, proměnné jen názvy, Neon branch, testovací účty) · B účast + garantovaná
témata na izolovaném Preview · C01–C06 technické/bezpečnostní · D náhled 1:1 · E hromadný výběr (bod 9) ·
F Zápisy (bod 11) · G celkové UI (bod 13) · H Témata a barvy účasti · I Google Kalendář F04 · J matice F01–F18,
D01–D07 · K UX/regresní audit + smoke E2E v CI · L release checklist · výstup: report + draft PR.

## Hotovo
- a029755 C01: `requeueAttendeeSync` nečte `event_participation` bez 0016 (`tests/c01-ucast-bez-schematu.test.ts`).
- e1f654d C02: `prepareDatabase` (`src/server/db/client.ts`) volá `markParticipationSchema` až po commitu; dřív
  při selhání seedu zůstala účast zapnutá nad vrácenými migracemi (`tests/c02-schema-po-commitu.test.ts`).
  Ověřeno: `participationEnabled()` se všude volá až po `getDb()` (integrace page, `run` akce, služby).
  0015 bez migrace: `setTopicPriority` mapuje 23514 na `priority_pending_migration` (OK).
- 910e0dc C03: `data-feedback-redact` na důvodu omluvy (`ParticipationPanel.tsx`) a seznamu `ManagedExcuses.tsx`
  (`tests/c03-redakce-omluv.test.ts`).
- C05 zjištěno (kód beze změny): `vedouci-tymu` je ve `WORK_ROLES`, ne v `GROUPS`; Správa validuje jen `GROUPS`
  (`src/features/sprava/actions.ts:21`) a `updateAccess` (`src/server/services/users.ts:176`) přepíše `groups`,
  takže uložený `vedouci-tymu` by se při uložení účtu tiše smazal. Dnes ho nic nepřiděluje (latentní).
- Ověřeno na e1f654d/910e0dc: cílené testy c01, c02, c03, ucast-aktivace, omluvy-nadrizeny, produkce, migrace-0015
  (29/29), tsc a eslint OK. Celá sada zatím ne.

## Další krok (pořadí, každá jednotka = změna + test + commit + push)
1. C04/C06 podle zadání (fáze C, přečti jen její body), pokud nejsou pokryté C01–C03.
2. Fáze A audit přes Vercel/Neon MCP jen čtením (deploymenty, migrace v `schema_migrations`, názvy proměnných),
   pak B (Preview proti branchi `overeni-ucast-0016-0018`, br-wandering-paper-b9ef86og v still-shadow-86247101;
   DATABASE_URL je tajemství = schválení vlastníka).

## Otevřené otázky pro vlastníka
- C05 varianty: (a) nechat a jen zachovat `vedouci-tymu` při uložení účtu (sloučit s uloženými pracovními rolemi),
  (b) přidat roli do Správy jako přidělitelnou kvalifikaci, (c) roli zatím odstranit z `WORK_ROLES`. Doporučení: (a).
- Limit 170 tis. při startu ~120 tis. dává ~50 tis. na práci. Zvýšení hooku na 200 tis. (podle zadání) musí
  udělat vlastník: v `scripts/limit-kontextu.py` SOFT_LIMIT 170_000, HARD_LIMIT 200_000 a text v `CLAUDE.md`.
- Preview s DB izolovaného branche (tajemství) a schválení migrací 0015–0018 na `zbc-wiki-produkce`.
- Význam role `vedouci-tymu`, skutečné mapování nadřízených, doba uchování omluv (firma).
