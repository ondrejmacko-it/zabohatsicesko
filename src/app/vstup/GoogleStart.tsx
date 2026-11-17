"use client";

import { useState, type ReactNode } from "react";

/**
 * Nové zařízení: uživatel adresu zadá sám, Wiki ji nikdy nepředvyplní. Adresa je jen nápověda pro výběr účtu
 * u Googlu, identitu a shodu s pozvánkou ověřuje server po návratu.
 *
 * Adresa nesmí skončit v URL Wiki (historie, přístupové logy, Referer): jde v těle `fetch` POST a server vrátí
 * adresu Googlu. Na ni klient přejde přes `location`, protože CSP `form-action 'self'` by přesměrování
 * odeslaného formuláře na Google zablokovala.
 */
export function GoogleStart({ href, children }: { href: string; children: ReactNode }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <form
      className="stack gate-start"
      method="post"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setFailed(null);
        try {
          const response = await fetch(href, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim() }),
            credentials: "same-origin",
            cache: "no-store",
          });
          const data = (await response.json().catch(() => null)) as { url?: unknown } | null;
          if (!response.ok || typeof data?.url !== "string") {
            setFailed(response.status === 429 ? "Příliš mnoho pokusů. Zkuste to za pár minut." : "Přihlášení se teď nepodařilo zahájit. Zkuste to znovu.");
            setBusy(false);
            return;
          }
          window.location.assign(data.url);
        } catch {
          setFailed("Přihlášení se teď nepodařilo zahájit. Zkontrolujte připojení a zkuste to znovu.");
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span className="field-label">E-mail</span>
        <input
          className="input"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {failed && (
        <p className="notice notice-danger" role="alert">
          {failed}
        </p>
      )}
      <button type="submit" className="btn btn-google" disabled={busy} aria-busy={busy || undefined}>
        {children}
      </button>
    </form>
  );
}
