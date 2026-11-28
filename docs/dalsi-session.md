# Navazující relace (stav 28. 11. 2026, relace 107)

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
běh 46148649291); vizuální regrese aa63cb7; přímá volání API pokrytá testy (relace 105);
`docs/promenne-prostredi.md` (430e814); skript `scripts/overeni-kalendare-google.ts` (925a1e3, živě nevyzkoušen).
Architektura plánovačů: `after()` + návštěva Wiki, GitHub */10 (nespolehlivý), Vercel cron denně 5:17 → oba ponechat.

## Relace 107
- Test `tests/kalendar-osobni-cteni.test.ts` (listEvents: stránkování, 404/503) – commity aadfec6 + následující.
- Lokálně na HEAD: eslint 0, tsc 0, vitest 668/668, `next build` OK. Plné `npm run e2e`: 1660 passed, 745 skipped, 0 failed (14,8 min).
- CI PR #97 (běh 46163734788): lint/typy/testy/build ZELENÉ, citlivé cesty ZELENÉ, smoke E2E ZELENÉ (9 passed),
  **vizuální regrese 15/15 FAIL**, každý snímek ~1 % pixelů. Příčina: reference vznikly v cloudovém kontejneru,
  CI renderuje na ubuntu-latest jinými systémovými fonty (Playwright 1.63.0 shodně). Není to regrese UI.
  Artefakt `vizualni-rozdily` stáhnout nejde (blob.core.windows.net blokuje proxy).

## Další kroky (malé jednotky, commit + push po každé)
1. Reference snímků z CI runneru: přidat `.github/workflows/vizualni-reference.yml` – trigger `push` na
   `reference-vizual/**` (workflow_dispatch nejde, soubor není na main), `permissions: contents: write`,
   kroky jako e2e-smoke v ci.yml + `npm run e2e:vizual -- --update-snapshots`, pak commit
   `e2e/vizualni.spec.ts-snapshots/*.png` zpět na tu pomocnou větev. Pushnout větev `reference-vizual/pr97`,
   počkat na běh, fetch, 2–3 PNG porovnat (Read) s lokálními, zkopírovat do pracovní větve, push → CI zelené.
   Alternativa bez nového workflow: vlastník stáhne artefakt a commitne `*-actual.png` jako reference.
2. (Plné lokální E2E hotovo v relaci 107, znovu jen po změně kódu.)
3. Přepsat `docs/report-zive-overeni-pr97.md` (85 ř.) do kategorií bodu 11 (odkaz na promenne-prostredi.md a skript,
   scénáře bodu 5 jako Blokované s přesným seznamem, co dodat), aktualizovat popis PR #97.
4. Report vlastníkovi + žádost o oprávnění pro maximální automatizaci (Google testovací účty 3×, testovací OAuth
   klient + redirect URI aliasu, Neon větev, Vercel branch-scoped env, GH vars/secrets, bypass secret, Make,
   povolení hostu blob storage GitHubu pro artefakty).

## Technika
- NEPOUŽÍVAT prettier. `npm ci`, `npx next build`. Playwright si server spouští sám.
- Nová relace má hned ~100k+ kontextu ze schémat MCP → kroky malé, předávat brzy.
