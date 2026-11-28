# Navazující relace (stav 28. 11. 2026, relace 101)

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

## Hotovo (relace 100)
- `docs/report-zive-overeni-pr97.md`: K1–K9, postup izolovaného testu, scénáře, vizuální sada ve 3 prohlížečích
  (jen V1), návrh vizuální regrese, souhrn. `scripts/vizualni-sada.mjs` funguje (Chromium/Firefox/WebKit).
- V1: `/vzdelavani/ucast` správce 768/1024 px, `.table-stack` (globals.css ~4250) se skládá jen do 480 px,
  tabulka bez posuvného obalu → vodorovný posun 18/26 px.

## Další kroky (po malých jednotkách, commit + push po každé)
1. Stav: PR #97, CI (GitHub actions_list), větve. Sjednotit auditní/testovací změny z této větve do PR #97,
   pokud bez konfliktů (skript vizuální sady, report).
2. V1 v PR #97: posuvný obal tabulky (`overflow-x:auto`, `tabindex=0`, `role=region` + aria-label, viditelný
   focus, náznak posunu), geometrický e2e test bez vodorovného posunu na 768/1024 (`expectNoHorizontalScroll`).
   Ověřit Chromium/Firefox/WebKit skriptem.
3. Ověřit: výchozí filtr témat „Všechna“, mobilní hamburger menu (e2e `menu-telefon.spec.ts`). Dokončit jen chybějící.
4. Vizuální regrese: malý projekt `toHaveScreenshot` (4–5 stránek × 390/1024/1440, Chromium, CI Linux),
   reference generovat v CI (ne lokálně jiné fonty), postup Firefox/WebKit do README/reportu.
5. Plánovač K1/K8: proč `kalendar-fronta.yml` končí success bez konfigurace → rozlišit vypnuto vs. chyba
   (chyba = fail). Posoudit, zda stačí jeden plánovač (návrh nejdřív zdůvodnit). Tabulka všech env proměnných
   (kde, k čemu, prostředí, jak vytvořit, jak ověřit, následky absence) do reportu.
6. Účast/oprávnění: cílené testy (nadřízený jen své lidi, účastník, přímé volání API).
7. Izolovaný test: připravit skript ověřující stav přes Google Calendar API + měření latence; nesecretní
   proměnné testovací větve nastavit až po potvrzení účtů. Sepsat přesně, co má vlastník dodat.
8. Finální běh lint/typecheck/unit/e2e/vizuál, report rozdělit do kategorií z bodu 11 zadání, PR popis.
9. Na konci požádat vlastníka o oprávnění pro maximální automatizaci a testování (přístupy, účty, secrets).

## Technika
- NEPOUŽÍVAT prettier. e2e: `E2E_WEBKIT=1 nohup node e2e/server.mjs &` (porty 3310/3311/3313), celá sada ~17 min.
- Prohlížeče: `npx playwright install-deps webkit firefox`; `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install webkit firefox`.
- Vizuální sada: `PROHLIZEC=firefox node scripts/vizualni-sada.mjs $PWD <out>` (absolutní cesta repa).
- Screenshoty číst jen jako výřezy/koláže (`montage` s `file[WxH+0+0]`), šetřit kontext.
