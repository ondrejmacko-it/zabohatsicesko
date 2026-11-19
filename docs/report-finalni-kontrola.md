# Finální kontrola a nový PR – průběžný report (relace 1)

Zadání: „ZBČ – Finální kontrola, dokončení oprav a příprava nového PR“ (od uživatele 19. 11. 2026, do repa se nedává).
Větev `claude/focused-cerf-gr1tdi`. Nic nemergnuto, nic nenasazeno, produkční data jen čtena (SELECT).

## 1. Inventura stavu (ověřeno 19. 11. 2026)

* `origin/main` = `e27b631` (merge PR #73). Strom `e27b631` je shodný s `ff7ac54` (`git diff` prázdný).
* Opravná větev `7de75e0`, merge-base s main `ff7ac54`, 37 commitů navíc (74 souborů, +2475/−575). Konflikty s main
  nejsou (main nemá nic navíc). Pracovní strom čistý. Otevřený PR z větve neexistuje (open PR: 0).
* Vercel projekt `zbc-vzdelavani-demo` (tým `maci`): produkce = `dpl_2srWXKNxJ1muz4z3jSKUQtePQgBJ`, `main` `e27b631`,
  READY, 2026-11-19 07:46 UTC. Preview nasazuje i opravnou větev (poslední `7de75e0`, READY). Vercel MCP projekt
  nevidí (jiný rozsah), čteno přes read-only REST API.

## 7. Migrace a databáze (jen čtení)

| Neon projekt | Role | 0013 / 0014 | Zápisy (`minutes`) |
|---|---|---|---|
| `bitter-breeze-02749976` `zbc-wiki-produkce` | produkce | **proběhly** 2026-11-19 07:47:25 UTC (start po deploy `e27b631`) | **0 řádků** → riziko skrytí schválených zápisů (`approved_version`) v produkci nevzniklo |
| `still-shadow-86247101` `neon-zbz-vzdelavani-demo` | Preview / ukázka | proběhly 2026-11-18 21:05 UTC | 1 návrh (`draft`, bez schválení) |

* Produkce: 15 témat, **3 garantovaná** (nearchivovaná s `priority_rank`), 112 akcí, „NJBJK“ 0×.
* Chyby startu migrací v runtime logu: zatím neověřeno (další relace: `get_runtime_logs` nebo REST, deploy `dpl_2srW…`).
* Neon produkce jednou vrátil 401 a při opakování odpověděl – přechodné, ne oprávnění.

## 10. „NJBJK“ (jen čtení)

* Jen v demo DB `still-shadow-86247101`: `topic-7e7bab00-…`, `org_id` `zbc-demo`, publikum `fp`, navrhl `demo-ucastnik`
  12. 11. 2026 17:50 UTC, nearchivované, bez priority, **2 zájemci**, **1 zveřejněná akce** `ev-abe4fb33-…` (11. 12. 2026
  07:30 UTC). Ukázkový záznam zadaný ručně přes UI. Smazání by se dotklo zájmu a zveřejněné akce (a případně pozvánek
  v simulaci) – návrh vyčištění v další relaci, nic se nemaže bez souhlasu.
