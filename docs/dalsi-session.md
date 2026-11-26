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

## AKTUÁLNÍ ÚKOL (zadání vlastníka 26. 11., relace 34) – UI/UX rework sekce účasti, logiku NEMĚNIT
Účast funguje (dobrovolné přihlásit/odhlásit, povinné omluvit/zrušit omluvu, náhled read-only). Neměnit služby
participation/excuse-managers ani server actions; měnit layout, komponenty, texty, badge/chip systém, spacing.
1. Detail zveřejněné akce: (a) stav nahoře (Zveřejněno / Zveřejněno · proběhlo / Zrušeno), (b) info blok Kdy /
   Téma / Vede / Pro koho, (c) samostatná karta „Účast“ POD obsahem akce, oddělená jako jiné boxy ve Wiki.
   Vzor čistoty: vzhled zrušené akce.
2. Každý stav účasti: 1 badge + 1 krátká věta + 1 hlavní tlačítko (+ v náhledu 1 krátká věta). Texty:
   Dobrovolné „Akce není povinná, můžeš se přihlásit.“ · Přihlášeno „Jsi přihlášený na dobrovolnou účast.“ ·
   Povinné „Akce je pro tebe povinná.“ · Omluven/a „Na této akci jsi omluvený.“ · Náhled „Náhled je jen ke čtení.“
   (respektovat oslovení D03/rod, pokud ho kód už používá). Odstranit dlouhé odstavce a opakování.
3. Jednotný systém stavů v celé Wiki (karty akcí, detail, filtry – stejné barvy, názvy, pozice badge):
   Povinné pro tebe, Dobrovolné, Můžeš se přihlásit, Přihlášeno, Omluven/a, Zrušeno, Proběhlo, Jen ke čtení/Náhled.
   Ideálně jedna mapa stav → label + CSS třída (tokeny) a jedna komponenta badge.
4. Náhled za jiného uživatele: stejná karta, správný stav, tlačítka disabled, nevypadá rozbitě, bez románů.
5. Stručná revize: kód + poslední změny participation + původních 18 bodů zadání firmy (viz docs/report-finalni-
   dokonceni.md, čti cíleně) → co hotové / funkční / funkční ale vizuálně nedotažené / chybí.
6. Ověřit (testy + ideálně Playwright screenshoty lokálního dema): přihlášení/odhlášení, omluva/zrušení,
   read-only náhled, >3 garantovaná témata. Pak draft PR (zahrnuje i C04/C05 z 807c822).
7. Výstup uživateli: stručný report, přesný seznam dotčených souborů, potvrzení 4 funkcí, odkaz na draft PR.
Postup: nejdřív grep komponent detailu akce (`src/features/**`, „Tvoje účast“), návrh struktury krátce do zprávy,
pak implementace po jednotkách s commitem a pushem.

## Další krok (po UI reworku)
1. Vlastník projde klikací test na produkci; případné chyby opravit.
2. Se souhlasem vlastníka draft PR z této větve (C04/C05) → ruční merge vlastníkem.
3. Úklid se souhlasem: Neon branch `test-migrace-0015-0019` (br-shy-pine-ba0v9yl8) smazat; záloha
   `zaloha-pred-0015-2026-11-26` (br-withered-salad-batie5vn) ponechat do potvrzení testu.
4. Rollback účasti: odebrat `PARTICIPATION` (data zůstanou); DB obnova ze zálohy.

## Otevřené otázky
- C04: mazat vazby i když se deaktivuje podřízený? (teď ne – jeho omluvy se stejně nefiltrují jako platné).
- Mapování nadřízených a doba uchování omluv (rozhodnutí firmy).
