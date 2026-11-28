# Navazující relace (stav 28. 11. 2026, relace 115)

Cíl: dokončit PR #97, ověřit skutečnou funkčnost (živý Google Kalendář), připravit bezpečné ostré nasazení.
Plné zadání vlastníka (body 1–11) je v promptu navazující relace; drž se ho. Bez merge do main, bez produkčního
deploye, bez změn produkčních proměnných, bez výpisu tajemství, žádné zprávy/pozvánky skutečným zaměstnancům.
Izolovaný živý test SCHVÁLEN, ale testovací Google účty (správce + 2 členové) NEMÁŠ: nevytvářet, vyžádat.

Větve: `claude/gallant-knuth-ydgzxz` = `claude/oprava-kalendare-a-prehled-ucasti` (PR #97 draft), pushuj na obě:
`git push origin HEAD:claude/oprava-kalendare-a-prehled-ucasti HEAD:claude/gallant-knuth-ydgzxz`. Souběžné relace:
vždy `git fetch` + merge. Vercel tým `team_PtkXmFd9hI7UeUYovGkbwZQG`, projekt `prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`.
Neon projekt `neon-zbz-vzdelavani-demo` (main = produkce, NEDOTÝKAT SE).

## NOVÉ ZADÁNÍ VLASTNÍKA (28. 11. 2026, závazné, nahrazuje omezení výše)
Demo, DB i nasazení jsou vývojové a data postradatelná. Vlastník dal plnou autonomii nad VÝVOJOVOU
infrastrukturou projektu: GitHub, Vercel (vč. Production demo projektu), Neon (vč. main demo projektu), Google
Cloud, Google Kalendář, Make, proměnné, plánovače, testovací data. Klíče/secrets generuj a ukládej sám (nikdy
nevypisuj). Použij současné demo pro živé testy, další infrastrukturu jen když nutné. Testovací Google účty
existují (ty, co vlastník dosud používal – zjisti z DB/env, např. BOOTSTRAP_ADMIN_EMAILS, uživatelé v DB).
Zakázáno bez souhlasu: zvyšovat náklady, merge do main, ostré FIREMNÍ nasazení, cizí projekty/osobní data.
Vlastník nechce návody ani checklisty. Jen při nepřekonatelné překážce: 1) přímý odkaz, 2) co přesně udělat,
3) proč to nejde samo – ideálně jednorázová autorizace. Hesla/klíče se neposílají chatem. Blokovaný úkol
nezastavuje ostatní.

## DOPLNĚNÉ ZADÁNÍ VLASTNÍKA (28. 11. 2026, po relaci 114, závazné)
Placený Vercel NE – čekat na limit, pokud není jiná bezpečná cesta. Dále:
A. Deployment kvóta: prověř `git.deploymentEnabled` (vercel.json, ověř sémantiku překrývajících se globů přes
   Vercel docs) a vypni automatická nasazení pomocných větví (min. claude/gallant-knuth-ydgzxz). CI a ruční
   nasazení (create_deployment) zachovat. Zvaž i commandForIgnoringBuildStep v nastavení projektu.
B. GitHub secret CALENDAR_WORKER_TOKEN: když MCP neumí, prověř REST API / gh CLI / jiné autorizované cesty
   (pozor: prostředí povoluje `gh` jen pro search; zvaž alternativu bez secretu, např. ověření GitHub OIDC
   tokenu v endpointu). Token NErotovat před každým testem; nutnou rotaci udělat koordinovaně všude
   (Vercel + GitHub) jednou, před finálním nasazením. Současná hodnota existuje jen ve Vercelu (sensitive).
C. Živý test Google Calendar API mimo Vercel (lokální server v kontejneru s existujícími test. přístupy, např.
   credential v demo DB + TOKEN_ENCRYPTION_KEY). Lokální ověření v reportu oddělit od ověření nasazené aplikace.
D. Ověř, že běžná synchronizace kalendářů běží automaticky (hned po akci uživatele, ne až denním cronem);
   plánovač má hlavně spolehlivě opakovat neúspěšné operace. Pokud ne, oprav.
E. Ruční volání /api/kalendar/fronta ≠ důkaz plánovače. Ověř obě věci zvlášť (Vercel cron 17 5 * * *,
   GitHub schedule */10 – ten běží jen z výchozí větve main; zdokumentuj omezení, do main NIC nemergovat).
F. Po uvolnění limitu: jedno ucelené ověřené nasazení (nejdřív lokální testy, nepushovat drobnosti zbytečně),
   pak všechny živé testy, opravy, dokumentace, finální kontrola.

## Stav bodů A–F (relace 115, HEAD 2c965ac + předávka)
- A HOTOVO v kódu: vercel.json `git.deploymentEnabled {"claude/gallant-knuth-ydgzxz": false}` (docs: při více
  shodách stačí jedno true → nasadí se; nepasující větve se nasazují). PR větev nechána zapnutá (1 preview/push).
  commandForIgnoringBuildStep NEpoužit (ignorovaný build stále vytváří nasazení a platil by i pro ruční deploy).
  Neověřeno: že create_deployment API vypnutí neovlivní (podle docs se týká jen Git pushů) → ověř v F.
  Pushnuto JEN na gallant (vypnutá) – na PR větev pushni až s F (vytvoří 1 preview).
- B HOTOVO v kódu: endpoint přijímá GitHub OIDC (src/server/calendar/worker-auth.ts, tests/kalendar-oidc.test.ts
  10/10 zelených, tsc+eslint OK); workflow má id-token: write, audience zbc-kalendar-fronta. ZBÝVÁ: nastavit
  Vercel Production env CALENDAR_WORKER_OIDC_REPOSITORY=ondrejmacko-it/zabohatsicesko (nesecretní, plain)
  a GitHub var WIKI_URL (zjisti, jestli existuje). GitHub secret už není nutný. Schedule běží jen z main →
  do nasazení/merge ověřit jen ručním workflow_dispatch na PR větvi (actions_run_trigger).
- C, D, E: NEZAČATO. Pak F (limit Vercelu do ~29. 11. 18:20 UTC) a úkoly 3–4 níže.
- Celou sadu testů (vitest s DB, e2e) před F spustit jednou.

## Úkoly (pořadí)
1. HOTOVO: CI PR #97 zelené na ff5b12f (Kontrola kódu + bezpečnosti).
2. ČÁSTEČNĚ (relace 114): Vercel Production env nastaveno – CRON_SECRET a CALENDAR_WORKER_TOKEN (sensitive,
   hodnoty nikde neuložené mimo Vercel; pro ruční volání /api/kalendar/fronta je potřeba nový token → vygeneruj
   nový a upsertni ho, starý se tím nahradí), CALENDAR_DELIVERY=personal. BLOKUJE: create_deployment vrací 402
   `api-deployments-free-per-day` (free plán, >100 nasazení/den, retryAfter 24 h od 28. 11. ~18:19 UTC). Neplatit,
   neupgradovat. Po uvolnění: create_deployment gitSource {type github, org ondrejmacko-it, repo zabohatsicesko,
   ref claude/oprava-kalendare-a-prehled-ucasti} target=production, project prj_MYpwzB5KekzHAVwbiUDrZv6CG12i.
   Rollback: promote dpl_DVApGnJwmapSmAnP44rLysRnd6zH. Každý push vytváří 2 preview nasazení (obě větve) a žere
   kvótu → před nasazením NEPUSHOVAT; zvaž update_project commandForIgnoringBuildStep pro preview (bez nákladů).
   Preview běží v CALENDAR_MODE=simulation → pro živý test nepoužitelný. GitHub secret CALENDAR_WORKER_TOKEN přes
   MCP nejde → volat endpoint ručně s Bearer (POST /api/kalendar/fronta).
3. Živé E2E (kap. 6 docs/report-zive-overeni-pr97.md, scripts/overeni-kalendare-google.ts --sledovat=N).
4. Report (8 kategorií) + popis PR #97 (oprav odkaz session v patičce), finální testy, report vlastníkovi na konci.

## Zjištění relace 113 (neověřovat znovu)
- PR #97 nepřidává migrace (poslední 0019). Demo DB (Neon still-shadow-86247101, neondb) má v schema_migrations
  jen do 0015 (17 řádků) → 0016–0019 se aplikují až při nasazení (APPROVED_MIGRATIONS je obsahuje).
- DB: 5 users @example.invalid (fiktivní seed) + 2 Google identity (gmail.com; role organizer a member),
  integration_credentials google-calendar = 1 (sdílený kalendář organizátora), personal_calendars = 0.
- Osobní doručení potřebuje grant scope calendar.app.created, který vzniká JEN při přihlášení Googlem v aplikaci
  (savePersonalGrant). Přihlášení = pozvánka + Google OAuth; bez hesel test. účtů to sám neuděláš →
  NEPŘEKONATELNÉ: po nasazení požádat vlastníka (odkaz na demo URL, přihlásit se oběma test. účty a povolit
  Kalendář; proč: vyžaduje interaktivní souhlas Google účtu). Mezitím testovat co jde bez nich (fronta/worker,
  sdílený kalendář přes uloženou credential, duplicity, stavy fronty).
- Production env: LOGIN/CALENDAR_MODE=google-test, WIKI_MODE=production, CALENDAR_ATTENDEES=audience,
  PARTICIPATION=on, CALENDAR_PERSONAL_NOTIFY (encrypted), BOOTSTRAP_ADMIN_EMAILS (encrypted). CRON_SECRET a
  CALENDAR_WORKER_TOKEN stále CHYBÍ (relace 113 je nevytvořila).
- Výpis env přes filter_project_envs uložit do souboru a filtrovat pythonem (json['result']['envs']).
- `kalendar-fronta.yml` čte vars.WIKI_URL, secrets.CALENDAR_WORKER_TOKEN, vars.CALENDAR_QUEUE_SCHEDULER; schedule
  běží jen z default větve (main) → pro PR #97 workflow_dispatch nebo ruční volání endpointu.

## Technika
- NEPOUŽÍVAT prettier. `npm ci`, `npx next build`. Playwright si server spouští sám.
- Force push (i --force-with-lease) klasifikátor zakazuje → nové větve místo přepisu.
- Nová relace má hned ~100k+ kontextu ze schémat MCP (ToolSearch select nač. jen potřebné) → kroky malé, předávat brzy.
