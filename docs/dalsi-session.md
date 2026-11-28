# Navazující relace (stav 28. 11. 2026, relace 105)

Cíl: dokončit opravy PR #97, ověřit skutečnou funkčnost (živý Google Kalendář), připravit bezpečné ostré nasazení.
Plné zadání vlastníka (body 1–11) je v promptu navazující relace; drž se ho. Bez merge do main, bez produkčního
deploye, bez změn produkčních proměnných, bez výpisu tajemství, žádné zprávy/pozvánky skutečným zaměstnancům.
Vlastník SCHVÁLIL přípravu a provedení izolovaného živého testu (testovací větev + Preview, prázdná/schema-only
Neon větev, branch-scoped proměnné, `CALENDAR_DELIVERY=personal`, `PARTICIPATION=on`, ideálně samostatný
testovací OAuth klient). Testovací Google účty (správce + 2 členové) zatím NEMÁŠ: nevytvářet, vyžádat.
Vlastník schválil opravu V1 PŘÍMO v PR #97 (větev `claude/oprava-kalendare-a-prehled-ucasti`).

Větve: `claude/gallant-knuth-ydgzxz` (report, HEAD viz `git log -1`), PR #97 draft. Souběžné relace: vždy
`git fetch` + merge. Vercel tým `team_PtkXmFd9hI7UeUYovGkbwZQG`, projekt `prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`.
Neon projekt `neon-zbz-vzdelavani-demo` (main = produkce, NEDOTÝKAT SE).

## Hotovo
- Relace 100: report K1–K9, postup izolovaného testu, `scripts/vizualni-sada.mjs` (3 prohlížeče), nález V1.
- Relace 102: větev `claude/gallant-knuth-ydgzxz` sjednocena s PR #97 (fast-forward, obě větve = stejný HEAD,
  pushuj na obě: `git push origin HEAD:claude/oprava-kalendare-a-prehled-ucasti HEAD:claude/gallant-knuth-ydgzxz`).
  CI PR #97 na b4362a8 zelené. V1 OPRAVENO v c5db69d: `src/components/TableScroll.tsx` (role=region,
  tabindex, `position:relative` kvůli absolutním `.visually-hidden` popiskům), CSS `.table-scroll` na konci
  globals.css, `e2e/ucast-sirka.spec.ts` (768/1024/1280, akce/lidé/detail, klávesnice) prošel v
  windows-1280, firefox-1280, webkit-1440 (E2E_WEBKIT=1); TLS proxy i pro UCAST (3413). ucast*.spec prošly.

## Relace 104
- ffcca12: výchozí filtr témat „Všechna“ (e2e `temata-filtr` 15/15, unit temata-f10-f12, tsc, eslint).
- 739187b: `kalendar-fronta.yml` – `vars.CALENDAR_QUEUE_SCHEDULER=off` = záměrně vypnuto (notice, exit 0);
  chybějící `vars.WIKI_URL`/`secrets.CALENDAR_WORKER_TOKEN` = `::error::` exit 1; HTTP ≠ 200 = error.
  DŮKAZ K1: běh 46148649291 (main, 28. 11.) – proměnné prázdné, „success“ = nic se nevolá.
- Architektura plánovačů (do reportu): `after()` v akcích + při návštěvě Wiki, GitHub */10 (nespolehlivý,
  ~4–9 h), Vercel cron denně 5:17 (Hobby). Návrh: ponechat oba, GitHub jako hlavní.

## Relace 105
- Krok 1 OVĚŘEN bez změn: přímá volání už pokrývají testy (`kalendar-organizator` 401 bez/špatný token,
  `ucast-prihlasky` cizí účast + podvržený požadavek v náhledu, `omluvy-nadrizeny` forbidden, `ucast-prehled`).
- aa63cb7: vizuální regrese `e2e/vizualni.spec.ts` (Úvod, Plán, Témata, akce ev-11-5, Účast × 390/1024/1440,
  UCAST server, seed referenceNow 12. 11. 2026 9:00, `page.clock`), projekt `vizual` jen s `E2E_VIZUAL=1`
  (`npm run e2e:vizual`, `scripts/e2e-vizual.mjs`), reference `e2e/vizualni.spec.ts-snapshots/*-linux.png`
  (2,4 MB), tolerance 0,002. Lokálně 2× po sobě 24 passed (stabilní). CI krok „Vizuální regrese“ v e2e-smoke
  (E2E_SKIP_BUILD=1) + artefakt `vizualni-rozdily`. README řádek s postupem Firefox/WebKit.
- CI na aa63cb7 NEOVĚŘENO (běželo). Pokud vizuál v CI selže jen kvůli vykreslení runneru: stáhnout artefakt,
  posoudit, případně přegenerovat reference (Chromium rev. 1243 = stejná jako lokálně, fonty z @fontsource).

## Další kroky (po malých jednotkách, commit + push po každé)
1. CI PR #97 na HEAD (vč. kroku Vizuální regrese a pinu upload-artifact v4.6.2 SHA ea165f8…).
2. Tabulka env proměnných (kde, k čemu, prostředí, jak vytvořit, jak ověřit, následky absence) do reportu.
3. Izolovaný test: skript ověřující stav přes Google Calendar API + měření latence; co má vlastník dodat.
4. Finální běh lint/typecheck/unit/e2e/vizuál, report `docs/report-zive-overeni-pr97.md` do kategorií
   z bodu 11 (+ V1 c5db69d, filtr ffcca12, plánovač 739187b, vizuál aa63cb7), PR popis.
5. Na konci report vlastníkovi + žádost o oprávnění pro maximální automatizaci a testování.
- Pozn.: nová relace má hned ~100k+ kontextu ze schémat MCP nástrojů → kroky dělat malé, předávat brzy.

## Technika
- NEPOUŽÍVAT prettier. `npm ci` (node_modules chybí v nové relaci), `npx next build`. Playwright si server
  spouští sám (neběží-li jiný): `E2E_WEBKIT=1 npx playwright test <spec> --project=prihlaseni --project=…`.
- Prohlížeče: `npx playwright install-deps webkit firefox`; `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install webkit firefox`.
- Vizuální sada: `PROHLIZEC=firefox node scripts/vizualni-sada.mjs $PWD <out>` (absolutní cesta repa).
- Screenshoty číst jen jako výřezy/koláže (`montage` s `file[WxH+0+0]`), šetřit kontext.
