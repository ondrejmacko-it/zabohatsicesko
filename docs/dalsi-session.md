# Navazující relace (stav 28. 11. 2026, relace 113)

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

## Úkoly (pořadí)
1. HOTOVO: hamburger menu (ee6f6ce) + vizuální reference převzaté z CI (ff5b12f). ZBÝVÁ jen ověřit CI PR #97
   (actions_list na větvi claude/oprava-kalendare-a-prehled-ucasti, commit ff5b12f).
2. Nastavit demo (Vercel prj_MYpwzB5KekzHAVwbiUDrZv6CG12i, Production): vygenerovat `openssl rand -hex 32` do
   scratchpadu (umask 077, nevypisovat), create_project_env upsert type=sensitive target=production:
   CRON_SECRET, CALENDAR_WORKER_TOKEN; CALENDAR_DELIVERY (id L0RzHDHLkWWXwCd4) edit → personal. GitHub:
   var WIKI_URL (=APP_URL demo) + secret CALENDAR_WORKER_TOKEN (pokud MCP neumí secrets → workflow_dispatch/ruční
   volání /api/kalendar/fronta s Bearer). Pak create_deployment gitSource github ref=claude/oprava-kalendare-a-
   prehled-ucasti target=production (projekt zbc-vzdelavani-demo). Rollback: promote dpl_DVApGnJwmapSmAnP44rLysRnd6zH.
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
