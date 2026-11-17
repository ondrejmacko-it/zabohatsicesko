/** Rámec stránek mimo Wiki (vstup, 404): značka, karta uprostřed a patička. */
export function GateShell({ title, wide = false, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="gate-page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Firemní Wiki</span>
          <span className="brand-tagline">Za bohatší Česko – znalosti a procesy na jednom místě</span>
        </div>
      </header>
      <main className="gate-main">
        <div className={`gate-card${wide ? " gate-card-wide" : ""}`}>
          <div className="gate-title">
            <span className="gate-mark" aria-hidden="true">
              W
            </span>
            <div>
              <p className="gate-eyebrow">Firemní Wiki</p>
              <h1>{title}</h1>
            </div>
          </div>
          {children}
        </div>
        <nav className="gate-foot" aria-label="Doplňující odkazy">
          <a href="/soukromi">Ochrana soukromí</a>
          <span aria-hidden="true">·</span>
          <span>Za bohatší Česko</span>
        </nav>
      </main>
    </div>
  );
}
