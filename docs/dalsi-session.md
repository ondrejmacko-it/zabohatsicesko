# Navazující relace (stav 28. 11. 2026, relace 100)

Cíl: bezpečné, opakovatelné živé ověření PR #97 před mergem (testovací prostředí, živé scénáře proti Google
Kalendáři, vizuální ověření 320–3440 px v Chromiu, WebKitu a Firefoxu, report nálezů). Bez redesignu, merge,
produkčního deploye, produkční DB, Make a změn živé konfigurace bez souhlasu vlastníka. Tajemství nevypisovat.
Report vlastníkovi poslat až v poslední relaci.

Větev `claude/gallant-knuth-ydgzxz` (souběžné relace: před prací `git fetch` + ff/merge). PR #97 (větev
`claude/oprava-kalendare-a-prehled-ucasti`) je draft, nic do něj nepushovat bez souhlasu.
Vercel: tým `team_PtkXmFd9hI7UeUYovGkbwZQG`, projekt `prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`.
## Hotovo
- Report `docs/report-zive-overeni-pr97.md` je kompletní: K1–K9, návrh izolovaného testu, scénáře,
  vizuální ověření Chromium + Firefox + WebKit (shodně jen V1), návrh vizuální regrese, souhrn
  ověřeno/simulováno/předpoklad/neověřeno. Souhrn a otázky poslány vlastníkovi.
- `scripts/vizualni-sada.mjs` ignoruje ikonová tlačítka bez textu (falešný „uříznutý text“).

## Další krok
Čekat na rozhodnutí vlastníka (otázky níže). Po schválení: izolovaný test podle reportu, případně oprava V1
(obal `table-scroll` v `ucast/page.tsx` + geometrický test bez vodorovného posunu na 768/1024 px).


## Technika
- NEPOUŽÍVAT prettier. Celá e2e ~17 min. Výpis env z Vercelu zpracovat skriptem (jen klíč, cíl, větev, typ).

## Otevřené otázky pro vlastníka
- Schválení izolovaného testu (testovací větev, branch-scoped proměnné, Neon větev schema-only, redirect URI).
- Které testovací účty Google smím použít (správce, 2 členové)?
- Nastavit `CRON_SECRET` v Production (K1) a secrets GitHub plánovače (K8)?
- Opravit V1 v PR #97, nebo samostatně?
