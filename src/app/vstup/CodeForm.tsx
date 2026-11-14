"use client";

import { useActionState } from "react";
import { enterWithCode, type GateState } from "./actions";

/** Jednorázový kód od správce pro toho, kdo nemá účet Google. */
export function CodeForm() {
  const [state, action, pending] = useActionState<GateState, FormData>(enterWithCode, { error: null });
  return (
    <form action={action} className="stack gate-form">
      <label className="field">
        <span className="field-label">Jednorázový kód</span>
        <input
          className="input code-input"
          name="code"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={16}
          placeholder="ABCDE-FGHJK"
          required
        />
        <span className="field-hint">Kód vám poslal správce spolu s odkazem. Platí jednou.</span>
      </label>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Ověřuji…" : "Přihlásit se kódem"}
        </button>
      </div>
    </form>
  );
}
