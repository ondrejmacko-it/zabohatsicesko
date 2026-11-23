# Report: finální integrační opravy F01–F18 (23. 11. 2026)

Větev `claude/funkce/finalni-integracni-opravy` nad koncem stacku `claude/funkce/kalendar-f04` (PR #84,
`153616b`). Draft PR do `claude/funkce/kalendar-f04`. Nic není sloučené, žádná produkční operace neproběhla.
Testovaný commit a čísla jsou v oddílu 6.

## 1. Co bylo hotové už před opravou

* Stack PR #77–#84 je lineární (každá větev obsahuje předchozí), všechny jsou Draft, `MERGEABLE`, base sedí.
* F01–F18 implementované podle `docs/pozadavky-f01-f18.md` včetně tabulky bod → testy. F02–F05 jsou za
  přepínačem `PARTICIPATION`, F04 ověřené jen v simulaci Kalendáře.
* Pojistky nasazení fungují: ostrá Wiki (`WIKI_MODE=production`) v kódu ignoruje `PARTICIPATION`,
  `EVENT_VISIBILITY` i `RECORDING_DEMO`; migrace 0015 a 0016 na vzdálené DB vyžadují `APPROVED_MIGRATIONS`.
* Náhled „Zobrazit jako“ neukazuje cizí omluvy (`ownParticipationDetail` s náhledem vrací `excuse: null`, test
  v `ucast-prihlasky.test.ts`). Důvod ani poznámka omluvy nejdou do Googlu (testy v `kalendar-ucast.test.ts`).

## 2. Co jsem skutečně opravil

Každá oprava má regresní test, který **před opravou selhal** a po ní prošel (ověřeno vrácením souboru opravy).

### A. Přepočet pozvánek po změně účtu (kritické)

* **Problém:** po deaktivaci zůstal člověk ve spravovaných hostech akce jiné skupiny, ke které se dobrovolně
  přihlásil. Stejně tak u akcí „Všichni“, když účet neměl uloženou skupinu `vsichni`.
* **Příčina:** `requeueAttendeeSync()` v `src/server/calendar/attendees.ts` vracel do fronty jen akce, jejichž
  publikum bylo ve starých nebo nových skupinách. Při prázdných skupinách nevracel nic.
* **Řešení:** funkce dostane člověka (`{ id, groups }`) a vrátí do fronty budoucí akce, kde: publikum je ve
  starých či nových skupinách nebo „Všichni“; nebo má člověk u akce přihlášku či omluvu; nebo je jeho adresa
  (ze Správy i ze svázaného účtu Google) mezi hosty spravovanými Wiki. Volání v `src/server/services/users.ts`
  (`inviteUser`, `updateAccess`). Samotný výpočet hostů se nemění (`eventAttendees`, `planGuests`), takže ruční
  hosté, cizí RSVP, deduplikace, zámek synchronizace i fronta s opakováním zůstávají.
* **Testy** (`tests/kalendar-ucast.test.ts`, proti napodobenému Googlu): deaktivace odebere dobrovolnou
  přihlášku k akci jiné skupiny a ruční host zůstane; opětovná aktivace ji vrátí; dvojí spuštění fronty nic
  nezdvojí ani znovu neposílá; odebrání poslední role bez uloženého „vsichni“; výpadek Kalendáře nezvrátí
  deaktivaci a pozvánka se srovná při dalším pokusu. Každý test ověřuje skutečné složení hostů.
* **Výsledek:** první test před opravou selhal (`expected 'synced' to be 'pending'`), po opravě 6/6.
* **Dopad na produkci:** po změně účtu se přepočítá víc budoucích akcí než dřív. Správné chování, ale v ostré
  Wiki to znamená skutečné úpravy pozvánek deaktivovaného člověka.

### C. Náhled dopadu změny zveřejněné akce (kritické)

* **Problém:** dialog před zveřejněním změny sliboval jiné hosty, než Wiki potom pozvala. Při změně termínu
  akce s omluveným tvrdil, že omluveného přidá. V režimu „všechny zveřejněné akce“ tvrdil, že původní skupina
  akci „přestane vidět“. Potvrzení nezastarávalo po nové přihlášce nebo omluvě.
* **Příčina:** `changeImpact()` v `src/server/services/impact.ts` počítal hosty `audienceAttendees` (jen
  skupina), synchronizace `eventAttendees` (individuální účast).
* **Řešení:** náhled, počet dotčených i otisk potvrzení počítají hosty stejnou funkcí jako synchronizace,
  nad zveřejněnou verzí po změně (`nextSnapshot`). Věta o publiku (`audienceNote`) odpovídá režimu viditelnosti.
  Bez účasti a v ostré Wiki je výsledek stejný jako dřív. Server dál odmítá chybějící a zastaralé potvrzení.
* **Testy** (`tests/dopad-zmeny-ucast.test.ts`, nový): náhled → zveřejnění → synchronizace a porovnání
  slíbených a skutečně přidaných a odebraných hostů pro změnu termínu s omluveným, RM → FP s přihlášeným i
  omluveným, RM → Všichni; přihláška i změna skupiny během potvrzování potvrzení zneplatní; staré potvrzení
  po zveřejnění neplatí; výpadek Kalendáře neslibuje konkrétní hosty.
* **Výsledek:** před opravou 4 ze 6 selhaly, po opravě 6/6 a stávající `publishing.test.ts` a `presun.test.ts`
  beze změny zelené.

### D. O09: nepravdivá věta o pozvánce

* **Problém:** u ručního hosta spárované pozvánky panel „Tvoje účast“ po omluvě řekl „Pozvánku v Kalendáři
  nemáš, omluva ji odmítla.“, i když host v pozvánce zůstal. Před omluvou tvrdil „čeká na odeslání“.
* **Příčina:** `calendarNote()` v `src/lib/calendar-note.ts` z toho, že člověk není mezi spravovanými hosty,
  usuzoval, že pozvánku nemá. Slovo „odmítla“ navíc naznačovalo RSVP `declined`, které Wiki nenastavuje (O04).
* **Řešení:** věty říkají jen to, co Wiki ví:
  * pozvaný, odesláno, mezi spravovanými není: „Wiki tvoji pozvánku nespravuje. Její stav ověř v Kalendáři.“
  * omluvený, odebrání čeká: „Odebrání z pozvánky v Kalendáři čeká na odeslání.“
  * omluvený, hotovo: „Wiki tě na tuto akci do Kalendáře nezve.“
  Účast ve Wiki (štítek „Omluveno ve Wiki, platí hned.“), synchronizace a Google RSVP se nezaměňují.
* **Testy:** `tests/kalendar-f04.test.ts` › O09 (spárovaná pozvánka, ruční host, omluva), tabulka
  `calendarNote`, e2e `ucast.spec.ts` › F04 s novým textem. Před opravou selhal, po ní 26/26.

### B. Kdo smí číst důvod omluvy (bez změny kódu oprávnění)

* Wiki **nemá žádnou manažerskou strukturu** (žádný nadřízený, tým ani vazba člověk → manažer v `schema.ts`).
  `vedouci-tymu` je jen pracovní role bez publika (O02). Oprávnění jsem proto **neotevřel nikomu dalšímu**.
* Doplněný test (`tests/ucast-role.test.ts`): hlavní správce, vedoucí týmu ani kolega ze skupiny důvod
  nevidí. Rozhodnutí R1 níže.

### Drobnost mimo aplikaci: E2E na Windows

`e2e/server.mjs` spouštěl Next přes `spawn("npx")`, což na Windows bez shellu selže (server nevznikne).
Teď `process.execPath` + `node_modules/next/dist/bin/next`, chování na Linuxu a macOS je stejné.

## 3. Co jsem záměrně neměnil

* **E (O04, `declined`):** Wiki omluveného odebere ze spravovaných hostů a `declined` za něj nenastavuje.
  Ponecháno: nastavit odpověď za cizí účet organizátor přes API spolehlivě neumí a ověřit by to šlo jen
  živým testem (D06). Selhání Googlu omluvu nevrací (test „když Kalendář selže, omluva ve Wiki platí dál“).
* **F (O08, retence poznámek):** lhůta není v podkladech ani v repu stanovená. Automatické mazání jsem
  nezavedl. Návrh v R2.
* **G (počet garantovaných témat):** `main` už od PR #73 dovoluje libovolný počet (migrace 0015). Počet ani
  migrace jsem neměnil. Ověřeno, že řazení a filtr jsou pokryté (`temata-priority.test.ts`,
  `temata-f10-f12.test.ts`, e2e `temata-planovani.spec.ts`: myš, dotyk, klávesnice, jen správce, souběh).
* **H (vedoucí týmu):** role je v typech (`WORK_ROLES`) a v testech, ale Správa ji v UI přiřadit neumí
  (`AccessForms.tsx` nabízí jen FP, RM, Tým A) a nic neodemyká. F05 je ověřené pro FP+RM. Neoznačuji
  „vedoucí týmu“ za hotové pro reálné použití. Rozhodnutí R5.
* **I (zápisy a AI):** `redaction.ts` je pojistka nad testovanými vzory (e-mail, telefon, RČ, číslo účtu,
  jméno za „klient/pan/paní“, známá křestní jména), ne záruka. Externí AI služba není zapojená: drafter je
  lokální ukázka a `training: "never"` je jen tvrzení v kódu. Před napojením skutečné služby je nutné ho
  doložit jejími smluvními podmínkami. Nic jsem nezapojoval.
* Design, texty mimo O09 a mobilní rozvržení beze změny.

## 4. Co vyžaduje tvoje nebo firemní rozhodnutí

| | Typ | Rozhodnutí | Doporučení |
|---|---|---|---|
| R1 | business + bezpečnost | Kdo je „oprávněný manažer“ pro důvod omluvy (F03, D01) | Nejmenší rozšíření: sloupec `users.manager_id` (přímý nadřízený, nastavuje správce ve Správě), `canReadExcuseDetails` = sám omluvený nebo jeho přímý nadřízený s aktivním účtem, v náhledu nikdy. Chce migraci (ke schválení) a reálné mapování od firmy. Do té doby vidí důvod jen omluvený. |
| R2 | bezpečnost (GDPR) | Retence poznámek a důvodů omluv | Po skončení akce +90 dní smazat `excuse_note` (důvod-kategorii nechat pro statistiku), denně v existující frontě (`/api/kalendar/fronta`). Lhůtu musí potvrdit firma. |
| R3 | produkční konfigurace | Zapnout F02–F05 na Preview pro tvé testování | Buď lokálně (bez rizika, viz oddíl 9), nebo pro jednu větev Preview `PARTICIPATION=on` + `APPROVED_MIGRATIONS=0015_topic_priority_unlimited,0016_event_participation`. Pozor: Preview DB je sdílená, 0016 se provede pro všechny větve (jen přidá tabulku). |
| R4 | produkční konfigurace | 0015 v produkci neprovedená, přitom kód v `main` ji předpokládá | Před přidáním 4. garantovaného tématu v ostré Wiki: záloha DB, pak `APPROVED_MIGRATIONS=0015_topic_priority_unlimited` v Production. Do té doby DB odmítne víc než 3 garantovaná témata. |
| R5 | business | Vedoucí týmu: má mít vlastní povinné akce a jak se přiřazuje? | Zatím nechat jen jako připravenou roli. Firma dodá, kdo vedoucí je a co má vidět. |
| R6 | business | Garantovaná témata: neomezeně (kód) × 3 (původní návrh) | Ponechat neomezeně (nic se nemaže, pořadí řídí správce). Potvrdit s firmou před ostrým používáním. |
| R7 | bezpečnost | Živý test Google Kalendáře (F04, O04) | Samostatný testovací kalendář a 2–3 testovací účty, Preview s `CALENDAR_MODE=google-test`, `CALENDAR_DELIVERY=organizer`, `CALENDAR_ATTENDEES=audience`. Až po tvém výslovném souhlasu. |
| – | integrace | Napojení do Moje ZBČ | Mimo rozsah (D05), čeká na technické podklady. |

## 5. Matice F01–F18

Stav po této větvi. Konkrétní názvy testů jsou v `docs/pozadavky-f01-f18.md` › „Bod → konkrétní testy“.

| Bod | Stav | Kde | Testy | Omezení |
|---|---|---|---|---|
| F01 | hotovo | `prepare-month.ts`, `PrepareMonth*` | `priprava-mesice.test.ts`, `ucast-role.test.ts`, e2e `okna.spec.ts` | – |
| F02 | hotovo za přepínačem | `domain/participation.ts`, `policy.ts` | `ucast-role`, `ucast-prihlasky`, e2e `ucast.spec.ts` | v ostré Wiki vypnuto |
| F03 | hotovo za přepínačem, manažer chybí | `services/participation.ts`, `ParticipationPanel` | `ucast-prihlasky`, `ucast-role` (+B) | R1 |
| F04 | hotovo v simulaci | `calendar/attendees.ts`, `sync.ts`, `calendar-note.ts` | `kalendar-f04` (+O09), `kalendar-ucast` (+A), e2e `ucast.spec.ts` | živý test R7 |
| F05 | hotovo pro FP+RM | `domain/participation.ts` | `ucast-role`, e2e `ucast.spec.ts` | vedoucí týmu R5 |
| F06–F09 | hotovo | Plán, příprava měsíce | `priprava-mesice-f06-f09.*` | – |
| F10–F12 | hotovo | `domain/topics.ts`, `TopicsSection` | `temata-f10-f12`, e2e `temata-planovani` | R6 |
| F13–F15 | hotovo | `RecordingSection`, `redaction.ts`, `ai-data-use.ts` | `zapisy-f13-f15`, e2e `zapisy-*` | anonymizace je pojistka, AI není zapojená |
| F16–F18 | hotovo | `(wiki)/layout.tsx`, `greeting.ts`, záhlaví | `nahled`, `osloveni`, e2e `nahled`, `zahlavi` | vlastní oslovení se neukládá (migrace) |

Napříč: náhled dopadu změny (C) nově odpovídá F04.

## 6. Výsledky testů

Prostředí: Windows 11, Node 24.21.0, npm 11.19.0, lokální PGlite, simulace Kalendáře a napodobený Google.
Testovaný kód: commit `616456e` (opravy) + dokumentace v následujícím commitu, který kód nemění.

| Kontrola | Výsledek |
|---|---|
| Lint (`npm run lint`) | 0 chyb, 0 varování |
| Typecheck (`npm run typecheck`) | OK |
| Unit + DB + migrace (`npx vitest run`) | 55 souborů, **547/547** (před větví 535, +12 nových) |
| Production build (`npm run build`) | OK |
| E2E Playwright, Chromium (`npm run e2e`), 3. a 4. celý běh po sobě | **1333 OK, 0 chyb, 213 přeskočeno** (15,8 min) a znovu **1333 OK, 0 chyb, 213 přeskočeno** (15,2 min) |
| E2E, 1. celý běh (stejný kód) | 1318 OK, 15 chyb, 213 přeskočeno: jen `okna.spec.ts` v `telefon-360`, `net::ERR_CONNECTION_REFUSED/RESET` na ukázkovém serveru 3310 během několika sekund, pak další testy zase prošly |
| E2E, 2. celý běh (stejný kód) | 1325 OK, 7 chyb, 213 přeskočeno: jen `temata-planovani.spec.ts:75` (od `windows-1920` dál; ve `windows-1280` prošel) a navazující :216 |
| E2E cíleně (stejný build) | témata 59/59, okna `telefon-360` 37/37, 4 reprodukce se zapisujícími specy před testem témat a všechny specy pro `windows-1280` + `windows-1920` (465 OK): ani jednou selhání |
| Firefox, WebKit | **netestováno** (prohlížeče nejsou nainstalované; `E2E_WEBKIT=1` po `npx playwright install webkit firefox`) |

**Hodnocení E2E (pravdivě):** dva poslední celé běhy po sobě jsou zelené (1333/0/213). Dvě dřívější selhání se
nepodařilo reprodukovat ani dohledat jejich příčinu:
* 1. běh: ukázkový server 3310 na několik sekund odmítal spojení (`ERR_CONNECTION_REFUSED`), proces nespadl a
  `e2e/server.mjs` ho nerestartuje, takže jde nejspíš o přetížení Windows při 3 workerech a 3 serverech.
* 2. běh: téma „Otevřené otázky na schůzce“ po testech ve `windows-1280` přestalo být „bez termínu“. Vyloučené
  zapisující specy: `doporucene-tema`, `priprava-mesice*`, `zapisy*`, `okna` (jen formuláře bez uložení),
  `temata-planovani` sám; ani celé dva projekty za sebou chybu nevyvolaly. Viník mohl být souběh dvou zápisů do
  sdílené ukázkové DB.
Kód aplikace ani testy jsem kvůli tomu neměnil: bez reprodukce by šlo jen o odhad. Nic není přeskočené ani
oslabené. Opravy A, C a D se těchto testů netýkají. Nestabilitu sdílených dat ukázky v E2E doporučuji řešit
samostatně (vlastní data pro každý zapisující test).

Přeskočené E2E jsou záměrné: testy, které zapisují do sdílených dat, běží jen v jednom projektu
(`windows-1280`, `telefon-390`), testy pro telefon jen na telefonu a pro počítač jen od 900 px.

## 7. PR a Git

* Opravný PR: viz `docs/navod-merge-f01-f18.md` (tabulka, řádek 1), base `claude/funkce/kalendar-f04`.
* Nad `153616b` jen nové commity, žádný force push, historie stacku beze změny, konflikty žádné.

## 8. Přesný návod merge

`docs/navod-merge-f01-f18.md`. Shrnutí: slučovat **odshora dolů** s volbou **Create a merge commit**:
#85 → #84 → #83 → #82 → #81 → #80 → #79 → #78 a nakonec #77 do `main`. Do `main` tak jde jen jeden merge
a produkce se nasadí jednou. Každý merge do `main` nasazuje produkci automaticky, proto krok 9 v klidné
chvíli a s připraveným Instant Rollback.

## 9. Příprava na tvoje uživatelské testování

**Kde:** nejbezpečněji lokálně. V `C:\Users\ondra\zabohatsicesko` vytvoř `.env.local` s řádky
`PARTICIPATION=on` a `RECORDING_DEMO=on`, pak `npm run dev` a otevři `http://localhost:3000`. Data jsou
fiktivní (PGlite v `.data`), Kalendář je simulace, nic neodchází. Na Preview F02–F05 neuvidíš bez R3.

| Role | Co vyzkoušet |
|---|---|
| Správce | Připravit měsíc → Pro koho → hromadně téma a vedoucí → Zveřejnit (věta u šedého tlačítka) → změnit termín nebo publikum zveřejněné akce → dialog dopadu odpovídá tomu, kdo pak v simulaci pozvánku má |
| FP | Moje / Všechny, štítky „Povinné pro tebe“ / „Můžeš se přihlásit“, přihlásit a odhlásit RM akci, omluvit se z FP akce (nemoc / dovolená / jiné + poznámka), zrušit omluvu, věta o Kalendáři v panelu |
| RM | Totéž s opačnou povinností |
| FP+RM (účet vedoucí) | Obě skupiny povinné, v simulované pozvánce jen jednou |
| Vedoucí akce | Zápis: vložit text → uložit návrh → doplnit → schválit → zveřejnit → další úprava nepřepíše schválenou verzi; věta „Zápis schvaluje…“ |
| Správa účtů | Pozvat → změnit roli → odebrat roli → deaktivovat → znovu aktivovat; po každém kroku zkontrolovat pozvánky v simulaci |
| Mobil | Totéž na telefonu (DevTools 390 px): záhlaví na jednom řádku, menu ⋯, dialogy, přetahování témat dotykem |
| Kalendář | Jen simulace. Živý Google až po R7 |
| Chyby | Vzdělávání → Integrace (`/vzdelavani/integrace`) → „Výpadek Google Kalendáře“ zapnout, pak se omluvit: omluva platí, synchronizace čeká a zkusí to znovu |
