# Návod: sloučení dokončení F01–F18 (větev `claude/nice-lamport-vjfy87`) do `main`

Stav ověřený 24. 11. 2026 (jen čtení ve Vercelu a Neonu). `main` = `a30605c` (PR #91). Stack #77–#87 a PR #91 už
jsou sloučené, platí jen tento jeden PR. Před každým krokem zkontroluj, že čísla v GitHubu sedí. Pokud ne,
nepokračuj.

## Nejdůležitější fakta

1. **Merge do `main` hned nasadí produkci.** Vercel projekt `zbc-vzdelavani-demo`: posledních 5 produkčních
   nasazení vzniklo automaticky z merge do `main` (poslední `a30605c`, PR #91, Ready, kandidát na rollback).
2. **Produkce je ostrá Wiki**: `WIKI_MODE=production`, `CALENDAR_MODE=google-test`, `CALENDAR_ATTENDEES=audience`.
   `PARTICIPATION` ani `APPROVED_MIGRATIONS` v produkci **nejsou nastavené** (ověřeno 24. 11.).
3. **Po merge se účast v produkci nezapne.** `participationEnabled()` je v ostré Wiki zapnutá jen při
   `PARTICIPATION=on` **a zároveň** provedených migracích 0016 a 0017; nadřízený pro omluvy navíc potřebuje 0018.
   Bez nich zůstanou štítky, přihlášky, omluvy i Nadřízený pro omluvy skryté a kód se na nové tabulky nedotazuje
   (`excuseManagersEnabled`, `participationReadiness` = `off`). Správa → Integrace ukazuje stav „Přihlášky a omluvy“.
4. **Migrace se samy nespustí.** Produkční DB (`zbc-wiki-produkce`) má 0001–0014. 0015–0018 mají příznak „čeká na
   schválení“ a na vzdálené DB proběhnou jen s ID v `APPROVED_MIGRATIONS`.
5. **Ověření migrací:** izolovaný Neon branch `overeni-ucast-0016-0018` (projekt `neon-zbz-vzdelavani-demo`, fiktivní
   data) má 0016–0018 a SQL kontroly prošly (omezení, unikáty, FK, nadřízený ne sám sobě). Aplikaci proti němu
   z cloudu spustit nejde (WebSocket přes proxy), viz `scripts/overeni-ucasti-db.ts`.

## Postup

### 0. Příprava (nic se nenasazuje)

1. Vercel → `zbc-vzdelavani-demo` → Deployments → filtr Production: poznamenej si nasazení `a30605c`
   („Merge pull request #91“). To je bod pro rollback.
2. V produkci **nic nenastavuj**. Merge žádnou proměnnou nepotřebuje.
3. Otevři draft PR této větve do `main`: kontroly „Lint, typy, testy a build“ a Vercel Preview musí být zelené
   a PR nesmí mít konflikt s `main`.

### 1. Preview test (doporučeno před merge)

1. Otevři Preview nasazení PR. Běží nad sdílenou ukázkovou DB a simulací Kalendáře, nic neodchází.
2. Projdi: Plán (návrh změny zveřejněné akce: okrová karta leží na „Zveřejněné verzi“, najetí myší na pruh ji
   vysune), náhled kolegy-správce 1:1, Témata (Navrhnout téma má jedno Zavřít), Zápisy, záhlaví na úzkém okně.
3. Účast (F02–F05) na Preview jen s tvým schválením: buď `APPROVED_MIGRATIONS` + `PARTICIPATION=on` pro tuto
   větev nad ukázkovou DB, nebo Preview s `DATABASE_URL` izolovaného branche. Obojí je změna Vercel proměnných.

### 2. Merge (jediné produkční nasazení)

1. PR → **Ready for review** → **Create a merge commit** → **Merge pull request** → **Confirm merge**.
   Ne squash ani rebase (zachová SHA commitů, které prošly CI). Větev nemaž, dokud není ověřená produkce.
2. Vercel → Deployments: počkej na produkční nasazení „Merge pull request #…“ ve stavu **Ready**.

### 3. Kontrola po merge

* Wiki se otevře, přihlášení funguje, Plán, detail akce, Témata, Zápisy a Správa bez chyby.
* Štítky „Povinné pro tebe“, přepínač Moje/Všechny a Omluvit se / Přihlásit **nejsou vidět**. To je správně.
* Správa → Integrace: „Přihlášky a omluvy“ = vypnuto.
* Logy nasazení (Hobby je drží hodinu): `[db] migrace 0015_topic_priority_unlimited čeká na schválení`, nic se
  neprovedlo.
* Problém: Deployments → `a30605c` → ⋯ → **Instant Rollback**. DB se nezměnila, návrat je bezpečný.

## Aktivace účasti v produkci (samostatný krok, jen s výslovným schválením)

1. Záloha: Neon → `zbc-wiki-produkce` → Branches → Create branch (snapshot).
2. Vercel Production:
   `APPROVED_MIGRATIONS=0015_topic_priority_unlimited,0016_event_participation,0017_participation_withdrawn,0018_excuse_managers`
   (ID podle `src/server/db/migrations.ts`), redeploy. V logu ověř provedení, v Neonu
   `SELECT id FROM schema_migrations ORDER BY id`.
3. Teprve potom `PARTICIPATION=on`, redeploy. Integrace musí ukázat „zapnuto“, ne „chybí schéma“.
4. Ve Správě nastav nadřízené pro omluvy (skutečné mapování dodá firma, stejně jako dobu uchování omluv).
5. Google Kalendář: změna účasti přepočítá pozvánky povinných akcí. Živé pozvánky jen po schválení D06.
6. Návrat: `PARTICIPATION` smazat a redeploy (funkce zmizí, data zůstanou). Migrace jen přidávají tabulky
   a sloupce, starší kód je nečte.

## Co nedělat

* Nenastavovat `APPROVED_MIGRATIONS` ani `PARTICIPATION` v produkci bez schválení.
* Nespouštět `npm run db:migrate` ani `db:reset` proti vzdálené DB.
* Nepoužívat squash, rebase, `--admin` ani auto-merge.
