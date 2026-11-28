# Navazující relace (stav 28. 11. 2026, relace 111)

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
HEAD ee6f6ce. Ověřeno na ee6f6ce: tsc 0, eslint změněných souborů 0, next build OK, e2e menu-telefon 28/28
(telefon-390), nahled+zpetna-vazba na telefon-390/320/windows-1280 prošly. Celá sada e2e/vitest po změně menu
ještě NEběžela (spustit před předáním). PR body: oprav odkaz session v patičce (překlep).

## Technika
- NEPOUŽÍVAT prettier. `npm ci`, `npx next build`. Playwright si server spouští sám.
- Force push (i --force-with-lease) klasifikátor zakazuje → nové větve místo přepisu.
- Nová relace má hned ~100k+ kontextu ze schémat MCP → kroky malé, předávat brzy.
