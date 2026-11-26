# Report: finální dokončení po PR #92

Větev `claude/festive-sagan-lilorz` z `main` 2703a0b (PR #92, produkce). Stav 26. 11. 2026. Nic se nemergovalo,
nenasazovalo ani nespouštělo proti produkční DB. Produkce Vercel a Neon jen čtení. Google jen simulace.

## A. Nálezy a opravy

Závažnost: **vysoká** = chyba dat nebo pád v produkci, **střední** = únik soukromých údajů nebo špatné chování
funkce, **nízká** = UX, texty, testy.

| ID | Problém | Příčina | Soubor | Závažnost | Oprava | Důkaz |
|---|---|---|---|---|---|---|
| C01 | Uložení účtu ve Správě padá na DB se schématem 0001–0014 (produkce) | `requeueAttendeeSync` vždy četl `event_participation` (0016) | `src/server/calendar/attendees.ts` | vysoká | bez `PARTICIPATION=on` se tabulka nečte | a029755, `tests/c01-ucast-bez-schematu.test.ts` (PGlite 0001–0014) |
| C02 | Účast zapnutá nad chybějící tabulkou po selhání seedu | `markParticipationSchema` uvnitř transakce migrací | `src/server/db/client.ts` | vysoká | stav schématu až po commitu | e1f654d, `tests/c02-schema-po-commitu.test.ts` |
| C03 | Důvod omluvy by odešel na snímku zpětné vazby | chybělo `data-feedback-redact` | `ParticipationPanel.tsx`, `ManagedExcuses.tsx` | střední | důvod a poznámka začerněné | 910e0dc, `tests/c03-redakce-omluv.test.ts` |
| C04 | Nadřízený viděl historické omluvy (zrušená akce, neaktivní účet, zaniklá povinnost) | `managedExcusesAt` nefiltroval podle stavu účasti | `src/server/services/excuse-managers.ts` | střední | jen platné omluvy podle `participationState` | 8e78cea, f3b85cf, `tests/omluvy-nadrizeny.test.ts` |
| C05 | `vedouci-tymu` se při uložení účtu může ztratit | jen zjištění | – | nízká | čeká na rozhodnutí (doporučení: zachovat) | otázka E |
| C06 | Formulář zápisu sliboval „AI bez trénování“, žádná AI se nevolá | text neodpovídal implementaci | `MinutesSourceForm.tsx`, `docs/integrace-do-firemni-wiki.md` | střední | text: lokální šablona, heuristické vynechání jmen | e4b6a8f, `e2e/zapisy-schvaleni.spec.ts` |
| B1 | Výpadek sítě u účasti skončil chybovou stránkou | nechycená síťová chyba serverové akce | `src/components/ActionForm.tsx`, `ParticipationPanel.tsx` | střední | zpráva u tlačítka bez slibu uložení | 0db222c, `tests/sit-akce.test.ts` |
| B2 | Garantovaných témat šlo jen omezený počet, e2e nestabilní | limit priorit (0015), závod v testu | `e2e/temata-planovani.spec.ts` | nízká | neomezený počet, ověření po každém návrhu | 15728d2, 0db222c |
| D | Náhled role nebyl 1:1 (nástroje skryté místo zamčených), server mutace v náhledu | podmínky `organizer && !preview` | `PreviewLock.tsx`, stránky Plánu, akce, Témat, Zápisů, Správy | střední | nástroje vidět zamčené, server vrací `preview_read_only` | 59a1147, 4a754a1–db78199, `tests/nahled-mutace.test.ts`, `e2e/nahled-role.spec.ts` |
| E | Hromadný výběr nevysvětlil rozpad a držel výběr přes změnu kontextu | chyběl rozpad a reset | `PlanSelection.tsx` | nízká | štítek s rozpadem, reset podle měsíce a filtrů, verze návrhu | abb7f96, 6aa27c6, `e2e/vyber-kontext.spec.ts` |
| F | Zápisy K dokončení nepřehledné, upozornění na citlivá data pod polem | rozvržení | `zapisy/page.tsx`, `TasksCard` | nízká | mřížka se stavem, souhrnný úkol nad limit 4 | 82be4a1, d39fd02, b15660a, d989390 |
| G | Lišta, Domů, dialogy, texty (D03 oslovení) | rozvržení a chybějící funkce | `zahlavi`, `page.tsx`, dialogy, migrace 0019 | nízká | G1–G5 | a93f0fb, 008c3e2, 7dbf96d, 76a1bab, bd3cf7e, `e2e/osloveni` |
| H | Témata bez hledání, barvy účasti | – | Témata, Harmonogram | nízká | hledání bez diakritiky, prázdný měsíc | d7fe624, b130183 |
| I1 | Rollback `PARTICIPATION` by znovu pozval omluvené a odebral přihlášené | hosté se počítali jen z publika | `src/server/calendar/attendees.ts` | vysoká | akce s uloženou účastí se řídí záznamy | 0889e6a, `tests/kalendar-ucast.test.ts` |
| I2 | Po aktivaci účasti se vydané pozvánky nepřepočítají | chyběl řízený postup | `src/server/calendar/activation.ts`, `scripts/kalendar-migrace.ts` | střední | inventura s otiskem, dávková synchronizace | 3463545, `docs/kalendar-migrace.md` |
| K1 | Tlačítko K dokončení v Zápisech nesplnilo axe (kontrast, název) | barva, `aria-label` jiný než text | `zapisy/page.tsx`, `globals.css` | nízká | kontrast, název podle textu | 51b2195 |
| K2 | Náhled Domů neukazoval formulář oslovení (není 1:1) | formulář skrytý v náhledu | `SalutationForm.tsx`, `osloveni-actions.ts` | nízká | zamčený formulář, server zápis odmítne | 3d4967a |
| K3 | Změna filtru v Plánu zavřela nabídku Filtry | přemontování výběru klíčem | `harmonogram/page.tsx`, `PlanSelection.tsx` | nízká | reset výběru bez přemontování | b1b8f24 |
| K4 | E2E závislé na pořadí (omluva bez úklidu) | test soukromí omluvy nechal omluvu | `e2e/ucast.spec.ts` | nízká | test omluvu po sobě zruší | 7dc9c8c |
| K5 | Smoke E2E neblokoval CI | – | `.github/workflows`, `@smoke` | nízká | job `e2e-smoke` (windows-1280, telefon-390, zápis témat) | ab1a2dc, d74a280 |

## B. Matice F01–F18

Sloupce: **Impl.** stav implementace · **Lokálně** unit + e2e na ukázce · **Preview** · **Produkce** · **Omezení** ·
**Chybí schválení**. Testy ke každému bodu: `docs/pozadavky-f01-f18.md` (tabulka testů).
Preview: běží nad sdílenou ukázkovou DB bez účasti, izolované ověření účasti **čeká na `DATABASE_URL`** (tajemství
nastavuje vlastník). Produkce = PR #92 (2703a0b), `PARTICIPATION` nenastaveno, DB 0001–0014.

| Bod | Impl. | Lokálně | Preview | Produkce | Omezení | Chybí schválení |
|---|---|---|---|---|---|---|
| F01 Pro koho (FP/RM/všichni) i v přípravě měsíce | hotovo | OK | pole Pro koho ano; povinnost čeká na `DATABASE_URL` | pole ano, povinnost se neprojeví (bez účasti) | – | migrace 0016–0017, `PARTICIPATION` |
| F02 štítky, přepínač Moje/Všechny | hotovo | OK | čeká na `DATABASE_URL` | skryté (bez účasti) | – | totéž |
| F03 Omluvit se / Přihlásit / Odhlásit | hotovo | OK | čeká na `DATABASE_URL` | skryté | nadřízený potřebuje 0018 a mapování od firmy | totéž + 0018, mapování nadřízených |
| F04 Kalendář přes pozvánky | hotovo | OK jen **simulace** | simulace | `google-test`, účast vypnutá | živý Google neověřen | D06, živý test na testovacím kalendáři |
| F05 víc rolí = povinné všech rolí | hotovo | OK | čeká na `DATABASE_URL` | skryté | – | jako F01 |
| F06 jedno Připravit měsíc | hotovo | OK | nasazeno v Preview | v produkci (PR #92) | – | – |
| F07 průvodce tři kroky, jedno Zavřít | hotovo | OK | ano | ano | – | – |
| F08 hromadné doplnění tématu | hotovo | OK | ano | ano | – | – |
| F09 proč je Zveřejnit šedé | hotovo | OK | ano | ano | – | – |
| F10 filtr Pro mou roli / Všechna | hotovo | OK | ano | ano | – | – |
| F11 pořadí témat mění jen správce | hotovo | OK | ano | ano (0015 neomezené priority čeká) | – | 0015 |
| F12 texty témat | hotovo | OK | ano | ano | – | – |
| F13 kdo zápis schvaluje / píše | hotovo | OK | ano | ano | – | – |
| F14 méně voleb, nahrávka skrytá | hotovo | OK | ano | ano | nahrávka čeká na integraci | – |
| F15 jména klientů vynechat | hotovo | OK | ano | ano | **heuristika**, ne záruka; AI se nevolá | smluvní garance AI služby |
| F16 náhled kolegy | hotovo (D: 1:1) | OK | ano | starší verze (bez D) | – | – |
| F17 oslovení jménem | hotovo | OK | ano | ano; vlastní oslovení (D03) až s 0019 | – | 0019 |
| F18 účet na jednom řádku | hotovo | OK | ano | ano | – | – |

„Preview ano“ = funkce je součástí této větve a bez účasti nezávisí na nové DB; živé proklikání Preview této větve
zatím neproběhlo (viz C).

## C. Ověření

| Kontrola | Výsledek | Commit |
|---|---|---|
| Lint (`npm run lint`) | OK | deee432 |
| Typy (`npm run typecheck`) | OK | deee432 |
| Build (`npm run build`) | OK (`next build`) | deee432 |
| Unit (`vitest run`) | OK, 69 souborů / 621 testů | deee432 |
| E2E celá sada (všechny projekty) | OK, 1469 passed / 256 skipped / 0 failed (12,0 min, 3 workery) | deee432 |
| Smoke E2E v CI (`e2e-smoke`) | blokující job v CI | ab1a2dc |
| Bezpečnost | náhled odmítne všechny serverové akce (`tests/nahled-mutace.test.ts`); soukromí omluv (C03, C04); `npm audit`: `--omit=dev` 0 zranitelností | – |
| Migrace | 0015–0019 `approval: true`, na vzdálené DB jen přes `APPROVED_MIGRATIONS`; unit testy na PGlite 0001–0019 | – |
| Skutečný PostgreSQL | Neon branch `overeni-ucast-0016-0018` (fiktivní data): 0016–0018 + SQL kontroly prošly; **0019 jen PGlite** | `scripts/overeni-ucasti-db.ts` |
| Google Kalendář | simulace (F04, I1, I2 unit testy); živý test **neschválen, neproběhl** | – |

## D. Screenshoty

Prostředí: lokální produkční build (`node e2e/server.mjs`), fiktivní seed v PGlite, referenční čas 12. 11. 2026 9:00, Chromium 1280×800 (mobil 390×844, isMobile). Snímky 04–11 na serveru s `PARTICIPATION=on` (účast ještě není zapnutá na Preview ani v produkci). Commit deee432. Složka `docs/screenshots/finalni-dokonceni/`.

| Soubor | Co ukazuje | Prostředí | Commit |
|---|---|---|---|
| `01-domu-ucastnik.png` | Domů, účastník FP | lokální | deee432 |
| `02-domu-spravce.png` | Domů, správce | lokální | deee432 |
| `03-horni-lista.png` | Horní lišta (účastník) | lokální | deee432 |
| `04-povinna-omluvit-se.png` | Povinná akce s tlačítkem Omluvit se | lokální, PARTICIPATION=on | deee432 |
| `05-formular-omluvy.png` | Formulář omluvy (důvod, poznámka, soukromí) | lokální, PARTICIPATION=on | deee432 |
| `06-omluveno.png` | Omluveno ve Wiki | lokální, PARTICIPATION=on | deee432 |
| `07-dobrovolna-prihlasit-se.png` | Dobrovolná akce s tlačítkem Přihlásit se | lokální, PARTICIPATION=on | deee432 |
| `08-prihlaseno.png` | Přihlášeno | lokální, PARTICIPATION=on | deee432 |
| `09-odhlaseno.png` | Odhlášeno (lze se znovu přihlásit) | lokální, PARTICIPATION=on | deee432 |
| `10-nahled-osoby-povinna.png` | Náhled osoby (správce → účastník FP): povinná, tlačítka zamčená | lokální, PARTICIPATION=on | deee432 |
| `11-nahled-osoby-dobrovolna.png` | Náhled osoby: dobrovolná, tlačítka zamčená | lokální, PARTICIPATION=on | deee432 |
| `12-navrh-zmeny.png` | Návrh změny zveřejněné akce v mřížce (ev-11-26) | lokální | deee432 |
| `13-vysunuty-original.png` | Najetí myší vysune zveřejněnou verzi (originál) | lokální | deee432 |
| `14-vybrat-navrhy.png` | Režim Vybrat návrhy | lokální | deee432 |
| `15-garantovana-temata-5.png` | Pět garantovaných témat (bez limitu) | lokální | deee432 |
| `16-zapisy.png` | Zápisy (správce) | lokální | deee432 |
| `17-mobil-390-domu.png` | Mobil 390: Domů | lokální | deee432 |
| `18-mobil-390-plan.png` | Mobil 390: Plán | lokální | deee432 |

## E. Co zbývá

Jen schválení a rozhodnutí, kód je hotový.

- **Schválení vlastníka:** merge PR do `main` (= produkční nasazení); migrace 0015–0019 v produkci; `PARTICIPATION=on`;
  otisk `aktivace-ucasti`; živé pozvánky (D06).
- **Tajemství:** Preview `DATABASE_URL` izolovaného branche → pak živé ověření účasti a garantovaných témat na Preview.
- **Rozhodnutí firmy:** mapování nadřízených pro omluvy, doba uchování omluv; C04 – smí si správce nastavit sebe
  jako nadřízeného kohokoli a číst důvody (doporučení: zakázat); mazat vazby po deaktivaci nadřízeného?;
  C05 `vedouci-tymu` (doporučení: zachovat při uložení účtu).
- **Chybějící integrace:** živý Google Kalendář (testovací kalendář + účty), nahrávky a přepis, AI služba pro zápisy.
- **Neověřená produkce:** účast, nadřízení, oslovení D03 a synchronizace pozvánek v produkci neběžely.
- **Rizika:** vynechání jmen klientů je heuristické (F15); 0019 neověřena na skutečném PostgreSQL; první
  synchronizace pozvánek po aktivaci mění hosty reálných akcí – proto dávky po 20 a otisk.

## L. Schvalovací checklist pro release (nic z toho neproběhlo)

| # | Krok | Změna | Účel | Riziko | Následek selhání / návrat |
|---|---|---|---|---|---|
| 1 | Ověřit nasazení | žádná; zapsat produkční nasazení `2703a0b` (PR #92) a starší `a30605c` (PR #91) | bod pro rollback | žádné | – |
| 2 | Záloha DB | Neon `zbc-wiki-produkce` → branch snapshot (DB má 0001–0014) | návrat dat | žádné | bez zálohy nelze vrátit data po migracích |
| 3 | Merge PR | Create a merge commit → automatický produkční deploy | nový kód bez účasti | regrese UI | Instant Rollback na `2703a0b`, DB beze změny |
| 4 | Migrace | `APPROVED_MIGRATIONS=0015…0019` (ID v `src/server/db/migrations.ts`) + redeploy | tabulky účasti, nadřízených, oslovení, priority | migrace selže při startu | transakce se vrátí (C02), funkce zůstanou vypnuté; obnova ze snapshotu |
| 5 | Kontrola | `SELECT id FROM schema_migrations ORDER BY id` (jen čtení) | potvrdit 0015–0019 | – | při chybějícím ID nepokračovat |
| 6 | Inventura | `npx tsx scripts/kalendar-migrace.ts aktivace-ucasti` → počty + otisk | vědět, kolik hostů se změní | žádné (Google se nevolá) | otisk schvaluje vlastník |
| 7 | Zapnout účast | `PARTICIPATION=on` + redeploy | štítky, omluvy, přihlášky | lidé uvidí povinnosti | Integrace musí ukázat „zapnuto“; jinak smazat proměnnou |
| 8 | Nadřízení | ve Správě nastavit mapování (dodá firma) | omluvy vidí správný nadřízený | únik důvodů nesprávné osobě | upravit mapování; audit zapisuje |
| 9 | Synchronizace | `synchronizovat-ucast --provest <otisk> --davka 20`, opakovat do `remaining` 0 | přepočet pozvánek | změna hostů reálných akcí | dávky, `attention` ručně; omluveným se nenastavuje `declined` |
| 10 | Smoke + rollback | proklikat Plán, akci, omluvu, přihlášku, Správu → Integrace | potvrdit produkci | – | Instant Rollback; `PARTICIPATION` smazat; migrace jen přidávají; hosté akcí s uloženou účastí se nemění (I1) |

Podrobný postup: `docs/navod-merge-f01-f18.md`, `docs/kalendar-migrace.md` (Aktivace účasti).
