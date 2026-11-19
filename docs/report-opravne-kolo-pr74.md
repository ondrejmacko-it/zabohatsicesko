# Opravné kolo PR #74 – průběžný report

Větev `claude/finalni-kontrola-novy-pr-g2r2wd` (draft PR #74). Výchozí HEAD `2127f4c` (kód = `c4c3a9a`), main `e27b631`.

## Potvrzené problémy a opravy

| ID | Problém | Stav | Oprava | Commit |
|---|---|---|---|---|
| P0-3 | Hromadný výběr vedoucího v Připravit měsíc nepřijal osobu (zůstalo „Vyberte vedoucího“, tlačítko neaktivní) | Potvrzeno reprodukcí v Chromiu (klávesnice i myš) | U výběrů se přehled přepočítá až na `change` | 0b1c0d2 |
| P0-2 | Pevný limit 3 garantovaných (doména, služba, DB CHECK 1–3, text „Nastaveno N ze 3“) | Potvrzeno v kódu | Bez maxima, garantovaná vždy první v doporučení, migrace 0015 se schválením | bea1c6c |
| P0-1 | DnD jen v rámci sekce, nestabilní na delší vzdálenost | Potvrzeno v kódu (DOM se přeskládává během tažení) | Atomický `placeTopic` na serveru; UI `TopicBoard`: jeden kontext přes obě skupiny, DOM se během tažení nemění | bea1c6c, ba4b169 |
| P1-2 | Garantovaná jen tenký pruh, nejžádanější bez akcentu | Potvrzeno v CSS | Garantovaná okrový podklad a pruh, nejžádanější mezi ostatními zelený pruh a štítek (tokeny `--ochre-soft`, `--ok`) | ba4b169 |
| P1-1 | ⋯ v mřížce vpravo dole 36 × 32 px přes čas, téma a štítek; v agendě `transform` dělal rámec pro `position: fixed`, menu se na telefonu otevíralo mimo obrazovku | Potvrzeno snímky 768/1280 a měřením (seznam y=1593 při okně 900) | ⋯ 26 × 22 px (dotykově 30 × 26, plocha 44 px) vpravo nahoře v řádku názvu s vyhrazeným místem, výstraha vlevo od něj; agenda bez `transform`; dlouhé menu na stranu s víc místem s `maxHeight`, v nízkém okně posun do okna | eda8a14 |
| P1-3 | Správa: e-mail, role i skupiny stejným písmem; Připravit měsíc: nulové počty jako tlačítka; Pravidelný rozvrh: dva úvodní odstavce | Potvrzeno snímky | Role štítkem (správce okrový), e-mail menší tlumený; nuly tichým textem; úvod rozvrhu jedním odstavcem | 7f04ef9 |

## P0-3: výsledek reprodukce

Scénář: Připravit měsíc → první dva řádky bez vedoucího → hromadný výběr klávesnicí (šipka dolů) i kliknutím a Enter.
Zaznamenané události na `<select>`: `input` s novou hodnotou, poté `change` už se starou prázdnou hodnotou.
Příčina: formulář měl `onInput` → `readFilled` → `setState`. Re-render po samostatné události `input` nastavil řízený
`<select value={bulkLead}>` zpět na `""` dřív, než React na `change` zavolal `setBulkLead`. Řádkové výběry jsou neřízené,
proto fungovaly. Playwright `selectOption` posílá `input` a `change` v jedné úloze bez překreslení mezi nimi, takže
dosavadní e2e chybu nezachytil. Ověřeno, že nový e2e test bez opravy padá (`expect(second).not.toBe("")`) a s opravou
prochází. Ostatní řízené výběry (okno akce: typ, vedoucí) klávesnicí fungují, `onInput` na formuláři mají jen tady.
Uložení a obnovení stránky ověřeno e2e, server beze změny (oprávnění, existence účtu, souběh revize pokrývají unit testy).

## P0-2: nová logika garantovaných témat

* Pořadí garantovaných je 1..n bez horní meze, nové garantované jde na konec, zrušení a archivace pořadí sesypou.
* `recommendTopics`: nejdřív všechna garantovaná (podle pořadí), pak téma pro skupinu, pak pořadí zájmu a historie.
* `placeTopic`: přesun na pozici i mezi sekcemi v jedné transakci pod zámkem řádků témat. Kontrola obou seznamů,
  jak je správce viděl (jinak `conflict` bez zápisu). Do garantovaných: priorita, ruční pořadí se zruší. Mezi ostatní:
  priorita zmizí, ostatní dostanou ruční pořadí (pozice má smysl jen s ním). Téma je stále stejný řádek.
* Migrace 0015: `DROP CONSTRAINT topics_priority_rank_check`, typ `integer`, `CHECK (priority_rank >= 1)`, unikátní
  index beze změny. **Na vzdálené DB se spustí jen s `APPROVED_MIGRATIONS=0015_topic_priority_unlimited`** (migrace
  běží při startu aplikace). Bez ní platí stará mez 1–3 a server vrátí čitelnou chybu.

## Rizika migrace 0015

* Zpětně kompatibilní: starší kód s novým schématem funguje (pořadí 1–3 jsou platná). Rollback = znovu přidat CHECK
  1–3 jen pokud žádné téma nemá pořadí > 3.
* Název omezení `topics_priority_rank_check` je výchozí název PostgreSQL pro sloupcový CHECK z 0013. Před spuštěním
  na Preview ověřit SELECTem v `pg_constraint` (jinak by zůstalo staré omezení, `IF EXISTS` nespadne).
* `ALTER COLUMN TYPE integer` přepíše tabulku `topics` (malá), krátký zámek.

## Testy (relace 1)

* Unit 405/405, lint, typecheck OK. E2E `priprava-mesice.spec.ts` (windows-1280) 13/13.
* Celé e2e, build a screenshoty zatím ne (další relace).

## P0-1: přetahování témat (relace 2)

* Příčina nestability: původní `TopicOrderList` přeskládával řádky v DOM při každém pohybu a cíl počítal z aktuálních
  (už posunutých) řádků; seznamy byly dva oddělené kontexty.
* Nově `TopicBoard`: řádek zůstává na místě jako zástupné místo, náhled je `position: fixed` u ukazatele (absolutní
  náhled prodlužoval stránku a autoscroll jel do prázdna – nalezeno e2e testem), linka ukazuje místo vložení.
  Cíl = skupina podle hranice mezi seznamy + počet středů řádků nad ukazatelem (souřadnice dokumentu zachycené při
  startu, platí i po posunu stránky). Prázdná skupina se zvýrazní celá. Po puštění jedna `placeTopicAction`.
* Bez knihovny: vlastní řešení pokrylo myš, dotyk, klávesnici, autoscroll i přesun mezi skupinami, nová závislost
  by nic nepřidala.
* Klávesnice: šipky o jedno místo, přes okraj skupiny do druhé (poslední garantované ↓ = první z ostatních).
  Fokus zůstává na úchytu, oznámení pro čtečku („je garantované“, „už není garantované“, „Přesun zrušen.“).

## Testy (relace 2)

* E2E přetažení (windows-1280, zápis jen jednou): 20+ ostatních témat, o 1/3/5/6 míst oběma směry, poslední→první
  a první→poslední s autoscrollem, Esc, ostatní→garantovaná na 1. místo, garantované v rámci skupiny i mezi ostatní,
  prázdná skupina jako cíl, klávesnice přes hranu skupin, souběh dvou oken (odmítnuto, vráceno), po archivaci,
  prst na 390 px (stránka se neposune), každý krok ověřen i po obnovení stránky. Unit: seznamy 1/3/10/25.
* Lint, typecheck OK. E2E temata-planovani, klavesnice, pristupnost, stranky, domu-ukoly, doporucene-tema, kdo-tema
  na všech projektech: 654 passed, 27 skipped, 0 failed.

## Relace 3 (P1-1, P1-3 cíleně)

* P1-1 testy (`rychle-akce.spec.ts`): nový test ⋯ nepřekrývá žádný text ani ikonu v žádné kartě mřížky, klik
  na ⋯ neotevře okno akce a stisk + tažení za ⋯ nespustí `dragstart`; dlouhé menu v okně 1280 × 260 celé v okně.
  Ověřeno: typecheck, lint, e2e rychle-akce + mobilni-ovladani + okna (1280, 1920, 1440, 390, 320) 220 passed / 43 skipped.
* P1-3: e2e pristupnost, stranky, priprava-mesice, okna, ostra-wiki na všech projektech 891 passed / 42 skipped /
  7 failed (jen změněný text úvodu rozvrhu v `okna.spec.ts`, test upraven, 11/11 passed).
* P1-4 inventura (záměrně beze změny v této relaci): Combobox (s vyhledáváním) mají Téma v okně akce i v Připravit
  měsíc. Nativní `<select>` se stylem Wiki: Vede, Pověřený kontrolor, Typ akce, Skupina (okno akce), vedoucí
  a skupina v řádcích Připravit měsíc a hromadný vedoucí, filtry Plánu a Zápisů, role ve Správě, zdroj zápisu.
  Datum a čas nativní `type=date/time` (bez vlastního datepickeru, dohodnuto dřív). Seznam osob je v ukázce krátký
  (5), nativní výběr je na telefonu nejpřístupnější. Návrh k rozhodnutí: výběr osoby (Vede, Kontrolor, vedoucí
  v Připravit měsíc) přes Combobox s vyhledáváním a hodnotou ID, až bude osob víc (riziko: P0-3 právě opravený).
* P1-5: průchody (vytvoření, editace, duplikace, přesun, doplnění měsíce, hromadné vyplnění, naplánování tématu,
  zápis) mají přímé formuláře, potvrzení nevratných kroků a rozdíl Uložit × Zveřejnit; beze změny.

## Relace 4: celé ověření, snímky a předání

### Testy na HEAD (lokálně, Chromium, bezpečná simulace kalendáře)

* ESLint, typecheck, unit **406/406**, produkční build: OK.
* Celé e2e (`npx playwright test --trace off`, všechny projekty 320–1920, macOS/Windows/telefon, přístupnost
  axe, oprávnění, únik dat, kalendářní procesy v simulaci, ostrá Wiki s falešným Google): **1176 passed /
  114 skipped / 1 failed**. Selhání: přesun šipkou přes hranici skupin ztratil fokus na úchytu, když pořadí
  z předchozího uložení dorazilo až po dalším stisku (řádek se na chvíli vykreslil v druhém seznamu jako nový
  prvek). Oprava c36436b: při přepisu pořadím ze serveru se fokus vrátí na úchyt. Po opravě lint, typecheck OK,
  `temata-planovani` (windows-1280) 3 × samostatně 12/12, `temata-planovani` + `klavesnice` na všech projektech OK.
* Skipped = testy omezené záměrně na jeden projekt (zápis do DB jen jednou) nebo jen desktop/telefon.
* Firefox/WebKit se v kontejneru nespouští (WebKit projekt jen při dostupném prohlížeči), neověřeno.
* Migrace 0015 ověřena jen na lokální PGlite (e2e a unit). Na stagingu (Preview) **nespuštěna**, čeká na schválení.

### Screenshoty před/po

`docs/screenshots/opravne-kolo-pr74/`: `pred-*` = c4c3a9a (před opravným kolem), `po-*` = c36436b, šířky 320, 390,
768, 1280, 1440, 1920 (výška okna 700/844/1024/800/900/1080, deviceScaleFactor 1, `cs-CZ`). Obrazovky: `domu`,
`plan`, `plan-menu` (otevřená nabídka ⋯ u „Portfolio tým“), `pripravit-mesic`, `rozvrh` (Nastavit pravidelný
rozvrh), `pridat-akci`, `okno-akce`, `temata`, `zapisy`, `sprava`. 120 snímků, 16 MB.
Porovnání: ⋯ menší a vpravo nahoře bez překryvu textu, nabídka v okně i na 320 px; garantovaná témata okrový podklad
a pruh, nejžádanější zelený akcent; Správa role štítkem; Připravit měsíc nulové počty tiše; text „Nastaveno N ze 3“
zmizel. Typografie a paleta Wiki beze změny.

### Záměrně nezměněno

* Výběr osob (Vede, Kontrolor, vedoucí v Připravit měsíc) zůstává nativní `<select>` (P1-4, návrh v inventuře výše).
* Datum a čas nativní `type=date/time`, bez vlastního datepickeru.
* Průchody P1-5 (formuláře, potvrzení, Uložit × Zveřejnit) beze změny, fungují.
* Schválené zápisy, historie a zámek proti souběhu beze změny (e2e zapisy, zapisy-schvaleni prošly).
* Žádné automatické zveřejnění, mazání dat ani odesílání pozvánek; kalendář jen v simulaci.
* Server výběru vedoucího beze změny (oprava P0-3 je čistě v UI).

### Commity opravného kola

0b1c0d2 P0-3 · bea1c6c P0-2 + migrace 0015 · ba4b169 P0-1 + P1-2 · eda8a14 P1-1 · 7f04ef9 P1-3 · c36436b fokus
při přesunu klávesnicí · předávky c380dd2, ff27312, cb02688 · snímky před a po.

### K rozhodnutí uživatele

1. Spustit migraci 0015 na Preview: nesecretní `APPROVED_MIGRATIONS=0015_topic_priority_unlimited` v Preview env
   + redeploy; předtím SELECT názvu omezení v `pg_constraint`. Bez ní Preview odmítne 4. garantované téma čitelnou chybou.
2. Výběr osob přes Combobox s vyhledáváním (P1-4), až bude osob víc.
3. Vedoucí akce se dnes nekontroluje proti příslušnosti ke skupině (jen existence účtu a oprávnění správce).
4. Merge PR #74 do main ručně po revizi.

## Relace 5: před merge (rozhodnutí uživatele body 1–6)

### 1. Migrace 0015 a Preview DB

Read-only ověření (jen metadata a SELECT, žádná hodnota tajemství se nečetla):

* **Oddělenost:** Vercel `DATABASE_URL` pro Preview a Production jsou různé proměnné z různých Neon úložišť
  (Preview → `store_b8h3…` = Neon `still-shadow-86247101` „neon-zbz-vzdelavani-demo“, Production → `store_memn…`
  = Neon `bitter-breeze-02749976` „zbc-wiki-produkce“). Preview tedy produkční databázi nevidí.
* **Omezení na Preview:** `topics_priority_rank_check` = `CHECK (priority_rank >= 1 AND priority_rank <= 3)`, sloupec `smallint`.
* **`schema_migrations` na Preview:** poslední `0014_minutes_sources_and_approval` (18. 11. 21:05 UTC), 0015 chybí.
* **Obnova:** Neon PITR 6 h (`history_retention_seconds` 21600) a navíc záložní větev
  `zaloha-pred-0015-2026-11-19` (`br-hidden-mode-b9dux46b`, bez compute) vytvořená z Preview `main` před migrací.

Úprava migrace (8c2fa73): místo `DROP CONSTRAINT IF EXISTS` nejdřív blok `DO $$ … RAISE EXCEPTION`, který ověří,
že omezení `topics_priority_rank_check` existuje a má horní mez 3. Jinak migrace selže celá (transakce, schéma beze
změny) a server nenastartuje s chybou místo tichého pokračování. Blok je na jednom řádku, protože `prepareDatabase`
dělí SQL podle středníku na konci řádku (pokryto testem). Nový `tests/migrace-0015.test.ts` (PGlite): úspěch
s očekávaným omezením, selhání bez omezení i s jinou horní mezí, schéma po selhání beze změny.

Spuštění na Preview: nesecretní `APPROVED_MIGRATIONS=0015_topic_priority_unlimited` jen pro Preview a jen git
větev `claude/finalni-kontrola-novy-pr-g2r2wd` (Production ji nemá), redeploy 8c2fa73 → `dpl_Hc4z5f5w7z2x7QEa7bF2bNxa4M9X` READY.
Migrace se spouští při prvním dotazu do DB (`getDb`), ne při buildu.

**Stav:** 0015 na Preview **proběhla 19. 11. 18:07:11 UTC** po otevření uživatelem (`topics_priority_rank_positive`, `integer`); dříve – nikdo zatím nasazení neotevřel a z cloudu ho nedosáhneme
(proxy na `*.vercel.app` 403, nasazení chrání Vercel Authentication). Proběhne při prvním otevření preview PR #74.
Funkční ověření 4–6 garantovaných témat na Preview vyžaduje přístupový kód ukázky (tajemství) → čeká na uživatele.
Produkce `APPROVED_MIGRATIONS` nemá: po merge tam 0015 nepoběží, server odmítne 4. garantované téma čitelnou chybou.

### 2.–3. Rozhodnutí bez změny kódu

Výběr osob zůstává nativní `<select>`. Vedoucí bez kontroly příslušnosti ke skupině (ověřuje se existence účtu a oprávnění).

### 4. Testy na kódu 8c2fa73 (HEAD 9111358 mění jen dokumentaci)

Lint OK, typecheck OK, unit **410/410**, build OK, celé e2e (`npx playwright test --trace off`) **1178 passed /
114 skipped / 0 failed** (7,5 min, Chromium, kalendář v simulaci).

### 5. Vizuální kontrola

Snímky `po-*` (Plán s ⋯ a otevřeným menu 390/1280, Témata 1280, Připravit měsíc 390) prohlédnuty: ⋯ vpravo nahoře bez
překryvu textu, menu celé v okně, garantovaná okrová, nejžádanější zelený pruh, hromadný vedoucí nativním selectem.
Potvrzená regrese nenalezena; UI kód se v této relaci neměnil, snímky se nepřegenerovaly.

## Relace 6/7: zpětná vazba uživatele na preview (body 1–4)

1. **Téma jen v návrhu akce** (6a2c354): místo červeného „bez termínu“ oranžově „v návrhu na <datum>“.
2. **Pomocné texty** (6a2c354): odstraněny vysvětlující věty typu „Při plánování se nabízejí jako první…“.
3. **Hlavní výzva stránky** (7bef7d1, schváleno): `PageCall` = věta serifem + jediné hlavní tlačítko nad obsahem
   (Témata „Navrhněte téma nebo podpořte návrh kolegů.“ + Navrhnout téma; Zápisy pro správce/vedoucího „Dokončete
   zápisy z proběhlých akcí.“ + K dokončení). Plán a Správa už hlavní tlačítko výrazné mají, beze změny.
4. **Návrh změny zveřejněné akce** (7bef7d1 + d0e70f1, schváleno, bez migrace – originál je `events.published`):
   * okno akce i detail: okrový panel „Návrh změny zveřejněné akce. Mění …“, rozbalitelná „Zveřejněná verze“
     (krátké vysunutí, bez animace při `prefers-reduced-motion`), volby Zveřejnit změny / **Zrušit návrh**
     (dřív Zahodit změny; s potvrzením). Čistý nový návrh nic z toho nemá, kolegové dál vidí jen zveřejněnou verzi.
   * mřížka Plánu – **stoh**: okrová karta návrhu leží na zveřejněné verzi, z níž nad kartou vykukuje 20px pruh
     „Zveřejněná verze“. Najetí myší na pruh originál roztáhne přes kartu (stín, návrh ztlumí na 35 %), vše uvnitř
     buňky. Originál je jen pro myš (`aria-hidden`, `tabIndex=-1`); klávesnice a čtečky mají totéž v okně akce.
     ⋯ a checkbox výběru zůstávají na kartě návrhu. Agenda (telefon) bez stohu: okrová karta + řádek „Mění …“.
   * data: `EventCard.original` jen pro správce (`changedParts`: termín, téma, vedoucí, publikum, typ, kontrolor).

### Návrh dalších lehkých animací (neimplementováno, čeká na souhlas)

| Kde | Co | Poznámka |
| --- | --- | --- |
| Karty v mřížce Plánu, Témata, Přehled | zvednutí při hoveru (stín + posun o 1–2 px) | bez zvětšení, ať se nerozhodí mřížka |
| Okna (Přidat akci, okno akce, Připravit měsíc) | plynulé otevření/zavření (fade + posun 8 px, 150 ms) | `dialog` už má strukturu, jen CSS |
| Uložení / zveřejnění | krátké potvrzení ✓ na tlačítku a zvýraznění změněné karty (okrový záblesk 600 ms) | navazuje na hlášku `status` |
| Přetahování témat a přesun akce | „zvednutí“ taženého prvku, plynulé zařazení na nové místo | DnD už má stav `data-lifted` |
| Štítky počtů (Připravit měsíc, K dokončení, hlasy) | krátký „pop“ při změně čísla | jen při změně, ne při načtení |
| Podpora tématu | srdce/šipka hlasu s malým odskokem | jediná „radostná“ mikrointerakce |
| Rozbalovací části (Zveřejněná verze, filtry) | plynulé rozbalení výšky | dnes jen fade |

Vše s `prefers-reduced-motion: reduce` bez animace, délky 120–220 ms, žádné animace při prvním načtení stránky.

### Testy relace 7 (lokálně, Chromium, kalendář v simulaci)

* Lint OK, typecheck OK, unit **415/415** (nově `tests/navrh-zmeny.test.ts` – `changedParts`), build OK.
* Celé e2e na 434b3a7 (`npx playwright test --trace off`): **1178 passed / 114 skipped / 0 failed** (7,7 min).
  První běh na d0e70f1: 7 failed – zastaralé očekávání „bez termínu“ v `temata-planovani.spec.ts` po bodu 1; test
  teď přijme „bez termínu“ i „v návrhu na“ (záleží na souběžném zapisujícím testu nad sdílenými daty).
* Po poslední úpravě CSS pruhu (18 → 20 px, ⋯ skryté nad vysunutým originálem): cíleně priprava-mesice, pristupnost,
  rychle-akce, plan-planovani **142 passed / 37 skipped / 0 failed**.
* Známý předexistující souběh: samostatně spuštěný `temata-planovani.spec.ts` může na telefonním projektu selhat
  (čtecí test vidí dočasně změněná garantovaná témata ze zapisujícího testu na windows-1280; stejně i na původním
  testu). V celém běhu neselhal. Oprava by znamenala oddělit zapisující testy od čtecích (návrh, nedělal jsem).
* Simulace vs. živý test: vše lokálně nad PGlite s fiktivními daty; Preview ani produkce se nedotýkalo, bez migrace.

### Snímky relace 7

`po-*` přegenerovány na finálním kódu (šířky 320–1920, správce, lokální PGlite s uloženým návrhem změny ev-11-26):
`plan` a `okno-akce` ukazují návrh změny, nově `po-stoh-*` a `po-stoh-hover-*` (768–1920) – klid a vysunutý originál.

## Relace 8: sjednocení Wiki, filtry, globální pohled (zadání P1–P6)

### P2 – analýza a návrh globálního „Zobrazit jako“ (před implementací)

Dnešní stav:
* `resolvePreview(user, klíč)` v `services/preview.ts` vrací `Viewer` skupiny (`nahled-skupiny`, role member) nebo kolegy
  jen pro správce (`isOrganizer`), jinak `null`. Skutečná identita se nemění, serverové akce vždy volají `requireUser()`.
* Klíč nese jen URL `?jako=`; používá ho Plán (`harmonogram/page.tsx`, i úkoly a okno akce) a detail akce
  (`akce/[id]`). Výběr je v nabídce Filtry (`PlanFilters.tsx`). Domů, Témata a Zápisy náhled neznají.

Datová pravidla stránek:
| Stránka | Data podle diváka | V náhledu |
| --- | --- | --- |
| Plán, okno akce, detail | `listMonth`, `getEventDetail`, `listTasks` (policy.ts) | už podporováno, jen ke čtení |
| Domů | `nextEventsFor`, `listTasks`; osobní kalendář a pozvánky z Gmailu | nejbližší akce a úkoly diváka; kalendář a pozvánky skryté (patří účtu) |
| Témata | `listTopics` (skupiny diváka, jeho hlasy), správa jen správce | témata a hlasy diváka, bez hlasování, návrhu a správy |
| Zápisy | `listPublishedMinutes`, `listMissingMinutes` (vedoucí) | zápisy, které divák vidí; bez přidání a schvalování |
| Správa, Integrace | jen správce | náhled se neuplatní, lišta to řekne („Tato stránka používá váš účet“) |

Návrh (bez nového přihlášení, bez změny role na serveru, bez migrace):
1. Klíč náhledu v HttpOnly cookie `zbc_nahled` (SameSite=Lax, session cookie, max. 12 h). Zapíše ji jen serverová akce
   `startPreview`, která ověří `isOrganizer(requireUser())` a platnost klíče přes `resolvePreview`; `endPreview` ji smaže.
   Cookie nic neopravňuje: při každém požadavku ji stránka znovu ověří přes `resolvePreview` (neznámý klíč nebo ne-správce = běžný pohled).
2. Helper `currentPreview(user)` čte cookie; Plán, detail, Domů, Témata a Zápisy počítají data pro `preview.viewer`
   a skryjí zapisující ovládání (stejně jako dnes Plán: `managing = organizer && !preview`). `?jako=` z URL zmizí.
3. Horní lišta: vlevo skutečný účet (jméno, role, Odhlásit), zvlášť blok „Pohled“ (Můj pohled / skupiny / kolegové +
   Ukončit pohled) jen pro správce. Aktivní náhled = okrový pruh pod lištou na každé stránce („Pohled: X · jen ke čtení“
   + kde platí); na Správě a Integracích pruh řekne, že stránka používá váš účet. Na mobilu kompaktní pruh.
4. Serverové akce zůstávají beze změny (vždy skutečný účet a jeho oprávnění). Nové e2e: v náhledu nejsou zapisující
   tlačítka na podporovaných stránkách, Správa ukazuje skutečný účet, ne-správce cookie nastavit nemůže / je ignorována.

### P5 – izolace e2e testů témat (7aa044e)

Příčina: zapisující testy (priorita, pořadí, téma do návrhu prosincové akce) a čtecí testy témat sdílely jednu
databázi ukázky a běžely souběžně v různých projektech. Čtecí test proto viděl někdy seed, jindy rozpracovaný stav.
Řešení: řízená serializace přes Playwright. Zapisující testy mají značku `@zapis-temat`, ostatní projekty je
vynechávají (`grepInvert`) a běží jen v projektu `zapis-temat` = teardown projektu `prihlaseni`, tedy až doběhnou
všechny projekty, které na přihlášení závisí. (Závislost na všech projektech nešla: Playwright na závislé projekty
nepoužije filtr souboru a samostatný běh by spustil celou sadu. Daň: každý cílený běh přidá 2 testy zápisu témat.)
Čtecí testy tak vždy vidí seed a ověřují jediný stav („ · bez termínu“, žádné „v návrhu na“). Zapisující test
dál ověřuje přechod na „v návrhu na 4. 12.“ i souběh při přetahování.

### P3 – vícenásobné filtry Plánu (290ea09)

* Adresa: `typ=a&typ=b&stav=navrhy&stav=doplnit` (čtou se i čárky); neznámé hodnoty se zahodí (`filterValues`).
* Logika `filterCards`: v kategorii NEBO, mezi typem a stavem A. Stavy jen pro správce, jako dosud.
* UI: nabídka Filtry s checkboxy (Typ akce, Stav s počty); změna hned přepne adresu (historie prohlížeče ji vrátí),
  nabídka zůstane otevřená a fokus na volbě. Štítky Návrhy/Doplnit přepínají svůj stav v sadě, každý vybraný typ má
  štítek s křížkem, „Zrušit filtry“ odebere vše. Filtry drží přepnutí Měsíc/Seznam i změnu měsíce (typ, který
  v novém měsíci není, vypadne). Bez JavaScriptu formulář odešle tlačítko Použít.
