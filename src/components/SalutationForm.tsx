import { saveSalutation } from "@/app/(wiki)/osloveni-actions";
import { SALUTATION_MAX } from "@/server/services/salutation";
import { PREVIEW_READ_ONLY } from "@/lib/labels";

/** D03: vlastní oslovení pod pozdravem. Sbalené, aby Domů zůstalo klidné. V náhledu zůstane na místě zamčené (D4 1:1). */
export function SalutationForm({ current, error, locked = false }: { current: string | null; error: boolean; locked?: boolean }) {
  return (
    <details className="salutation" open={error}>
      <summary className="small muted">Upravit oslovení</summary>
      <form action={saveSalutation} className="salutation-form">
        <label className="small" htmlFor="osloveni">
          Jak tě máme oslovovat (5. pád, např. Anno)
        </label>
        <div className="row">
          <input id="osloveni" name="osloveni" className="input" maxLength={SALUTATION_MAX} defaultValue={current ?? ""}
            aria-invalid={error || undefined} aria-describedby="osloveni-napoveda" />
          <button className="btn btn-small btn-primary" type="submit" disabled={locked || undefined}
            aria-disabled={locked || undefined} title={locked ? PREVIEW_READ_ONLY : undefined}>Uložit</button>
        </div>
        <p id="osloveni-napoveda" className={error ? "form-error" : "small muted"}>
          {error ? "Použij jen písmena, mezeru nebo spojovník, nejvýš 40 znaků." : "Prázdné pole vrátí oslovení podle jména."}
        </p>
      </form>
    </details>
  );
}
