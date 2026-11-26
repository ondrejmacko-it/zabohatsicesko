# Navazující relace (stav 26. 11. 2026, relace 33 „Ověření účasti na produkci + C04/C05“)

Větev `claude/gallant-bohr-m1lyna` (main 76c2011 + předávky + 807c822). PR zatím nezaložen. Limit 170 tis.; čti cíleně.
Bez souhlasu vlastníka: žádné změny produkčního Vercelu/Neonu, migrace ani Google pozvánky, žádný merge do main.

## Ověřeno na produkci (relace 33, 23:00)
- Deployment dpl_AeCfSDi5d1pbvoiSEgjFFCqoAdWg (commit 76c2011) READY, alias zbc-vzdelavani-demo.vercel.app.
- Neon zbc-wiki-produkce: schema_migrations obsahuje 0015–0019 (applied 22:50:40). Data zachována: 12 aktivních
  účtů, 143 akcí, 15 témat; event_participation, excuse_managers, user_salutations prázdné.
- Runtime logy deploymentu (posledních 30 min, warning/error/fatal): žádné záznamy. Hobby drží logy jen 1 h.
- Klikací test v aplikaci NEPROBĚHL: vstup jen přes osobní pozvánku, Claude nemá přihlášení (vytvořit pozvánku =
  zápis do produkce). Postup testu pro vlastníka je ve zprávě relace 33 (omluva, zrušení, přihlášení/odhlášení
  dobrovolné akce, >3 garantovaná témata, náhled 1:1 se zamčenými tlačítky).

## Hotovo v kódu (807c822, zatím jen na větvi)
- C04: `setExcuseManagers` – správce nesmí nastavit sám sebe nadřízeným (forbidden).
  Deaktivace účtu (`updateAccess` status=disabled) smaže vazby, kde je účet nadřízeným, + audit
  `excuse_managers.removed_on_disable` (jen když je 0018 aktivní). Po reaktivaci je nutné vazby nastavit znovu.
- C05: `updateAccess` zachová `vedouci-tymu`, které formulář správy neukazuje (`keepUnmanagedGroups`).
- Testy: celá sada 623/623 OK, typecheck a lint OK na 807c822.

## Další krok
1. Vlastník projde klikací test na produkci; případné chyby opravit.
2. Se souhlasem vlastníka draft PR z této větve (C04/C05) → ruční merge vlastníkem.
3. Úklid se souhlasem: Neon branch `test-migrace-0015-0019` (br-shy-pine-ba0v9yl8) smazat; záloha
   `zaloha-pred-0015-2026-11-26` (br-withered-salad-batie5vn) ponechat do potvrzení testu.
4. Rollback účasti: odebrat `PARTICIPATION` (data zůstanou); DB obnova ze zálohy.

## Otevřené otázky
- C04: mazat vazby i když se deaktivuje podřízený? (teď ne – jeho omluvy se stejně nefiltrují jako platné).
- Mapování nadřízených a doba uchování omluv (rozhodnutí firmy).
