# Opravné kolo PR #74 – průběžný report

Větev `claude/finalni-kontrola-novy-pr-g2r2wd` (draft PR #74). Výchozí HEAD `2127f4c` (kód = `c4c3a9a`), main `e27b631`.

## Potvrzené problémy a opravy

| ID | Problém | Stav | Oprava | Commit |
|---|---|---|---|---|
| P0-3 | Hromadný výběr vedoucího v Připravit měsíc nepřijal osobu (zůstalo „Vyberte vedoucího“, tlačítko neaktivní) | Potvrzeno reprodukcí v Chromiu (klávesnice i myš) | U výběrů se přehled přepočítá až na `change` | 0b1c0d2 |
| P0-2 | Pevný limit 3 garantovaných (doména, služba, DB CHECK 1–3, text „Nastaveno N ze 3“) | Potvrzeno v kódu | Bez maxima, garantovaná vždy první v doporučení, migrace 0015 se schválením | bea1c6c |
| P0-1 | DnD jen v rámci sekce, nestabilní na delší vzdálenost | Potvrzeno v kódu (DOM se přeskládává během tažení) | Atomický `placeTopic` na serveru; UI `TopicBoard`: jeden kontext přes obě skupiny, DOM se během tažení nemění | bea1c6c, ba4b169 |
| P1-2 | Garantovaná jen tenký pruh, nejžádanější bez akcentu | Potvrzeno v CSS | Garantovaná okrový podklad a pruh, nejžádanější mezi ostatními zelený pruh a štítek (tokeny `--ochre-soft`, `--ok`) | ba4b169 |

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
