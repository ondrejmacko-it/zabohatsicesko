# Prompt pro další session

Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`).

---

Pokračuj na demu modulu Vzdělávání. Kód je hotový a ověřený na větvi
`claude/funkce-vzdelavani-harmonogram` (PR do `main`). Nečti znovu celé zadání ani celý kód. Kontext
máš v `README.md` a `docs/predani.md`, pravidla v `CLAUDE.md`. Pracuj úsporně: čti jen soubory,
které měníš, a ověřuj cíleně.

Úkol: zprovozni chráněné preview na Vercelu a pošli mi odkaz. Nic nesmí být veřejně live.

0. Pokud ještě neexistuje, otevři PR z `claude/funkce-vzdelavani-harmonogram` do `main` (česky, podle
   `.github/pull_request_template.md`, výsledky ověření vezmi z `docs/predani.md`). Push na `main`
   blokuje ochrana repa, to je záměr. V minulé relaci Vercel konektor vracel 403 na založení projektu
   a Neon jde zakládat jen přes Vercel Storage.

1. Vercel tým `maci` (`team_PtkXmFd9hI7UeUYovGkbwZQG`), projekt `zbc-vzdelavani-demo` napojený na
   repo. Pokud neexistuje a nemáš oprávnění ho založit, řekni mi to jednou větou a skonči.
2. Zkontroluj nastavení projektu:
   - Vercel Authentication pro všechna nasazení (`ssoProtection.deploymentType = "all"`);
   - produkční buildy přeskočené přes ignored build step
     `if [ "$VERCEL_ENV" = "production" ]; then exit 0; else exit 1; fi`;
   - region funkcí `fra1`.
3. Proměnné jen pro **Preview**, typ *sensitive*:
   - `DATABASE_URL` přichází z Neon Storage připojeného ve Vercelu, hodnotu nečti ani nevypisuj;
   - `SESSION_SECRET` (min. 32 náhodných znaků) a `DEMO_ACCESS_CODE` (min. 12 znaků): pokud chybí,
     vygeneruj je. Přístupový kód mi pošli jen v odpovědi, nikam ho necommituj.
4. Nasaď preview větve `claude/funkce-vzdelavani-harmonogram`. Zkontroluj build log a runtime chyby.
   Ověř přihlášení přístupovým kódem a tok: organizátor upraví a zveřejní akci 12. 11., vedoucí nahraje
   `public/demo/testovaci-nahravka.wav` k akci 11. 11. a zveřejní zápis, kolega mimo publikum je zamítnut.
5. Pošli mi odkaz na preview, přístupový kód a krátké shrnutí, co prošlo.

Na `main` nepushuj, merge dělám já přes PR. Respektuj limit kontextu v `CLAUDE.md`.
