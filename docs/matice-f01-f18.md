# Matice F01–F18 (PR #94, 27. 11. 2026)

Sestaveno z `docs/pozadavky-f01-f18.md` a ze stavu kódu a testů na větvi `claude/gallant-bohr-m1lyna`.
Unit = `tests/` (Vitest nad PGlite, vestavěným PostgreSQL ve WASM), e2e = `e2e/` (Playwright, produkční build
nad vlastní PGlite, `PARTICIPATION=on`). Vizuálně = screenshoty nebo ruční průchod v e2e.

Sloupce: **Impl.** implementováno v kódu · **Auto** automatický test · **Viz.** vizuálně ověřeno ·
**PG** skutečný PostgreSQL · **Preview** Vercel preview PR #94 · **Prod.** produkce · **Čeká** na integraci nebo firmu.

Legenda: ✅ ano · ⚠️ částečně · ❌ ne · — netýká se.

- **PG:** všechny body běží v testech nad PGlite 0.5 (PostgreSQL ve WASM). Migrace 0015–0019 navíc prošly na kopii
  produkční databáze v Neonu (PG 18, branch `test-migrace-0015-0019`). Funkční průchody na skutečném Neonu
  v této větvi neproběhly, proto ⚠️.
- **Preview:** deployment `dpl_9da2u3g5bBVGmQCv87bRn6oMmiLK` (commit b9721d8) je READY. Ruční proklikání
  je v postupu kontroly před merge, zatím neproběhlo, proto ⚠️.
- **Prod.:** produkce běží na main 76c2011 (PR #93). Úpravy z PR #94 (karta účasti, dialog omluvy, věty o Kalendáři,
  StatusBadge) tam ještě nejsou.

| Bod | Obsah | Impl. | Auto (unit / e2e) | Viz. | PG | Preview | Prod. | Čeká |
|---|---|---|---|---|---|---|---|---|
| F01 | Pro koho: Všichni / FP / RM, povinnost podle role | ✅ | `priprava-mesice.test.ts`, `ucast-role.test.ts` / `okna.spec.ts` | ✅ | ⚠️ | ⚠️ | ✅ | — |
| F02 | Viditelnost zveřejněných akcí, přepínač Moje/Všechny, štítky | ✅ | `ucast-role.test.ts`, `ucast-prihlasky.test.ts` / `ucast.spec.ts` | ✅ | ⚠️ | ⚠️ | ✅ (bez PR #94) | — |
| F03 | Přihlášení, odhlášení, omluva s důvodem, soukromí, souběh | ✅ | `ucast-prihlasky.test.ts` / `ucast.spec.ts`, `ucast-karta.spec.ts` | ✅ 24 PNG | ⚠️ | ⚠️ | ✅ (bez PR #94) | retence omluv (firma) |
| F04 | Kalendář podle povinnosti, omluvy a přihlášky | ✅ **jen simulace** | `kalendar-f04.test.ts`, `kalendar-ucast.test.ts` (vč. `calendarNote`, fake Google) / `ucast.spec.ts` › F04 | ✅ | ⚠️ | ⚠️ | osobní kalendáře | živý Google test (D06) |
| F05 | Víc pracovních rolí (FP+RM, vedoucí) | ✅ | `ucast-role.test.ts` / `ucast.spec.ts` › F05 | ✅ | ⚠️ | ⚠️ | ✅ | mapování nadřízených (C04) |
| F06 | Jedno hlavní tlačítko Připravit měsíc | ✅ | `priprava-mesice-f06-f09.test.ts` / `priprava-mesice-f06-f09.spec.ts` | ✅ | ⚠️ | ⚠️ | ✅ | — |
| F07 | Průvodce se třemi kroky, jedno Zavřít | ✅ | tamtéž | ✅ | ⚠️ | ⚠️ | ✅ | — |
| F08 | Hromadné doplnění tématu, filtr Chybí téma | ✅ | tamtéž › F08 / `priprava-mesice-f06-f09.spec.ts:67`, `:93` | ✅ | ⚠️ | ⚠️ | ✅ | — |
| F09 | Proč je Zveřejnit šedé, potvrzení | ✅ | tamtéž › F09 | ✅ | ⚠️ | ⚠️ | ✅ | — |
| F10 | Témata: filtr Pro mou roli / Všechna | ✅ | `temata-f10-f12.test.ts` / `temata-planovani.spec.ts`, `ucast.spec.ts` | ✅ | ⚠️ | ⚠️ | ✅ | — |
| F11 | Pořadí témat mění jen správce | ✅ | tamtéž | ✅ | ⚠️ | ⚠️ | ✅ | — |
| F12 | Texty témat bez „zatím neproběhlo“ | ✅ | tamtéž | ✅ | ⚠️ | ⚠️ | ✅ | — |
| F13 | Kdo zápis schvaluje, úkol napsat zápis | ✅ | `zapisy-f13-f15.test.ts`, `zapisy-schvaleni.test.ts` / `zapisy-schvaleni.spec.ts` | ✅ | ⚠️ | ⚠️ | ✅ | — |
| F14 | Méně voleb, nahrávka skrytá | ✅ | `zapisy-f13-f15.test.ts` / `zapisy-bez-nahravky.spec.ts` | ✅ | ⚠️ | ⚠️ | ✅ | nahrávky (integrace) |
| F15 | Jména klientů vynechat, AI bez trénování | ⚠️ **jen heuristika** | `zapisy-f13-f15.test.ts` / `zapisy-bez-nahravky.spec.ts` | ✅ | — | ⚠️ | ✅ | skutečné AI a firemní pravidla anonymizace |
| F16 | Náhled kolegy s jeho oprávněními | ✅ | `nahled.test.ts` / `nahled.spec.ts`, `nahled-role.spec.ts`, `ucast-karta.spec.ts` (náhled 1:1) | ✅ | ⚠️ | ⚠️ | ✅ (bez PR #94) | — |
| F17 | Oslovení jménem (5. pád, neutrální Ahoj) | ✅ | `osloveni.test.ts` / `osloveni.spec.ts:7`, `domu-ukoly.spec.ts` | ✅ | ⚠️ | ⚠️ | ✅ | — |
| F18 | Horní lišta na jednom řádku | ✅ | — / `zahlavi.spec.ts:23`, `nahled.spec.ts:221` | ✅ | — | ⚠️ | ✅ | — |

## Vybrané scénáře

| Scénář | Test | Stav |
|---|---|---|
| ≥5 garantovaných témat přes UI + obnovení stránky | `temata-planovani.spec.ts:444` (3. až 6. téma, pořadí, odebrání, přetrvání po reloadu, migrace 0015); unit `temata-priority.test.ts:226`, `:240` (neomezeně, souběh) | ✅ |
| Animace původní verze při najetí na návrh | `priprava-mesice.spec.ts:275` (najetí ukáže původní verzi, z-index, průhlednost návrhu; při `reduced-motion` bez animace) | ✅ |
| Hromadný výběr návrhů | `priprava-mesice.spec.ts:142`; souběh výběru `vyber-kontext.spec.ts:75`; `vyber-navrhu.spec.ts` | ✅ |
| Kolize v přípravě měsíce | `priprava-mesice.spec.ts:17` (kolize říká, s jakou akcí a kdy); unit `obsazeni-terminu.test.ts`, `doplneni-mesice-scenare.test.ts:48` | ✅ |
| Zápisy a schvalování | `zapisy-schvaleni.spec.ts:12`, `zapisy.spec.ts:8`; unit `zapisy-schvaleni.test.ts` | ✅ |
| Filtry a počítadla | `plan-planovani.spec.ts:148`, `harmonogram-rozlozeni.spec.ts:87`, `mobilni-ovladani.spec.ts:312` | ✅ |
| Oslovení | `osloveni.spec.ts:7` | ✅ |
| Horní lišta | `zahlavi.spec.ts:23`, `nahled.spec.ts:221` | ✅ |
| Mobil | `mobilni-ovladani.spec.ts`, projekt `telefon-390`, `ucast-karta.spec.ts` (šířky 320–1920) | ✅ |
| Karta „Tvoje účast“ až po obsahu akce | `ucast-karta.spec.ts` (trvalý regresní test) | ✅ |

## Omezení

- **F04** je hotové jen v simulaci (fake Google). Doručení pozvánky, zrušení po omluvě a `declined` (O04) ověří až
  živý test s Googlem, ke kterému je potřeba schválení vlastníka (D06).
- **F15** pozná jména klientů jen heuristikou, ne spolehlivě. Pravidla anonymizace a výběr AI musí potvrdit firma.
- Varianta „správce + dobrovolná akce“ v seedu nejde, protože správce je ve všech skupinách.
