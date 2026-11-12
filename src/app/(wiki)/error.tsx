"use client";

/** Neočekávaná chyba stránky. Detaily zůstávají v provozním logu, uživatel vidí jen srozumitelnou zprávu. */
export default function WikiError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="stack">
      <h1>Něco se nepovedlo</h1>
      <p>Stránku se nepodařilo načíst. Zkuste to prosím znovu, případně za chvíli.</p>
      <p>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Zkusit znovu
        </button>
      </p>
    </section>
  );
}
