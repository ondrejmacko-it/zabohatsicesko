# Audit 23. 11. 2026 · §5 a §6: viditelnost, filtry a stavy účasti, náhledy

Větev `oprava/audit-ucast-nahledy` ze základu `oprava/kompletni-audit-rozhrani-a-funkci` (ab4a606). Jen fiktivní
data a lokální PGlite, žádná živá DB, žádný deploy, žádné pozvánky skutečným lidem.

Kategorie: **C** = potvrzená chyba (reprodukovaná testem nebo kódem), **P** = pravděpodobná, **R** = neověřené
riziko, **N** = návrh (změna chování, potřebuje rozhodnutí vlastníka).

## Nálezy

| ID | P | Kat. | Část | Důkaz | Dopad | Oprava | Ověření | Test |
|----|---|------|------|-------|-------|--------|---------|------|
| U01 | P1 | C | Filtr Moje, Úvod „Co tě čeká“ | `isMine(view, card.handler)`; `handler = canHandleRecording` je u správce/organizátora `true` pro každou zveřejněnou akci (`canPlan`) | Správci (vlastník Wiki je admin) ukazovalo Moje i Úvod všechny zveřejněné akce, filtr byl k ničemu | Nové pole `EventCard.leadsOrReviews` (`isEventHandler` nad zveřejněnou verzí); Moje i Úvod počítají jen s ním | vitest | `tests/audit-ucast-nahledy.test.ts` „Moje u správce…“, „Moje na Úvodu i v Plánu…“ |
| U02 | P2 | C | Náhled bez zapnutých přihlášek (`PARTICIPATION` vypnuté, ostrá Wiki) | Karta měla štítek „Dobrovolné“ (přepis jen ve `withOwnParticipation`), okno a detail akce v náhledu „Můžeš se přihlásit“ | V ostré Wiki náhled sliboval přihlášení, které neexistuje; měsíc a detail si odporovaly | `ownParticipationView(…, { enrollment })` – jeden zdroj štítku pro kartu, detail i náhled | vitest (demo i `WIKI_MODE=production` s `PARTICIPATION=on`) | `tests/audit-ucast-nahledy.test.ts` „náhled skupiny (demo/production)…“ |
| U03 | P2 | C | Úvod (`NextEventsList`) | Tón štítku `excused ? outline : ok` – „Odhlášeno“ a „Můžeš se přihlásit“ byly zelené jako platná účast; měsíc a panel měly jiné pravidlo | Odhlášený kolega na Úvodu viděl zelený štítek, jako by byl přihlášený | Sdílená `participationTone` (status.ts) v měsíci, seznamu, Úvodu i panelu | vitest | `tests/audit-ucast-nahledy.test.ts` „tón štítku účasti“ |
| U04 | P2 | C | Rollback `EVENT_VISIBILITY=audience` | `publishedEventVisibleToMember` porovnával `viewer.groups.includes(audience)`; `vsichni` se ale neukládá (účty z Google žádosti mají `[]`, správa skupin `vsichni` nepřidává) | Při nouzovém rollbacku by kolega bez uloženého `vsichni` neviděl akce pro Všechny, které jsou pro něj povinné | `audience === "vsichni"` platí vždy, shodně s `isRequiredForUser` | vitest | `tests/audit-ucast-nahledy.test.ts` „rollback…“ |
| U05 | P3 | C | Panel účasti v náhledu kolegy | Nadpis „Tvoje účast“ a u omluvy text „Důvod vidíš jen ty. Wiki tě z pozvánky odebere…“ | Správce v náhledu četl text, jako by šlo o jeho omluvu (důvod se neukazoval, únik ne) | V náhledu nadpis „Účast v náhledu“ a bez vysvětlení vlastní omluvy | Playwright | `e2e/ucast.spec.ts` „náhled kolegy s omluvou“ |
| U06 | P3 | C | Panel účasti u zrušené akce | `STATE_TEXT.cancelled` chyběl, panel měl prázdný odstavec | Prázdné místo pod nadpisem | Text „Akce je zrušená, účast se u ní neeviduje.“ | revize kódu | – (statický text) |
| U11 | P2 | C | Proběhlá nepovinná akce (měsíc, seznam, okno, detail) | e2e snímek: okno akce z 3. 11. ukazovalo štítek „Můžeš se přihlásit“, text „Pokud chceš, můžeš se přihlásit“, „Do Kalendáře se akce přidá, až se přihlásíš“ a zároveň „Akce už začala“. Od PR #86 vidí kolegové i cizí proběhlé akce, takže se to týká většiny začátku měsíce | Rozporný slib přihlášení, které server odmítne | Štítek „Dobrovolné“ u nepovinné akce, která už začala; panel u uzavřené akce bez nabídek a bez poznámky o Kalendáři (texty „nebyla povinná“, „ses odhlásil“) | vitest + Playwright | `tests/audit-ucast-nahledy.test.ts` „proběhlá nepovinná akce…“, `e2e/ucast.spec.ts` |
| U12 | P2 | C | e2e po PR #86 | `e2e/nahled.spec.ts:90` čekal „Akce není dostupná“ u zveřejněné RM akce (dnes legitimně viditelné všem); `e2e/ucast.spec.ts:37` bral první (už proběhlou) kartu a po odhlášení čekal stav „nikdy nepřihlášeno“ místo Odhlášeno (0017). Příčina obou pádů je nezávislá na této větvi (padají i na základu podle analýzy, samostatně nespuštěno) | Sada e2e nehlídala účast ani náhled | Testy převedeny na původní záměr bez oslabení: cookie nic nezmění (bez pruhu a panelu účasti) a nezveřejněný návrh `ev-11-19` nevydá okno ani `/vzdelavani/akce/…` (404); účast se mění na budoucí akci a po odhlášení se ověřuje Odhlášeno + znovu přihlásit | Playwright | `e2e/nahled.spec.ts`, `e2e/ucast.spec.ts` |
| U07 | P3 | – | Migrace 0016 → 0017 | Analýza: 0017 jen nahradí `event_participation_kind_check` (výchozí název inline CHECK z 0016) a přidá `withdrawn`; data nemění | – (chyba nenalezena), doplněno pokrytí | – | vitest na PGlite, nikdy živá DB | `tests/migrace-0016.test.ts` „0017 nad skutečnými záznamy 0016…“ |
| U08 | P3 | R | Přihláška po zániku povinnosti | Stará omluva u (už) nepovinné akce: „Přihlásit se“ ji přepíše záznamem `voluntary_enrolled` | Když se povinnost vrátí, omluva už neplatí a akce je zase povinná. Okrajový případ, chování je bezpečné (víc pozvánek, ne méně) | – | analýza | – |
| U09 | P3 | N | Filtry Povinné/Moje a zrušené akce | Zrušená akce má stav `cancelled`, takže z Povinné i Moje zmizí, i když byla povinná | Kolega v Povinné nevidí, že jeho povinná akce byla zrušena (ve Všechny ji vidí) | Návrh: u zrušené akce si pamatovat původní povinnost a nechat ji v Povinné/Moje se štítkem Zrušeno | – | – |
| U10 | P3 | N | Detail bez zapnutých přihlášek | `ownParticipationDetail` vrací bez `PARTICIPATION` a mimo náhled `null`; měsíc přitom ukazuje „Povinné pro tebe“ | Detail nic o účasti neříká, měsíc ano (rozpor jen v informovanosti) | Návrh: read-only panel se stavem podle rolí (vyžaduje změnu existujícího testu „vypnutý přepínač“, proto neprovedeno) | – | – |

## Ověřeno bez nálezu

- Výchozí viditelnost `all-published`: FP vidí zveřejněné RM akce a naopak, víc rolí bez duplicit (výpis je jeden řádek na akci), návrh bez zveřejněné verze běžnému uživateli neunikne ani přes `?akce=` (`EventPeek` → `getEventDetail` → `visibleEvent`), ani přes `/vzdelavani/akce/[id]` (stejná 404 jako neexistující ID). Pokryto `tests/ucast-role.test.ts`, `tests/nahled.test.ts`.
- Filtry `ucast=`: Povinné = povinné + omluvené, Dobrovolné = nabídka + přihláška + odhlášení, svátky zůstávají, kombinace s `typ`/`stav` (A), hodnota zůstává v odkazech (měsíc, pohled, filtry typu) a po obnovení stránky. Neznámá či vícenásobná hodnota = Všechny. Logika je teď čistá funkce `matchesAttendance` s testem.
- Stavy: Odhlášeno (`withdrawn`) ≠ nikdy nepřihlášeno (`optional`) v doméně, štítku i panelu; zrušená, proběhlá (akce uzavřené) a návrh (bez účasti).
- Přechody: přihlásit/odhlásit/znovu přihlásit, omluvit/zrušit omluvu, idempotence, souběh (`FOR UPDATE` + PK), minulost, neaktivní účet – `tests/ucast-role.test.ts`, `tests/ucast-prihlasky.test.ts`.
- Náhledy: identita akcí je vždy session, v náhledu `actions: []`; náhled kolegy čte jeho záznam (stav), nikdy důvod ani poznámku (`excuse: null`); náhled skupiny je hypotetický (bez záznamů); cookie je vázaná na účet a ověřená na serveru; `PlanFilters key={preview?.key}`.

Doplněno i e2e F04 (`e2e/ucast.spec.ts`): po odhlášení se čeká stav Odhlášeno a věta `calendarNote` pro
`withdrawn` („Wiki tě na tuto akci do Kalendáře nezve.“), kterou záměrně odlišil commit 66f9f76.

## Výsledky (23. 11. 2026, lokálně, simulace)

- `npx eslint .` OK, `npx tsc --noEmit` OK, `npx vitest run` 56 souborů / 559 testů OK.
- `npx playwright test e2e/ucast.spec.ts e2e/nahled.spec.ts e2e/harmonogram-rozlozeni.spec.ts --project=windows-1280 --project=telefon-390`: 32/32 OK (build proběhl uvnitř `e2e/server.mjs`). Nové: axe bez závažných nálezů na měsíci, seznamu a Úvodu se stavy účasti (server `PARTICIPATION=on`), náhled kolegy s omluvou.
- Běh probíhal na dočasně posunutých portech (3350–3353, 3450), protože porty 3311/3313 držel souběžný e2e běh jiné relace. Úprava `e2e/constants.mjs` se necommitovala.
- Mimo rozsah: v prvním běhu (se závislými projekty) padl `e2e/temata-planovani.spec.ts:216` (pořadí témat „Týmové priority“ vs „DnD téma 01“) – oblast témat řeší jiná relace, neověřováno.
- Snímky prohlédnuty: seznam (Dobrovolné u proběhlých, Můžeš se přihlásit u budoucích, Odhlášeno, Omluveno, Zrušeno), Úvod na telefonu, okno akce v náhledu kolegy („Účast v náhledu“, Omluveno, bez důvodu a bez tlačítek).
- Simulace vs. živý test: vše nad fiktivním seedem a PGlite. Proti živé DB ani Google nic nespuštěno; migrace 0016/0017 jen na PGlite.

## Navazující prompt

Větev `oprava/audit-ucast-nahledy` (draft PR do `oprava/kompletni-audit-rozhrani-a-funkci`). Hotovo U01–U07, U11, U12.
Otevřené pro vlastníka: U09 (nechat zrušenou povinnou akci v Povinné/Moje?), U10 (read-only panel účasti v detailu
bez zapnutých přihlášek – mění existující test „vypnutý přepínač“), U08 jen riziko. Další krok: rozhodnutí U09/U10,
případně celé e2e po sloučení souběžných větví auditu.
