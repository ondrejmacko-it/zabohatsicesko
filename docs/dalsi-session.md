# Prompt pro další session

**#65 PŘIPRAVENÝ KE SLOUČENÍ (18. 11. 2026, relace session_01HpUirxBmt1Vh8n8CDU9bEP).** #67, #63 a #64 jsou v `main`.
Do `claude/final-zapisy-temata` sloučen `origin/main` merge commitem c16a852 (bez konfliktů, bez force). Lokálně: lint, tsc,
unit **279/279**, `npx tsx scripts/audit-plny.ts` projde jen se známou výjimkou GHSA-fc5q-39xc-vjpf (picomatch). Na c16a852
„Citlivé cesty v PR“ zelené a Vercel preview Ready; „Lint, typy, testy a build“ běžel při zápisu. Tento zápis je jen dokumentace.
PR je ještě draft.
**Další krok:** ověřit zelené CI na hlavě PR (oba joby); pak uživatel dá #65 „Ready for review“ a sloučí přes „Create a merge
commit“ a ověří Production nasazení.
Otevřené zůstávají přepis dlouhých nahrávek a ostrý Google Kalendář (beze změny).

**BEZPEČNOSTNÍ ÚPRAVA #67 (18. 11. 2026).** Na pokyn uživatele: plný audit už není `continue-on-error`. #67 (480e814):
`scripts/audit-plny.ts` + `scripts/audit-vyjimky.ts` + `scripts/audit-vyjimky.json` – blokuje vše kromě GHSA-fc5q-39xc-vjpf
v `picomatch` do 31. 12. 2026; chyba auditu blokuje; produkční audit beze změny; testy `tests/audit-vyjimky.test.ts` (7).
Zkušební sloučení #67+#63+#64+#65 bez konfliktu, unit 279/279. Uživatel nechce další funkční ani vizuální úpravy.
**Další krok:** nic bez pokynu; uživatel slučuje #67 → #63 → #64 → #65 (vždy Update branch + zelené CI).

**OVĚŘENÍ PŘED PŘEDÁNÍM HOTOVO (18. 11. 2026, relace session_01HpUiruuQL3xe1DCLQTCGbo).**
* CI #67 zelené (oba joby + citlivé cesty). #63/#64/#65 padají jen na plném `npm audit` (picomatch, dev), vyřeší sloučení #67.
* Popisy #63 (U08 v 1127481) a #64 (U08 hotové, pořadí sloučení) aktualizované.
* Kombinace #63+#64+#65 (`claude/final-zapisy-temata`): lint, tsc, unit **272/272** (+2 testy souběhu hromadného mazání
  v `tests/pevne-svatky.test.ts`, commit 1c99f77), build OK, úplné e2e **918 passed / 42 skipped / 0 failed**.
* Screenshoty 328 (5 rolí + host × 8 šířek) bez vodorovného posunu; prohlédnuté montáže správce 320/1280/1920, role 390,
  vstup 360, RM 768. Nové nálezy: žádné.
* Finální report uživateli odeslán. **Další krok:** nic bez pokynu uživatele. Sloučení: #67 → #63 → (merge main do #64, CI)
  #64 → (merge main do #65, CI) #65. Otevřené zůstávají přepis dlouhých nahrávek a ostrý Google Kalendář.

**FINÁLNÍ SJEDNOCENÍ PŘED PŘEDÁNÍM (18. 11. 2026) – navazuje na FINAL POLISH níže.**
Uživatel 18. 11. potvrdil: všechny 3 věty z `/vstup` pryč (už se neptat). Schválil rozdělení auditu a přenos U08 do #63.
Zákazy: nemergovat do `main`, nepřepínat produkční Kalendář, nerozesílat pozvánky, nemazat produkční data, neměnit tajemství,
žádné placené služby. Neimplementovat znovu hotové funkce, opravovat jen konkrétní nálezy.

**Hotovo v této relaci:**
* **Draft PR [#67](https://github.com/ondrejmacko-it/zabohatsicesko/pull/67)** (`claude/ci-audit-produkce`, base main, 46c2eed): job „Lint, typy,
  testy a build“ má `npm audit --omit=dev --audit-level=moderate` (blokuje), nový neblokující job „Bezpečnostní report – všechny
  závislosti“ (plný audit, varování + souhrn). Evidence `docs/bezpecnost-zavislosti.md`, issue [#66](https://github.com/ondrejmacko-it/zabohatsicesko/issues/66).
  Ověřeno lokálně: produkční audit 0, `npm ls picomatch --omit=dev` prázdné, přibalený picomatch v Next jen pro `next/image` (nepoužíváme).
  **Musí se sloučit první**, jinak CI #63–#65 dál padá na plném auditu (workflow se bere z merge ref PR).
* **U08**: cherry-pick 44df29e → #63 jako 1127481 (`claude/final-akce-navrhy`), pak merge #63 → #64 (775d696) a #64 → #65
  (e866d69, prázdný diff, bez konfliktu). Bez force. `e2e/pristupnost.spec.ts` na #63 i #64: 22 passed / 18 skipped / 0 failed.
  V historii #65 jsou dva commity se stejnou změnou (44df29e a 1127481); bez přepsání historie to nejde, diff PR je bez duplicity.

**Další kroky (nová relace):**
1. Subscribe #63, #64, #65, #67; zkontrolovat CI #67 (oba joby). Popis #64 a #63 aktualizovat: U08 už opraveno v #63 (1127481).
2. Na `claude/final-zapisy-temata` (= #63+#64+#65): lint, tsc, unit, `npm run build`, úplné `npm run e2e` (dřív 918/42/0).
3. Cíleně projít: přístupnost, klávesnice, formuláře, okna, chyby, prázdné stavy; oprávnění správce/vedoucí/FP/RM/host;
   screenshoty 320–1920 (`node e2e/server.mjs` + `node scripts/audit-screenshoty.mjs . <scratchpad>`; po změně CSS server
   restartovat a zabít i `next-server`); texty (překlepy, duplicity, technické formulace, zbytečné ovládací prvky);
   hromadné Zveřejnit/Smazat vybrané návrhy včetně potvrzení a souběhu (`deleteDrafts`, testy `tests/pevne-svatky.test.ts`,
   `e2e/okna.spec.ts`, `e2e/plan-planovani.spec.ts`; doplnit test souběhu, pokud chybí).
4. Opravy jen nalezených problémů na `claude/final-zapisy-temata` (nebo do větve, kde chyba vznikla, a pak merge dál bez force).
5. Finální report uživateli (tykat): hotové/funkční; ukázka/simulace; kontroly prošlé/neprošlé; zbývající problémy; co
   potřebuje jeho schválení; **pořadí sloučení: #67 → #63 → (merge main do #64, CI) #64 → (merge main do #65, CI) #65**;
   jak ověřit nasazení po sloučení. Zvlášť: přepis dlouhých nahrávek (`docs/nahravky-moznosti.md`) a ostrý Google Kalendář
   jsou samostatné otevřené body.

**FINAL POLISH (18. 11. 2026).** Zadání „ZBČ WIKI · FINAL PRODUCT POLISH“ je v první zprávě relace
session_01HpUiru5P4yB2SxRCiVSjHt. Uživatel dal plné právo pokračovat bez ptaní, zakládat nové relace a připravit draft PR
(merge do main dělá on, Kalendář nepřepínat, produkční data nemazat).

**Hotovo:**
* **Draft PR [#63](https://github.com/ondrejmacko-it/zabohatsicesko/pull/63) „Final A“** (`claude/final-akce-navrhy`): jednotné okno
  akce, Úvod otevírá akci v okně, filtr „Návrhy“, pevné svátky (UI + server), zamčený termín proběhlé akce. Sledovaný.
* **Draft PR [#64](https://github.com/ondrejmacko-it/zabohatsicesko/pull/64) „Final B“** (`claude/final-hromadne-navrhy`, stojí na #63,
  sledovaný): Vybrat návrhy (výběr, Zveřejnit/Smazat vybrané, server `deleteDrafts` v jedné transakci); lišta Plánu (Měsíc/Seznam
  vlevo, měsíc uprostřed, Přidat akci · Připravit měsíc · Vybrat návrhy · ⋯ vpravo, filtry ve 2. řádku, „Zobrazit jako“ s nápovědou);
  **oprava chyby**: „Zpět“ v potvrzovací liště odeslal formulář (React znovu použil tlačítko) – lišty mají `key` (i `EventDialog`),
  po Zpět se fokus vrátí; výběr návrhů se při zavření neptá na rozepsané změny. E2e okna/plán (1280, 1920, 320) prošly, unit 270/270,
  screenshoty 320–1920 lišty prohlédnuté (bez vodorovného posunu).
* **Draft PR [#65](https://github.com/ondrejmacko-it/zabohatsicesko/pull/65) „Final C“** (`claude/final-zapisy-temata`, base main,
  stojí na #64, sledovaný): `/vstup` bez 3 vět (slogan „Plán…na jednom místě“, „Heslo… nikdy nevidí“, notice „Pozvánka je
  ověřená…“ v ukázce); Zápisy: okno „Nedokončené zápisy“ / „Moje zápisy k dokončení“, „Odpovědný: jméno“, seed zveřejněného
  zápisu ev-11-6; Témata: archiv jako karty s Obnovit; **Správa** (e0f2c65): menu účtu Upravit přístup… / skupina „Přihlašování
  se zařízeními“ (Nový odkaz pro další zařízení, Zneplatnit čekající odkaz, Odhlásit <zařízení>… po řádcích) / Odebrat přístup…;
  zařízení v kartě po řádcích (`accessLines`); panel Kalendář jednotná stavba v obou režimech. Lint, tsc, unit 270/270, build OK.
  Screenshoty prohlédnuté (ostrá Správa přes lokální `next start` s fiktivním správcem: skript ve scratchpadu, v repu není;
  Témata-archiv, Zápisy, `/vstup` 390/1280).

* **E2E U08 opraveno v #65** (44df29e): `pristupnost.spec.ts` počítal se starým dialogem akce (před jednotným editorem z #63):
  „Název“ → „Název akce“, „Uložit návrh“ → „Uložit jako návrh“, na počítači je v řádku Typ + Pro koho a Datum + Od (dřív Typ + Datum).
  Úplné e2e na e0f2c65: 913 passed / 42 skipped / 5 failed (jen U08). Na #63 a #64 samotných tyto testy dál padají (oprava jen v #65,
  do jejich větví se nepushuje bez svolení). Úplné e2e na 44df29e: **918 passed / 42 skipped (záměrně jen jeden projekt) / 0 failed**.

* **Screenshoty (18. 11.)**: úplný audit 5 rolí × 8 šířek (320–1920) na e46ce35 bez vodorovného posunu, montáže prohlédnuté.
  Opraveno (99a6c76): Zápisy na telefonu od 360 px mají „Hledat“ vedle pole (`.filter-grow` 180 px). Cílené e2e zapisy+stranky
  531 passed / 3 skipped / 0 failed, lint, tsc, unit 270/270. Popis #64 doplněn o úplné e2e a U08 (cherry-pick 44df29e do #63,
  nebo sloučit #63–#65 dohromady). Závěrečný report uživateli odeslán.

**Další kroky:**
1. Nic dalšího bez pokynu uživatele. Čeká se na jeho kontrolu #63–#65 a odpovědi na otevřené body.
2. Otevřené: výklad „3 nadbytečné věty na /vstup“ (potvrdit); U08 na #63/#64 (cherry-pick 44df29e?); dlouhé nahrávky jen jako
   otevřený bod `docs/nahravky-moznosti.md`. **CI červené jen kvůli `npm audit`**: advisory GHSA-fc5q-39xc-vjpf (picomatch, všechny verze, bez opravy, jen
   dev nástroje; `--omit=dev` = 0). Komentář na #65. Rozhodnutí o CI auditu (počkat / `--omit=dev`) je na uživateli.
   Pozn.: e2e server je produkční build, po změně CSS ho restartovat (zabít i `next-server`).

Kontext limit: na začátku čti jen tento blok, README a měněné soubory.

---


Zkopíruj text níže jako první zprávu nové relace Claude Code (repo `ondrejmacko-it/zabohatsicesko`)
a přilož audit ZIP `ZBC_Audit_balicek_2026-11-15.zip` (do repa nepatří).

---

Pokračuj na modulu Vzdělávání (repo `ondrejmacko-it/zabohatsicesko`). Nečti znovu celé zadání ani celý kód.
Kontext máš v `docs/dalsi-session.md` a `README.md`, pravidla v `CLAUDE.md`, audit v přiloženém ZIPu. Tykej mi,
kroky pro mě piš úplně, pod sebe, s přesnými kliky (Windows, PowerShell).

**Trvalá fakta (neptat se na ně znovu):**
* Vlastní doménu **nemáme a neřešíme** (firma Wiki zatím nemá a nemusí ji používat). Žádné kroky s doménou, logem,
  Search Console ani ověřením aplikace.
* OAuth aplikace (projekt `zbc-vzdelavani-test`) je **In production**, External, 3/100 uživatelů. Production má
  `GOOGLE_OAUTH_PUBLISHED=1` (nastaveno 15. 11., platí od dalšího nasazení Production).
* Úkoly z auditu jsou v `docs/audit-ukoly.md`. Audit ZIP stačí přiložit, jen když je potřeba `textove-upravy.csv`.

**Stav 17. 11. večer, C3 jako draft #61, PR D rozpracovaný (poslední):** #56–#59 v `main`, #60 čeká na merge (CI zelené).
* **C3 = draft [#61](https://github.com/ondrejmacko-it/zabohatsicesko/pull/61)** (`claude/ux-temata-sprava`, stojí na #60). Úplné e2e
  899 passed / 36 skipped (záměrně jen jeden projekt) / 0 failed, unit 265/265, lint, tsc, build. Po sloučení #60 sloučit
  `origin/main` do C3 (bez force).
* **PR D = draft [#62](https://github.com/ondrejmacko-it/zabohatsicesko/pull/62)** (`claude/ux-zaverecny-audit`, stojí na #61; e2e 899/36 skip/0 fail, unit 265, build): úplný audit 328 screenshotů (8 šířek × 5 rolí) bez vodorovného
  posunu. Opraveno: nepoužité styly pryč; navigace na ≤380 px „Správa“ (zbytek názvu jen pro čtečku); rada „nemá pozvánku v
  Kalendáři“ jen u neproběhlé akce a bez odkazu „níže“; Integrace bez technických pojmů; 404 ve stejném rámci jako `/vstup`
  (`src/components/GateShell.tsx`); na tabletu skrytý podtitulek značky.
* **Hotovo, závěrečné shrnutí odeslané.** Další krok: po sloučení #60 → #61 → #62 vždy sloučit `origin/main` do další
  větve (bez force), sledovat CI. Nic dalšího bez pokynu uživatele.
* CI na `main` nemá běhy (workflow běží jen na PR), dřívější „červené main“ proto ověřit nejde; příčina byla opravená v #60.

**Stav 17. 11. odpoledne, #60 ověřené, C3 rozpracované (předchozí):** #56–#59 sloučené v `main`.
* **#60 (PR C2b, `claude/ux-formular-akce`)**: hotové. Úplné e2e na ba4682e 891 passed / 33 skipped (záměrně jen na jednom
  projektu) / 0 failed, unit 263/263, lint, build. Opraven test `tests/kalendar-migrace.test.ts` (chyběl
  `GOOGLE_ORGANIZER_EMAIL` po #57; chování beze změny). Popis PR aktualizovaný, položka e2e zaškrtnutá.
* **C3 (`claude/ux-temata-sprava`, pushnuté, PR zatím NENÍ)**: sloučený #60 (merge, bez force) + commit „C3: průchod zápisu…“:
  ukázková nahrávka ke stažení přímo u nahrávání, pole souboru „Soubor s nahrávkou“ (dřív stejné jméno jako tlačítko),
  nabídka ⋯ jen u zveřejněného zápisu; `/vstup` bez pozvánky má vlastní hlášky (`NO_INVITE_RESULTS`) a ukáže i
  „Žádost o přístup je odeslaná“; telefon: odznak Ukázka v řádku se značkou, výběr role + „Změnit“ + Odhlásit v jednom řádku;
  persona vedoucího „nahrává nahrávky“; integrace bez slova „token“. Nové e2e `e2e/zapisy.spec.ts` (vedoucí nahraje →
  návrh → zveřejní; FP vidí, RM ne) a test hlášek nepozvaného účtu v `ostra-wiki.spec.ts`. Cílené e2e (zapisy, ostra-wiki,
  okna; 1280 + 320) 74 passed / 2 skipped; unit 265/265; lint a tsc čisté. Audit skript má skutečné chybové stavy vstupu.
* **Ověřeno screenshoty:** `/vstup` (ukázka, ostrá, správce, nepovolený, čeká, vypršelo) 390; Témata a Správa 390/1280
  (Přidat přístup, menu u účtu, sbalený technický stav); RM na `/sprava`, `/vzdelavani/integrace` a cizí akci dostane 404.
* **Další krok C3:** (1) prohlédnout přehled rolí 390 (vedoucí, FP, RM: úvod, plán, akce, zápisy, témata, moje cesta) –
  pořiď znovu `ROLE=vedouci,ucastnikFp,ucastnikRm SIRKY=390,1280 node scripts/audit-screenshoty.mjs . <scratchpad>`,
  zmenšené montáže; (2) Správa na telefonu: tlačítko ⋯ u karty člověka stojí samo na řádku (dát vpravo nahoru);
  (3) prázdné stavy (Témata bez témat, Zápisy bez zápisů – ten je ověřený); (4) úplné `npm run e2e` z `/home/user/...`
  hlavního checkoutu (ne worktree se symlinkem), pak draft PR C3 do `main` podle šablony (v popisu: stojí na #60).
  Pak PR D a velké závěrečné shrnutí (zadání v promptu relace).
* Vyčištění testovacích témat („Test“, „Něco“, „Ahoj“): jen návrh uživateli (archivovat přes Témata → ⋯ → Archivovat);
  produkční DB nečíst ani neměnit. Duplicitní názvy server už odmítá (`DomainError("duplicate")`, bez ohledu na velikost písmen).

**Stav 17. 11. pozdě večer, C2 dokončené jako nový draft PR (předchozí):** #56, #57, #58, #59 jsou **sloučené v `main`** (#59 na d2d0a9d).
Zbytek C2 je ve větvi `claude/ux-formular-akce` (sloučený `origin/main`, merge d2554bd) jako nový draft PR do `main` („PR C2b“, číslo v GitHubu).
* Hotovo v C2b: `slotConflict` (6d3a6d5); `MonthDraft.clash` v `listMonthDrafts` + štítek `.publish-clash` a věta v kroku „2. Zkontrolovat“;
  Enter v Připravit měsíc nic neodešle (`ignoreEnter`); okno `Modal wide="extra"` (1120 px, návrh na jednom řádku od ~800 px);
  pravdivé hlášky po uložení/zveřejnění (`src/lib/invite-mode.ts`: simulace / čeká na Kalendář / testovací adresy / odesílá se)
  a `FlashMessage` v `(wiki)/layout.tsx` (potvrzení přežije zavření dialogu a přesměrování); testy `tests/doplneni-mesice-scenare.test.ts`
  (svátek, smazaný a přesunutý termín, zveřejněná a zrušená akce, souběh), e2e `okna.spec.ts` (Enter, potvrzení návrhu).
  Lint, tsc, `npm test` 254/254, cílené e2e `okna`+`pristupnost` (1280, 320) 62 passed / 3 skipped (desktop testy na telefonu).
  **Neověřeno: úplné e2e** (zastaveno kvůli limitu kontextu) – spustit na začátku další relace a výsledek zapsat do popisu PR C2b.
* Screenshoty dialogů prohlédnuté (390, 1280): formulář, souhrn chyb („Doplňte nebo opravte: Název“), potvrzení dopadu i chyba
  „Nezveřejněno, chybí téma… hodnoty zůstaly“ odpovídají chování. Skript: `node <scratchpad>/dialogy.mjs` není v repu; použij
  `scripts/audit-screenshoty.mjs` (teď s `locale: 'cs-CZ'`). Návrh 30 termínů: na desktopu ~75 px na řádek, na telefonu delší seznam
  se svislým posunem v okně a pevnými tlačítky dole – přijatelné, bez wizardu.
* **Další krok: C3** ve větvi `claude/ux-temata-sprava` (commit 5d56e60 na d2d0a9d): `git merge origin/claude/ux-formular-akce` (bez force),
  pak body C3 níže, draft PR C3 do `main`. Pak PR D a velké závěrečné shrnutí (viz zadání uživatele v promptu).
* Vyčištění testovacích témat („Test“, „Něco“, „Ahoj“): jen návrh uživateli (archivovat přes Témata → Správa), produkční DB nečíst ani neměnit.

**Stav 17. 11. večer, C2 doplněné, C3 rozpracované (předchozí):** uživatel poslal podrobné zadání „Dokončení UX/UI: C2 → C3 → D“
(platí nadále, shrnutí níže). Kalendář, #56 a #57 stranou.
* **C2** (`claude/ux-formular-akce`, draft #59, base `main`, stojí na #58): navíc commity d2d0a9d (Připravit měsíc na celou šířku,
  „Chybí téma a vedoucí“ u termínu místo souhrnného seznamu, texty bez „šablona“) a 6d3a6d5 (`slotConflict` v `domain/generation.ts`:
  termín přeskočí jen akce stejné skupiny s časovým překryvem, akce „vsichni“ nebo stejný typ ve stejný den = návrh vznikne
  + varování v hlášce; `generateMonth` vrací `{ created, withTopic, skipped, review }`; testy `tests/obsazeni-terminu.test.ts`
  a v `tests/hromadne-zverejneni.test.ts`). Lint, tsc, `npm test` 249/249. **Neověřeno: build a úplné e2e na posledním commitu.**
* **Zbývá v C2 (podle zadání uživatele):** (1) varování z `review` ukázat i v kroku „2. Zkontrolovat“ (teď jen ve zprávě po doplnění);
  (2) testy pro svátek/výjimku, přesunutý termín z Pravidelného týdne, zveřejněnou akci, zrušenou ruční akci (pravidlo už to pokrývá,
  chybí scénáře v DB); (3) projít `EventDialog.tsx` texty o pozvánkách (rozlišit uloženo / zveřejněno ve Wiki / čeká na Kalendář /
  chyba; žádný falešný úspěch), Enter nesmí zveřejnit, zachování hodnot při chybě; (4) Připravit měsíc s 0, 1, 5, 15, 30 návrhy
  (seed nebo test fixture), případně sbalit skupiny; (5) screenshoty: Přidat akci, Upravit akci, rozbalené možnosti, potvrzení,
  Připravit měsíc prázdný / více návrhů / neúplné / připravené, chyba validace; 320, 390, 1280 + tablet a 1920. Skript na dialogy:
  viz `scripts/audit-screenshoty.mjs` (rozšířit o dialogy, nebo vlastní skript ve scratchpadu); (6) čistý build + úplné e2e, aktualizovat
  popis #59 (base můžeš přepnout na `claude/ux-uvod-plan`, aby diff byl jen C2).
* **C3** (`claude/ux-temata-sprava` z C2, commit „C3 (rozpracováno)“, PR zatím není, před pokračováním rebase na nový C2 bez force:
  `git merge origin/claude/ux-formular-akce`): hotové `isRecommendable` (doporučení jen s ≥1 zájemcem, i ve formuláři a `suggestTopics`,
  test `tests/temata-doporuceni.test.ts`), kratší úvod Témat, Správa bez štítku „Aktivní“ a řádku „Fiktivní role ukázky“,
  Kalendář + diagnostika v `<details class="admin-tech">` „Kalendář a technický stav“, otevře se sám jen při problému
  (`calendarExpiresSoon` v `CalendarStatusLine.tsx`), Zápisy bez nepravdivého „Vyhledávejte“ v prázdném stavu, prázdný stav pro vedoucího,
  `UploadForm` říká, že přepis je zatím jen ukázka. **Neověřeno:** screenshoty po změně (pořízené v `scratchpad/a2`, neprohlédnuté),
  e2e. Zbývá: přihlášení `/vstup` (první dojem, chyby, nepozvaný účet, bez oprávnění), celý průchod zápisu (nahrát → návrh → kontrola →
  zveřejnit → účastník vidí), karty témat a archiv, návrh vyčištění testovacích témat (jen návrh), jednotná čeština (vykání, role,
  tlačítka, bez technických pojmů), pak draft PR C3.
* **PR D:** audit všech rolí a šířek 320–1920 (`scripts/audit-screenshoty.mjs`), oprava nálezů, úplné e2e a přístupnost, pak velké
  závěrečné shrnutí pro uživatele (9 bodů z jeho zadání: změny po stránkách, odstraněné duplicity, opravené průchody, co je funkční,
  co demo, PR a testy, screenshoty desktop/mobil, zbývající nedostatky, produkční kroky čekající na schválení) včetně #56–#59.

**Stav 17. 11. odpoledne, C1 a C2 jako drafty (předchozí):** draft [#58](https://github.com/ondrejmacko-it/zabohatsicesko/pull/58)
= PR C1 (`claude/ux-uvod-plan` → `main`), draft [#59](https://github.com/ondrejmacko-it/zabohatsicesko/pull/59) = PR C2
(`claude/ux-formular-akce`, stojí na C1, base `main`, mergovat po #58). Obě: lint, tsc, test (C2 239/239), e2e zelené.
* C1 navíc: Správa v navigaci jen pro oprávněné, filtry Plánu na 768–1100 vlevo a bez přetečení na 320, kontrast `.extra .line`,
  e2e `domu-ukoly.spec.ts` (RM má jediný úkol = pozvánky).
* C2: jiná akce bez výchozího názvu, pole Název nahoře (`labelInMain` v `EventDialog.tsx`), kratší texty, bez `notice-ok`.
  Připravit měsíc: kroky „1. Doplnit termíny / 2. Zkontrolovat / 3. Zveřejnit“, `PairingOverview` a `pairing` smazané.
  `generateMonth` přeskočí slot překrytý ruční akcí (test v `tests/hromadne-zverejneni.test.ts`).
* **Neověřeno vizuálně:** screenshoty dialogů C2 (formulář akce, Připravit měsíc) na 320/390/1280 – udělat na začátku C3.
* **Další krok: PR C3** nová větev `claude/ux-temata-sprava` z `claude/ux-formular-akce`. (1) Doporučovat jen témata s ≥1 zájemcem:
  `TopicsSection.tsx:21` (`t.interestCount > 0`) a návrhy ve formuláři `EventDialog.tsx` (`suggestions`, filtr na `interestCount`),
  zvážit i `suggestTopics` v `generateMonth`. (2) Návrh vyčištění testovacích názvů témat („Test“, „Něco“, „Ahoj“) jen jako
  návrh uživateli, nic nemazat. (3) Správa: lidé, role, skupiny, přístupy, zařízení nahoře; integrace a diagnostika seskupené
  a sbalené (sem případně přehled párování s Kalendářem). (4) Zápisy a nahrávky: stavy, prázdné stavy, přepis = demo.
  (5) Přihlášení `/vstup`: první dojem a chybové stavy. Pak PR D (audit všech rolí a šířek) a velké shrnutí pro uživatele.
* Otevřené pro uživatele: přehled párování s Kalendářem jsem z Připravit měsíc vyndal (diagnostika); pokud ho chce zpět, říct.

**Stav 18. 11. večer, PR C1 rozpracovaný (předchozí):** větev `claude/ux-uvod-plan`, commit „PR C1 (rozpracováno)“.
Lint, tsc a `npm test` 238/238 prošly. **Neověřeno:** `npm run build` mimo e2e server a `npm run e2e`, PR zatím není.
* Hotovo: Úvod bez Moduly, vypnutého hledání a úspěšného stavu Kalendáře (`PersonalCalendarStatus` vrací null bez akce).
  Pozvánky bez odpovědi = jeden úkol v „Čeká na vás“ (`src/features/vzdelavani/invitations.ts`, test `tests/ukoly-uvod.test.ts`),
  `InvitesCard` smazaná, `TaskRow` má volitelné `href`, `newTab`, `urgent`. Plán: karty název + téma + čas + `cardBadges`
  (`status.ts`), legenda pryč, jeden řádek nástrojů, stav měsíce jako štítky `PlanFilters` (`group` „Čeká na vás v tomto
  měsíci“), typ a pohled jako malé selecty, vlastní úkoly v `<details class="plan-tasks">`. e2e upravené: `domu-ukoly.spec.ts`,
  `pristupnost.spec.ts` (štítky místo panelu). Skript `scripts/audit-screenshoty.mjs` umí `ROLE`, `SIRKY`, `STRANKY`.
* **Další krok:** (1) prohlédnout screenshoty `uvod`/`plan`/`plan-seznam` na 320, 390, 768, 1024 pro správce a FP
  (zkontrolovat zalomení řádku nástrojů na 768–1024 a štítky v seznamu na 320), opravit. (2) Účastníkovi skrýt v navigaci
  neaktivní „Správa systému“ (`Sidebar.tsx`, dnes šedá kulisa). (3) `npm run e2e` na pozadí (porty uvolnit `fuser -k 3310/tcp 3311/tcp`),
  opravit pády. (4) Draft PR C1 do `main` podle šablony. Pak C2, C3, D.
* Otevřené pro uživatele: kulisy shellu ukázky („Moje role“, „Jak pracujeme“, Dokumenty) nechávám, ostrá Wiki je nemá.
  V kartách Plánu nechávám téma (bez něj by se čtyři „Trénink poradců“ nedaly rozlišit), vedoucí je až v náhledu.

**Stav 18. 11. odpoledne, Kalendář pozastaven, začíná UX (předchozí):** obě opravy Kalendáře jsou hotové jako drafty.
* #56 (PR B, `claude/kalendar-migrace-dry-run`, base přepnut na `main`): `removePersonalCalendar` při odmítnutém smazání
  (kromě 404) nechá token i řádek ve stavu `removal_failed` + `error_code`, `retireWikiCalendars` vrací `{ removed, failed }`,
  inventura `removalFailed`, migrace `0012` jen rozšíří CHECK. Lint, tsc, test 241/241, build. Popis PR aktualizovaný.
* #57 (`claude/kalendar-ucet-organizatora` z `main`): `GOOGLE_ORGANIZER_EMAIL` (povinná v režimu organizátora, jinak
  `googleCalendarConfig()` = null, fronta stojí, Integrace ukáže proměnnou), callback porovná ověřený e-mail z ID tokenu
  (`aud`, `email_verified`), nesoulad = token zneplatněn, nic neuloženo, Integrace „jiny-ucet“; přihlášení správce se
  v režimu organizátora na Kalendář neptá, `login_hint` = organizátor. Lint, tsc, test 238/238, build. e2e ne (simulace).
* **Další krok: PR C1** ve větvi `claude/ux-uvod-plan` (z `main`, zatím jen tento soubor). Úvod `src/app/(wiki)/page.tsx`:
  pryč blok Moduly a `PersonalCalendarStatus` ve stavu ok (ukazovat jen warn/alert), nejbližší akce a úkoly vedle sebe
  (`home-columns` vždy, pod sebou na mobilu). Pak Plán. Nejdřív výchozí screenshoty: e2e server `node e2e/server.mjs`
  (porty 3310/3311), přihlášení `e2e/.auth/<role>.json` z `e2e/prihlaseni.setup.ts`, skript `scripts/audit-screenshoty.mjs`
  (rozšířit šířky na 320–1920 a role o nového uživatele a bez oprávnění), screenshoty jen do scratchpadu.
* Otevřené: nic blokujícího. Ověřit (jen čtením názvů/hodnot nesecretních proměnných), že produkce má `CALENDAR_DELIVERY=personal`
  (PR #57 to předpokládá).

**Stav 18. 11., ZMĚNA PRIORIT (předchozí):** #55 (PR A) je sloučené v `main` (849f139). #56 (PR B, větev
**Stav 18. 11., ZMĚNA PRIORIT (poslední):** #55 (PR A) je sloučené v `main` (849f139). #56 (PR B, větev
`claude/kalendar-migrace-dry-run`) zůstává draft. Nejvyšší priorita uživatele je teď **finální UX/UI a obsah celé Wiki**.
Kalendář: jen dvě opravy, pak pozastavit.
1. **Oprava v PR B:** `src/server/calendar/personal.ts` `removePersonalCalendar()`: když Google odmítne smazání kalendáře
   (CalendarError kromě 404 = už smazaný), NEodvolat token a NEmazat řádek. Nastavit stav `removal_failed` + `error_code`
   (rozšířit `PersonalCalendarStatus` v `schema.ts`, `stateOf`), aby šel úklid bezpečně zopakovat (sync volá
   `removePersonalCalendar` znovu u neaktivního účtu). `retireWikiCalendars` vrací `{ removed, failed }`. Testy.
2. **Pojistka účtu organizátora** (nová větev z `main`, např. `claude/kalendar-ucet-organizatora`): `GOOGLE_ORGANIZER_EMAIL`
   v konfiguraci; v callbacku propojení Kalendáře ověřit skutečnou identitu Googlu (id_token/userinfo, ne vstup uživatele);
   při nesouladu propojení odmítnout se srozumitelnou hláškou; v režimu organizátora nepovolit auto-propojení osobního účtu
   správce; v `WIKI_MODE=production`/`google-test` bez nastavené adresy organizátora neodesílat pozvánky (fronta stojí,
   Správa ukáže problém). Testy. Produkci nepřepínat.
3. **Pak UX/UI** podle zadání uživatele (níže), rozdělit na PR C1 (Úvod, Plán, navigace), C2 (Přidat/upravit akci,
   Připravit měsíc), C3 (Témata, Správa, Zápisy, přihlášení, texty), D (vizuální audit, screenshoty, předávka).
   Zásady: méně informací, každý prvek má účel, úspěšný technický stav neukazovat, problém jen když vyžaduje zásah,
   žádné duplicity (blok Moduly na Úvodu, „Čeká na vás“ na Plánu, „Kalendář propojen“), neslibovat neověřené
   (přepis nahrávek je demo), zachovat identitu (teplé světlé pozadí, bílé plochy, tmavá navigace, okrové akcenty).
   Úvod: nejbližší akce a úkoly vedle sebe na desktopu. Plán: karty jen název, čas, stav; chybějící téma/vedoucí
   jako malý štítek; filtry a nástroje správce přehodnotit; zachovat přidání z kalendáře, přetahování, seznam, detail.
   Formulář akce: hlavní pole nahoře, doplňky schované, bez technických bloků příjemců, uložit jako návrh,
   bez výchozího názvu „Jiná akce“. Připravit měsíc: Doplnit → Zkontrolovat → Zveřejnit, bez diagnostiky Kalendáře,
   duplicity ručních akcí a šablony. Témata: doporučovat jen s ≥1 zájemcem (`TopicsSection.tsx:21`), návrh vyčištění
   testovacích názvů („Test“, „Něco“, „Ahoj“) bez mazání produkce. Správa: lidé, role, skupiny, zařízení; integrace
   a diagnostika seskupené a sbalené. Role: správce, vedoucí, FP, RM, nový uživatel, bez oprávnění.
   Šířky 320, 360, 390, 768, 1024, 1280, 1440, 1920. Screenshoty (mimo repo, `scripts/audit-screenshoty.mjs`)
   sám prohlédnout a opravit. Pak lint, tsc, test, build, e2e. Málo dokumentace, hlavně reálné změny UI.
* Nesmí bez souhlasu: přepnout produkci, rozeslat pozvánky, mazat produkční data, merge, placené služby, produkční
  úklid Kalendáře (ani trvalé tlačítko pro něj).

**Stav 17. 11. noc 3, PR A a PR B jako drafty (předchozí):** PR A = draft #55 (`claude/kalendar-pozvanky-organizator` → `main`),
PR B = draft #56 (`claude/kalendar-migrace-dry-run` → větev PR A). PR A: lint, tsc, `npm test` 235/235, build, e2e 883 passed / 33 skipped.
PR B: lint, tsc, `npm test` 239/239, build (e2e ne, UI beze změny). Nic neběželo proti skutečnému Googlu.
* PR A navíc: `docs/kalendar-organizator.md` (provoz, RSVP, náklady, úplné kroky pro uživatele), README proměnné, workflow
  s volitelným secretem `VERCEL_AUTOMATION_BYPASS_SECRET` (preview je za Vercel Authentication, `all_except_custom_domains`).
* Vercel preview: `CALENDAR_MODE=simulation`, `CALENDAR_DELIVERY` nenastavené, `CALENDAR_ATTENDEES` jen v Production. Nic neměněno.
* PR B: `migration.ts` (`migrationInventory`, `retireWikiCalendars` s otiskem, odmítne v `personal`), `scripts/kalendar-migrace.ts`,
  `docs/kalendar-migrace.md` (inventura produkce: 41 akcí, 3 aktivní, 2 osobní kalendáře, 23 záznamů, 45 vazeb bez ext. ID).
* **Otevřené pro uživatele:** (1) kde spustit úklid na produkci (sensitive proměnné nejdou stáhnout: tlačítko ve Správě,
  nebo endpoint s otiskem), (2) pojistka proti propojení osobního účtu správce místo organizátora (proměnná s očekávaným
  účtem), (3) založit účet organizátora a tokeny podle `docs/kalendar-organizator.md`, (4) merge #55 a ruční běh workflow.
* **Další krok:** po odpovědích doplnit PR B (spouštění úklidu, pojistka účtu), pak PR C1, C2, D podle plánu.

**Stav 17. 11. noc 2, PR A téměř hotový (předchozí):** větev `claude/kalendar-pozvanky-organizator`, commit „PR A: RSVP, worker, endpoint…“.
Ověřeno v této relaci: `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm test` (235/235) prošly. **Neověřeno:** `npm run build`, `npm run e2e`.
* Hotové navíc proti WIP: `src/server/calendar/rsvp.ts` (`syncResponses` se zámkem, úplná/přírůstková, 410 → úplná, stránkování,
  jen GET; `invitationsFor`, `gmailSearchHref`), `worker.ts` (`runCalendarWorker`, `runWorkerIfDue` 5 min s atomickým nárokem,
  `workerHealth`), `worker-auth.ts` (sha256 + `timingSafeEqual`), endpoint `src/app/api/kalendar/fronta/route.ts` (GET cron, POST GitHub),
  `vercel.json` (cron `17 5 * * *`), `.github/workflows/kalendar-fronta.yml` (`*/10`, bez tajemství exit 0, denní `enable`),
  Úvod: `InvitesCard` + `RefreshOnReturn` + `after(runWorkerIfDue)`, Správa: `CalendarWorkerHealth`. `FakeGoogle` přesunutý do
  `tests/fake-google.ts` (umí syncToken, 410, `pageSize`). Testy `tests/kalendar-organizator.test.ts` (23, všechny scénáře ze zadání).
* **Zbývá v PR A:** (1) `docs/kalendar-organizator.md`: provoz, kroky pro uživatele (účet organizátora, OAuth, `CALENDAR_WORKER_TOKEN`
  a `CRON_SECRET` ve Vercelu, secret `CALENDAR_WORKER_TOKEN` a proměnná `WIKI_URL` v GitHub Actions, přesné kliky Windows),
  náklady (GitHub Actions zdarma pro veřejné repo; Vercel Pro 20 USD/měs. s cronem po minutách; cron-job.org zdarma), README tabulka
  proměnných (`CALENDAR_WORKER_TOKEN`, `CRON_SECRET`). (2) `npm run build`, `npm run e2e` (na pozadí, porty 3310/3311 uvolnit).
  (3) Preview proměnné na Vercelu: ověřit `GET /v9/projects/<prj>/env` (jen názvy), nesecretní nic nového nepotřebuje.
  (4) Draft PR (base `main`) s výsledky a upřímným přehledem simulace vs. živě. (5) PR B: jen příprava a dry-run.
* Otevřené pro živý test: zda `sendUpdates=all` při pouhém přidání hosta pošle e-mail i ostatním hostům; zda denní `enable`
  workflow skutečně resetuje 60denní odpočet.

**Stav 17. 11. noc, PR A rozpracovaný (předchozí):** větev `claude/kalendar-pozvanky-organizator`, commit „WIP PR A“.
Relace skončila na limitu kontextu. **Neověřeno:** v kontejneru chyběly `node_modules`, nejdřív `npm ci`, pak `npx tsc --noEmit`.
* Hotové v kódu (jen napsané): `CALENDAR_DELIVERY` = `organizer` (výchozí, `invites` = totéž) | `personal`, `organizerDelivery()`,
  `calendarWorkerTokens()` (`CALENDAR_WORKER_TOKEN`, `CRON_SECRET`, min. 32 znaků), `.env.example`. Migrace `0011_calendar_outbox_rsvp`
  (jen ADD: `calendar_links.next_attempt_at`, `failing_since`; tabulky `calendar_responses`, `calendar_sync_state`,
  `calendar_worker_runs`) + schéma + reset dema. `google.ts`: 401 po obnově a 403 už nejsou odvolání (`calendar_forbidden`,
  `ACCESS_403` → `calendar_no_access`, kvóty přechodné), `GUEST_PRIVACY` při založení i úpravě, `guestsPrivate`, `listChanges`
  (events.list, `showDeleted`, `syncToken`, stránkování, 410 → `null`). `simulated.ts`: `listChanges`. `sync.ts`: `errorKind`,
  `retryDelayMinutes`, `markAttention` plánuje `next_attempt_at` podle času DB, `syncPending` bere i splatné `attention`,
  srovná pozvánku bez soukromí hostů, `calendar_forbidden` v `FIXED_BY_RECONNECT`. Štítek `calendar_forbidden` v `labels.ts`.
  Test `google-calendar.test.ts`: 403 `forbidden` → `calendar_forbidden:permanent`.
* **Zbývá v PR A:** (1) `src/server/calendar/rsvp.ts`: `syncResponses(db)` (zámek na `calendar_sync_state`, úplná/přírůstková,
  410 → znovu úplná, mapování přes `calendar_links.external_event_id`, zrušená = smazat odpovědi, jen GET) a `invitationsFor(viewer)`
  (stavy čeká/přijata/možná/odmítnuto, „nelze ověřit“ při chybě nebo `synced_at` starším 3 h). (2) `worker.ts`:
  `runCalendarWorker(source)` (v `personal` nic nedělá), záznam běhu do `calendar_worker_runs`, `runWorkerIfDue("visit")` (5 min),
  `workerHealth()` (výpadek = žádný úspěch github/vercel-cron 30 min, chyby fronty starší 1 h podle druhu). (3) Endpoint
  `src/app/api/kalendar/fronta/route.ts`: GET = Vercel cron, POST = GitHub, `Authorization: Bearer`, porovnání sha256 + `timingSafeEqual`,
  odpověď jen počty, `no-store`. (4) `vercel.json` cron 1× denně; `.github/workflows/kalendar-fronta.yml` (`*/10`, `workflow_dispatch`,
  bez tajemství skončí 0, výstup curl do `/dev/null`, jednou denně `PUT …/actions/workflows/kalendar-fronta.yml/enable`
  s `permissions: actions: write` proti vypnutí po 60 dnech, neověřené). (5) Úvod: karta `InvitesCard` (červeně jen do 7 dní,
  „Otevřít Gmail“ = `https://mail.google.com/mail/u/0/#search/` + `from:<účet organizátora> in:anywhere`, v simulaci bez odkazu,
  souhrn vyřízených), klientský `RefreshOnReturn` (návrat do okna, max. 1×/min, jinak 5 min), `after(runWorkerIfDue)`.
  (6) Správa: stav běhů a upozornění při výpadku/chybách. (7) Testy `tests/kalendar-organizator.test.ts` (FakeGoogle z
  `google-calendar.test.ts`): 401/403/404/409/410/429/5xx, timeout, zachování `responseStatus`, soukromí hostů, nový zaměstnanec,
  změna skupiny, zrušení `cancelled`, RSVP stavy, nedostupné RSVP, bez duplicit, čtení RSVP bez zápisu, endpoint bez tokenu 401,
  souběh s `personal` vyloučen. Upravit `plan.test.ts` jen pokud spadne kvůli frontě. (8) `docs/kalendar-organizator.md` (provoz,
  náklady: GitHub Actions zdarma pro veřejné repo, Vercel Pro 20 USD/měs. s cronem po minutách, alternativa cron-job.org zdarma),
  README tabulka proměnných. (9) lint, tsc, test, build, e2e, draft PR (base `main`), pak PR B jen příprava a dry-run.
* Otevřené pro živý test: zda `sendUpdates=all` při pouhém přidání hosta pošle e-mail i ostatním hostům (dokumentace to neříká).

**Stav 17. 11. pozdě, schválený plán Kalendáře (předchozí):** závazné zadání je `docs/plan-kalendar-pozvanky.md`
(jeden organizátor s pozvánkami, RSVP, outbox, úklid osobního režimu, UX). #53 je v `main`, self-invite vypnutý.
* **Další krok:** implementovat PR A ve větvi `claude/kalendar-pozvanky-organizator` podle plánu, pak PR B, C1, C2, D.
  Produkční přepnutí, pozvánky, mazání a destruktivní migrace jen po výslovném souhlasu uživatele.

**Stav:** PR 4b část 2 je draft [#33](https://github.com/ondrejmacko-it/zabohatsicesko/pull/33) z větve
`claude/vibrant-ritchie-d100a3` (úvod s kartami, záložky Plán | Zápisy | Témata, Plán bez řádku Kalendáře,
Správa na 320/360 px). Uživatel ho mergne sám.

**Stav 15. 11. večer:** PR 5 je draft [#34](https://github.com/ondrejmacko-it/zabohatsicesko/pull/34) z větve `claude/audit-texty-a03` (stojí na #33): A03, T01–T04, přepisy textů
z auditu, okna „Akce/Zápis není dostupný“. Lint, typy, 173/173 testů a build prošly. **Průchod v Chromiu neproběhl:**
`next start` na http blokuje skripty přes CSP (přihlášení do ukázky neprojde); ověřit přes `npx next dev -p 3100`
(nebo zjistit, proč CSP lokálně blokuje i vlastní skripty, to by byla chyba k opravě v PR 8).

**Priorita uživatele (15. 11.):** hlavně testy pro desktopy a macOS. Automatizovaná sada v Playwrightu (desktop
1280, 1440×900, 1512×982 a 1920×1080, Retina `deviceScaleFactor: 2`, macOS user agent, klávesnice, axe), WebKit jen
pokud je v prostředí k dispozici. Skutečné Safari na Macu ověří uživatel podle kroků.

**Další krok:** ověřit PR 5 v Chromiu (role správce, vedoucí, účastník FP i RM; 1280/390/360/320; bez posunu a chyb),
pak PR 6 (U02–U08), PR 7 (Připravit měsíc, G6), PR 8 (bezpečnost a rychlost) podle `docs/audit-ukoly.md`. Každý
draft stavět na předchozím. Pak kompletní kontrola celého výtvoru. Neptat se, rozhodnout nejméně invazivně.

Nouzové zrušení zařízení hlavního správce (UI ho záměrně nenabízí) jde bez změny kódu a deploye přes Neon SQL:
`UPDATE trusted_devices SET revoked_at = now() WHERE id = '<id>'` (ID z dotazu na `trusted_devices` podle e-mailu).
Platí od dalšího požadavku. Můžeš ho provést i ty přes Neon MCP, ale jen na výslovný pokyn uživatele.


**Stav 16. 11. noc 3, kalendář 401 (poslední):** #47–#50 jsou v `main`. Draft [#51](https://github.com/ondrejmacko-it/zabohatsicesko/pull/51) z větve `claude/oprava-kalendare-401`:
`calendarList.get` → `update` → `patch` varianty, 401 už neukončí nastavení (důvod do `setup_code`), `selected/hidden`,
`EVENT_FORMAT = 3`, kontrola odvolání po 10 min (Úvod čeká max. 2,5 s), „Kalendář odpojen“ + „Připojit Kalendář znovu“
na Úvodu, v Plánu a ve Správě. Podrobnosti a kroky v `docs/kalendar-ucastniku.md`, část „Po merge #47: 401…“.
* **Další krok 1:** po merge a nasazení přečíst (jen čtení) `select status, event_format, setup_code, error_code, synced_at
  from personal_calendars`, zapsat do `docs/kalendar-ucastniku.md`. `event_format < 3` → uživatel otevře Úvod.
  `setup_code` bez `full` → navrhnout zapnutí self-invite (zapnutí potvrdí uživatel).
* **Další krok 2 (čeká na souhlas uživatele s návrhem):** Plán „+“ na dni a přesun tažením s potvrzením
  (`claude/plan-pridani-a-presun`), „Čeká na vás“ na Úvodu (`claude/domu-ceka-na-vas`). Návrhy jsou v odpovědi relace
  a zkráceně tady:
  - „+“: tlačítko v rohu buňky dne (`ScheduleGrid`), jen `canPlan`; viditelné při `:hover`/`:focus-within`, na
    `(hover: none)` vždy. Odkaz na stávající dialog „Přidat akci“ s `?den=YYYY-MM-DD`, server datum validuje stejně.
  - Přesun: HTML5 drag and drop na bloku akce (jen `canPlan`), drop na den → potvrzovací dialog → serverová akce
    `moveEventAction(eventId, dateKey, revision)` = úprava akce se stejným časem (stejná validace, oprávnění, revize).
    Bez myši: v detailu akce „Přesunout na jiný den“ (pole data). Na dotyku jen tato cesta.
  - „Čeká na vás“: společná komponenta `TasksCard` pro Plán i Úvod; 1280 px dva sloupce (Nejbližší akce | Čeká na vás),
    320 px pod sebou (Čeká na vás první), odkaz „Celý plán“ u obou.

**Stav 16. 11. noc 2, audit (poslední):** #47, #48, #49 nebyly v `main` (ověřeno `git merge-base --is-ancestor`).
Blok „Stav 16. 11. noc, notifikace“ je v předávce větve #49.
* #47: text ve Správě podle `personalSelfInvite()`, lint/typy ok, vitest 202/202, e2e 788 ok + 30 přeskočeno.
  Popis PR doplněný. V `docs/kalendar-ucastniku.md` (větev #47) je část „Po merge #47“: výklad `setup_code`, kroky Vercelu, živý test.
* Neon (jen čtení, před merge): oba kalendáře `active`, `synced_at` 19:39 UTC, sloupce `event_format`/`setup_code` zatím nejsou.
* Draft #50 `claude/audit-drobne-opravy`: Témata a Integrace na 320 px, `docs/audit-zaverecny.md`. e2e 788 ok.
  ZIP screenshotů poslán uživateli (mimo repo).
* **Další krok:** po merge #47 a nasazení číst `select status, event_format, setup_code, synced_at from personal_calendars`.
  `event_format = 0` → uživatel otevře Úvod. Pak self-invite podle `docs/kalendar-ucastniku.md` a výsledek tam zapsat.
* Otevřené: nálezy 3 a 4 z auditu (useknuté menu a zástupný text na 320 px), rozhodne uživatel.
* Při merge #49 a #50 se může střetnout tento soubor (obě větve sem přidávají blok), ponechat oba bloky.

**Stav 16. 11. večer, připomínky (poslední):** #45 je v `main`. Propojení živě funguje (oba účty `active`). Google ale odmítá

**Stav 16. 11. noc, notifikace (poslední):** relace skončila na limitu kontextu (200 tis.). #45 a #46 jsou v `main`,
#46 je na Production od 19:41 UTC. Akce se ale naposledy přepsaly 19:39 UTC, takže připomínky z #46 v kalendářích nejsou.
* Draft #47 `claude/vynuceny-prepis-akci`: migrace `0010` (`personal_calendars.event_format`, `setup_code`).
  Úvod spustí přepis, když je `event_format < EVENT_FORMAT`, a jednou za verzi znovu zkusí `calendarList.patch`
  ve 4 variantách. Výsledek se ukládá jako strojový kód do `setup_code` (dřív 404 prošla tiše). K tomu zkušební
  režim `CALENDAR_PERSONAL_NOTIFY=self-invite` (výchozí vypnuto, uživatel ho zvolil: jen Google, nic externího):
  host akce = účet účastníka, `sendUpdates=all`. Vitest 201/201 + nové testy, e2e v této větvi nespuštěné.
* Draft #48 `claude/vstup-mobil`: bez „Použít jiný účet“ (i `?jiny=1`), karta uprostřed i na mobilu. e2e 788 ok.
* Draft #49 `claude/unik-dat-a-design`: e2e `unik-dat.spec.ts` (HTML i RSC bez tajemství, člen max. 1 e-mail,
  pravé tlačítko neblokované), Správa: „Připojit Kalendář znovu“ jako tlačítko v kartě. Kód: tokeny do klienta
  nejdou, cookies HttpOnly, e-maily členů vidí jen správce (příjemci pozvánek).
* **Další krok 1:** po merge #47 přečíst v Neonu (jen čtení) `select status, event_format, setup_code, synced_at from
  personal_calendars` a podle `setup_code` určit důvod odmítnutí. Pak s uživatelem zapnout `self-invite`
  (proměnná na Vercelu, Production, redeploy) a živě ověřit e-mail o nové/změněné/zrušené akci (Gmail i Spam).
  Pozor na text ve Správě „Pozvánky ani e-maily o pozvání se neposílají“: v režimu self-invite neplatí, upravit.
* **Další krok 2:** úkol 5, závěrečný audit `docs/audit-zaverecny.md`. Skript `node scripts/audit-screenshoty.mjs <repo> <výstup>` (běžící `node e2e/server.mjs`, sezení z `e2e/.auth`, adresáře role/ a host/ založit předem)
  (role × 1280/390/360/320 × klíčové stránky, JPEG q60, kontrola posunu), ZIP ≤ 30 MB mimo repo, poslat přes SendUserFile.
  Screenshotovat stav po sloučení #47–#49 (lokální integrační větev, nepushovat).

**Stav 16. 11. večer, připomínky (předchozí):** #45 je v `main`. Propojení živě funguje (oba účty `active`). Google ale odmítá

`calendarList.patch` (audit `setup_none`), takže kalendář nemá výchozí připomínky ani e-mailová upozornění. Draft PR
z větve `claude/pripominky-v-akcich`: připomínky přímo v každé akci (e-mail den předem, oznámení 30 min), přepis všech
akcí při dalším přihlášení nebo zveřejnění. Lint/typy/vitest cíleně ok, celé e2e v této větvi nespuštěné.
* **Další krok 1 (uživatel říká „klíčové“):** e-mail o nové, změněné a zrušené akci. Google ho u vlastního kalendáře
  nepošle. Navrhnout uživateli (nejdřív se zeptat, větší změna):
  (a) Wiki posílá e-maily sama přes poskytovatele (např. Resend, tajemství přidá uživatel, doména/odesílatel),
      souhrn změn za akci, odhlášení, logy bez obsahu;
  (b) zpět k pozvánkám (`invites`), kde Google e-maily posílá, ale je to dnešní problém s pozvánkami;
  (c) zjistit důvod 403 `calendarList.patch` z logu Vercelu (uživatel: Vercel → projekt → Logs → filtr
      `google.personal` → kód `configure_full_http_403_…`) a podle něj zapnout aspoň ranní přehled.
  Nejdřív (c), protože je zadarmo, a souběžně se rozhodnout mezi (a) a (b).
* **Další krok 2–4:** únik dat do klienta, jednotný design (role × 1280/390/360/320), závěrečný audit
  `docs/audit-zaverecny.md` se screenshoty v jednom ZIPu ≤ 30 MB mimo repo. Každý v samostatné relaci (limit kontextu).

**Stav 16. 11. oprava kalendáře (předchozí):** #44 je v `main`, `CALENDAR_DELIVERY=personal` je na Vercelu zapnuté.
Živé propojení selhalo: 403 na `calendarList.patch` se tvářilo jako odvolání, ID kalendáře se neuložilo a každý pokus
založil další „Vzdělávání ZBC“. Draft PR z větve `claude/oprava-osobniho-kalendare` (base `main`): oprava (ID hned po
založení, 403 ≠ odvolání, znovupoužití kalendáře, první zápis v callbacku), lidské texty stavu, „Celý plán“ v hlavičce
sekce na Úvodu, nová vstupní stránka `/vstup`. Podrobnosti `docs/kalendar-ucastniku.md`, „Oprava propojení 16. 11. večer“.
* **Další krok 1:** po merge živé ověření podle kroků v PR. Když propojení zase nepůjde, přečíst v Neonu
  `personal_calendars.error_code` (`forbidden_<důvod>`) a `audit_log` (`calendar.personal.setup_basic|setup_none`).
* Stará data: oba účty jsou v DB `revoked` bez `calendar_id`. Opravené propojení je přepíše samo, zápis do DB není třeba.
  Duplicitní kalendáře (`calendarList.list` rozsah nepovoluje) smaže uživatel ručně.
* Runtime logy Vercelu relace nepřečte (MCP 403, CLI zakázané kontrolou oprávnění).
* **Další krok 2–4:** beze změny (únik dat do klienta, jednotný design, závěrečný audit).

**Stav 16. 11. pozdě v noci (předchozí):** #43 je v `main`. Draft [#44](https://github.com/ondrejmacko-it/zabohatsicesko/pull/44) z větve `claude/kalendar-ucastniku-ui`
(base `main`): UI stavu osobního kalendáře (Úvod, Plán, Správa), spouštěč na Úvodu, úklid starých pozvánek
ve Správě, štítek u návrhů, testy. Podrobnosti `docs/kalendar-ucastniku.md`, část „Doplněno 16. 11.“.
* `CALENDAR_DELIVERY=personal` na Vercelu **nenastaveno**: zápis přes API zamítla kontrola oprávnění relace.
  Nastaví uživatel ručně (Production, projekt `zbc-vzdelavani-demo`), nebo povolí volání a další relace ho udělá.
  Pozor: platí od nasazení Production. Nastavit až těsně před merge tohoto PR (jinak by redeploy `main` zapnul
  režim bez UI).
* **Další krok 1:** živé ověření podle kroků v PR (propojení, kalendář „Vzdělávání ZBC“, změna času, Gmail i Spam,
  ranní přehled, úklid starých pozvánek). Zápis do produkční DB přes Neon jen po výslovném souhlasu.
* **Další krok 2–4:** beze změny (únik dat do klienta, jednotný design, závěrečný audit), každý v samostatné relaci.
* Otevřené: odpojit i spárované cizí události při úklidu (zvoleno: ano, nemažou se), štítek „Návrh“ v seznamu
  nese plný text jen jako nápovědu (plný text je v okně akce a legendě).

**Stav 16. 11. noc (předchozí):** relace skončila na limitu kontextu. #41 a #42 jsou v `main`.
* Draft [#43](https://github.com/ondrejmacko-it/zabohatsicesko/pull/43) z větve `claude/kalendar-ucastniku` (base `main`): serverové jádro Kalendáře účastníků, **vypnuté**
  (`CALENDAR_DELIVERY` výchozí `invites`). Podrobnosti a co chybí: `docs/kalendar-ucastniku.md`, sekce „Stav
  implementace“ a „Upozornění e-mailem od Googlu“. Lint, typy, 189/189 vitest, e2e 786 prošlo + 18 přeskočeno.
* Uživatel 16. 11. povolil v prostředí hosty `developers.google.com` a `support.google.com` (dokumentace Googlu).
* **Další krok 1:** UI stavu osobního kalendáře (Úvod + Plán: stav a jedno tlačítko → `/api/google/prihlaseni?kalendar=osobni`;
  Správa: sloupec „Kalendář“ z `personalCalendarStates`), spouštěč `after(syncPersonalCalendars)` při otevření Úvodu,
  úklid 27 pozvánek z `primary` správce (tlačítko ve Správě, jen `zbcKey`, `sendUpdates=none`, vazby přepnout),
  štítek „Návrh, do Kalendáře zatím nejde“, e2e. Pak `CALENDAR_DELIVERY=personal` přes API Vercelu a živé ověření.
* **Další krok 2–4 (neudělané):** kontrola úniku dat do klienta/HTML a hlaviček, jednotný design (odkaz „Připojit
  Kalendář znovu“ ve Správě → tlačítko v kartě; role × 1280/390/360/320), závěrečný audit `docs/audit-zaverecny.md`
  se screenshoty v ZIPech ≤ 30 MB mimo repo. Na limit kontextu dávat každý úkol do samostatné relace.

**Stav 16. 11. večer (poslední):** relace skončila na limitu kontextu (200 tis.).
* Draft [#41](https://github.com/ondrejmacko-it/zabohatsicesko/pull/41) `claude/uklid-readme`: README (tabulka příkazů), souhrn auditu, zjištění 16. 11., návrh `docs/kalendar-ucastniku.md`.
* Draft [#42](https://github.com/ondrejmacko-it/zabohatsicesko/pull/42) `claude/pozvanka-po-prihlaseni` (úkol 2): pozvánka se spotřebuje až po přihlášení pozvaným účtem
  (`checkInvite` bez zápisu, cookie `zbc_invite` 30 min, scope `invite`, `claimInvite(..., userId)` v callbacku).
  Lint, typy, 184/184 vitest, e2e 786 prošlo + 18 přeskočeno. Živě neověřeno.
* **Další krok 1 (hlavní):** implementovat Kalendář účastníků podle `docs/kalendar-ucastniku.md` (varianta a,
  `calendar.app.created`, vlastní kalendář „Vzdělávání ZBC“, bez pozvánek). Nejdřív se zeptat, kam konzole
  zařadila rozsah (necitlivý/citlivý), krok 1 v tom souboru.
* **Další krok 2:** úkol 3 (krátká kontrola, že tokeny a cizí data nejdou do klienta ani HTML; žádné blokování
  pravého tlačítka), úkol 4 (jednotný design, začít odkazem „Připojit Kalendář znovu nebo jiným účtem“ ve Správě →
  tlačítko v kartě; projít role a šířky 1280/390/360/320). Obojí zatím neuděláno.
* Pozor: e2e ve zvláštním worktree potřebuje `cp -al node_modules` (symlink Turbopack odmítne).

**Stav 16. 11. (poslední, jen zjištění, kód beze změn):** #39 (PR 7) a #40 (PR 8) jsou sloučené v `main` (`7c72b91`)
a nasazené na https://zbc-vzdelavani-demo.vercel.app (ostrá Wiki, Neon `zbc-wiki-produkce`, projekt `bitter-breeze-02749976`).
Uživatel ověřil hlavičky (nosniff, X-Frame-Options DENY, Referrer-Policy same-origin). Relace skončila na limitu kontextu
při průzkumu, opravy čekají. Zjištěno (Neon jen čtením, žádný zápis):
1. **Pozvánka**: odkaz pro ondrasssssko@ se spotřeboval hned prvním otevřením (12:31, vzniklo zařízení v anonymním okně),
   druhé otevření v běžném okně server odmítl (`invite.rejected` 12:33), přihlášení Googlem proběhlo jen na tom zařízení.
   Cizí účet Google se k pozvánce nepřihlásí (`scopedAccount`: `wrong_account`). **Skutečná slabina:** kdo otevře odkaz první,
   ho spálí (zařízení vznikne dřív než přihlášení), pozvaný pak potřebuje nový odkaz. **Oprava (další krok, větev
   `claude/pozvanka-po-prihlaseni`):** `/api/pozvanka` jen ověří platnost (bez zápisu) a uloží HttpOnly cookie `zbc_invite`
   s tokenem (30 min, lax); `/api/google/prihlaseni` bez zařízení vezme scope `{ kind: "invite", userId }` + login_hint;
   `scopedAccount` ho vyhodnotí jako `device` (shoda e-mailu); callback teprve po úspěchu zavolá `claimInvite` s kontrolou
   `invite.userId === result.userId` v transakci, založí zařízení, smaže `zbc_invite`. Špatný účet = pozvánka zůstane platná.
   `LiveGate` ukáže tlačítko Google i s platnou `zbc_invite`. Testy do `tests/pozvanky.test.ts` (cizí účet nespálí, druhé
   použití neplatí, souběh) a e2e ostré Wiki. Zařízení d-4f01ed32 (ondrasssssko, Opera) je v pořádku, nerušit.
2. **Kalendář**: synchronizace **funguje**. 27 zveřejněných akcí má `sync_status = synced`, bez chyb, kalendář `primary`
   účtu zbc.test.spravce@, skuteční hosté v `managed_attendees` (FP → ondrasssssko@, RM → zbc.test.uzivatel@), API volá
   `sendUpdates=all`. Nesynchronizované jsou jen svátky (záměr) a **8 listopadových návrhů** (nezveřejněné, do Kalendáře
   nejdou). Akce `tym-a` mají prázdné hosty (skupina bez členů). Příčina „nic v Kalendáři“ je tedy nejspíš u příjemce:
   pozvánka od neznámého odesílatele (Google Kalendář → Nastavení → Obecné → Události z pozvánek „jen od známých
   odesílatelů“), Spam v Gmailu, nebo kontrola jiného účtu (ondra.macko1@ není ve Wiki). Neověřeno živě: přístup do
   schránek příjemců nemám. Ověření: detail akce jako správce ukazuje hosty načtené přímo z Googlu. Do UI doplnit:
   v Plánu u návrhů „Návrh, do Kalendáře zatím nejde“, u účastníka v detailu „Pozvánku posílá kalendář Wiki
   (zbc.test.spravce@) na vaši adresu“. Účastník oprávnění ke Kalendáři nepotřebuje, pozvánku posílá správcův kalendář.
3. **Vzhled** (odkaz „Připojit Kalendář znovu“ mimo kartu), 4. **pravé tlačítko** (nejdřív navrhnout uživateli, DevTools
   nejde zablokovat), 5. **kompletní průchod**: zatím neudělané.
* **Otevřená otázka (16. 11.):** uživatel chce, aby akce byly v Kalendáři účastníka „automaticky od prvního přihlášení“
  a myslí, že k tomu chybí žádost o Kalendář při přihlášení. Navrženo: A) ponechat pozvánky ze správcova kalendáře
  (nic od účastníka, jen ověřit Spam a nastavení „Přidávat pozvánky: Od všech“), B) žádat při přihlášení každého
  účastníka o `calendar.events` a zapisovat do jeho kalendáře (citlivý rozsah: Google bez ověření aplikace ukáže
  varování „neověřená aplikace“, ověření je mimo rozsah podle Trvalých faktů, víc tokenů a odvolání). Doporučeno A.
  Před prací na B počkat na rozhodnutí uživatele.
* `README.md` má po merge #39/#40 rozbitou tabulku příkazů (řádek `npm test` dvakrát a prázdné řádky). Opravit v prvním PR.
* `docs/audit-ukoly.md`: hotovo vše kromě A07; zbývá jen 69 přepisů z `textove-upravy.csv` (potřebuje audit ZIP).

**Stav 15. 11. noc 5:** #38 (PR 6) je v `main`. Otevřené drafty, oba base `main`, mergovat nezávisle:
* PR 7 [#39](https://github.com/ondrejmacko-it/zabohatsicesko/pull/39) (`claude/pripravit-mesic`): okno „Připravit měsíc“ (G6). Tlačítko vždy pro správce, doplnění termínů,
  párování nadcházejících akcí, živé mezery, sloupce datum/skupina/téma/vedoucí, „Uložit změny“ (nic neodešle) a „Zveřejnit“.
  176/176 vitest, e2e 772 prošlo + 18 přeskočeno.
* PR 8 [#40](https://github.com/ondrejmacko-it/zabohatsicesko/pull/40) (`claude/bezpecnost-rychlost`): hlavičky i pro statické soubory (HSTS v produkci), limit akcí
  120/min v `runAction`, Plán v jedné paralelní vlně dotazů + rozpočet dotazů v testu, `logError` jen bezpečný kód,
  `npm audit` 0. 178/178 vitest, e2e 775 prošlo + 18 přeskočeno.
* Po merge obou se střetne řádek s počtem testů v `README.md` (správně 180) a sekce PR 7/8 v `docs/audit-ukoly.md`.

**Další krok:** po merge #39 a #40 kompletní kontrola celého výtvoru na preview (role správce, vedoucí, účastník FP a RM;
1280/390/360/320), hlavičky na preview (F12 → Network), okno Připravit měsíc živě s Google Kalendářem. Zbývá jen A07 (rozhodne firma).

**Stav 15. 11. noc 4:** PR 6 dokončený jako draft z větve `claude/pristupnost-u03-u08` (base `main`):
U03, U04 (kotva `#zadosti`), U05, U07 (menu jako disclosure), U08 (souhrn chyb, fokus, pole podle šířky formuláře,
320×256). Testy `e2e/pristupnost.spec.ts` a `tests/journey.test.ts`. Draft PR [#38](https://github.com/ondrejmacko-it/zabohatsicesko/pull/38).
**PR 7 rozpracovaný** na větvi `claude/pripravit-mesic` (z `main`, bez PR, commit `b895da1`): hotová jen serverová
část `publishDrafts` (ruční datum v témže měsíci a v budoucnu, publikum, `{ publish: false }` = uložit bez
zveřejnění, chyba `outside_month`). Zbývá: `publishMonthAction` (pole `date-<id>`, `aud-<id>`, `intent=save`),
přestavět `PublishMonthDialog` na okno „Připravit měsíc“ (tlačítko vždy pro správce, uvnitř „Doplnit chybějící
termíny“ = `generateMonthAction`, přehled mezer a stavu párování z `monthCards[].syncStatus`, sloupce datum
a skupina, „Uložit změny“ a „Zveřejnit“), vitest pro `publishDrafts` (datum mimo měsíc, minulost, uložení bez
zveřejnění nic neodešle) a e2e okna. Pak PR 8 podle `docs/audit-ukoly.md`.

**Stav 16. 11. noc 4, Plán a Úvod (poslední):** #51 (`claude/oprava-kalendare-401`) zatím NENÍ v `main`
(ověřeno `git merge-base --is-ancestor`), čtení Neonu proto čeká. Blok „Stav 16. 11. noc 3“ je v předávce větve #51.
* Draft PR z `claude/plan-pridani-a-presun`: „+“ na dni v měsíčním Plánu (`?den=`), přesun tažením s potvrzením,
  „Přesunout na jiný den“ v náhledu i detailu. Server `planMove` (events.ts) + `previewMoveAction`/`moveEventAction`.
  Vitest 209/209 (nové `tests/presun.test.ts`), e2e `e2e/plan-planovani.spec.ts`.
* Draft PR z `claude/domu-ceka-na-vas`: `TasksCard` + `orderTasks` (Plán i Úvod), Úvod 2 sloupce / pod sebou.
  e2e `e2e/domu-ukoly.spec.ts`.
* **Další krok 1:** po merge #51 a nasazení číst (jen čtení) `select status, event_format, setup_code, error_code,
  synced_at from personal_calendars` a postupovat podle `docs/kalendar-ucastniku.md`, část „Po merge #47: 401…“.
* **Další krok 2:** po merge PR Plánu živě vyzkoušet přesun zveřejněné akce na ostré Wiki (Kalendář účastníků).
* Otevřené: přesun mimo měsíc a do minulosti je odmítnutý (pravidlo z Připravit měsíc), proběhlou akci přesunout
  nejde; zveřejněná akce s rozpracovaným návrhem se přesune jen v návrhu. „+“ jen u dnů od dneška.

**Stav 15. 11. noc 3:** #34, #35 a #36 se sloučily jen do svých základních větví, ne do `main`. Jejich obsah jde do
`main` draft PR [#37](https://github.com/ondrejmacko-it/zabohatsicesko/pull/37) z `claude/testy-desktop-macos`. Další práci
stavět z `main` až po sloučení #37. U dalších PR v řetězu dávat base `main` (ne předchozí větev) a mergovat postupně.

**Stav 15. 11. noc 2:** draft [#35](https://github.com/ondrejmacko-it/zabohatsicesko/pull/35) (`claude/testy-desktop-macos`, na #34): `npm run e2e`
(Playwright 1.63.0 nad produkčním buildem, ukázka + ostrá Wiki s falešnými Google hodnotami, 750/750 na Windows 1280/1920,
macOS 1440/1512 Retina s UA Safari/Chrome, telefony 390/360/320; WebKit v prostředí není, `E2E_WEBKIT=1` na Macu).
Opraveno: CSP bez nonce na `/soukromi` a 404 (byla to skutečná chyba, ne http), menu na telefonu, fokus z okna z menu,
Integrace 320 px. Ruční postup pro Mac: `docs/overeni-mac.md`. Draft PR 6 [#36](https://github.com/ondrejmacko-it/zabohatsicesko/pull/36) z `claude/audit-pristupnost-u02-u08` (na #35):
zatím jen U02. Base #34 ukazuje na sloučenou #33, po merge přepnout base na `main`.

**Další krok:** dokončit PR 6 (U03, U04, U05, zbytek U07, U08), pak PR 7 (G6) a PR 8 podle `docs/audit-ukoly.md`.
Před každým PR `npm run e2e` (cca 5 min, `E2E_SKIP_BUILD=1` bez buildu).

---

## Stav 15. 11. 2026 odpoledne 2 (větev `claude/vibrant-ritchie-d100a3`, draft PR 4b část 2)
* **Neon `zbc-wiki-produkce` po merge #32:** 7 vazeb `synced`, `calendar_id = primary`, `connected_at` 13:54 UTC
  (merge 13:50 UTC). Bez zásahu.
* **Úvod:** karty modulů (Vzdělávání, Správa systému jen pro `canManageUsers`) a Nejbližší akce (3, `NextEventsList`).
  Nejbližší akce z Plánu pryč, `nextEventsFor` bez filtru Plánu, `matchesPlanFilter` smazán.
* **Záložky:** Plán | Zápisy | Témata. `/vzdelavani/temata` je samostatná stránka (`TopicsSection`), stará kotva
  `/vzdelavani/zapisy#temata` přesměruje v prohlížeči (`TopicsAnchorRedirect`).
* **Plán:** místo `CalendarStatusLine` jen `CalendarAlert` (nepropojeno/vypršelo/nedostupné/vyprší do 2 dnů).
  Podrobný stav zůstal ve Správě.
* **Správa 320/360 px:** přetékala tabulka příjemců (dlouhé e-maily). Teď `overflow-wrap: anywhere` a pod 480 px
  řádky pod sebou. Ověřeno v Chromiu za správce ukázky (rozbalené sekce, okno Pozvat, simulované dlouhé adresy
  a štítky ostré Wiki). Ostrá Správa s Googlem lokálně přihlásit nejde.
* Ověřeno: lint, typy, 169/169 testů, build, Chromium (správce i účastník, 1280/390/360/320, přesměrování).

## Stav 15. 11. 2026 pozdě večer (větev `claude/brave-clarke-uyu0gb`, draft PR 4b část 1)
* **Diagnóza Kalendáře:** propojení se 15. 11. ve 14:01 uložilo (přepis fungoval, stránka ukazovala jen datum).
  Všech 7 vazeb mělo `calendar_unavailable`: Google na zápis do vedlejšího kalendáře (`…@group.calendar.google.com`)
  vracel 404 (účet k němu neměl přístup), adaptér to hlásil jako výpadek a nelogoval. `resumeAfterReconnect`
  vracel do fronty jen `calendar_revoked`. Přihlašovací callback navíc zneplatňoval nový token u Googlu,
  když propojení už existovalo, což u téhož účtu může shodit i uložené propojení. Logy Vercelu přes API nešly (403).
* **Oprava:** `checkConnection` (vynucená obnova tokenu, odvolaný/nečitelný = smazat), `needsCalendarConnection`
  žádá o souhlas vždy bez platného propojení. Souhlas při přihlášení vždy přepíše starý. 404 = `calendar_no_access`,
  `probeTargetCalendar` po připojení (`?google=bez-pristupu`). `syncAfterReconnect`: převede vazby bez pozvánky na
  nastavený kalendář, obnoví chyby přístupu a odešle celou frontu (`syncPublished`).
* **Vercel (API):** Production `GOOGLE_CALENDAR_ID` a `GOOGLE_ALLOWED_CALENDAR_IDS` = `primary` (rozhodnutí uživatele).
* **Zařízení:** `DEVICE_NEVER_EXPIRES`, migrace `0008_devices_never_expire`, přihlášení obnoví cookie zařízení.
* **Hlavní správce:** `primaryAdminEmail()` = první adresa `BOOTSTRAP_ADMIN_EMAILS`. Session 400 dní, účet, odkazy
  a zařízení nikdo nemění (server `forbidden`, UI bez menu, štítek „hlavní správce“).
* **Správa:** „Zrušit toto zařízení…“ s větou o dopadu, data `22. 11.`, okna s hotovým odkazem se na změny neptají.
* **Integrace v ostré Wiki:** bez tabulky režimů a technických textů, „Připojit znovu“, propojení s časem.
* Ověřeno: lint, typy, 169/169 testů, build, Chromium (vstup 320/360 px). Správa přihlášená v prohlížeči ne, naživo proti Googlu ne.

## Stav 15. 11. 2026 noc (větev `claude/pozvanky-na-zarizeni`, draft PR 4a do `main`)
* **Pozvánka na jedno zařízení** (`src/server/auth/devices.ts`, migrace `0007_login_invites`): odkaz `/vstup#<43 znaků>`
  (256 bitů, v DB HMAC otisk), 7 dní, jednorázový (podmíněný UPDATE), po použití cookie `__Host-zbc_device`
  (`<id>.<tajemství>`, v DB otisk), zařízení platí 30 dní od posledního použití (zápis nejvýš 1× za hodinu).
  Session nese `d` (ID zařízení), `resolveSessionUser` ho v ostré Wiki vyžaduje: starší session bez zařízení neplatí.
  `InviteClaim` čte fragment, maže ho z adresy a posílá POSTem na `/api/pozvanka` (Origin, JSON, limit 10/15 min).
  OAuth start bez zařízení přesměruje na `/vstup`, callback zařízení ověří znovu. `completeLogin` v ostré Wiki
  přes `scopedAccount`: e-mail Googlu musí přesně odpovídat pozvánce, žádné žádosti cizích lidí.
  Pojistka: `/vstup?spravce=1` jen pro `BOOTSTRAP_ADMIN_EMAILS`, po přihlášení zaregistruje zařízení.
* **Správa:** tlačítko „Pozvat člověka“ (okno, výsledek odkaz + Kopírovat), seznam Lidé se stavem zařízení a odkazu,
  menu Nový odkaz / Zneplatnit odkaz / Odhlásit zařízení. Odebrání přístupu zneplatní zařízení i odkaz. Pryč box
  „Jak to funguje“, text o e-mailu, v ostré Wiki „Technické nastavení ukázky“ (místo něj odkaz na nové připojení
  Kalendáře). Čekající žádosti jen když nějaké jsou. Tabulka příjemců v rozbalení. Výběr role Správce ukáže dopad.
* Ověřeno: lint, typy, 164/164 testů (nové `tests/pozvanky.test.ts`), build, Chromium nad `next start` v režimu
  production s falešnými Google hodnotami (neutrální vstup bez tlačítka, neplatný odkaz smazán z adresy a ohlášen,
  přímé OAuth 303 na `/vstup`, cizí Origin 403, `?spravce=1` s tlačítkem, 320 px bez posunu). Naživo proti Googlu ne.
* Po merge: dnešní session správce přestane platit. Přihlášení: `https://zbc-vzdelavani-demo.vercel.app/vstup?spravce=1`.

## Stav 15. 11. 2026 odpoledne (po PR 3, větev `claude/zen-feynman-jcmjd3`, jen tento soubor)
* **Production nasazená** uživatelem (Create Deployment z `main` po #29). Ignored build step je prázdný
  (Automatic), takže každý merge do `main` teď nasadí produkci. Zrušená nasazení Vercel v seznamu skrývá.
  Přihlášení Googlem, bootstrap správce, propojení Kalendáře a Správa ověřené uživatelem naživo (screenshoty).
* Env Production kompletní (ověřeno API, hodnoty nečteny). Změnu projektu Vercelu přes API (ignored build
  step) zablokoval klasifikátor, nastavení dělá uživatel v UI: Settings → Build and Deployment.
* Výhrady uživatele k ostrému UI a požadavek na přihlášení jen přes pozvánku jsou v promptu výše.

## Stav 15. 11. 2026 noc (větev `claude/bezpecne-pozvanky-a-dopad`, draft PR 3 do `main`)
* **Vercel (API):** Production `WIKI_MODE=production`, `LOGIN_MODE`/`CALENDAR_MODE=google-test`,
  `CALENDAR_ATTENDEES=audience`, `APP_URL=https://zbc-vzdelavani-demo.vercel.app`. Preview `WIKI_MODE=demo`,
  `CALENDAR_MODE=simulation`, odebrané `LOGIN_MODE`, všechny `CALENDAR_ATTENDEES`, 9 `APP_URL` a 2 `GATE_MODE`
  na větvích. Obecná `APP_URL` Preview zůstala.
* **Neon:** založení `zbc-wiki-produkce` přes API odmítnuto (organizace spravovaná Vercelem). Udělá uživatel
  ve Vercelu Storage, postup v `docs/nasazeni.md`.
* **A01** `looksLikeSameInvite` (sync.ts): cizí pozvánka ten den do 3 h nebo se stejným názvem zastaví automatiku,
  vlastní pozvánky Wiki (`createdByWiki`) ne. **A05** `mergeDescription`: Wiki mění jen své řádky s adresou akce
  (i HTML s `<br>`). **A02** token dopadu obsahuje otisk adres publika, `ImpactNotConfirmed.stale`. Fronta dál
  podle publika (rozhodnuto). **A04** `publishDrafts(..., confirmedIncomplete)` a zaškrtávátko s počtem v dialogu.
  **A06** `CancelImpact.verified/hasInvite`, dialog „Zkusit znovu“ a vědomé zrušení, server ověří znovu.
  **A08** `SyncPanel.unlinkedReason`, jednotný text v Plánu, vstup ukázky podle `attendeeSource`.
* Ověřeno: lint, typy, 153/153 testů, build. V prohlížeči neprocházeno (dialogy zrušení a hromadného zveřejnění).
  Naživo proti Googlu ne.

## Stav 15. 11. 2026 večer (větev `claude/produkce-a-zvaci-odkaz`, draft PR #28 do `main`)
* **Ostrá Wiki:** prázdná DB dostane jen 4 sloty pravidelného týdne (`seedProductionBase`, `prepareDatabase`
  plní jen DB bez uživatelů i šablony), `seedDatabase` v production vyhodí chybu. `BOOTSTRAP_ADMIN_EMAILS`
  v `completeLogin` (`createBootstrapAdmin`, audit `user.bootstrap_admin`), `GOOGLE_LOGIN_ACCOUNTS` ignorován,
  `DEMO_ACCESS_CODE` nepotřeba, `GOOGLE_ALLOWED_ATTENDEES` povinná jen při `allowlist`.
* **UI production:** `/vstup` jen Google (`LiveGate`), Sidebar bez neaktivních položek a hledání (`live`),
  domov bez hledání, popis stránky podle režimu (`generateMetadata`).
* **Zvací odkaz:** `/vstup?pozvanka=` → `src/app/vstup/pozvanka/route.ts` → cookie `zbc_gate` (src/server/auth/gate.ts,
  7 dní, otisk kódu, sdílený limit `gate:<ip>`). Ukázka Google nenabízí (trasy dál existují, vypne je odebrání
  `LOGIN_MODE` na Preview).
* Ověřeno: lint, typy, 147/147 testů, build, Chromium nad `next start` (ukázka i production s falešnými
  hodnotami Google). Naživo proti Googlu ne.
* Otevřené: Vercel Authentication a ignored build step pro Production, Hobby plán, OAuth Testing (vyprší ~19. 11.).

## Stav 15. 11. 2026 (větev `claude/relaxed-edison-tb8rqz`, draft PR 1 do `main`)
* **Odhlášení (S02):** `endSession` maže cookie se stejnými atributy jako uložení (`Secure`, `maxAge: 0`).
  Ověřeno v produkčním buildu v Chromiu: cookie zmizí, Plán přesměruje na `/vstup`, audio vrátí 401.
* **`WIKI_MODE=production` (S01):** odmítá demo session (`resolveSessionUser`), výběr i přepnutí role, obnovu dat
  (`resetDemoAction` i `resetDatabase`, tedy i `npm run db:reset`), přepínače simulace; skutečný čas; skryté
  ukázkové prvky na vstupu, v liště a na Integraci. `src/instrumentation.ts` nespustí ostrou Wiki bez Google
  přihlášení a Kalendáře (`liveWikiConfigProblems`). Testy `tests/produkce.test.ts`. 141 ze 141 testů, lint,
  typy, build. Production na Vercelu zatím nemá env ani DB, nic se nenasazovalo.
* Vercel: projekt přes Vercel MCP konektor není vidět (jiný token), přes `api.vercel.com` s proxy ano
  (tým `team_PtkXmFd9hI7UeUYovGkbwZQG`). Vercel Authentication chrání všechna nasazení včetně production.
* Rizika k řešení s uživatelem: Hobby plán je nekomerční, OAuth v režimu Testing (7 dní, 100 uživatelů),
  nahrávky v production přepis neumí (návrh: ruční zápis bez audia), úklid skutečných účtů z DB preview.

## Stav 15. 11. 2026 (větev `claude/pensive-ramanujan-lk23o9`, kód beze změn proti `main`)
* Snímky předány znovu: 368 snímků (4 role a vstupní brána, 1280 a 390 px, 2×) ve 4 ZIPech do 30 MB, v 1. části `SEZNAM.md` a zdrojový kód. Vznikly automatickým průchodem lokálního buildu (`next start` nad PGlite, každé tlačítko, menu a okno z menu, nic se neodesílá) a scénářem zápisu (správce nahrál nahrávku k ev-11-10, zveřejnil, ostatní role čtou). Vodorovný posun nikde, chyby v konzoli žádné. Skripty jsou mimo repo.
* Poznámka pro lokální snímkování: brána má limit 10 pokusů za 15 minut na IP (v DB). Na lokálním serveru stačí každému kontextu prohlížeče dát jiné `x-forwarded-for`.
* Další krok beze změny: živý test s uživatelem (bod 3), propojení Testing vyprší kolem 19. 11.

## Stav 14. 11. 2026 večer (větev `claude/youthful-brown-attvm9`, draft PR do `main`)
Vychází z `claude/sharp-babbage-5nqoac` (ta zůstala bez PR, její práce je v této větvi). Ověřeno: lint, typy, testy, build (viz PR). Naživo proti Googlu neověřeno.

* Menu místo řad tlačítek: sekce Nahrávka a zápis má menu ⋯ (testovací nahrávka, „Stáhnout zveřejněný zápis…“), Integrace při připojení „Možnosti připojení“ (Připojit znovu, Odpojit), panel Kalendáře v detailu menu ⋯ (nová pozvánka místo spárování, nástroje simulace, technické nastavení). U proběhlé akce, kterou správce vede, je „Upravit“ vedlejší.
* Opravy osy: blok údajů akce na 390 px už není odsazený (`.section.facts-section`), ve Správě drží vlastní účet odznak stavu ve stejné ose (prázdné místo místo menu, „· váš účet“ u jména).
* Ověřeno v Chromiu nad PGlite (Playwright): správce u cizí akce nahrál záznam, AutoRefresh přepnul na návrh zápisu bez obnovení (asi 7 s), uložení, zveřejnění, úprava, stažení zápisu; účastník FP zápis čte bez nahrávky, RM ho nevidí; „Přidat zápis“ na 1280 px bez posunu; Plán za účastníka na 390 px bez posunu; schválení a zamítnutí čekající žádosti (žádosti vložené skriptem do lokální DB). Snímky všech rolí, oken a menu na 1280 a 390 px předány jako ZIP (mimo repo), bez vodorovného posunu.
* Hydratační varování na Plánu (13. 11.) se lokálně nepodařilo vyvolat ani s pásmem prohlížeče Europe/Prague a America/New_York (server UTC). Pokud se znovu objeví na preview, poslat přesný text z konzole.
* Preview této větve: `https://zbc-vzdelavani-demo-git-claude-youthful-brown-attvm9-maci.vercel.app`, `APP_URL` nastavená přes API. Uživatel přidá do Google konzole `<adresa>/api/google/prihlaseni/callback` a `<adresa>/api/google/kalendar/callback`.
* Sloučeno s `main` po PR #19 (jiná relace): na `/vstup` je jen jedna persona správce, `demo-organizator` zůstává v seedu jako „Druhý správce ukázky“ (vazba na testovací účet Google). Odsouhlaseno 14. 11.: ostré zveřejňování a skutečné pozvánky na preview smí Claude spouštět bez dalšího ptaní.
* Další krok: živý test s uživatelem krok za krokem (bod 3 promptu z 14. 11.), až řekne. Hromadné zveřejnění před prvním ostrým použitím potvrdit. Propojení Testing vyprší kolem 19. 11.

Stav 14. 11. 2026 (větev `claude/sharp-babbage-5nqoac`, bez PR)

Ověřeno: lint, typy, 135 ze 135 testů, build. V Chromiu nad PGlite dialog „Přidat akci“ a Správa za správce
na 1280 a 390 px (bez vodorovného posunu, bez chyb v konzoli). **Naživo proti Googlu neověřeno.**

- **Vercel:** `CALENDAR_ATTENDEES=audience` je nově nastavená pro všechna preview (bez omezení na větev),
  podle rozhodnutí uživatele. Starší proměnné omezené na větve zůstaly, mají stejnou hodnotu.
- **Dialog akce:** pod výběrem publika blok „Pozvánku dostane N lidí“ se jmény (nad 8 jmen rozbalovací „a další“).
  Data z `loadInviteRecipients` (`services/calendar-status.ts`, bez dotazu na Google, `loadCalendarStatus` ji
  používá). V testovacím režimu (`allowlist`) řekne, kolik lidí ze skupiny zatím pozvánku nedostane.
  Doporučená témata mají počet zájemců jako okrový odznak. Test v `tests/kalendar-prihlaseni.test.ts`.
- **Role v textech:** „organizátor“ v UI i komentářích nahrazen „správcem“. Zůstává jen tam, kde jde o Googlem
  definovaného organizátora události (`google.ts`, `simulated.ts`, `docs/google-kalendar.md`). Persona
  `demo-organizator` se jmenuje „Správce vzdělávání“ (role v DB dál `organizer`, id beze změny). Na sdílené
  databázi preview se nové jméno projeví až po „Obnovit ukázková data“.
- **Správa:** žádost má hlavní tlačítko „Schválit…“ (okno s rolí a skupinami) a v menu „Zamítnout žádost…“.
  Uživatel má menu ⋯ s „Upravit roli a skupiny“ (okno) a „Odebrat přístup…“ (potvrzení, role a skupiny
  zůstanou), odebraný „Vrátit přístup…“. Úprava, odebrání a vrácení ověřené v prohlížeči, schválení ne.
- **Dokumentace:** `README.md`, `docs/predani.md`, `docs/google-prihlaseni.md`, `docs/google-kalendar.md`
  odpovídají stavu (jedna role Správce, souhlas ke Kalendáři při přihlášení, `GOOGLE_OAUTH_PUBLISHED`,
  příjemci, řádek stavu, automatické vazby a fronta, hromadné zveřejnění).

## Stav 13. 11. 2026 pozdě v noci (větev `claude/tender-fermat-oepq6p`)

Ověřeno: lint, typy, 134 ze 134 testů, build. V Chromiu nad PGlite okno „Zveřejnit návrhy“ za správce na 1280
a 390 px (bez vodorovného posunu). **Naživo proti Googlu neověřeno.**

- **Proč 4 zveřejněné akce neměly pozvánku:** seed zakládá akce se záměrem `pair`, `publishInTx` vytvoří vazbu
  jen pro `create` a fronta `syncPending` čte jen existující vazby. V režimu Googlu seed žádné vazby nezakládá.
- **Automatické vazby** (`sync.ts`: `linkPublishedWithoutInvite`, `syncPublished`): každá zveřejněná budoucí
  nezrušená akce bez vazby ji dostane a fronta založí pozvánku. Pozvánku, kterou Wiki založila dřív (před obnovou
  dat), pozná podle klíče a nezdvojí. Výjimka: když ve stejném čase leží v Kalendáři cizí nespárovaná pozvánka,
  akce zůstane „bez vazby“ a správce ji spáruje nebo založí novou. Bez propojeného Kalendáře se nezakládá nic.
  Spouští se po otevření Plánu správcem, po zveřejnění, po hromadném zveřejnění a po obnově ukázkových dat.
  Platí i v simulaci (ukázkové akce bez pozvánky ji dostanou po otevření Plánu).
- **Hromadné zveřejnění** (`PublishMonthDialog`, `listMonthDrafts`, `publishDrafts`, `publishMonthAction`):
  tlačítko „Zveřejnit návrhy (počet)“ vedle „Přidat akci“. Nahoře přehled dopadu (počet akcí, kolik lidí dostane
  e-mail a z jakých skupin, podle režimu Kalendáře). Základ ze šablony je předvybraný, návrhy přidané navíc
  ne. Téma a vedoucího jde doplnit přímo v řádku. Návrhy změn zveřejněných akcí v okně nejsou (jen počet),
  server je odmítne stejně jako cizí měsíc, proběhlé termíny a zastaralou verzi návrhu.
  Testy: `tests/hromadne-zverejneni.test.ts`, dva nové v `tests/google-calendar.test.ts`.
- **Neuděláno z promptu:** živý test, hosté a témata v dialogu akce, texty „organizátor“, Správa v okně a menu,
  doověření oken, dokumentace, snímky.

## Stav 13. 11. 2026 noc (větev `claude/blissful-mendel-ejkw5s`, draft PR do `main`)

Vychází z `claude/amazing-edison-51eo2g`. Ověřeno: lint, typy, 128 ze 128 testů, build. V Chromiu nad PGlite jen
Plán a Správa za správce na 1280 a 390 px (řádek Kalendáře, tabulka příjemců, výběr role, bez vodorovného
posunu). **Naživo proti Googlu neověřeno nic z níže uvedeného.**

- **Souhlas ke Kalendáři při přihlášení** (`google-login.ts`, `api/google/prihlaseni/*`): po každém přihlášení
  Googlem si prohlížeč uloží podepsanou cookie `zbc_google_hint` s ID uživatele. Při dalším přihlášení server
  podle ní pozná aktivního správce, a pokud Wiki nemá propojení, požádá Google na jedné obrazovce o identitu
  i `calendar.events` (`prompt=consent`, `access_type=offline`, `login_hint`). Callback propojení uloží
  (`saveGrant`), jinak token hned zneplatní (`revokeToken`). První přihlášení z nového prohlížeče jde starou
  cestou: druhé automatické přesměrování na `/api/google/kalendar/pripojit?auto=1`. Odmítnutý souhlas:
  brána nabídne „Přihlásit se bez Kalendáře“ (`?kalendar=ne`), `?jiny=1` vynutí výběr účtu.
- **Příjemci pozvánek** (`attendees.ts`, `listRecipients`): v režimu Googlu aktivní účty skupiny akce. Nově
  i fiktivní role svázaná s účtem Google ze seznamu `GOOGLE_LOGIN_ACCOUNTS` (dostane pozvánku na adresu Google).
  Přepínač `CALENDAR_ATTENDEES=audience` je od 13. 11. v noci zapnutý jen pro preview této větve. Budoucí
  vazby jsou vrácené do fronty, odešlou se, když správce otevře Plán (`after(syncPending)` na stránce Plán).
  Osobní účet uživatele je na jeho žádost z databáze smazaný (i vazba na Google), nezakládat ho znovu.
- **Stav Kalendáře** (`services/calendar-status.ts`, `CalendarStatusLine.tsx`): řádek na Plánu (jen správce mimo
  náhled) a ve Správě v sekci „Kalendář a pozvánky“ s tabulkou, kdo dostane pozvánku podle skupiny. Propojení
  se při načtení ověří u Googlu (vypršelý souhlas se pozná hned). V režimu Testing ukazuje datum vypršení
  (7 dní od souhlasu), dva dny předem nabídne „Obnovit propojení“. `GOOGLE_OAUTH_PUBLISHED=1` upozornění vypne.
- **Jedna role Správce** (`policy.ts`: `canPlan`, `isOrganizer` a `isAdmin` jsou totéž): v databázi zůstávají
  `admin` i `organizer`, Správa nabízí jen Správce a Člena týmu. Správce smí u každé akce nahrát záznam,
  číst pracovní zápis, zveřejnit ho i stáhnout (`canHandleRecording`, `canReadPublishedMinutes`). Mezi úkoly
  „Čeká na vás“ má dál jen akce, které sám vede nebo kontroluje. Testy: `tests/kalendar-prihlaseni.test.ts`,
  upravené `access`, `users`, `zapisy-temata`.
- **Nedoděláno z promptu:** hosté a doporučená témata v dialogu akce, zbylé texty „organizátor“ v UI, celá
  část C, dokumentace `README.md`, `docs/predani.md`, `docs/google-*.md`, snímky. Živý test neproběhl.

**Preview této větve:** `https://zbc-vzdelavani-demo-git-claude-blissful-mendel-ejkw5s-maci.vercel.app`, vlastní
`APP_URL` je na Vercelu nastavená. V Google konzoli je potřeba přidat `<adresa>/api/google/prihlaseni/callback`
a `<adresa>/api/google/kalendar/callback` (dělá uživatel). Přihlašovat se jen z této adresy větve.

**Diagnostika preview 13. 11. (proč se nic nepropisovalo):** Kalendář propojený je (12. 11. 17:48 testovacím
účtem svázaným s `demo-organizator`), synchronizace běží (5 vazeb `synced`, poslední 13. 11. 19:41). Pozvánky
ale šly jen na jednu adresu z `GOOGLE_ALLOWED_ATTENDEES`, protože `CALENDAR_ATTENDEES` na Vercelu není
nastavené. Osobní účet uživatele je ve Wiki Člen týmu ve skupinách Všichni a FP (pozvaný), neplánuje a mezi
hosty nebyl. Propojení v režimu Testing vyprší kolem 19. 11. Výchozí `APP_URL` preview míří na starou větev
`ccr-2d4283fa-slno9d`, každá testovaná větev proto potřebuje vlastní.

## Stav 13. 11. 2026 (větev `claude/amazing-edison-51eo2g`, bez PR)

Hotovo a ověřeno (lint, typy, 121 ze 121 testů, build; Chromium nad PGlite):

- **Okna (`src/components/Modal.tsx`):** vykreslují se přes portál do `<body>`. Okno otevřené z jiného okna to
  první po dobu práce schová (pravidlo `body > .dialog[open]:has(~ .dialog[open])`), po zavření se první vrátí.
  Klik mimo a Esc zavírají. Rozepsaný formulář (otisk polí se od otevření změnil) se nejdřív zeptá. Dialog akce
  si změny hlídá sám (`selfGuarded`).
- **Menu (`src/components/Menu.tsx`):** nahrazuje `details.menu`. Seznam je `position: fixed`, neořízne ho okno
  ani tabulka, otevře se nahoru, když se dolů nevejde. Zavírá klik mimo, Esc, posun stránky a volba položky.
  Položky zůstávají v dokumentu, aby si okna otevřená z menu držela stav. Odesílací tlačítka menu nezavírají.
- **Okno akce (`EventPeek`):** vlevo „Další možnosti“ (Zobrazit zápis, Otevřít celý detail, Nahradit pravidelný
  termín, pod čarou Zrušit akci nebo Smazat návrh), vpravo hlavní „Upravit“. Bez posuvníku na 1280 i 390 px.
  Stejné rozložení má záhlaví celého detailu akce. Kdo není organizátor, má odkazy jako tlačítka.
- **Plán:** filtry jsou úplně nahoře (`.plan-filter-bar`). „Čeká na vás“ i „Nejbližší akce“ se počítají pro
  diváka z „Zobrazit jako“ (`listTasks`, `nextEventsFor` se stejnými pravidly, úkoly v náhledu bez tlačítek)
  a respektují Typ akce i Stav (`matchesPlanFilter`, `JourneyTask.eventType`). Skryté úkoly ohlásí řádek
  „Filtr skrývá další úkoly“.
- **Témata:** karty ve dvou sloupcích, doporučená okrově. Jména zájemců po kliknutí na počet. **Vidí je jen
  organizátor a správce** (`listTopicInterested`, jinak `forbidden`), ostatní jen počet. Je to opatrná volba,
  čeká na potvrzení uživatele. Správa tématu je v menu (Upravit, Archivovat).
- **Zápisy:** zápis se otevírá v okně nad stránkou (`?zapis=<id>`, `MinutesPeek`), vedoucí v něm rovnou nahraje
  záznam a zápis zkontroluje. Tlačítko „Přidat zápis“ s počtem (`?pridat=1`, `listMissingMinutes`): vedoucí
  a kontrolor vidí své proběhlé akce bez zápisu, organizátor všechny jako přehled s odkazem na akci. **Organizátor
  sám nahrát nesmí**, pokud akci nevede (oprávnění se neměnila).
- Testy: `tests/zapisy-temata.test.ts`.

Neověřeno: body v části A.3 promptu, Safari, živý Google. Správa (bod A.1) se nezačala.

Rozhodnuto uživatelem 13. 11. večer: jména zájemců vidí ti, kdo plánují (tak to je). Správce a organizátor
mají umět vše včetně zápisů u cizích akcí a role se mají sloučit do jedné. Kalendář má fungovat automaticky
už od přihlášení (části A a B promptu).

Poznámky k prostředí: lokální běh `npx next dev -p 3100` nad PGlite, na `/vstup` kliknout na `label.persona`
a odeslat. Po větší změně serverových modulů vývojový server restartuj (držel starou verzi modulu).
`AGENTS.md` v kořeni je v repu, nemaž ho. Živý test: preview větve potřebuje vlastní `APP_URL`
(`https://zbc-vzdelavani-demo-git-<větev>-maci.vercel.app`) a dvě přesměrovací adresy v Google konzoli
(`/api/google/prihlaseni/callback`, `/api/google/kalendar/callback`). Větev `claude/festive-shannon-s7wa4o` je má.
Všechny preview sdílí jednu databázi Neon. Starší historii relací najdeš v gitu tohoto souboru.

## Odsouhlaseno 12. 11. 2026

- Hotové demo „jak by to vypadalo v realitě“, fiktivní role a simulace zůstávají jako přepínače.
- Role smí přidělovat správce i organizátor (roli správce jen správce). Pozvánka i žádost.
- Zatím osobní Gmaily, jeden firemní kalendář vzdělávání, jeden OAuth klient.
- E-maily: žádný vlastní poskytovatel. Pozvánky a změny rozesílá Google. Zveřejněný zápis doplní odkaz
  do pozvánky s rozesláním změny, ve Wiki je to v Moje cesta.

## Rozhodnuto 12. 11. 2026 večer

- Zásada UI: co je v dané části důležité, musí být vidět hned a přehledně. Proto je Přidat akci samostatné
  tlačítko a v nabídce jsou jen méně časté nástroje.
- Pořadí: nejdřív dodělat zbytek, potom živý test, potom testy, úpravy a změny včetně UI.
- Nahrávky a přepis: zatím jen demo. Firma nemá žádné vlastní služby ani úložiště, uživatel může nabídnout
  Google Disk. **Nic placeného se nezavádí, dokud to firma neschválí a nezaplatí.** Přepis teď není klíčový,
  stačí znát možnosti. Požadavek na budoucí přepis: co nejkvalitnější čeština, ideálně bez chyb, zpracování
  v EU. Delší záznamy (2 až 2,5 h) se v praxi otestují až na žádost firmy.

## Vercel a přístupy

- Tým `maci`, projekt `zbc-vzdelavani-demo`, plán Hobby. Preview se spouští pushem větve, produkci
  přeskakuje ignored build step. `POST /v13/deployments` nepoužívat (vytvoří produkční deploy).
- Proměnné pro Preview jsou nastavené (`CALENDAR_MODE`, `LOGIN_MODE`, `GOOGLE_*`, `TOKEN_ENCRYPTION_KEY`,
  `APP_URL`, `GOOGLE_LOGIN_ACCOUNTS`). Nesecretní zakládá Claude přes API sám, tajemství doplní uživatel.
- Preview chrání Vercel Authentication. Pro Playwright: sdílecí odkaz z dashboardu (Share, 23 h) a
  dočasně povolený host preview v síťových pravidlech prostředí (po testu odebrat). Vercel runtime logy
  přes konektor vrací 403, data jdou číst přes Neon konektor (projekt `neon-zbz-vzdelavani-demo`).
- Do Wiki se automat dostane jen přístupovým kódem. Kód zná uživatel, nikam ho nezapisuj. Doporučeno
  ho po testu 12. 11. změnit, protože byl v chatu.
- Pozor: Google přihlášení a Kalendář sdílí jednoho OAuth klienta.

## Čeká na odpověď uživatele

- Výběr poskytovatele přepisu a úložiště: přehled je v `docs/nahravky-moznosti.md`, odloženo, rozhodne firma.
- Skutečné pravidlo střídání typů ve slotu šablony a zda předvyplňovat téma i tréninkům.
- Kam trvale uložit zadání (ZIP), aby ho nebylo nutné posílat. Do tohoto veřejného repa ne.

## Úklid, rozhoduje uživatel

- Token pro `api.vercel.com` v síťových tajemstvích prostředí Default a sloučená větev
  `claude/vzdelavani-vercel-preview-52jflw`.
- Jednobajtový soubor `h` v kořeni repa (commit „Create h“), nejspíš omyl.
- Tento soubor uvádí názvy projektů na Vercelu a v Neonu. Nejsou to tajemství, u veřejného repa zvážit.

Respektuj limit kontextu v `CLAUDE.md`. Na `main` nepushuj, merge dělá uživatel přes PR.
