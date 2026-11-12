# Prompt pro další session

Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`).

---

Pokračuj na demu modulu Vzdělávání. Nečti znovu celé zadání ani celý kód. Kontext máš v `README.md`,
`docs/predani.md`, `docs/google-kalendar.md` a `docs/google-prihlaseni.md`, pravidla v `CLAUDE.md`.
Uživateli tykej, piš přátelsky. Větší změny nejdřív navrhni, nejasnosti se ptej.

## Stav kódu

- `main` obsahuje PR #1 až #5 (simulace, testovací režim Kalendáře, přihlášení Googlem).
- Větev `claude/pensive-johnson-r6i888` (z `main`): **krok A cílového průchodu, správa uživatelů**.
  Role Správce ZBC (`admin`, persona `demo-spravce`), stránka `/sprava` (čekající žádosti, pozvat kolegu,
  úprava role a skupin, odebrání a vrácení přístupu), žádost po prvním přihlášení neznámého účtu,
  `GOOGLE_LOGIN_ACCOUNTS` jen volitelný zaváděcí seznam, migrace `0004_user_management`.
  Lokálně ověřeno: lint, typová kontrola, 84 z 84 testů, build. **UI `/sprava` zatím nikdo neviděl**
  (ani screenshot), živě neověřeno. Draft PR zatím není.

## Odsouhlaseno 12. 11. 2026

- Hotové demo „jak by to vypadalo v realitě“, fiktivní role a simulace zůstávají jako přepínače.
- Role smí přidělovat správce i organizátor (roli správce jen správce). Pozvánka i žádost.
- Zatím osobní Gmaily, jeden firemní kalendář vzdělávání, jeden OAuth klient.
- E-maily: žádný vlastní poskytovatel. Pozvánky a změny rozesílá Google. Zveřejněný zápis doplní odkaz
  do pozvánky s rozesláním změny, ve Wiki je to v Moje cesta.

## Živý test (zatím neproběhl)

- Preview staré větve `ccr-2d4283fa-slno9d` má stejný kód jako `main`, na ni míří `APP_URL` i redirect
  URI v Googlu. Kroky v `docs/google-prihlaseni.md` (pro novou větev už upravené) a ověření
  automatické synchronizace po znovupřipojení Kalendáře (zrušit přístup v Google účtu, zveřejnit změnu,
  znovu připojit) čekají na uživatele.
- Pro preview nové větve: uživatel přidá v Google konzoli redirect URI
  `https://zbc-vzdelavani-demo-git-claude-pensive-johnson-r6i888-maci.vercel.app/api/google/prihlaseni/callback`
  (a `/api/google/kalendar/callback`), Claude nastaví branch-specific `APP_URL` přes Vercel API.
- Pozor: všechny preview sdílí jednu databázi Neon (jen větev `main`). Migrace 0004 je aditivní,
  starý kód s ní běží, ale po obnově dat uvidí i personu správce.

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

1. Screenshot a kontrola `/sprava` (lokálně `npm run dev`, persona Správce ZBC ukázky), draft PR kroku A.
2. Živý test podle bodu výše.
3. Krok B: hosté pozvánek z publika akce (aktivní uživatelé skupiny, Wiki spravuje jen své hosty,
   RSVP a ruční hosté zůstanou, změna skupiny upraví budoucí pozvánky, `sendUpdates=all`).
   Dnes v testu Googlu jdou pozvánky jen na `GOOGLE_ALLOWED_ATTENDEES`, simulace zve jen fiktivní role.
4. Krok C: stránka Zápisy (jen oprávněné, filtry, hledání) a odkaz na zápis v pozvánce.
5. Krok D: Moje cesta jako výchozí stránka, menu Moje cesta · Harmonogram · Zápisy · Témata (+ Správa),
   první přihlášení a prázdné stavy, zjednodušený detail akce.
6. Nahrávky pro provoz (soukromé úložiště, 2 až 2,5 h, dělení, skutečný přepis).

## Čeká na odpověď uživatele

- Poskytovatel přepisu (zpracování v EU) a úložiště nahrávek (soukromý Vercel Blob, nebo firemní).
- Skutečné pravidlo střídání typů ve slotu šablony a zda předvyplňovat téma i tréninkům.
- Kam trvale uložit zadání (ZIP), aby ho nebylo nutné posílat. Do tohoto veřejného repa ne.

## Úklid, rozhoduje uživatel

- Token pro `api.vercel.com` v síťových tajemstvích prostředí Default a sloučená větev
  `claude/vzdelavani-vercel-preview-52jflw`.
- Jednobajtový soubor `h` v kořeni repa (commit „Create h“), nejspíš omyl.
- Tento soubor uvádí názvy projektů na Vercelu a v Neonu. Nejsou to tajemství, u veřejného repa zvážit.

Respektuj limit kontextu v `CLAUDE.md`. Na `main` nepushuj, merge dělá uživatel přes PR.
