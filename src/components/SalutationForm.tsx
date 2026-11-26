import { saveSalutation } from "@/app/(wiki)/osloveni-actions";
import { SALUTATION_MAX } from "@/server/services/salutation";

/** D03: vlastní oslovení pod pozdravem. Sbalené, aby Domů zůstalo klidné. */
export function SalutationForm({ current, error }: { current: string | null; error: boolean }) {
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
          <button className="btn btn-small btn-primary" type="submit">Uložit</button>
        </div>
        <p id="osloveni-napoveda" className={error ? "form-error" : "small muted"}>
          {error ? "Použij jen písmena, mezeru nebo spojovník, nejvýš 40 znaků." : "Prázdné pole vrátí oslovení podle jména."}
        </p>
      </form>
    </details>
  );
}
