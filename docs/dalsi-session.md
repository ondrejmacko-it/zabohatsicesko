# Navazující relace (stav 28. 11. 2026, relace 97)

Cíl: připravit bezpečné, opakovatelné živé ověření PR #97 před mergem (testovací prostředí, živé scénáře
proti skutečnému Google Kalendáři, vizuální ověření 320–3440 px v Chromiu, WebKitu a Firefoxu, report nálezů).
Bez redesignu a velkých UI změn. Bez merge, deploye do produkce, produkční DB, Make a změn živé konfigurace
bez výslovného souhlasu vlastníka. Tajemství nečíst ani nevypisovat.

Větev `claude/gallant-knuth-ydgzxz` = HEAD PR #97 `e3c92b3` + report. PR #97 (větev
`claude/oprava-kalendare-a-prehled-ucasti`) je draft, nic do něj nepushovat bez souhlasu.
Vercel: tým `team_PtkXmFd9hI7UeUYovGkbwZQG`, projekt `prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`.
Preview PR #97: `zbc-vzdelavani-demo-eedvobxq1-maci.vercel.app` (demo, simulace, účast vypnutá).

## Hotovo
- Report `docs/report-zive-overeni-pr97.md`: K1–K9 (K8 GitHub plánovač nenastavený a běží jen 2–4× denně,
  K9 Neon `main` = produkční větev, test jen schema-only). Body 1 a 2 předchozí předávky hotové.
- WebKit a Firefox: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install webkit firefox` (v novém
  kontejneru zopakovat, ~1 min). Skript `scripts/vizualni-sada.mjs` (3 prohlížeče × 10 šířek × role, automatické
  kontroly přetečení/uříznutí/konzole, JPEG; WebKit přes vlastní TLS proxy 3411/3413).
- Zkušební běh Chromium 390: kandidáti „přetéká fieldset.filter-group“ (plán, moje cesta) a „uříznutý label
  Přepnout ukázkovou roli“ – pravděpodobně skrytý panel / sr-only, OVĚŘIT na screenshotu, nezapisovat naslepo.

## Další krok
1. `npm ci`, instalace prohlížečů, `E2E_WEBKIT=1 node e2e/server.mjs` na pozadí, pak po prohlížečích
   `PROHLIZEC=chromium node scripts/vizualni-sada.mjs . <scratchpad>/out` (potom firefox, webkit).
2. Prohlížet koláže (`montage` je k dispozici: jedna stránka × 10 šířek na obrázek, malé rozlišení), ne stovky
   souborů. Falešné kandidáty odfiltrovat úpravou kontroly ve skriptu, skutečné nálezy do reportu (reprodukce,
   příčina, závažnost, minimální oprava).
3. Návrh udržitelné vizuální regrese (`toHaveScreenshot`, pevný seed a DEMO_CLOCK, jen pár stránek) do reportu.
4. Dokončit report (ověřeno/simulováno/předpoklad/neověřeno), pak poslat vlastníkovi souhrn a otázky.

## Technika
- NEPOUŽÍVAT prettier. e2e server jede nad buildem (`npx next build`). Celá e2e ~17 min.
- Výpis env proměnných z Vercelu je velký: zpracovat skriptem, vypsat jen klíč, cíl, větev, typ.

## Otevřené otázky pro vlastníka
- Schválení izolovaného testu (testovací větev, branch-scoped proměnné, Neon větev, redirect URI).
- Které testovací účty Google smím použít (správce, 2 členové)?
- Nastavit `CRON_SECRET` v Production (K1)?
