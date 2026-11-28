# Navazující relace (stav 28. 11. 2026, relace 112)

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
1. HOTOVO (ee6f6ce): hamburger menu ≤640 px v `src/components/Sidebar.tsx` (+CSS `.nav-toggle` v globals.css,
   helper `openMainMenu` v `e2e/support.ts`, nový `e2e/menu-telefon.spec.ts`). Tablet 641–900 mřížka beze změny.
   ZBÝVÁ: vizuální reference. Pushnuto na NOVOU větev `reference-vizual/pr97-menu` (stará pr97 nebyla FF, force
   zakázán) → workflow `vizualni-reference.yml` commitne snímky zpět na ni. Zkontroluj běh (actions_list),
   převezmi `e2e/vizualni.spec.ts-snapshots/*` do pracovní větve (git checkout origin/reference-vizual/pr97-menu --
   e2e/vizualni.spec.ts-snapshots), commit, push na obě větve, ověř CI PR #97.
2. Nastavit demo pro živý test: CALENDAR_DELIVERY=personal, PARTICIPATION=on, CRON_SECRET a
   CALENDAR_WORKER_TOKEN (vygenerovat), GitHub secret/var WIKI_URL + CALENDAR_WORKER_TOKEN (K1/K8, K2, K6).
3. Živé E2E Google Kalendáře se stávajícími účty: všechny scénáře kap. 6 `docs/report-zive-overeni-pr97.md`,
   skript `scripts/overeni-kalendare-google.ts` (`--sledovat=N` latence), duplicity, pravdivé stavy fronty.
   Chyby opravit, opakovat do funkčnosti. Make živě (zpětná vazba) pokud je scénář/webhook.
4. Aktualizovat report (8 kategorií) + popis PR #97 (draft), finální testy, report vlastníkovi až na konci.

## Stav
HEAD f1c1cb3 (beze změn kódu v relaci 112). Workflow referencí run 46172197766 (větev reference-vizual/pr97-menu)
běžel od 17:45 UTC; po doběhnutí převzít snímky dle úkolu 1. Celá sada e2e/vitest po změně menu ještě NEběžela.
PR body: oprav odkaz session v patičce (překlep).

## Zjištění relace 112 (pro úkol 2–3, neověřovat znovu)
- Vercel Production demo (zbc-vzdelavani-demo.vercel.app) běží z `main` (fa5e67f, PR #96), NE z PR #97. Production
  env: CALENDAR_MODE/LOGIN_MODE=google-test, CALENDAR_ATTENDEES=audience, PARTICIPATION=on, CALENDAR_DELIVERY
  (encrypted, hodnota neznámá), APPROVED_MIGRATIONS do 0019, FEEDBACK_WEBHOOK_URL (Make hook eu1) + SECRET.
  CHYBÍ CRON_SECRET a CALENDAR_WORKER_TOKEN (čte `src/server/config.ts:195`).
- Preview env: CALENDAR_MODE=simulation, WIKI_MODE=demo, vlastní DB proměnné, GOOGLE_* existují (OAuth redirect na
  preview URL neověřen). Nejčistší živý test PR #97 = nasadit větev na Production demo (create_deployment
  gitSource ref=claude/oprava-kalendare-a-prehled-ucasti, target production), doplnit APPROVED_MIGRATIONS o
  migrace PR #97 (zjistit v `src/server/db/migrations.ts`), CRON_SECRET+CALENDAR_WORKER_TOKEN (sensitive,
  vygenerovat `openssl rand -hex 32`, nevypisovat), CALENDAR_DELIVERY=personal. Rollback = promote dpl_DVApGnJwmapSmAnP44rLysRnd6zH.
  Před tím přes Neon run_sql ověřit uživatele (jen testovací účty → audience bezpečné).
- Neon projekt id `still-shadow-86247101` (výchozí větev = demo produkce).
- Plánovač `kalendar-fronta.yml` čte vars.WIKI_URL, secrets.CALENDAR_WORKER_TOKEN, vars.CALENDAR_QUEUE_SCHEDULER;
  schedule běží jen z default větve (ověřit, zda soubor je na main; jinak workflow_dispatch / ruční volání).
- Výpis env Vercelu je obří: filtrovat v pythonu, nevypisovat celý.

## Technika
- NEPOUŽÍVAT prettier. `npm ci`, `npx next build`. Playwright si server spouští sám.
- Force push (i --force-with-lease) klasifikátor zakazuje → nové větve místo přepisu.
- Nová relace má hned ~100k+ kontextu ze schémat MCP (ToolSearch select nač. jen potřebné) → kroky malé, předávat brzy.
