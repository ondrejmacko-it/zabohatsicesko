"use client";

import { useState, type ReactNode } from "react";

/**
 * Nové zařízení: uživatel adresu zadá sám, Wiki ji nikdy nepředvyplní. Adresa je jen nápověda pro výběr účtu
 * u Googlu, identitu a shodu s pozvánkou ověřuje server po návratu. Navigace jde přes `location`, ne odesláním
 * formuláře, protože CSP `form-action 'self'` by přesměrování na Google zablokovala.
 */
export function GoogleStart({ href, children }: { href: string; children: ReactNode }) {
  const [email, setEmail] = useState("");
  return (
    <form
      className="stack gate-start"
      onSubmit={(event) => {
        event.preventDefault();
        const url = new URL(href, window.location.origin);
        url.searchParams.set("email", email.trim());
        window.location.assign(url.pathname + url.search);
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
      <button type="submit" className="btn btn-google">
        {children}
      </button>
    </form>
  );
}
