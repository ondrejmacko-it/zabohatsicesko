# Navazující relace (stav 28. 11. 2026, relace 103)

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

## Relace 103 (krátká, kontext vyčerpán schématy nástrojů)
- CI PR #97 na ec1a241 ZELENÉ (lint/typy/testy/build, E2E smoke, citlivé cesty, Vercel).
- `temata-filtr` + `menu-telefon` (windows-1280, telefon-390, telefon-320): 36 passed, 48 skipped (gating projektů).
- NÁLEZ: `src/server/domain/topics.ts:122` `defaultTopicFilter` = „all“ jen pro organizátora, člen má „role“.
  Zadání říká výchozí „Všechna“; e2e testuje jen `?filtr=vse`, ne výchozí stav. Přečíst komentář nad funkcí
  (ř. ~112–121); pokud není výslovně dohodnuto jinak, změnit na „all“ pro všechny + e2e bez parametru.
- Plánovač: běhy `kalendar-fronta.yml` jen ~každé 4–9 h místo */10 (35 běhů celkem), všechny „success“ –
  důkaz pro K1/K8 (GitHub schedule nespolehlivý + exit 0 při chybějící konfiguraci).

## Další kroky (po malých jednotkách, commit + push po každé)
1. Výchozí filtr témat (viz nález), report V1 doplnit (c5db69d, CI zelené).
2. Vizuální regrese: malý projekt `toHaveScreenshot` (4–5 stránek × 390/1024/1440, Chromium, CI Linux),
   reference generovat v CI, postup Firefox/WebKit do README/reportu.
3. Plánovač K1/K8: `kalendar-fronta.yml` exit 0 bez konfigurace → rozlišit vypnuto (proměnná např.
   `vars.CALENDAR_QUEUE_DISABLED`) vs. chyba (fail). Posoudit jeden vs. dva plánovače. Tabulka env proměnných.
4. Účast/oprávnění: cílené testy (nadřízený jen své lidi, účastník, přímé volání API).
5. Izolovaný test: skript ověřující stav přes Google Calendar API + měření latence; co má vlastník dodat.
6. Finální běh lint/typecheck/unit/e2e/vizuál, report do kategorií z bodu 11 zadání, PR popis.
7. Na konci požádat vlastníka o oprávnění pro maximální automatizaci a testování (přístupy, účty, secrets).
- Pozn.: nová relace má hned ~100k+ kontextu ze schémat MCP nástrojů → kroky dělat malé, předávat brzy.

## Technika
- NEPOUŽÍVAT prettier. `npm ci` (node_modules chybí v nové relaci), `npx next build`. Playwright si server
  spouští sám (neběží-li jiný): `E2E_WEBKIT=1 npx playwright test <spec> --project=prihlaseni --project=…`.
- Prohlížeče: `npx playwright install-deps webkit firefox`; `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install webkit firefox`.
- Vizuální sada: `PROHLIZEC=firefox node scripts/vizualni-sada.mjs $PWD <out>` (absolutní cesta repa).
- Screenshoty číst jen jako výřezy/koláže (`montage` s `file[WxH+0+0]`), šetřit kontext.
