# Navazující relace (stav 28. 11. 2026, relace 110)

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
1. HAMBURGER MENU na telefonu (vlastník výslovně chce). Nahradit mřížku `e2e/menu-telefon.spec.ts` za
   přehledné hamburger menu ve stylu Wiki (přístupnost: aria-expanded, Esc, fokus, zavření po kliknutí).
   Upravit testy a vizuální reference (push na `reference-vizual/**` → workflow vygeneruje snímky).
2. Nastavit demo pro živý test: CALENDAR_DELIVERY=personal, PARTICIPATION=on, CRON_SECRET a
   CALENDAR_WORKER_TOKEN (vygenerovat), GitHub secret/var WIKI_URL + CALENDAR_WORKER_TOKEN (K1/K8, K2, K6).
3. Živé E2E Google Kalendáře se stávajícími účty: všechny scénáře kap. 6 `docs/report-zive-overeni-pr97.md`,
   skript `scripts/overeni-kalendare-google.ts` (`--sledovat=N` latence), duplicity, pravdivé stavy fronty.
   Chyby opravit, opakovat do funkčnosti. Make živě (zpětná vazba) pokud je scénář/webhook.
4. Aktualizovat report (8 kategorií) + popis PR #97 (draft), finální testy, report vlastníkovi až na konci.

## Stav
HEAD 7b4d7c1; CI na 783c592 zelené vč. vizuální regrese. eslint/tsc 0, vitest 668/668, e2e 1660/0.
PR body: oprav odkaz session v patičce (překlep). Pomocná větev `reference-vizual/pr97` existuje.

## Technika
- NEPOUŽÍVAT prettier. `npm ci`, `npx next build`. Playwright si server spouští sám.
- Nová relace má hned ~100k+ kontextu ze schémat MCP → kroky malé, předávat brzy.
