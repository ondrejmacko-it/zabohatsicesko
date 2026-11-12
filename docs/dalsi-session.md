# Prompt pro další session

Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`).

---

Pokračuj na demu modulu Vzdělávání. Nečti znovu celé zadání ani celý kód. Kontext máš v `README.md`,
`docs/predani.md`, `docs/google-kalendar.md` a `docs/google-prihlaseni.md`, pravidla v `CLAUDE.md`.
Uživateli tykej, piš přátelsky. Větší změny nejdřív navrhni, nejasnosti se ptej.

## Stav kódu

- `main`: demo se simulovanými integracemi (PR #1 a #2).
- Větev `ccr-2d4283fa-slno9d` obsahuje v lineární historii i PR #3 (`ccr-f94571c9-6bvs9j`) a Kalendář
  (`ccr-ed96f52d-3gp38c`): předvyplnění témat, testovací režim Google Kalendáře, přihlášení Google
  identitou (`LOGIN_MODE=google-test`) a opravy z živého testu. Pro ni je draft PR do `main`. Pokud ho
  uživatel sloučil, začni novou větví z `main`.
- Lokálně ověřeno 12. 11. 2026: lint, typová kontrola, 74 z 74 testů, build.

## Živý test 12. 11. 2026 (preview větve `ccr-2d4283fa-slno9d`)

- **Google Kalendář: všech 8 kroků prošlo proti skutečnému Googlu**, výsledky v `docs/google-kalendar.md`.
  Zjištění: Google při změně termínu vynuluje RSVP (text ve Wiki upraven).
- Opravy po testu, zatím neověřené živě: obnova ukázkových dat už neodpojí Kalendář, po novém připojení
  se akce zastavené odvoláním přístupu odešlou samy, `/vstup` a štítky ukazují skutečný režim.
- **Přihlášení Googlem**: uživatel se přihlásil (`session.start.google` v auditu), celý živý test
  z `docs/google-prihlaseni.md` (5 kroků) zatím neproběhl. Je to první úkol.
- Ukázková data na preview jsou po testu změněná (Trénink RM 12. 11. má téma „Živý test: po odebrání
  přístupu“, 13. 11. je zrušený, 26. 11. má pozvánku). Před ukázkou obnovit v Integracích.

## Vercel a přístupy

- Tým `maci`, projekt `zbc-vzdelavani-demo`, plán Hobby. Preview se spouští pushem větve, produkci
  přeskakuje ignored build step. `POST /v13/deployments` nepoužívat (vytvoří produkční deploy).
- Proměnné pro Preview jsou nastavené (`CALENDAR_MODE`, `LOGIN_MODE`, `GOOGLE_*`, `TOKEN_ENCRYPTION_KEY`,
  `APP_URL`, `GOOGLE_LOGIN_ACCOUNTS`). Nesecretní zakládá Claude přes API sám, tajemství doplní uživatel.
- Preview chrání Vercel Authentication. Pro Playwright: sdílecí odkaz z dashboardu (Share, 23 h) a
  dočasně povolený host preview v síťových pravidlech prostředí (po testu odebrat). Vercel runtime logy
  přes konektor vrací 403, data jdou číst přes Neon konektor (projekt `neon-zbz-vzdelavani-demo`).
- Do Wiki se automat dostane jen přístupovým kódem. Kód zná uživatel, nikam ho nezapisuj. Doporučeno
  ho po testu 12. 11. změnit, protože byl v chatu.
- Pozor: Google přihlášení a Kalendář sdílí jednoho OAuth klienta.

## Další kroky

1. Živý test přihlášení Googlem (5 kroků, většinu kliká uživatel) a krátké ověření oprav
   (obnova dat nechá Kalendář připojený, po novém připojení se synchronizace dokončí sama).
2. Cílový průchod, jak ho popsal uživatel 12. 11. 2026. Nejdřív navrhni a odsouhlas:
   - Nový uživatel se přihlásí účtem Google a jednou udělí potřebná oprávnění.
   - Správce ZBC mu ve Wiki přidělí roli a skupiny. To nahradí seznam `GOOGLE_LOGIN_ACCOUNTS` a fiktivní
     role: správa uživatelů (pozvání nebo schválení, vazba na `sub`, změna role, odebrání).
   - Podle role vidí jen svůj obsah. Všechny akce, které se ho týkají, dostane do svého Kalendáře jako
     pozvánku s e-mailem a stejně tak každou změnu. Dnes jdou pozvánky jen testovacím příjemcům a
     publikum se do hostů nepřenáší, takže je potřeba propojit publikum akce s hosty pozvánky.
   - Přehledný přístup k zápisům a nahrávkám, na které má oprávnění.
3. Funkce a design: jednodušší a přehlednější na první pohled, hlavně pro nového uživatele (první
   přihlášení, prázdné stavy, Moje cesta jako výchozí stránka účastníka).
4. Nahrávky pro provoz: soukromé úložiště souborů, dlouhé soubory (2 až 2,5 hodiny), dělení pro
   poskytovatele přepisu, skutečný testovací režim přepisu.

## Čeká na odpověď uživatele

- Má přihlášení Googlem fiktivní role a přístupový kód úplně nahradit, nebo nechat ukázkový režim?
- Kdo smí přidělovat role (jen správce systému, nebo i organizátor) a jak se nový uživatel dostane
  dovnitř: pozvánkou od správce, nebo žádostí po prvním přihlášení?
- Pozvánky skutečným lidem: jaká doména účtů (firemní Google Workspace, nebo osobní Gmaily)? Do kterého
  kalendáře se zapisuje (jeden firemní kalendář vzdělávání, nebo přímo do kalendářů lidí)?
- Oddělit OAuth klienta pro přihlášení a pro Kalendář?
- Poskytovatel přepisu (zpracování v EU) a úložiště nahrávek (soukromý Vercel Blob, nebo firemní).
- Skutečné pravidlo střídání typů ve slotu šablony a zda předvyplňovat téma i tréninkům.
- Kam trvale uložit zadání (ZIP), aby ho nebylo nutné posílat. Do tohoto veřejného repa ne.

## Úklid, rozhoduje uživatel

- Token pro `api.vercel.com` v síťových tajemstvích prostředí Default a sloučená větev
  `claude/vzdelavani-vercel-preview-52jflw`.
- Jednobajtový soubor `h` v kořeni repa (commit „Create h“), nejspíš omyl.
- Tento soubor uvádí názvy projektů na Vercelu a v Neonu. Nejsou to tajemství, u veřejného repa zvážit.

Respektuj limit kontextu v `CLAUDE.md`. Na `main` nepushuj, merge dělá uživatel přes PR.
