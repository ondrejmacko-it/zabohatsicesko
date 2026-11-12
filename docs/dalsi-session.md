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

Další krok: ověřit preview (přihlášení kódem, organizátor zveřejní akci 12. 11. se stavem
Synchronizováno, vedoucí nahraje `public/demo/testovaci-nahravka.wav` k akci 11. 11. a zveřejní zápis,
kolega mimo publikum je zamítnut) a výsledek popsat v draftu PR.

Respektuj limit kontextu v `CLAUDE.md`. Na `main` nepushuj.
