# Navazující relace (stav 28. 11. 2026, relace 108)

Cíl: dokončit PR #97, ověřit skutečnou funkčnost (živý Google Kalendář), připravit bezpečné ostré nasazení.
Plné zadání vlastníka (body 1–11) je v promptu navazující relace; drž se ho. Bez merge do main, bez produkčního
deploye, bez změn produkčních proměnných, bez výpisu tajemství, žádné zprávy/pozvánky skutečným zaměstnancům.
Izolovaný živý test SCHVÁLEN, ale testovací Google účty (správce + 2 členové) NEMÁŠ: nevytvářet, vyžádat.

Větve: `claude/gallant-knuth-ydgzxz` = `claude/oprava-kalendare-a-prehled-ucasti` (PR #97 draft), pushuj na obě:
`git push origin HEAD:claude/oprava-kalendare-a-prehled-ucasti HEAD:claude/gallant-knuth-ydgzxz`. Souběžné relace:
vždy `git fetch` + merge. Vercel tým `team_PtkXmFd9hI7UeUYovGkbwZQG`, projekt `prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`.
Neon projekt `neon-zbz-vzdelavani-demo` (main = produkce, NEDOTÝKAT SE).

## Hotovo (relace 108)
- `.github/workflows/vizualni-reference.yml` (55acd35): push na `reference-vizual/**` → `npm run e2e:vizual --
  --update-snapshots` na ubuntu-latest → commit `e2e/vizualni.spec.ts-snapshots/*.png` zpět na tu větev.
  Pushnuta větev `reference-vizual/pr97`, běh 46165244474 (viz krok 1, zda doběhl).
- `docs/report-zive-overeni-pr97.md` přepsán do 8 kategorií bodu 11 (cf2510e), vč. seznamu přístupů od vlastníka.
- Mobilní navigace: ponechána mřížka 3–4 položek (testy `e2e/menu-telefon.spec.ts`), hamburger záměrně ne –
  zdůvodněno v reportu kap. 2.
- Dříve: V1 c5db69d, filtr témat ffcca12, plánovač 739187b, vizuální regrese aa63cb7, proměnné 430e814.
- Testy (HEAD a53c972, kód aplikace se od té doby neměnil): eslint 0, tsc 0, vitest 668/668, build OK,
  plné e2e 1660 passed / 0 failed. CI 46163734788 zelené kromě vizuální regrese 15/15 (fonty runneru).

## Další kroky
1. HOTOVO: reference z běhu 46165244474 (commit aebd393) převzaty do pracovní větve. Ověř běh CI PR #97 na
   HEAD (`actions_list` list_workflow_runs, branch claude/oprava-kalendare-a-prehled-ucasti): vizuální krok zelený?
   Když ne: `get_job_logs` (tail 60) a opravit.
2. Do reportu kap. 5 R1 doplnit výsledek (zelené/červené, číslo běhu). Aktualizovat popis PR #97 (shrnutí
   kategorií reportu + odkaz na report; bez merge, draft ponechat).
3. Pomocnou větev `reference-vizual/pr97` nechat (smazání je nevratné – uvést vlastníkovi).
4. Poslední relace: report vlastníkovi (souhrn kap. 1–8 reportu, commity, stav CI) + žádost o oprávnění pro
   maximální automatizaci = kap. 7 reportu (3 Google účty, testovací OAuth klient + redirect URI, Neon
   schema-only větev, Vercel branch-scoped env + tajemství, bypass secret, produkční CRON_SECRET/
   CALENDAR_WORKER_TOKEN/WIKI_URL až po testu, povolení blob storage GitHubu v proxy, Make testovací webhook).

## Otevřené otázky
- Hamburger menu na telefonu: ponechána mřížka (původní zadání); potvrdit vlastníkem.

## Technika
- NEPOUŽÍVAT prettier. `npm ci`, `npx next build`. Playwright si server spouští sám.
- Nová relace má hned ~100k+ kontextu ze schémat MCP → kroky malé, předávat brzy.
