# Podklady pro SPER: co potřebujeme k začlenění modulu Vzdělávání

Seznam otázek a podkladů pro tým, který spravuje firemní Wiki (SPER). Odpovědi rozhodnou o variantě
začlenění popsané v [integrace-do-firemni-wiki.md](integrace-do-firemni-wiki.md). Nic z toho zatím
neznáme a nic ve Wiki neměníme.

**Otevřená otázka:** nevíme, kdo nebo co je SPER (tým, firma, systém, role). Označení přebíráme ze zadání.
Před odesláním je potřeba potvrdit adresáta a komu se odpovědi vrací.

Prosíme o odpověď u každého bodu, nebo „nevíme / rozhodne někdo jiný (kdo)“.

## A. Wiki a její vývoj
1. Na jaké technologii Wiki běží (framework, jazyk, verze)? Je to vlastní vývoj, nebo hotový produkt?
2. Jak se do Wiki přidávají nové části (moduly, pluginy, odkazy na samostatné aplikace)?
3. Kde je zdrojový kód, kdo ho spravuje a jak probíhá schválení a nasazení změn?
4. Existuje testovací instance Wiki? Můžeme dostat testovací účty?

## B. Přihlášení a účty
5. Jak se uživatelé do Wiki přihlašují (Google Workspace, Microsoft, jiný poskytovatel, vlastní účty)?
6. Podporuje poskytovatel OIDC nebo SAML pro další aplikaci? Kdo může aplikaci zaregistrovat?
7. Je zapnuté vícefázové ověření? Jak funguje odhlášení?
8. Kde se vedou role a skupiny (finanční poradci, relationship manažeři, týmy)? Lze je číst automaticky (SCIM, skupiny v tokenu, API)?
9. Kdo bude správcem modulu Vzdělávání a kdo smí přidělovat role?

## C. Data a infrastruktura
10. Kde Wiki běží (cloud, region, vlastní servery)? Jsou požadavky na umístění dat (EU, ČR)?
11. Smí modul používat vlastní databázi PostgreSQL (dnes Neon, EU), nebo musí využít firemní?
12. Jaké je firemní úložiště souborů pro nahrávky a podklady (Google Drive, SharePoint, S3…)?
13. Jaké jsou požadavky na zálohy (jak často, jak dlouho, kdo testuje obnovu)?
14. Jak se dělá rollback nasazení a kdo o něm rozhoduje?

## D. Google Kalendář
15. Který účet má být organizátorem pozvánek na vzdělávání? Kdo vlastní dnešní pozvánky a série?
16. Povoluje Workspace aplikaci třetí strany s přístupem ke Kalendáři (OAuth)? Je potřeba schválení administrátora?
17. Mají se pozvánky posílat celé skupině, nebo jen vybraným lidem?

## E. Bezpečnost, GDPR, provoz
18. Jaké bezpečnostní požadavky musí modul splnit (audit, penetrační test, pravidla pro domény a iframe)?
19. Kdo je správce osobních údajů a kdo zpracovatel? Existuje záznam o činnostech zpracování, kam modul doplnit?
20. Jak dlouho se smí uchovávat nahrávky, pracovní přepisy a zveřejněné zápisy? Kdo je smí mazat?
21. Může být nahrávka zpracována externí službou (přepis, AI)? Pokud ano, kterou a se smlouvou o zpracování?
22. Plánuje firma vlastního AI/bota pro zápisy? Jaké bude mít rozhraní a kdo ho provozuje?
23. Jaký je firemní monitoring a kam hlásit chyby? Kdo řeší výpadek mimo pracovní dobu?

## F. Témata a zápisy (nové po rychlých akcích a plánování témat)
24. Kdo určuje garantovaná (prioritní) témata a na jak dlouho platí (měsíc, čtvrtletí)? Stačí tři?
25. Kdo smí zápis schválit a zveřejnit? Dnes jen vedoucí akce. Má ho při nepřítomnosti vedoucího zastoupit správce
    nebo kontrolor? Má schválení předcházet kontrola kontrolorem?
26. V jakém formátu budou přepisy a poznámky přicházet (Google Meet, Teams, jiný nástroj, titulky VTT/SRT)?
27. Má firemní AI/bot zápis jen navrhnout (dnešní hranice `MinutesDrafter`), nebo i něco dalšího? Kde poběží
    a jaká data smí dostat?

## G. Rozhodnutí o rozsahu
28. Má modul zatím běžet samostatně s jednotným přihlášením, nebo hned pod doménou Wiki?
29. Má Wiki na úvodní stránce zobrazovat údaje z modulu (nejbližší akce, úkoly)?
30. Které dnešní nástroje (Notion, Numbers, ruční pozvánky) a kdy se mají přestat používat?

## Co můžeme dodat my
* Architekturu, schéma databáze a seznam migrací.
* Popis oprávnění (`src/server/policy.ts`, včetně `canApproveMinutes`) a auditních záznamů
  (např. `minutes.approval_revoked`, změny priority a pořadí témat).
* Seznam migrací včetně nových `0013_topic_priority_and_order` a `0014_minutes_sources_and_approval`.
* Rozhraní pro napojení přepisu a firemního AI/bota: `TranscriptionProvider` a `MinutesDrafter`
  (`src/server/integrations/minutes-drafter.ts`).
* Popis integrace Kalendáře a fronty (`docs/kalendar-organizator.md`).
* Testovací Preview s fiktivními daty a výsledky automatických testů.
