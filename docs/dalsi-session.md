# Navazující relace (stav 26. 11. 2026, relace 32 „Zprovoznění účasti na produkci“)

Větev `claude/gallant-bohr-m1lyna` (= main 76c2011, PR #93 mergnutý). Limit 170 tis.; čti cíleně.
Bez souhlasu vlastníka: žádné změny produkčního Vercelu/Neonu, migrace ani Google pozvánky.

## Ověřený stav produkce (relace 32)
- Vercel projekt `zbc-vzdelavani-demo` (team_PtkXmFd9hI7UeUYovGkbwZQG), produkční deployment dpl_4p6kxUp6RSEEdXkFs5hihD8auDwz
  = commit 76c2011, READY. V produkci CHYBÍ `APPROVED_MIGRATIONS` i `PARTICIPATION` → proto omluvy/přihlášky nejsou vidět.
- Neon `zbc-wiki-produkce` (bitter-breeze-02749976), hlavní branch br-flat-cake-badr13ge: migrace jen 0001–0014.
  12 aktivních účtů, 143 akcí, 15 témat.
- Kalendář: produkce doručuje do osobních kalendářů (103 vazeb, managed_attendees všude NULL = markLinksDelivered,
  44 personal_calendar_entries). Osobní kalendáře se řídí publikem, ne účastí → PARTICIPATION=on Google nemění,
  inventura vrátí notApplicable=personal. Riziko jen při budoucím přepnutí na CALENDAR_DELIVERY=organizer.
- Záloha: Neon branch `zaloha-pred-0015-2026-11-26` (br-withered-salad-batie5vn, bez compute).
- Test: branch `test-migrace-0015-0019` (br-shy-pine-ba0v9yl8) – SQL 0015–0019 prošlo v jedné transakci na kopii
  produkce (PG 18), data zachována. Branch po aktivaci smazat (jen se souhlasem).

## Další krok (čeká na souhlas vlastníka)
1. Production env: `APPROVED_MIGRATIONS=0015_topic_priority_unlimited,0016_event_participation,0017_participation_withdrawn,0018_excuse_managers,0019_user_salutation`, `PARTICIPATION=on` (plain, target production).
2. Redeploy produkce (deploymentId dpl_4p6kxUp6RSEEdXkFs5hihD8auDwz) → migrace se provedou při prvním dotazu do DB.
3. Ověřit schema_migrations (0015–0019), runtime logy bez `[db]`/`[ucast]` varování, průchody FP/RM/více rolí,
   omluva, zrušení omluvy, přihlášení, odhlášení, >3 garantovaná témata, náhled 1:1 se zamčenými tlačítky.
4. Rollback: odebrat `PARTICIPATION` (data zůstanou); DB obnova z branch zálohy.

## Otevřené (z dřívějšího zadání, po zprovoznění)
- C04 zákaz self-grant nadřízeného na serveru + odebrání vazeb při deaktivaci; C05 zachovat `vedouci-tymu`.
