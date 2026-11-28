# Navazující relace (stav 28. 11. 2026, relace 106)

Cíl: dokončit PR #97, ověřit skutečnou funkčnost (živý Google Kalendář), připravit bezpečné ostré nasazení.
Plné zadání vlastníka (body 1–11) je v promptu navazující relace; drž se ho. Bez merge do main, bez produkčního
deploye, bez změn produkčních proměnných, bez výpisu tajemství, žádné zprávy/pozvánky skutečným zaměstnancům.
Izolovaný živý test SCHVÁLEN (testovací větev + Preview, prázdná Neon větev, branch-scoped proměnné,
`CALENDAR_DELIVERY=personal`, `PARTICIPATION=on`, ideálně samostatný testovací OAuth klient). Testovací Google
účty (správce + 2 členové) NEMÁŠ: nevytvářet, vyžádat.

Větve: `claude/gallant-knuth-ydgzxz` = `claude/oprava-kalendare-a-prehled-ucasti` (PR #97 draft), pushuj na obě:
`git push origin HEAD:claude/oprava-kalendare-a-prehled-ucasti HEAD:claude/gallant-knuth-ydgzxz`. Souběžné relace:
vždy `git fetch` + merge. Vercel tým `team_PtkXmFd9hI7UeUYovGkbwZQG`, projekt `prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`.
Neon projekt `neon-zbz-vzdelavani-demo` (main = produkce, NEDOTÝKAT SE).

## Hotovo dříve (do reportu)
V1 tabulka Účasti c5db69d; filtr témat „Všechna“ ffcca12; plánovač bez skrytých výpadků 739187b (důkaz K1:
běh 46148649291); vizuální regrese aa63cb7; přímá volání API pokrytá testy (relace 105). Architektura
plánovačů: `after()` + návštěva Wiki, GitHub */10 (nespolehlivý), Vercel cron denně 5:17 → ponechat oba.

## Relace 106
- CI PR #97 na ccfc452: lint/typy/testy/build + citlivé cesty zelené, E2E smoke (vč. vizuálu) v tu chvíli běžel
  → OVĚŘIT na aktuálním HEAD (`get_check_runs` PR 97; při pádu vizuálu stáhnout artefakt `vizualni-rozdily`).
- `docs/promenne-prostredi.md`: kompletní tabulka env (Vercel, GitHub Actions, skripty) – krok 2 HOTOV.
- `scripts/overeni-kalendare-google.ts` + `personalCalendarExpectation` (personal.ts) + `listEvents`
  (personal-api.ts): porovnání DB ↔ Google Calendar API (chybí/navíc/odlišné/duplicity), `--sledovat=N` měří
  latenci. Jen čte. tsc 0, eslint 0, vitest 665/665. Proti živému Googlu NEVYZKOUŠENO (chybí účty).

## Další kroky (malé jednotky, commit + push po každé)
1. CI na HEAD.
2. Volitelně unit test `listEvents` (stránkování, fake fetch) v testech personal-api.
3. Finální běh lint/tsc/unit/e2e (`npx next build` + e2e) a vizuál (`npm run e2e:vizual`).
4. Přepsat `docs/report-zive-overeni-pr97.md` do kategorií bodu 11 (odkaz na promenne-prostredi.md a skript,
   scénáře bodu 5 jako Blokované s přesným seznamem, co dodat), aktualizovat popis PR #97.
5. Report vlastníkovi + žádost o oprávnění pro maximální automatizaci (Google testovací účty 3×, testovací OAuth
   klient + redirect URI aliasu, Neon větev, Vercel branch-scoped env, GH vars/secrets, bypass secret, Make).

## Technika
- NEPOUŽÍVAT prettier. `npm ci`, `npx next build`. Playwright si server spouští sám.
- Nová relace má hned ~100k+ kontextu ze schémat MCP → kroky malé, předávat brzy.
