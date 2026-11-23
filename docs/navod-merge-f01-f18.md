# Návod: sloučení F01–F18 (PR #77–#84 a opravný PR) do `main`

Stav ověřený 23. 11. 2026. `main` = `d9be02e`, nic z níže uvedeného není sloučené. Před každým krokem
zkontroluj, že čísla a větve v GitHubu pořád sedí s tabulkou. Pokud ne, nepokračuj a nech postup ověřit znovu.

## Nejdůležitější fakta před začátkem

1. **Každý merge do `main` hned nasadí produkci.** Ověřeno ve Vercelu: projekt `zbc-vzdelavani-demo`,
   posledních 5 produkčních nasazení vzniklo automaticky z merge do `main` (poslední `d9be02e`, PR #76).
   Starší věta v `docs/nasazeni.md` o přeskakování produkce už neplatí.
2. **Produkce je ostrá Wiki se skutečným Google Kalendářem**: `WIKI_MODE=production`,
   `CALENDAR_MODE=google-test`, `CALENDAR_ATTENDEES=audience`, `LOGIN_MODE=google-test`.
3. Ostrá Wiki **v kódu ignoruje** `PARTICIPATION`, `EVENT_VISIBILITY` a `RECORDING_DEMO`. F02–F05 (štítky,
   přihlášky, omluvy, pozvánky podle účasti) proto v produkci po merge **nebudou vidět ani nic nezmění**.
   Vidět budou změny UI: F01 (Pro koho v přípravě měsíce), F06–F18.
4. **Migrace se v produkci samy nespustí.** `0015_topic_priority_unlimited` a `0016_event_participation` mají
   příznak „čeká na schválení“. Na vzdálené DB proběhnou, jen když je jejich ID v `APPROVED_MIGRATIONS`.
   V produkci tahle proměnná **není nastavená** (ověřeno). Obě tedy čekají a další se za nimi zastaví.
   Pozor: 0015 je už v dnešním `main` (od PR #73), produkce s ní tedy už teď běží neprovedenou. To se merge
   nemění, viz rozhodnutí R4 v reportu.
5. **Preview** používá jednu sdílenou ukázkovou databázi a simulaci Kalendáře. `APPROVED_MIGRATIONS` je tam
   nastavené jen pro starou větev `claude/finalni-kontrola-novy-pr-g2r2wd` (jen 0015).

## A. Přehled pořadí

Stack je lineární: každá větev obsahuje všechny předchozí. Proto jdeme **odshora dolů**: každý PR se sloučí
do své vlastní základní větve (ne do `main`) a do `main` jde jen úplně poslední krok. Výsledek: jedno
produkční nasazení místo devíti a jeden bod pro případný rollback.

| Krok | PR | Zdrojová větev (head) | Cíl dnes (base) | Změnit base? | Obsah |
|---|---|---|---|---|---|
| 1 | [#85](https://github.com/ondrejmacko-it/zabohatsicesko/pull/85) | `claude/funkce/finalni-integracni-opravy` | `claude/funkce/kalendar-f04` | ne | Opravy A, C, D, testy B, návod a report |
| 2 | [#84](https://github.com/ondrejmacko-it/zabohatsicesko/pull/84) | `claude/funkce/kalendar-f04` | `claude/funkce/release-audit` | ne | F04 v simulaci |
| 3 | [#83](https://github.com/ondrejmacko-it/zabohatsicesko/pull/83) | `claude/funkce/release-audit` | `claude/funkce/obecne-f16-f18` | ne | F06–F09, release audit |
| 4 | [#82](https://github.com/ondrejmacko-it/zabohatsicesko/pull/82) | `claude/funkce/obecne-f16-f18` | `claude/funkce/zapisy-f13-f15` | ne | F16–F18 |
| 5 | [#81](https://github.com/ondrejmacko-it/zabohatsicesko/pull/81) | `claude/funkce/zapisy-f13-f15` | `claude/funkce/temata-f10-f12` | ne | F13–F15 |
| 6 | [#80](https://github.com/ondrejmacko-it/zabohatsicesko/pull/80) | `claude/funkce/temata-f10-f12` | `claude/funkce/priprava-mesice-pro-koho` | ne | F10–F12 |
| 7 | [#79](https://github.com/ondrejmacko-it/zabohatsicesko/pull/79) | `claude/funkce/priprava-mesice-pro-koho` | `claude/funkce/ucast-prihlasky` | ne | F01 v přípravě měsíce |
| 8 | [#78](https://github.com/ondrejmacko-it/zabohatsicesko/pull/78) | `claude/funkce/ucast-prihlasky` | `claude/funkce/ucast-role-zaklad` | ne | F02, F03 (za přepínačem) |
| 9 | [#77](https://github.com/ondrejmacko-it/zabohatsicesko/pull/77) | `claude/funkce/ucast-role-zaklad` | `main` | ne | Role, účast, migrace 0016; **v tuto chvíli obsahuje celý stack** |

Žádná base se měnit nemusí. Pro každý PR platí:

* **Připravenost:** všechny jsou Draft. Před sloučením klikni „Ready for review“.
* **Před merge zkontroluj:** zelené kontroly („Lint, typy, testy a build“ a Vercel), stav „This branch has no
  conflicts with the base branch“, base = sloupec „Cíl dnes“.
* **Po merge:** větev nemaž (GitHub ji nemaže sám, `delete_branch_on_merge` je vypnuté). Smazání větve by
  GitHub u navazujícího PR přesměroval jinam. Uklidit se dají až po kroku 9.

## B. Postup krok po kroku (GitHub v prohlížeči)

### Krok 0 – příprava (nic se nenasazuje)

1. Ve Vercelu otevři projekt `zbc-vzdelavani-demo` → **Deployments**, filtr **Production**. Poznamenej si
   aktuální produkční nasazení (commit `d9be02e`, „Merge pull request #76“). To je bod pro rollback.
2. Doporučeno: Vercel → projekt → **Settings → Environments → Production** a vypni automatické přiřazení
   produkční domény („Auto-assign Custom Production Domains“). Merge do `main` pak sestaví produkční nasazení,
   ale lidem ho ukážeš až tlačítkem **Promote**. Když tuto volbu ve svém plánu nenajdeš, nevadí: produkci
   zasáhne až krok 9, který uděláš v klidné chvíli.
3. V produkci **nenastavuj** `APPROVED_MIGRATIONS`, `PARTICIPATION` ani nic jiného. Merge to nepotřebuje.
4. Celé E2E na Windows nebylo zelené (dvakrát jiná skupina chyb, izolovaně prochází, viz report oddíl 6).
   Pokud chceš jistotu, nech před krokem 9 spustit `npm run e2e` ještě jednou.
5. Otevři [PR #85](https://github.com/ondrejmacko-it/zabohatsicesko/pull/85) a zkontroluj, že kontroly jsou
   zelené. Pokud ne, zastav se.

### Kroky 1–8 – sloučení do základních větví (produkce se nemění)

Pro každý řádek 1 až 8 tabulky, **v tomto pořadí**:

1. Otevři PR (odkaz v tabulce).
2. Nahoře zkontroluj text „wants to merge … into `<Cíl dnes>`“. Musí sedět s tabulkou.
3. Dole klikni **Ready for review**.
4. Počkej, až kontroly doběhnou zeleně. U kroků 2–8 se spustí znovu, protože předchozí krok do větve přidal
   merge commit. To je správně.
5. U zeleného tlačítka merge klikni na šipku vedle něj a vyber **Create a merge commit**. Ne „Squash and
   merge“, ne „Rebase and merge“ (proč, viz část C).
6. Klikni **Merge pull request** → **Confirm merge**.
7. Výsledek: PR je „Merged“. Další PR v pořadí má na kartě **Files changed** víc souborů než předtím,
   protože teď nese i právě sloučenou práci. U postupu odshora je to očekávané.

**Kdy se zastavit:** kontrola je červená, GitHub hlásí konflikt, base nesedí s tabulkou, nebo PR obsahuje
commit, který v tabulce nečekáš. Nic dalšího neslučuj a pošli mi odkaz.

Preview: po každém kroku Vercel sestaví nové Preview té větve. Běží nad sdílenou ukázkovou DB v simulaci
Kalendáře, žádný skutečný e-mail ani pozvánka neodchází a 0016 se tam bez schválení neprovede.

### Krok 9 – PR #77 do `main` (jediné produkční nasazení)

1. Otevři [PR #77](https://github.com/ondrejmacko-it/zabohatsicesko/pull/77). Base musí být `main`.
2. **Files changed** teď ukazuje celý stack. Zkontroluj, že tam je `docs/navod-merge-f01-f18.md` a
   `docs/report-finalni-integracni-opravy.md` (důkaz, že obsahuje i opravný PR) a že kontroly jsou zelené.
3. **Ready for review** → **Create a merge commit** → **Merge pull request** → **Confirm merge**.
4. Ve Vercelu → Deployments počkej na nové produkční nasazení s commitem „Merge pull request #77“.

### Kontrola po kroku 9

* Nasazení je **Ready** (ne Error). Při chybě sestavení zůstává v provozu předchozí nasazení.
* Otevři produkční Wiki a přihlas se: Plán, detail akce, Témata a Zápisy se otevřou bez chyby.
* Neuvidíš štítky „Povinné pro tebe“, přepínač Moje/Všechny ani tlačítka Omluvit se / Přihlásit. To je
  správně (ostrá Wiki má účast vypnutou).
* V **Settings → Logs** nového nasazení (do hodiny, Hobby drží log jen hodinu) najdi řádek
  `[db] migrace 0015_topic_priority_unlimited čeká na schválení`. Znamená to, že se nic nespustilo.
* Pokud se cokoli pokazí: Vercel → Deployments → předchozí produkční nasazení (`d9be02e`) → **⋯ → Instant
  Rollback**. Databáze se nezměnila, návrat je bezpečný. Pak mi pošli, co se stalo.

## C. Strategie merge: proč „Create a merge commit“

| Strategie | Co udělá v tomto stacku | Doporučení |
|---|---|---|
| **Create a merge commit** | Zachová původní commity. Každá další větev je jejich pokračováním, slučování odshora nemá konflikty. | **Ano, pro všech 9 kroků** |
| Squash and merge | Udělá z PR jeden nový commit s jiným SHA. Navazující PR by pak obsahoval tytéž změny znovu jako „jiné“ commity: duplikovaný diff a hrozba konfliktů. | Ne |
| Rebase and merge | Přepíše SHA všech commitů. Stejný problém jako squash, navíc ztratí vazbu na zelené CI konkrétních commitů. | Ne |

Proč odshora a ne od #77 nahoru: postup zdola (#77 do `main`, pak #78 do `main` …) by spustil 9 produkčních
nasazení s rozpracovanými mezistavy. Postup odshora dá do produkce jen hotový a celý otestovaný stav.

## D. Vercel a produkční nasazení

* **Preview:** vzniká samo pro každou větev. Pro F02–F05 ale potřebuje `PARTICIPATION=on` a provedenou
  migraci 0016 na sdílené ukázkové DB. To je rozhodnutí R3 v reportu. Bez něj ukáže Preview jen F01, F06–F18.
* **CI:** GitHub Actions „Kontrola kódu“ běží na každém PR (lint, typy, unit, build). E2E v CI neběží, pouští
  se ručně (`npm run e2e`).
* **Produkční proměnné:** merge žádnou nepotřebuje. Neměň je.
* **Aktivace nových funkcí v produkci:** dnes nejde. `participationEnabled()` vrací v ostré Wiki vždy `false`.
  Zapnutí je samostatný budoucí krok: schválit 0015 a 0016 v produkci, zálohovat DB a vědomě odstranit pojistku
  v `src/server/config.ts`. Nic z toho tento merge nedělá.
* **Zastavení nebo rollback:** Instant Rollback na předchozí produkční nasazení (část B).

## E. Databázové migrace

| | |
|---|---|
| Před prvním merge | Nic. Ověř jen, že v produkci není `APPROVED_MIGRATIONS` (Vercel → Settings → Environment Variables). |
| Co se stane automaticky | Při startu aplikace se projdou migrace. Na vzdálené DB se 0015 a 0016 bez schválení přeskočí s varováním, další se za nimi zastaví. Lokálně a v testech (PGlite) proběhnou vždy. |
| Jak ověřit stav | Log nasazení (`[db] migrace … čeká na schválení`), nebo v Neonu dotaz `SELECT id FROM schema_migrations ORDER BY id`. |
| Co vyžaduje schválení | 0015 a 0016 v produkci. 0016 na sdílené Preview DB. |
| Bezpečný okamžik | Až po kroku 9, po záloze (Neon → Branches → Create branch jako snapshot) a v době, kdy nikdo nepracuje s tématy. Obě migrace jen přidávají nebo uvolňují, nic nemažou. |
| Co nedělat | Nenastavuj `APPROVED_MIGRATIONS` v produkci ani na Preview, dokud to výslovně neschválíš. Nespouštěj `npm run db:migrate` ani `db:reset` proti vzdálené DB. |

Rollback aplikace po budoucím provedení 0016: starší kód novou tabulku nečte, funguje dál. Nedokončená
migrace: každá běží v transakci, při chybě se vrátí celá a aplikace hlásí chybu při startu.

## F. Google Kalendář

* **Jde vyzkoušet v simulaci (bez Googlu):** pozvánka po zveřejnění, omluva odebere ze spravovaných hostů,
  dobrovolná přihláška přidá, odhlášení odebere, změna role nebo deaktivace přepočítá pozvánky, ruční hosté a
  cizí RSVP zůstanou. Lokálně nebo na Preview se simulací.
* **Vyžaduje skutečný Google účet a tvé samostatné schválení (D06):** že pozvaný dostane e-mail, že odebrání
  po omluvě Google doručí jako zrušení, jak se chová `declined` (O04), skutečné časy doručení.
* **Žádné živé pozvánky** do schválení. Tento merge na chování produkčního Kalendáře mění jen jedno: po změně
  účtu (role, deaktivace) Wiki přepočítá víc budoucích akcí než dřív (oprava A). Je to správné chování, ale
  znamená, že deaktivace člověka může v produkci upravit jeho budoucí pozvánky.

## G. Kontrola po každém kroku (shrnutí)

| Po kroku | Má platit | Pokračuj, když | Zastav se, když |
|---|---|---|---|
| 1–8 | PR „Merged“, další PR v pořadí má zelené kontroly a žádný konflikt | vše zelené | červená kontrola, konflikt, nečekaná base |
| 9 | Nové produkční nasazení Ready, Wiki funguje, účast skrytá | – (hotovo) | Error, chyba stránek → Instant Rollback |

## H. Alternativa v terminálu

Klikání v GitHubu je preferované. Totéž přes `gh` (stejné pořadí, merge commit, větve se nemažou):

```
gh pr ready 85 -R ondrejmacko-it/zabohatsicesko
gh pr checks 85 -R ondrejmacko-it/zabohatsicesko --watch
gh pr merge 85 -R ondrejmacko-it/zabohatsicesko --merge
```

Totéž postupně pro 84, 83, 82, 81, 80, 79, 78 a jako poslední 77. Před každým `gh pr merge` znovu
`gh pr checks <číslo> --watch` a `gh pr view <číslo> --json baseRefName`. Nepoužívej `--squash`, `--rebase`,
`--delete-branch` ani `--admin`.
