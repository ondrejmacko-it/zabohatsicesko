"use client";

import { useActionState } from "react";
import type { Persona } from "@/server/auth/personas";
import { enterDemo, type GateState } from "./actions";

export function GateForm({ personas, needsCode }: { personas: Persona[]; needsCode: boolean }) {
  const [state, action, pending] = useActionState<GateState, FormData>(enterDemo, { error: null });
  return (
    <form action={action} className="stack gate-form">
      {needsCode && (
        <label className="field">
          <span className="field-label">Přístupový kód</span>
          <input className="input" name="code" type="password" autoComplete="off" required />
          <span className="field-hint">Kód jste dostali spolu s odkazem na ukázku.</span>
        </label>
      )}
      <fieldset className="persona-list">
        <legend className="field-label">Projít ukázku jako</legend>
        {personas.map((p, index) => (
          <label key={p.id} className="persona">
            <input type="radio" name="persona" value={p.id} defaultChecked={index === 0} required />
            <span>
              <span className="item-title">{p.name}</span>
              <span className="item-meta">{p.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Ověřuji…" : "Vstoupit do ukázky"}
        </button>
      </div>
      {!needsCode && <p className="small muted">Lokální režim bez přístupové brány. Na hostingu je kód povinný.</p>}
    </form>
  );
}
