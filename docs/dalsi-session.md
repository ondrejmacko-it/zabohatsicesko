# Navazující relace (stav 28. 11. 2026, relace 99)

Cíl: bezpečné, opakovatelné živé ověření PR #97 před mergem (testovací prostředí, živé scénáře proti Google
Kalendáři, vizuální ověření 320–3440 px v Chromiu, WebKitu a Firefoxu, report nálezů). Bez redesignu, merge,
produkčního deploye, produkční DB, Make a změn živé konfigurace bez souhlasu vlastníka. Tajemství nevypisovat.
Report vlastníkovi poslat až v poslední relaci.

Větev `claude/gallant-knuth-ydgzxz` (souběžné relace: před prací `git fetch` + ff/merge). PR #97 (větev
`claude/oprava-kalendare-a-prehled-ucasti`) je draft, nic do něj nepushovat bez souhlasu.
Vercel: tým `team_PtkXmFd9hI7UeUYovGkbwZQG`, projekt `prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`.

## Hotovo
- Report `docs/report-zive-overeni-pr97.md`: K1–K9 (konfigurace), návrh izolovaného testu, scénáře,
  nově sekce „Vizuální ověření“ s V1 (tabulka Účasti přetéká na 768/1024 px, ověřeno na screenshotu).
- Chromium celá sada proběhla (2,5 min). `scripts/vizualni-sada.mjs` už nehlásí visually-hidden, zavřené
  `<details>` ani 404 na `/neexistuje`. Skript chce ABSOLUTNÍ cestu repa: `node scripts/vizualni-sada.mjs $PWD <out>`.

## Další krok
1. Příprava (~5 min): `npm ci`; `npx playwright install-deps webkit firefox`;
   `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install webkit firefox`;
   `E2E_WEBKIT=1 nohup node e2e/server.mjs >log &`; čekat na HTTP 200 portů 3310, 3311, 3313 (jen kód, ne tělo).
2. Zbývající kandidát Chromia: „uříznutý text button:Možnosti akce …“ / „Možnosti účtu …“ (ikonová tlačítka
   ⋯ v plánu a Správě, všechny šířky). Nejspíš falešný (scrollWidth ikony) – ověřit na výřezu screenshotu,
   pak kontrolu ve skriptu zúžit (např. ignorovat tlačítka bez textového obsahu).
3. `PROHLIZEC=firefox`, pak `webkit`: porovnat `nalezy.txt` s Chromiem, prohlížet jen odlišné kandidáty
   a koláže (`montage`, malé rozlišení). Screenshoty jsou velké – číst jen výřezy/zmenšeniny (šetřit kontext).
4. Do reportu: návrh udržitelné vizuální regrese (`toHaveScreenshot`, pevný seed a DEMO_CLOCK, 4–5 stránek ×
   3 šířky, jen Chromium v CI, WebKit/Firefox ručně před releasem), shrnutí ověřeno/simulováno/předpoklad/neověřeno.
5. Poslat vlastníkovi souhrn a otázky (níže).

## Technika
- NEPOUŽÍVAT prettier. Celá e2e ~17 min. Výpis env z Vercelu zpracovat skriptem (jen klíč, cíl, větev, typ).

## Otevřené otázky pro vlastníka
- Schválení izolovaného testu (testovací větev, branch-scoped proměnné, Neon větev schema-only, redirect URI).
- Které testovací účty Google smím použít (správce, 2 členové)?
- Nastavit `CRON_SECRET` v Production (K1) a secrets GitHub plánovače (K8)?
- Opravit V1 v PR #97, nebo samostatně?
