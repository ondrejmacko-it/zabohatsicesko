# Živý test na preview s pomocí ChatGPT (agent v prohlížeči)

Scénář dělí práci na dvě části. Kroky, které potřebují Google účet, souhlas u Googlu nebo tajemství, dělá
uživatel. Kroky ve Wiki dělá ChatGPT v interním prohlížeči. ChatGPT se přihlašuje jen jednorázovým kódem
fiktivní role. Heslo ke Googlu ani přístupový kód Wiki nikdy nedostane. Kódy a sdílecí odkaz se do repa nezapisují.

Preview: `https://zbc-vzdelavani-demo-git-claude-adoring-ramanujan-rot348-maci.vercel.app`
(proměnné jen pro tuto větev: `APP_URL`, `CALENDAR_ATTENDEES=audience`, `GATE_MODE=invite`).

## A. Příprava (dělá uživatel)

1. Google Cloud konzole, OAuth klient, Authorized redirect URIs: přidat
   `<preview>/api/google/prihlaseni/callback` a `<preview>/api/google/kalendar/callback`.
2. Vercel dashboard, deployment této větve, Share: zkopírovat sdílecí odkaz (platí 23 h). Ten dostane ChatGPT.
3. Ve vlastním prohlížeči se na preview přihlásit Googlem jako správce. Při druhém přihlášení má stačit jedna
   obrazovka se souhlasem včetně Kalendáře. Na Plánu ověřit řádek „Kalendář · Propojeno“.
4. Ve Správě u fiktivních účtů (Vedoucí ukázky, Účastník FP, Účastník RM, Druhý správce ukázky) zvolit v menu
   „Jednorázový kód (bez účtu Google)“ a kódy předat ChatGPT v chatu (ne do repa).
5. Hromadné zveřejnění posílá skutečné e-maily. Spouští se jen po výslovném souhlasu uživatele.

## B. Prompt pro ChatGPT

Zkopíruj do ChatGPT (režim agenta) a doplň odkaz a kódy:

> Testuješ ukázkovou firemní Wiki, modul Vzdělávání. Otevři sdílecí odkaz `<SDÍLECÍ ODKAZ>`. Na stránce
> `/vstup` se přihlas jednorázovým kódem. Kódy: Druhý správce `<KÓD>`, Vedoucí `<KÓD>`, Účastník FP `<KÓD>`,
> Účastník RM `<KÓD>`. Každý kód platí jednou. Pro další roli se odhlas a použij další kód. Nezadávej žádná
> hesla a nepřihlašuj se přes Google. Nic nemaž a nezveřejňuj hromadně. U každého kroku zapiš: co jsi udělal,
> co jsi čekal, co se stalo, a pořiď snímek. Každý krok zkontroluj i v šířce okna kolem 390 px. Hlídej
> vodorovný posun, texty mimo osu a chybové hlášky.
>
> 1. Jako Druhý správce: Vzdělávání › Plán. Je nahoře řádek „Kalendář“ a co v něm stojí? Otevři budoucí
>    zveřejněnou akci. Ukazuje dialog stav pozvánky a seznam hostů podle skupiny (Publikum)?
> 2. Přidej akci na nejbližší volný den (Typ, téma z doporučených, vedoucí, publikum FP) a zveřejni ji. Pod
>    Publikem má být počet a jména hostů. Po zveřejnění má akce stav pozvánky „synchronizováno“ nebo „čeká“.
> 3. Změň u té akce čas o hodinu, ulož. Pak akci zruš (Další možnosti › Zrušit akci). Zapiš, co dialog
>    hlásil o pozvánce.
> 4. Správa systému: projdi seznam účtů, otevři menu u účtu Účastník RM, okno „Upravit roli a skupiny…“,
>    přidej skupinu FP, ulož, pak ji zase odeber. Zkontroluj, že se změna projevila.
> 5. Odhlas se a přihlas jako Vedoucí. Plán › „Čeká na vás“ a Zápisy › „Přidat zápis“: je vidět proběhlá akce,
>    kterou vede? Otevři zápis, ukázkovou nahrávku nahraj (soubor nabídnutý Wiki), zkontroluj a zveřejni zápis.
> 6. Odhlas se a přihlas jako Účastník FP. Moje cesta: je u akce odkaz na zápis? Plán: vidí jen akce své
>    skupiny a nemá tlačítka plánování?
> 7. Jako Účastník RM ověř, že akci jen pro FP nevidí.
>
> Na konci dej tabulku: krok, výsledek (OK / chyba / nejasné), poznámka, snímek.

## C. Kontrola po testu (dělá uživatel)

- Přišly pozvánky, změna času a zrušení do schránek účtů, které mají skutečný e-mail? Fiktivní adresy
  `@example.invalid` pozvánku nedostanou, to je správně.
- Nový účet a žádost: přihlas se Googlem z jiného (testovacího) účtu, jako správce schval žádost ve Správě
  (okno „Schválit…“) a ověř, že mu pozvánky na budoucí akce jeho skupin dojdou samy.
- Odkaz na zápis v pozvánce Kalendáře po zveřejnění zápisu.
- Po testu: sdílecí odkaz nechat vypršet, použité kódy jsou jednorázové.
