import { saveSalutation } from "@/app/(wiki)/osloveni-actions";
import { SALUTATION_MAX } from "@/server/services/salutation";

/** D03: vlastní oslovení v menu Účet (sbalené). V náhledu se nenabízí, ukládá se jen skutečnému účtu. */
export function SalutationForm({ current, error, inputId = "osloveni" }: { current: string | null; error: boolean; inputId?: string }) {
  return (
    <details className="salutation" open={error}>
      <summary className="small muted">Upravit oslovení</summary>
      <form action={saveSalutation} className="salutation-form">
        <label className="small" htmlFor={inputId}>
          Jak tě máme oslovovat (5. pád, např. Anno)
        </label>
        <div className="row">
          <input id={inputId} name="osloveni" className="input" maxLength={SALUTATION_MAX} defaultValue={current ?? ""}
            aria-invalid={error || undefined} aria-describedby={`${inputId}-napoveda`} />
          <button className="btn btn-small btn-primary" type="submit">Uložit</button>
        </div>
        {current && (
          <button className="btn btn-small" type="submit" name="vratit" value="1" formNoValidate>
            Vrátit podle jména
          </button>
        )}
        <p id={`${inputId}-napoveda`} className={error ? "form-error" : "small muted"}>
          {error ? "Použij jen písmena, mezeru nebo spojovník, nejvýš 40 znaků." : "Prázdné pole vrátí oslovení podle jména."}
        </p>
      </form>
    </details>
  );
}
