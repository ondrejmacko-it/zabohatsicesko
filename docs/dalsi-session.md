# Prompt pro další session

Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`).

---

Pokračuj na demu modulu Vzdělávání. Kód i dokumentace jsou sloučené do `main` (PR #1 a #2). Nečti
znovu celé zadání ani celý kód. Kontext máš v `README.md` a `docs/predani.md`, pravidla v `CLAUDE.md`.

Stav Vercelu (tým `maci`, `team_PtkXmFd9hI7UeUYovGkbwZQG`, plán Hobby):

- Projekt `zbc-vzdelavani-demo` (`prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`) napojený na repo. Vercel konektor
  vrací 403 na zakládání projektů, Vercel REST API jde přes token v síťových tajemstvích prostředí.
- Vercel Authentication `deploymentType = "all"`, region funkcí `fra1`. Ignored build step přeskakuje
  produkci: po sloučení PR #2 skončil produkční deploy z `main` (`a1b6eba`) jako `CANCELED`.
- Neon `neon-zbz-vzdelavani-demo` (fra1, Free) připojený jen k Preview. `SESSION_SECRET` a
  `DEMO_ACCESS_CODE` jsou sensitive jen pro Preview. Kód zná jen uživatel, necommitovat.
- Preview se spouští pushem pracovní větve (Git integrace). REST `POST /v13/deployments` s `gitSource`
  bez `target` vytvořil produkční deploy, nepoužívat.
- Poslední preview je `READY` z větve `claude/vzdelavani-vercel-preview-52jflw` (`c84ada1`, kód shodný
  s `main`). Větev je sloučená, uživatel ji zatím záměrně nemaže.

Ověřeno 12. 11. 2026:

- Lokálně na `c84ada1`: lint, typová kontrola, 32 z 32 testů, build.
- Na preview (Playwright přes sdílecí odkaz Vercelu): vstup kódem, plán a zveřejnění akce
  organizátorem, synchronizace Kalendáře, nahrávka vedoucího od kontroly po zveřejnění, omezení
  účastníků FP a RM, organizátor bez role kontrolora. Žádné 5xx. Podrobnosti jsou v popisu PR #2.
- Integrace uvnitř dema (Google Kalendář, zpracování nahrávek) běží v označené simulaci, proti
  skutečným službám se netestovaly.

Ukázková data v Neonu jsou po testu obnovená (Integrace → Nástroje ukázky → „Obnovit ukázková data“,
stejná funkce `resetDatabase` jako `npm run db:reset`).

Přístup k preview: Vercel Authentication. Pro automatické testy je potřeba sdílecí odkaz z dashboardu
(Share, 23 h) a dočasně povolený host preview v síťových pravidlech prostředí. Bypass for Automation a
deploy hooky blokuje bezpečnostní filtr relace.

Úkol: [doplň konkrétní zadání, např. další úpravu dema nebo opakované ověření preview]

Otevřené, rozhoduje uživatel:

- Token pro `api.vercel.com` v síťových tajemstvích prostředí Default a větev
  `claude/vzdelavani-vercel-preview-52jflw` zatím zůstávají. Smazat, až preview nebude potřeba.
- V kořeni `main` je jednobajtový soubor `h` (commit „Create h“), nejspíš omyl.
- Tento soubor uvádí identifikátory týmu a projektu na Vercelu a název databáze v Neonu. Nejsou to
  tajemství, u veřejného repa zvážit odstranění.

Respektuj limit kontextu v `CLAUDE.md`. Na `main` nepushuj, merge dělá uživatel přes PR.
