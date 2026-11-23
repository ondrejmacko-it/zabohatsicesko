# Opravné kolo harmonogramu – 23. 11. 2026

## Doložené problémy
- Smazání všech generovaných návrhů založilo `generation_exclusions`; opakovaná příprava měsíce doposud nic nevygenerovala.
- `EVENT_VISIBILITY` ve výchozím režimu skrylo lidem zveřejněné akce jiných skupin, včetně náhledů.
- `PARTICIPATION` je na ukázce často vypnutý: neobjevovaly se štítky ani přepínač účasti.
- Náhled konkrétního kolegy ignoroval jeho individuální přihlášky/omluvy.
- Dobrovolné odhlášení mazalo záznam a nešlo ho odlišit od nikdy nepřihlášeného.
- Úvodní `Co tě čeká` při společném harmonogramu vybíral i nepovinné akce.

## Změny
- Výchozí viditelnost zveřejněných akcí = `all-published`. Nouzové vrácení na původní filtr: výslovné `EVENT_VISIBILITY=audience`. Serverová práva k zápisům, nahrávkám a změnám zůstávají oddělená.
- V Plánu jsou čtyři filtry: Všechny, Povinné, Dobrovolné, Moje. Společný plán je výchozí; neaktivní účast zobrazí jen odvozené stavové štítky bez možnosti zápisu.
- Barevně odlišené, slovně pojmenované stavy na kartách harmonogramu i v seznamu.
- Náhled konkrétního kolegy při `PARTICIPATION=on` vidí pouze jeho stav účasti. Důvod a text omluvy zůstávají neveřejné. Náhled skupiny nemá individuální záznamy.
- Po kompletním smazání pracovních návrhů měsíce lze jeho sloty znovu vytvořit; existující jednotlivé termíny a svátky nejsou duplikovány. Pokud jiné pracovní akce stále existují, jednotlivá historická vyloučení zůstávají zachována.
- Odhlášení se ukládá jako `withdrawn`; je odlišitelné od `optional` a umožňuje znovupřihlášení.
- Úvod zobrazuje nejbližší osobně relevantní akce a jejich stav.
- Garantovaná témata nemají limit tří, upravena související nápověda.

## Release a bezpečnost
- **NEMERGOVAT** bez zeleného CI, nezávislého testu a ověření produkčních dopadů.
- `PARTICIPATION` je stále chráněný přepínačem. Výchozí hodnota je vypnuto, v `WIKI_MODE=production` je změna účasti nadále zablokovaná. Pouhé sloučení PR **nezapne** přihlášky a omluvy.
- Nová migrace `0017_participation_withdrawn` rozšiřuje kontrolu `event_participation.kind` a vyžaduje schválení. Před případným povolením účasti na vzdálené DB musejí být aplikované `0016_event_participation` a `0017_participation_withdrawn` v tomto pořadí, s backupem a ověřením.
- Nespouštět živé změny Google Kalendáře bez výslovného schválení. Před aktivací ověřit idempotentní synchronizaci a zachování ručně přidaných hostů.
- Neodkrývat důvody omluv, soukromé zápisy ani pracovní verze akcí.
- Zveřejněné zápisy zůstávají dostupné dle dosavadní samostatné politiky oprávnění.

## Akceptační testy před merge
1. Správce vymaže všech 17 generovaných návrhů z budoucího měsíce, zavře okno, znovu spustí přípravu: návrhy se bezpečně obnoví právě jednou. Svátky a jednotlivé úpravy se neduplikují.
2. FP, RM, FP+RM, vedoucí a administrátor vidí stejné zveřejněné aktivity v „Všechny“. Nikdo nevidí cizí pracovní návrh nebo soukromý podklad zápisu.
3. „Povinné“ odpovídá rolím, „Dobrovolné“ zobrazuje nepovinné akce včetně přihlášených/odhlášených, „Moje“ odpovídá povinným a dobrovolně přidaným akcím.
4. Náhled konkrétní osoby: povinné, přihlášené i omluvené stavy bez důvodů; režim jen pro čtení. Náhled skupiny je modelový.
5. Odhlásit -> Odhlášeno -> Znovu přihlásit; pozvánky bez duplicit v simulaci.
6. Úvodní „Co tě čeká“ odpovídá individuálnímu plánu, nikoli libovolným celofiremním akcím.
7. Kontrola desktop/mobil a čitelnosti barev, fokusu a dialogů.
8. Testy lint, typecheck, unit, build, E2E a skutečná testovací DB.

## Omezení
- Změna ve větvi neznamená změnu existující ukázky na Vercelu. Neověřoval se živý Google ani konkrétní produkční konfigurace.
- Stav „Odhlášeno“ nelze použít na vzdálené DB před aplikací migrace 0017.
- Skupinový náhled nemůže mít vlastní přihlášky/omluvy; jedná se o hypotetickou roli.
- Náhled konkrétního kolegy při vypnutém `PARTICIPATION` ukazuje jen povinné/dobrovolné podle role (neuložené osobní změny nečte).
