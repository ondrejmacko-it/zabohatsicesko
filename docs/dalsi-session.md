# Prompt pro další session

Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`).

---

Pokračuj na demu modulu Vzdělávání. Kód je sloučený do `main` (PR #1). Nečti znovu celé zadání ani
celý kód. Kontext máš v `README.md` a `docs/predani.md`, pravidla v `CLAUDE.md`.

Stav Vercelu (tým `maci`, `team_PtkXmFd9hI7UeUYovGkbwZQG`, plán Hobby):

- Projekt `zbc-vzdelavani-demo` (`prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`) napojený na repo, založený přes
  Vercel REST API s tokenem uloženým jako síťové tajemství prostředí (Vercel konektor vrací 403 na
  zakládání projektů).
- Vercel Authentication `deploymentType = "all"`, ignored build step přeskakuje produkci (první
  produkční deploy skončil `CANCELED`), region funkcí `fra1`.
- Neon `neon-zbz-vzdelavani-demo` (fra1, Free) připojený jen k Preview. `SESSION_SECRET` a
  `DEMO_ACCESS_CODE` jsou sensitive jen pro Preview. Kód zná jen uživatel, necommitovat.
- REST `POST /v13/deployments` s `gitSource` bez `target` vytvořil produkční deploy, proto se preview
  spouští pushem pracovní větve (Git integrace).

Ověřeno na preview (12. 11. 2026, Playwright přes sdílecí odkaz Vercelu): špatný kód odmítnut, bez
přihlášení stránka vede na vstup a API vrací 401; organizátor uložil návrh (přežil obnovení), potvrdil
dopad a zveřejnil akci 12. 11. → stejná pozvánka `demo-existing-rm-1112`, host s RSVP zůstal, stav
Synchronizováno; vedoucí nahrál testovací nahrávku k 11. 11., Ke kontrole → oprava → zveřejnění, audio
200; účastník FP čte zápis bez přepisu a audia; účastník RM dostal „Záznam neexistuje nebo k němu
nemáte přístup“ (stránka i přímý odkaz 404); organizátor bez role kontrolora audio nezíská. Žádné 5xx.

Data v Neonu jsou po testu změněná (zveřejněná akce i zápis). Pro čistou ukázku je obnoví
`npm run db:reset` s `DATABASE_URL` z Preview.

Otevřené: preview běží z větve `claude/vzdelavani-vercel-preview-52jflw` (kód shodný s `main`).
Token pro `api.vercel.com` je uložený v síťových tajemstvích prostředí Default, po dokončení ho smazat.

Respektuj limit kontextu v `CLAUDE.md`. Na `main` nepushuj.
