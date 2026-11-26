# Navazující relace (stav 26. 11. 2026, relace 1 zadání „Finální dokončení po PR #92“)

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
- a029755 C01: `requeueAttendeeSync` (`src/server/calendar/attendees.ts`) četl `event_participation` i bez 0016,
  na DB 0001–0014 (produkce) padalo uložení účtu. Oprava + `tests/c01-ucast-bez-schematu.test.ts`
  (+ kalendar-ucast, kalendar-uklid: 15/15). tsc a eslint OK.
- Zbylé přístupy k tabulkám 0016/0018 (`participation.ts`, `excuse-managers.ts`, `detail.ts`, `eventAttendees`) jsou
  podmíněné `participationEnabled()`/`excuseManagersEnabled()`. Neověřeno: 0015 (`topic_priority`), schéma
  `prepareDatabase` při cold startu/souběhu (C02).

## Další krok (pořadí, každá jednotka = změna + test + commit + push)
1. Push a029755 (`git push -u origin claude/festive-sagan-lilorz`), pokud ještě není venku.
2. C02 (`src/server/config.ts` markParticipationSchema/migrationApplied, `src/server/db/client.ts` getDb):
   co volá `participationEnabled()` před `getDb()`; zkontrolovat přístupy na 0015.
3. C03 (`ManagedExcuses.tsx`, `ParticipationPanel.tsx`, `src/components/feedback/screenshot.ts`, `data-feedback-redact`).
4. C05 `vedouci-tymu` ve `WORK_ROLES` vs `GROUPS` (`src/lib/types.ts`): zjistit, pak varianty vlastníkovi.
5. Fáze A audit přes Vercel/Neon MCP jen čtením, pak B (Preview proti branchi `overeni-ucast-0016-0018`,
   br-wandering-paper-b9ef86og v still-shadow-86247101; DATABASE_URL je tajemství = schválení vlastníka).

## Otevřené otázky pro vlastníka
- Limit 170 tis. při startu ~120 tis. dává ~50 tis. na práci. Zvýšení hooku na 200 tis. (podle zadání) musí
  udělat vlastník: v `scripts/limit-kontextu.py` SOFT_LIMIT 170_000, HARD_LIMIT 200_000 a text v `CLAUDE.md`.
- Preview s DB izolovaného branche (tajemství) a schválení migrací 0015–0018 na `zbc-wiki-produkce`.
- Význam role `vedouci-tymu`, skutečné mapování nadřízených, doba uchování omluv (firma).
