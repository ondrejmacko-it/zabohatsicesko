# Navazující relace (stav 26. 11. 2026, relace 35 „UI rework účasti, kroky 1–3“)

Větev `claude/gallant-bohr-m1lyna` (main 76c2011 + 807c822 C04/C05 + UI rework do 2ab8033). PR zatím nezaložen. Limit 170 tis.; čti cíleně.
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

## AKTUÁLNÍ ÚKOL (zadání vlastníka 26. 11.) – UI/UX rework sekce účasti, logiku NEMĚNIT
Neměnit služby participation/excuse-managers ani server actions; jen layout, komponenty, texty, badge, spacing.
Celé zadání (body 1–7) je v historii tohoto souboru: `git show 375879d:docs/dalsi-session.md`.

### Hotovo (relace 34–35)
- 5a0db07 krok 0: krátké texty `ParticipationPanel.tsx`, spacing v `globals.css`, e2e věta omluvy.
- fed7f10 kroky 1–2: nová `components/StatusBadge.tsx` (props `label`, `title?`, `tone` | `ucast`),
  `ParticipationBadge.tsx` smazán; použito v `Schedule.tsx` (CardMeta, seznam, „Návrh“), `ParticipationPanel.tsx`,
  hlavičce `akce/[id]/page.tsx`. `PARTICIPATION_LABELS.excused` = „Omluven/a“ (testy ucast-prihlasky, e2e ucast:198).
  EventPeek má status-band, ne badge (beze změny). Štítky témat (Garantované/Doporučené) nejsou stav akce, beze změny.
- 2ab8033 krok 3: `lifecycleStatus` past → „Zveřejněno · proběhlo“ (tests/stav-akce); `key-facts` v detailu
  Kdy / Téma / Vede / Pro koho (Téma = topicTitle nebo Todo), staré `dl` s Tématem odstraněno.
- Rozhodnutí: badge „Náhled“ se nepřidává, náhled nese nadpis „Účast v náhledu“ + věta „Náhled je jen ke čtení.“
  (pravidlo 1 badge na stav).
- Ověřeno na 2ab8033: tsc OK, eslint změněných souborů OK, vitest audit-ucast-nahledy + ucast-prihlasky 24/24,
  stav-akce 8/8. Celá sada, build ani Playwright zatím neběžely. (V nové relaci nejdřív `npm ci`.)

### Zbývá
4. Náhled skupiny/kolegy: Playwright screenshot lokálního dema (detail povinné/dobrovolné/omluvené akce, náhled 1:1
   a skupiny), zkontrolovat zamčenou kartu a 4 položky key-facts na mobilu.
5. Revize 18 bodů (`docs/report-finalni-dokonceni.md`, čti cíleně grep), celá sada testů (`npm test`), lint,
   build, e2e ucast/nahled (pozor: e2e mohou hledat „Proběhlo“/Téma v `dl` – opravit, pokud spadnou), pak draft PR
   (vč. C04/C05 z 807c822, bez merge) a report vlastníkovi: soubory, 4 funkce (přihlášení/odhlášení,
   omluva/zrušení, read-only náhled, >3 garantovaná témata), revize 18 bodů, odkaz na PR.

## Další krok (po UI reworku)
1. Vlastník projde klikací test na produkci; případné chyby opravit.
2. Se souhlasem vlastníka draft PR z této větve (C04/C05) → ruční merge vlastníkem.
3. Úklid se souhlasem: Neon branch `test-migrace-0015-0019` (br-shy-pine-ba0v9yl8) smazat; záloha
   `zaloha-pred-0015-2026-11-26` (br-withered-salad-batie5vn) ponechat do potvrzení testu.
4. Rollback účasti: odebrat `PARTICIPATION` (data zůstanou); DB obnova ze zálohy.

## Otevřené otázky
- C04: mazat vazby i když se deaktivuje podřízený? (teď ne – jeho omluvy se stejně nefiltrují jako platné).
- Mapování nadřízených a doba uchování omluv (rozhodnutí firmy).
