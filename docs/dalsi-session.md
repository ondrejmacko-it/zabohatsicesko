# Navazující relace (stav 28. 11. 2026, relace 96)

Cíl: připravit bezpečné, opakovatelné živé ověření PR #97 před mergem (testovací prostředí, živé scénáře
proti skutečnému Google Kalendáři, vizuální ověření 320–3440 px v Chromiu, WebKitu a Firefoxu, report nálezů).
Bez redesignu a velkých UI změn. Bez merge, deploye do produkce, produkční DB, Make a změn živé konfigurace
bez výslovného souhlasu vlastníka. Tajemství nečíst ani nevypisovat.

Větev `claude/gallant-knuth-ydgzxz` = HEAD PR #97 `e3c92b3` + report. PR #97 (větev
`claude/oprava-kalendare-a-prehled-ucasti`) je draft, nic do něj nepushovat bez souhlasu.
Vercel: tým `team_PtkXmFd9hI7UeUYovGkbwZQG`, projekt `prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`.
Preview PR #97: `zbc-vzdelavani-demo-eedvobxq1-maci.vercel.app` (demo, simulace, účast vypnutá).

## Hotovo
- Konfigurace Vercelu přečtená (jen názvy a cíle), nálezy K1–K7 a návrh izolovaného testu:
  `docs/report-zive-overeni-pr97.md`. Hlavní nález: Production nemá `CRON_SECRET` ani
  `CALENDAR_WORKER_TOKEN`, takže plánovač fronty Kalendáře v produkci nefunguje (401).

## Další krok
1. Ověřit běhy workflow `kalendar-fronta.yml` (GitHub actions_list: „není nastavený“ / HTTP 401?) a doplnit K1.
2. Neon: najít projekt Preview DB (Neon MCP, jen čtení) a ověřit, že jde vytvořit větev schema-only. Nic nezakládat.
3. Vizuální sada lokálně nad buildem: `npx playwright install webkit firefox` (do /opt/pw-browsers), pak
   skript screenshotů v scratchpadu pro šířky 320, 360, 390, 430, 768, 1024, 1280, 1440, 1920, 3440, všechny
   stránky a role (vzor `scripts/audit-screenshoty.mjs`), skutečně prohlédnout, nálezy do reportu.
   `E2E_WEBKIT=1` cíleně na webkit/firefox projekty.
4. Návrh udržitelné vizuální regrese (`toHaveScreenshot`, pevný seed a DEMO_CLOCK, jen pár stránek).
5. Doplnit report a poslat vlastníkovi návod k bodu „Navržený postup“ ke schválení.

## Technika
- NEPOUŽÍVAT prettier. e2e server jede nad buildem (`npx next build`). Celá e2e ~17 min.
- Výpis env proměnných z Vercelu je velký: zpracovat skriptem, vypsat jen klíč, cíl, větev, typ.

## Otevřené otázky pro vlastníka
- Schválení izolovaného testu (testovací větev, branch-scoped proměnné, Neon větev, redirect URI).
- Které testovací účty Google smím použít (správce, 2 členové)?
- Nastavit `CRON_SECRET` v Production (K1)?
