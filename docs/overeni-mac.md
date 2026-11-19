# Ověření na skutečném Macu v Safari

Automatická sada (`npm run e2e`) běží v Chromiu a macOS jen napodobuje: rozlišení 1440×900 a 1512×982,
Retina (`deviceScaleFactor: 2`) a user agent Safari a Chrome na macOS. Skutečné Safari (WebKit) v cloudovém
prostředí není. Tento postup zvládne kolega s Macem za 15 minut, bez instalace čehokoli.

## Ruční průchod v Safari (bez instalace)

1. Otevřete Safari a v něm odkaz na preview ukázky, který vám pošle správce (včetně přístupového kódu).
2. Na vstupu vyplňte kód, vyberte **Správce ZBC ukázky** a klikněte na **Vstoupit do ukázky**.
3. Postupně otevřete v levém menu **Vzdělávání** a záložky **Plán**, **Zápisy**, **Témata**.
   U každé stránky ověřte, že nejde posunout do strany (dvěma prsty na touchpadu doleva/doprava).
4. Na Plánu klikněte na **Přidat akci**. Okno se otevře, klávesa **Esc** ho zavře.
5. Na Plánu klikněte na **Připravit měsíc** → **Nastavit pravidelný rozvrh**. Okno se otevře, **Esc** ho zavře.
6. Klikněte na **Zkontrolovat … návrhů**. Okno se otevře a dá se v něm rolovat, **Esc** ho zavře.
7. Klikněte na akci **Setkání týmu**. Otevře se náhled. Pak podržte **⌘ (Cmd)** a klikněte na stejnou akci:
   má se otevřít nová karta a na původní stránce se nesmí nic otevřít.
8. Otevřete detail akce (v náhledu **Celý detail**), klikněte na **Upravit** a pak **Další možnosti** →
   **Zrušit akci…**. Nic neukládejte, okna zavřete tlačítkem **Zavřít**.
9. Klávesnice: Safari ve výchozím stavu přeskakuje odkazy klávesou Tab. Zapněte **Safari → Nastavení →
   Pokročilé → Zvýraznit každou položku na webové stránce klávesou Tab** (nebo používejte **⌥ + Tab**).
   Pak Tab musí projít menu, záložky a tlačítka a fokus musí být vidět (tmavý obrys).
10. Vpravo nahoře přepněte roli na **Účastník – finanční poradce** a zopakujte kroky 3 a 7.
11. Otevřete adresu ukázky s koncem `/vzdelavani/harmonogram?akce=neexistuje`. Má se ukázat okno
    **Akce není dostupná** a tlačítko **Zpět na plán** vás vrátí na Plán.
12. Cokoli, co nesedí, vyfoťte (**⌘ + Shift + 4**, pak mezerník a klik na okno) a pošlete i s krokem.

## Automatická sada ve skutečném WebKitu (pro vývojáře)

Na Macu s Node.js 22 v Terminálu v kořeni repa:

```bash
npm ci
npx playwright install webkit
E2E_WEBKIT=1 npm run e2e -- --project=prihlaseni --project=webkit-1440
```

WebKit od Playwrightu je jádro Safari, ne celé Safari (chybí třeba nastavení Tab z kroku 9).
