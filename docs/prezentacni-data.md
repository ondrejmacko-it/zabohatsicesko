# Prezentační data pro ostrou Wiki

Skript: [`prezentacni-data.sql`](prezentacni-data.sql). **Připraveno, nespuštěno.** Rozhodnutí uživatele: data do
produkce až po merge PR `claude/doladeni-harmonogramu-a-temat`. Doporučení témat se ukáže živě (skript nevkládá
návrhy, vzniknou skutečným generováním). Akce vedou jen noví fiktivní kolegové.

## Výchozí stav (read-only SELECT, 18. 11. 2026)

* 3 účty (správce, 2 členové), 12 témat, pravidelný týden út Action time, st Trénink poradců/Portfolio tým,
  čt Trénink RM, pá Firemní vzdělávání FP/RM.
* Listopad až leden je vygenerovaný a zveřejněný (revize 2), akce z pravidelného týdne bez vedoucího a tématu.
  9 ručních akcí s tématem vedou stávající účty. Únor 2027 je prázdný.

## Co skript udělá

1. 6 fiktivních kolegů `*.prezentace@example.invalid` (member; FP: Vašek, Petra, Lucie; RM: Tomáš, Jana; Tým A: Martin).
2. 3 nová témata od kolegů a zájem kolegů o témata. Únor pak při Připravit měsíc → Doplnit nabídne doporučení
   (5. 2., 12. 2., 19. 2.), 26. 2. zůstane bez doporučení (ukázka, že bez doporučení nejsou kliknutí navíc).
3. U 15 budoucích akcí 26. 11. 2026 – 27. 1. 2027 doplní Kdo a u 6 Téma (2× ze seznamu Témata, 5× vlastní text).
   Ostatní akce zůstávají záměrně prázdné: správce vidí „— doplnit“, kolega „Bude upřesněno“.
   Zápis ve stejném tvaru jako uložení a zveřejnění v aplikaci (revize, snímek, vazba Kalendáře `pending`, audit).

Nic nemaže. Šablonu týdne, ruční akce, nahrávky, přepisy a zápisy nemění. Opakované spuštění zastaví pojistka.

## Postup

1. Merge PR a nasazení na produkci (dělá uživatel).
2. Záloha: v Neonu větev z `main` (např. `zaloha-pred-prezentaci`).
3. Spustit celý soubor jako jednu transakci (Neon SQL Editor). Poslední SELECT vypíše doplněné akce.
4. V ostré Wiki: Plán listopad–leden (Kdo/Téma), pak únor → Připravit měsíc → Doplnit → okrová doporučení
   (Přijmout / Změnit / Odmítnout). Nezveřejněné návrhy zůstanou návrhy, dokud je správce nezveřejní.

**Kalendář:** vazby `pending` zpracuje běžná synchronizace. Podle inventury jde o osobní režim (bez e-mailů hostům).
Fiktivní adresy nemají kalendář, nic jim nepřijde.

## Návrat

Nejjistěji obnovit výchozí větev ze zálohy. Bez zálohy ručně: vedoucí a témata akcí vrátit novou revizí přes UI
(Upravit → Zveřejnit), pak smazat zájmy, 3 témata `topic-prezentace-*` a uživatele `%.prezentace@example.invalid`
(jen pokud na ně nic neodkazuje).

## Ověření skriptu

Nanečisto v lokální PGlite s migracemi aplikace a vzorkem akcí ve tvaru produkce: transakce projde, snímek
odpovídá `snapshotOf` (čas `…T11:30:00.000Z`), revize `publish`, vazby `pending`, akce s vedoucím přeskočena,
téma u akce s tématem nepřepsáno, audit `user.invited` 6×, `topic.propose` 3×, `event.publish` 1× za akci.
Proti ostré DB neběžel.
