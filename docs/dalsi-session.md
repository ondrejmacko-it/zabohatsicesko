# Navazující relace (stav 28. 11. 2026, relace 109)

Cíl: dokončit PR #97, ověřit skutečnou funkčnost (živý Google Kalendář), připravit bezpečné ostré nasazení.
Plné zadání vlastníka (body 1–11) je v promptu navazující relace; drž se ho. Bez merge do main, bez produkčního
deploye, bez změn produkčních proměnných, bez výpisu tajemství, žádné zprávy/pozvánky skutečným zaměstnancům.
Izolovaný živý test SCHVÁLEN, ale testovací Google účty (správce + 2 členové) NEMÁŠ: nevytvářet, vyžádat.

Větve: `claude/gallant-knuth-ydgzxz` = `claude/oprava-kalendare-a-prehled-ucasti` (PR #97 draft), pushuj na obě:
`git push origin HEAD:claude/oprava-kalendare-a-prehled-ucasti HEAD:claude/gallant-knuth-ydgzxz`. Souběžné relace:
vždy `git fetch` + merge. Vercel tým `team_PtkXmFd9hI7UeUYovGkbwZQG`, projekt `prj_MYpwzB5KekzHAVwbiUDrZv6CG12i`.
Neon projekt `neon-zbz-vzdelavani-demo` (main = produkce, NEDOTÝKAT SE).

## Hotovo (relace 109)
- CI PR #97 na 783c592 zelené včetně vizuální regrese 15/15 (46165521065, 46165521067).
- Report kap. 2 a 5/R1 doplněn (0d7cfcd), popis PR #97 aktualizován (draft ponechán).
- Report vlastníkovi a žádost o přístupy (kap. 7 reportu) odeslány v relaci 109.
- Dříve: V1 c5db69d, filtr témat ffcca12, plánovač 739187b, vizuální regrese aa63cb7/783c592, proměnné 430e814.
- Testy: eslint 0, tsc 0, vitest 668/668, build OK, plné e2e 1660/0 failed (kód aplikace od a53c972 beze změny).

## Další kroky
Vše neblokované je hotové. Čeká se na vlastníka (kap. 7 reportu). Po dodání přístupů:
1. Neon schema-only větev, Vercel Preview pro `test/zive-overeni-kalendare` (nesecretní proměnné dle kap. 7).
2. Scénáře kap. 6 přes `scripts/overeni-kalendare-google.ts` (`--sledovat=N` pro latenci), výsledky do reportu.
3. Po testu úklid (proměnné, Neon větev, Git větev, testovací události). Pomocná větev `reference-vizual/pr97`
   ponechána, smazání na vlastníkovi.

## Otevřené otázky
- Hamburger menu na telefonu: ponechána mřížka (původní zadání); potvrdit vlastníkem.

## Technika
- NEPOUŽÍVAT prettier. `npm ci`, `npx next build`. Playwright si server spouští sám.
- Nová relace má hned ~100k+ kontextu ze schémat MCP → kroky malé, předávat brzy.
