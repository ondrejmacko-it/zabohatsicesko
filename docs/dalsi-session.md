# Prompt pro další session

Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`).

---

Pokračuj na demu modulu Vzdělávání. Kód i dokumentace jsou sloučené do `main` (PR #1 a #2). Nečti
znovu celé zadání ani celý kód. Kontext máš v `README.md` a `docs/predani.md`, pravidla v `CLAUDE.md`.

Trvalá podmínka (je i v `CLAUDE.md`): výsledek musí maximálně splnit zadání, být co nejpřehlednější a
zároveň co nejsilnější. Pokud něco nevíš nebo si nejsi jistý, zeptej se. Větší změny nejdřív navrhni.

Stav Vercelu (tým `maci`, `team_PtkXmFd9hI7UeUYovGkbwZQG`, plán Hobby):

- Projekt `zbc-vzdelavani-demo` (`prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`) napojený na repo. Vercel konektor
  vrací 403 na zakládání projektů, Vercel REST API jde přes token v síťových tajemstvích prostředí.
- Vercel Authentication `deploymentType = "all"`, region funkcí `fra1`. Ignored build step přeskakuje
  produkci: po sloučení PR #2 skončil produkční deploy z `main` (`a1b6eba`) jako `CANCELED`.
- Neon `neon-zbz-vzdelavani-demo` (fra1, Free) připojený jen k Preview. `SESSION_SECRET` a
  `DEMO_ACCESS_CODE` jsou sensitive jen pro Preview. Kód zná jen uživatel, necommitovat.
- Preview se spouští pushem pracovní větve (Git integrace). REST `POST /v13/deployments` s `gitSource`
  bez `target` vytvořil produkční deploy, nepoužívat.
- Poslední ověřené preview je `READY` z větve `claude/vzdelavani-vercel-preview-52jflw` (`c84ada1`, kód
  shodný s `main`). Větev je sloučená, uživatel ji zatím záměrně nemaže.

Ověřeno 12. 11. 2026:

- Lokálně na `c84ada1` (stav `main`): lint, typová kontrola, 32 z 32 testů, build.
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

Rozpracováno, čeká na ruční merge uživatelem v tomto pořadí:

- Draft PR #3 (větev `ccr-f94571c9-6bvs9j`): trvalá podmínka v `CLAUDE.md` a předvyplnění témat při
  generování měsíce (`suggestTopics`).
- Větev `ccr-ed96f52d-3gp38c` (stojí na PR #3): testovací režim Google Kalendáře. Adaptér
  `src/server/calendar/google.ts`, OAuth a šifrované tokeny `google-auth.ts`, trasy
  `/api/google/kalendar/pripojit` a `/callback`, sekce připojení v Integracích, migrace
  `0002_integration_credentials`. Lokálně: lint, typová kontrola, 49 z 49 testů, build, průchod stránkou
  Integrace v prohlížeči s falešnou konfigurací. **Neověřeno proti Googlu ani na preview.**
  Popis a postup živého testu: `docs/google-kalendar.md`.

Zadání: uživatel dodal ZIP, do repa nepatří (repo je veřejné). Pokud v relaci není, vyžádej si ho.
Části: 01 produkt a UX, 02 Google Kalendář, 03 audio a bezpečnost, 04 ověření a předání, 05 Git,
06 bezpečnost kódu.

Další kroky, před každou částí nejdřív návrh uživateli:

1. Přihlášení Google identitou (OIDC) jako režim vedle fiktivních rolí. Podle části 02 ověřit podpis,
   issuer, audience, expiraci a ověřený e-mail, účet vázat na stabilní `sub`, role dál z databáze.
   Uživatel zatím nepotvrdil, zda jde o druhý režim, nebo náhradu přístupového kódu.
2. Nahrávky pro reálný provoz: soukromé úložiště souborů místo databáze, nahrávání dlouhých souborů
   (tréninky mají 2 až 2,5 hodiny), dělení pro poskytovatele přepisu. Skutečný testovací režim přepisu,
   jakmile uživatel vybere poskytovatele.
3. Po dodání Google účtů a OAuth klienta: nastavit proměnné na Preview a projít živý test Kalendáře.

Čeká na odpověď uživatele (ptej se průběžně, nedomýšlej):

- Testovací Google účty (organizátor a příjemce) a OAuth klient v Google Cloud: dodá později.
- Poskytovatel přepisu pro testovací režim (zpracování v EU).
- Úložiště nahrávek: soukromý Vercel Blob, nebo rovnou úložiště pod účtem firmy.
- Google přihlášení: náhrada přístupového kódu, nebo druhý režim vedle fiktivních rolí.
- Skutečné pravidlo střídání typů ve slotu a zda předvyplňovat téma i tréninkům.
- Kam trvale uložit zadání, aby ho nebylo nutné posílat (soukromé repo nebo Disk, ne tento repozitář).

Otevřené, rozhoduje uživatel:

- Token pro `api.vercel.com` v síťových tajemstvích prostředí Default a větev
  `claude/vzdelavani-vercel-preview-52jflw` zatím zůstávají. Smazat, až preview nebude potřeba.
- V kořeni `main` je jednobajtový soubor `h` (commit „Create h“), nejspíš omyl.
- Tento soubor uvádí identifikátory týmu a projektu na Vercelu a název databáze v Neonu. Nejsou to
  tajemství, u veřejného repa zvážit odstranění.
- Střídání typů ve slotu šablony (lichý a sudý týden) je odhad, pevné pravidlo ze vzoru nevyplývá.

Respektuj limit kontextu v `CLAUDE.md`. Na `main` nepushuj, merge dělá uživatel přes PR.
