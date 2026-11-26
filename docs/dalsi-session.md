# Navazující relace (stav 26. 11. 2026)

Limit relace 170 tis. tokenů (pravidla v `CLAUDE.md`, hook `scripts/limit-kontextu.py`).
Větev `claude/festive-sagan-lilorz` z main 2703a0b (PR #92 F01–F18 je v main). Nic nemergovat/nenasazovat,
žádné migrace na `zbc-wiki-produkce` ani změny produkčních Vercel proměnných bez schválení vlastníka.

## Stav účasti (přihlášky, omluvy, nadřízený)
- Kód hotový v main: `participationEnabled()` = `PARTICIPATION=on` + migrace 0016+0017; nadřízený pro omluvy
  navíc 0018 (`src/server/config.ts`, `services/participation.ts`, `services/excuse-managers.ts`, `docs/ucast-a-role.md`).
- Produkční DB `zbc-wiki-produkce` (bitter-breeze-02749976): migrace 0001–0014, chybí 0015–0018. Produkce nemá
  `PARTICIPATION` ani `APPROVED_MIGRATIONS` (ověřeno 24. 11.).
- Ukázková DB `neon-zbz-vzdelavani-demo` (still-shadow-86247101): 0001–0015, chybí 0016–0018.
  Izolovaný branch `overeni-ucast-0016-0018` (br-wandering-paper-b9ef86og) má 0016–0018, po ověření smazat.
- Release postup: `docs/navod-merge-f01-f18.md`.

## Další krok
Plán „účast naplno + Preview“ předložen vlastníkovi 26. 11., čeká na schválení (body a otázky v chatu relace).
Bez schválení nic neprovádět.

## Otevřené otázky pro vlastníka
- Varianta Preview (ukázková DB + `APPROVED_MIGRATIONS`, nebo izolovaný branch) a schválení migrací 0015–0018.
- Skutečné mapování nadřízených a doba uchování omluv (firma).
