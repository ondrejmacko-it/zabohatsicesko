import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ochrana soukromí" };

// Veřejná stránka bez přihlášení: Google ji vyžaduje ke zveřejnění OAuth aplikace.
export default function PrivacyPage() {
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Firemní Wiki</span>
          <span className="brand-tagline">Za bohatší Česko – znalosti a procesy na jednom místě</span>
        </div>
      </header>
      <main className="gate">
        <article className="panel gate-panel stack">
          <h1>Ochrana soukromí</h1>
          <p>
            Firemní Wiki je interní nástroj týmu Za bohatší Česko pro plán vzdělávání, témata a zápisy. Přístup
            mají jen lidé, kterým ho schválí správce Wiki.
          </p>
          <h2>Jaké údaje Wiki zpracovává</h2>
          <ul>
            <li>Z účtu Google jméno, e-mailovou adresu a identifikátor účtu. Slouží jen k přihlášení.</li>
            <li>Roli a skupiny, které přidělí správce, a záznam důležitých kroků (kdo co zveřejnil nebo změnil).</li>
            <li>Obsah, který do Wiki vložíte: akce, témata, zájem o témata, nahrávky a zápisy.</li>
            <li>Nezbytné cookies pro přihlášení. Wiki nepoužívá analytické ani reklamní cookies.</li>
          </ul>
          <h2>Google Kalendář</h2>
          <p>
            Pouze správce, který Kalendář propojí, uděluje Wiki oprávnění ke správě událostí. Wiki ho používá
            jen k založení, úpravě a zrušení pozvánek na akce vzdělávání ve firemním kalendáři. Přístupový
            token je uložený šifrovaně. Ostatní uživatelé pozvánky jen dostávají.
          </p>
          <p>
            Použití informací získaných z Google API se řídí zásadami Google API Services User Data Policy
            včetně požadavků Limited Use. Údaje z Googlu se neprodávají, nepoužívají k reklamě ani se
            nepředávají třetím stranám.
          </p>
          <h2>Kde jsou údaje uložené</h2>
          <p>
            Aplikace běží na Vercelu, databáze u Neonu v Evropské unii (Frankfurt). Údaje se uchovávají po dobu
            používání Wiki.
          </p>
          <h2>Vaše možnosti</h2>
          <p>
            O opravu nebo smazání údajů a zrušení přístupu požádejte správce Wiki. Oprávnění pro Wiki můžete
            kdykoli odebrat také v nastavení svého účtu Google (Zabezpečení, Aplikace třetích stran).
          </p>
          <p>
            <a href="/vstup">Zpět na přihlášení</a>
          </p>
        </article>
      </main>
    </>
  );
}
