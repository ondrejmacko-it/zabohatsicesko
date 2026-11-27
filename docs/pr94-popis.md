## Shrnutí

Dokončení UI účasti (zadání vlastníka 26. 11., body 1–10) a finální kontrola. Karta „Tvoje účast“ je samostatná
karta až po obsahu akce, dialog omluvy je zkrácený, Kalendář se popisuje jako stav synchronizace a štítky stavu
jsou sjednocené. Navíc C04/C05 (nadřízení). Produkce, Neon ani Google pozvánky se v PR nemění.

## Opravy

| # | Pr. | Oprava | Hlavní soubory |
|---|---|---|---|
| 1 | P0 | Okno akce: vlastní účast a správa omluv až po údajích akce, mimo `<form>` editace. Změna účasti neuloží editaci, rozpracovaná editace se nezahodí. | `EventDialog.tsx`, `EventPeek.tsx`, `Schedule.tsx` |
| 2 | P0 | Karta „Tvoje účast“: nadpis, jeden štítek v hlavičce, jedna věta, akce vpravo (mobil zalomí), info o Kalendáři, podbarvení stávajícími tokeny podle stavu. Barva není jediný nositel významu. | `ParticipationPanel.tsx`, `globals.css` |
| 3 | P0 | Dialog omluvy: Nemoc / Dovolená / Jiné, nepovinná poznámka, Zpět + Omluvit se. Text: „Důvod a poznámku vidíš ty a tvůj oprávněný nadřízený. Do Google Kalendáře se neposílají.“ Omluva platí hned. | `ParticipationPanel.tsx`, `actions.ts` |
| 4 | P0 | Kalendář: synchronizováno / čeká / selhalo / stav neznámý, žádný slib doručení pozvánky. | `src/lib/calendar-note.ts`, `tests/kalendar-f04.test.ts` |
| 5 | P1 | Jednotný `StatusBadge` (Úvod, měsíc, seznam, detail, okno akce, náhledy). Životní stav akce je oddělený od osobní účasti, štítky se neopakují. `ParticipationBadge` odstraněn. | `StatusBadge.tsx`, `status.ts`, `akce/[id]/page.tsx` |
| 6 | P1 | Náhled 1:1: stejné komponenty, v náhledu osoby jsou tlačítka zamčená (ne odstraněná), náhled skupiny ukazuje jen stav z rolí, serverový zákaz mutací zůstává. | `ParticipationPanel.tsx`, `tests/audit-ucast-nahledy.test.ts` |
| 7 | P1 | Nová matice F01–F18 a aktuální věty o Kalendáři u F04. | `docs/matice-f01-f18.md`, `docs/pozadavky-f01-f18.md` |
| 8 | P0 | E2E: akce se otevře klikem v harmonogramu. Trvalý regresní test hlídá, že karta účasti je až po obsahu akce a dá se doscrollovat do zobrazení. Stavy na 7 šířkách. | `e2e/ucast-karta.spec.ts` |
| 9 | — | C04: nadřízený nesmí být sám sobě (server), vazby se při deaktivaci odeberou. C05: role `vedouci-tymu` zůstává. | `excuse-managers.ts`, `users.ts`, `tests/omluvy-nadrizeny.test.ts` |

Změněné soubory: 25 souborů kódu, testů a dokumentace (+784 / −337) a 48 PNG (`git diff --stat main...HEAD`).

## Screenshoty před / po

Před úpravou (948ea18): `docs/screenshots/ucast-karta/pred/`. Po úpravě: `docs/screenshots/ucast-karta/`.
Každý stav je na 390 a 1280 px: správce povinná, účastník povinná, formulář omluvy, omluveno, před přihlášením,
přihlášeno, potvrzení odhlášení, zrušená, proběhlá, náhled kolegy, náhled skupiny a stránka detailu.
Ostatní šířky (320, 768, 1024, 1440, 1920) e2e kontroluje bez ukládání PNG.

Před úpravou byla karta nad formulářem, bez podbarvení a bez informace o Kalendáři.
„Správce + dobrovolná akce“ v seedu nejde, protože správce je ve všech skupinách.

## Matice F01–F18

Viz [`docs/matice-f01-f18.md`](docs/matice-f01-f18.md). F04 je hotové jen v simulaci, F15 jen heuristikou.
Preview a skutečný Postgres (Neon) jsou ⚠️, dokud neproběhne kontrola níže.

## Testy

- Na cb655cc/15fc144: lint 0 chyb, `tsc` OK, Vitest 69 souborů / 628 testů OK, build OK, `ucast-karta.spec.ts` 15 OK.
- Celá e2e sada na d5379e7 (1767 testů, 12,7 min): **1468 OK, 2 chyby, 291 přeskočeno, 6 nespuštěno**.
  Přeskočené jsou testy omezené na jeden projekt nebo šířku (`test.skip` podle projektu), ne vypnuté testy.
  Chyby se analyzují: `pristupnost.spec.ts:121` (U08, windows-1920) a `ucast.spec.ts:93` (F04, telefon-390).
- Simulace oproti živému testu: Kalendář jen fake Google, živý test čeká na D06.

## Překážky a rizika

| Závažnost | Položka |
|---|---|
| Vysoká (před ostrým provozem) | F04: živý test s Google Kalendářem (doručení, zrušení po omluvě, `declined`) čeká na schválení (D06). Zatím je to jen simulace. |
| Střední | C04: mapování nadřízených a retenci omluv musí určit firma. Wiki si nadřízené nevymýšlí. |
| Střední | F15: anonymizace jmen klientů je jen heuristika. Pravidla musí potvrdit firma. |
| Nízká | Preview zatím nikdo neproklikal (build b9721d8 je READY). Funkční průchody nad skutečným Neonem v této větvi neproběhly. |
| Nízká | Neon branch `zaloha-pred-0015-2026-11-26` a `test-migrace-0015-0019` zůstávají. Smazat je jen se souhlasem vlastníka. |

## Kontrola Preview před merge

1. Otevři preview deployment posledního commitu PR (Vercel, větev `claude/gallant-bohr-m1lyna`, stav READY).
   Ověř, že preview má `PARTICIPATION=on` a vlastní (ne produkční) databázi.
2. Jako **správce**: Harmonogram → klik na povinnou akci. Pořadí: nadpis, stav, obsah, karta „Tvoje účast“,
   správa omluv, možnosti správce. Rozepiš změnu v editaci, změň účast a ověř, že se editace neuložila ani nezahodila.
3. Jako **účastník** (FP nebo RM): povinná akce → Omluvit se → Nemoc + poznámka → Omluvit se. Štítek „Omluven/a“
   se ukáže hned, bez schvalování. Zkontroluj text o soukromí. Pak omluvu zruš.
4. Dobrovolná akce: Přihlásit se → „Přihlášen/a“ → Odhlásit se (s potvrzením). Věta o Kalendáři nesmí slibovat pozvánku.
5. **Náhled kolegy**: stavy podle kolegy, tlačítka zamčená. **Náhled skupiny**: jen stav z rolí. Důvod a poznámka
   omluvy kolegy se nesmí ukázat v HTML (zobrazit zdroj stránky) ani v okně.
6. Zrušená a proběhlá akce: bez akčních tlačítek, štítky odpovídají Plánu i Úvodu.
7. Telefon (390 px): karta se zalomí, nic nepřetéká, dialog omluvy se dá posunout a zavřít.
8. Vercel runtime logy preview: žádná varování `[db]` ani `[ucast]`.
9. Až všechno projde, PR převeď z draftu a mergni ručně. Produkce potom potřebuje redeploy s už nastaveným
   `APPROVED_MIGRATIONS` (0015–0019) a `PARTICIPATION=on`. Rollback: odebrat `PARTICIPATION`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01HpUiruN3Rrrndiui6vsbHL
