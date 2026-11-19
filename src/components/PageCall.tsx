/**
 * Hlavní výzva stránky: věta s účelem stránky a jediné hlavní tlačítko. Stojí nad obsahem, aby hlavní akce
 * nesplývala se zbytkem stránky. Na stránce je nejvýš jedna.
 */
export function PageCall({ text, children }: { text: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="page-call">
      <p className="page-call-text">{text}</p>
      <div className="page-call-action">{children}</div>
    </div>
  );
}
