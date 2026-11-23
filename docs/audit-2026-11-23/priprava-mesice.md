# Audit P0 §7: příprava měsíce a ztráta návrhů (23. 11. 2026)

Větev `oprava/audit-priprava-mesice` (základ `oprava/kompletni-audit-rozhrani-a-funkci`). Jen fiktivní data,
PGlite v unit testech, Playwright přes `e2e/server.mjs`. Žádná živá DB, žádný Google, žádný merge do `main`.

## Nahlášená chyba

Správce smazal návrhy v měsíci, stiskl Připravit měsíc → Doplnit chybějící termíny a nic nevzniklo.
PR #86 přidal do `generateMonth` obnovu: když v měsíci není žádná nesvátková nezrušená akce, smažou se výjimky
(`generation_exclusions`) měsíce. Obnova tedy fungovala jen pro úplně vyprázdněný měsíc.

## Nálezy

| ID | Priorita | Stav | Část | Nález |
|---|---|---|---|---|
| PM-01 | P0 | potvrzená, opravená | `generateMonth` | Jediná ruční, zveřejněná nebo přes hranici měsíce zasahující akce zablokovala obnovu úplně. Smazané návrhy pak nešlo vrátit žádnou cestou. |
| PM-02 | P1 | potvrzená, opravená | `generateMonthAction` | Hláška po doplnění bez výsledku tvrdila „Všechny pravidelné termíny už v plánu jsou“, i když chyběly smazané termíny. Proto to vypadalo jako nefunkční tlačítko. |
| PM-03 | P1 | riziko, ošetřené | `generateMonth` | Výjimky se mazaly před kontrolou kolize. Termín, který obnova kvůli kolizi přeskočila, ztratil výjimku a vrátil by se sám později (např. po zrušení kolizní akce). Ve staré cestě (prázdný měsíc) prakticky nenastane, v nové obnově by nastalo. |
| PM-04 | P2 | potvrzená, opravená | `generateMonth` | Obnova vyprázdněného aktuálního měsíce vracela i proběhlé termíny. Takový návrh nejde zveřejnit (`publishDrafts` bere jen budoucí). |
| PM-05 | P2 | potvrzená, opravená | texty mazání | Okno Smazat vybrané tvrdilo „nejde to vrátit“, okno Smazat návrh „doplnění ho už znovu nevytvoří“. U termínů z rozvrhu to po opravě neplatí. |
| PM-06 | P2 | potvrzená, opravená | počet smazaných | Obnova by nabízela termíny dne, který je v rozvrhu vypnutý (nic by nevzniklo, tlačítko by zůstalo). |
| PM-07 | P3 | riziko, beze změny | `planMonth` | První doplnění aktuálního měsíce vytvoří návrhy i pro proběhlé dny. V okně se nezobrazí (bere jen budoucí), ale jsou v datech. Otázka O2. |
| PM-10 | P2 | potvrzená, opravená | okno Připravit měsíc | Po Doplnit chybějící termíny (nebo Uložit změny) a zavření se okno ptalo „Neuložené změny“, i když nikdo nic nepsal. `Modal` bral otisk polí jen při otevření, formulář se po načtení nových návrhů založil znovu. |
| PM-11 | P3 | potvrzená, opravená | okno Připravit měsíc | Po obnově zůstala pod Doplnit stará hláška „…se nevrací“, která odporovala výsledku. |
| PM-12 | P2 | riziko, beze změny | okno Připravit měsíc | Rozepsané (neuložené) úpravy řádků zmizí bez varování, když správce mezitím stiskne Doplnit nebo Obnovit (formulář má `key` podle verzí návrhů). Otázka O4. |
| PM-13 | – | mimo rozsah | `e2e/okna.spec.ts` | „cizí akce neprozradí obsah“ padá na 1280/1920/320 (FP vidí akci RM `tr-rm-1112`). Souvisí s výchozí viditelností `all-published` z PR #86, ne s přípravou měsíce. Patří relaci účast/náhledy. |
| PM-08 | – | ověřeno, v pořádku | klíč slotu | `split(":").at(-1)` odpovídá formátu `<org>:slot-<den>:<YYYY-MM-DD>`. Nová podmínka bere posledních 10 znaků klíče. |
| PM-09 | – | ověřeno v simulaci | souběh | `events.generation_key` je `UNIQUE` a vkládá se s `ON CONFLICT DO NOTHING`. Výjimka se maže až pro opravdu vložené řádky. Dva požadavky naráz nevytvoří duplicitu. PGlite dotazy serializuje, skutečný souběh na Postgresu nebyl živě testovaný. |

### Důkaz a oprava

* **PM-01:** test `tests/priprava-mesice-obnova.test.ts` scénáře 4, 6, 14. Na původním kódu padá 12 ze 14 scénářů
  (ověřeno záměnou `events.ts` za verzi z `HEAD`).
  Oprava: `generateMonth(viewer, month, { restoreDeleted: true })` vrátí smazané budoucí termíny měsíce bez ohledu
  na ostatní akce. V okně Připravit měsíc je v kroku 1 samostatné tlačítko **Obnovit smazané návrhy (N)** s textem
  „Smazané termíny z rozvrhu: N. Doplnění je nevrací.“ Zobrazí se jen, když je co vracet.
  Automatická obnova úplně vyprázdněného měsíce z PR #86 zůstává.
* **PM-02:** výsledek `generateMonth` vrací `restored` a `deletedLeft`. Hláška: „Nic nového k doplnění. Dřív smazané
  termíny (N) se nevrací, obnovíš je tlačítkem Obnovit smazané návrhy.“ E2E v `e2e/priprava-mesice.spec.ts`.
* **PM-03:** výjimka se maže jen u termínů, které obnova opravdu vložila. Scénář 9.
* **PM-04, PM-06:** podmínka `restorableExclusion` (SQL): budoucí datum, žádná akce s klíčem (zrušená, přesunutá
  i upravená akce si klíč drží), den aktivní v rozvrhu. Scénáře 10 a 13.
* **PM-05:** nové texty: „Nic se neodešle. Ručně přidané návrhy nejde vrátit, termíny z rozvrhu obnoví Připravit
  měsíc.“ a „…Vrátit ho jde v Připravit měsíc tlačítkem Obnovit smazané návrhy.“ Upravený `e2e/okna.spec.ts`
  (kontroluje nový text, nic neoslabeno).
* **PM-10:** `PrepareMonthDialog` předává `Modal` vlastní `hasUnsavedChanges`. Otisk formuláře návrhů se bere při
  každém jeho založení (`fieldsFingerprint`, nově exportovaný z `Modal`). E2E: po doplnění se Zavřít neptá.
* **PM-11:** formulář Doplnit má `key` podle počtu smazaných, po obnově se hláška vyčistí. E2E.
* Počet smazaných se počítá v existujícím dotazu `listMonthDrafts` (poddotaz), rozpočet dotazů Plánu
  (`tests/pocet-dotazu.test.ts`, 17) zůstává.

## 14 scénářů (vitest, `tests/priprava-mesice-obnova.test.ts`)

| # | Scénář | Očekávání | Výsledek |
|---|---|---|---|
| 1 | prázdný měsíc | vzniknou návrhy, nic se neobnovuje ani nezveřejní | ✓ |
| 2 | jen svátky | vyprázdněný měsíc doplnění obnoví celý, svátky se nezdvojí | ✓ |
| 3 | existující návrhy | opakované doplnění i obnova nic nepřidá | ✓ |
| 4 | zveřejněné akce | smazané návrhy vedle zveřejněné akce jdou vrátit, zveřejněná beze změny revize | ✓ |
| 5 | smazaný návrh | běžné doplnění ho nevrátí (`deletedLeft=1`), obnova ano, jako návrh | ✓ |
| 6 | ruční akce | jediná ruční akce obnovu nezablokuje a zůstane nedotčená | ✓ |
| 7 | přesunutý termín | obnova ho na původním dni nezdvojí | ✓ |
| 8 | zrušený termín | ani prázdný měsíc, ani obnova zrušenou akci nevrátí | ✓ |
| 9 | konflikt | termín obsazený akcí stejné skupiny se neobnoví, výjimka zůstane, po zrušení kolize se sám nevrátí | ✓ |
| 10 | upravený rozvrh | vypnutý den se nenabízí, po zapnutí obnova použije aktuální čas | ✓ |
| 11 | opakované kliknutí | druhá obnova nic nepřidá | ✓ |
| 12 | souběžné generování | 3 požadavky naráz = přesně N návrhů, unikátní klíče | ✓ (PGlite) |
| 13 | historicky vyloučené sloty | proběhlý smazaný termín zůstane smazaný, budoucí se vrátí | ✓ |
| 14 | přesah mezi měsíci | vícedenní akce z listopadu obnovu prosince neblokuje, leden zůstane beze změny | ✓ |

Starší pokrytí beze změny: `tests/plan.test.ts` (generování ze šablony, smazání všech návrhů),
`tests/doplneni-mesice-scenare.test.ts` (svátky, výjimky, přesuny, kolize, vedoucí).

## Workflow 1. Doplnit → 2. Zkontrolovat → 3. Zveřejnit

* Krok 1: hlavní tlačítko jen bez návrhů, jinak vedlejší. Nově Obnovit smazané návrhy (malé, vedlejší) jen se
  smazanými termíny. Hlášky říkají „jako návrh, nic se nezveřejnilo“.
* Krok 2 a 3 (přehled, hromadné doplnění, filtr, šedé Zveřejnit s důvodem, potvrzení neúplných) jsou pokryté
  `e2e/priprava-mesice*.spec.ts` a `tests/priprava-mesice*.test.ts`. Nové chyby jsem tu nenašel.
* Dialog s celým měsícem návrhů: E2E snímky 320/390/1280/1920 a kontrola vodorovného posunu (viz Ověření).

## Otázky pro vlastníka

* **O1:** Má zůstat automatická obnova úplně vyprázdněného měsíce (PR #86) vedle tlačítka Obnovit smazané návrhy?
  Zachováno, protože to popisuje `docs/opravne-kolo-ucast-mesic-2026-11-23.md` (akceptační test 1).
  Čistší by bylo vracet smazané jen tlačítkem.
* **O2:** Má doplnění aktuálního měsíce vytvářet návrhy i pro proběhlé dny (PM-07)? Beze změny.
* **O4:** Má Doplnit/Obnovit při rozepsaných úpravách řádků nejdřív upozornit (PM-12)? Beze změny.
* **O3:** Stačí obnova všech smazaných termínů měsíce najednou, nebo je potřeba vracet jednotlivě?

## Ověření (23. 11. 2026)

* `npm run lint` 0, `npx tsc --noEmit` 0, `npx vitest run` 56 souborů / 563 testů zelených (včetně nových 14).
* Playwright `e2e/priprava-mesice.spec.ts`, `e2e/priprava-mesice-f06-f09.spec.ts` na windows-1280 a telefon-320:
  35 passed, 1 skipped (zápis jen na 1280). Dřívější běh s `e2e/okna.spec.ts` a windows-1920: vše kromě PM-13.
* Snímky dialogu se 17 návrhy (320/390/1280/1920) prohlédnuté: bez vodorovného posunu, patička s Zveřejnit /
  Uložit změny / Zrušit úpravy zůstává dole, krok 1 s obnovou se zalamuje čitelně. Snímky se necommitují.
* Simulace: PGlite a demo server s fiktivními daty. Živě netestováno: souběh na skutečném Postgresu, Google.

## Navazující prompt

Stav: větev `oprava/audit-priprava-mesice`, draft PR do `oprava/kompletni-audit-rozhrani-a-funkci`. Další krok:
rozhodnutí vlastníka k O1–O4. PM-13 předat relaci účast/náhledy. Případně varování před ztrátou rozepsaných řádků
(PM-12) jako samostatná malá změna.
