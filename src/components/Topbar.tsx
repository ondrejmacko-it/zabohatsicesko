import Link from "next/link";
import { signOut, switchPersona } from "@/app/vstup/actions";
import type { Persona } from "@/server/auth/personas";
import type { CurrentUser } from "@/server/auth/session";
import { ROLE_LABELS } from "@/lib/labels";

export function Topbar({ user, personas }: { user: CurrentUser; personas: Persona[] }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-name">Firemní Wiki</span>
        <span className="brand-tagline">Za bohatší Česko – znalosti a procesy na jednom místě</span>
      </Link>
      <div className="account">
        <span className="demo-badge" title="Fiktivní data a ukázkové režimy integrací">Ukázka · fiktivní data</span>
        {user.signedInWith === "google" ? (
          <span className="small muted" title={user.email}>
            Přihlášení účtem Google
          </span>
        ) : (
          <form action={switchPersona} className="row">
            <label className="visually-hidden" htmlFor="persona">
              Přepnout ukázkovou roli
            </label>
            <select id="persona" name="persona" className="select persona-select" defaultValue={user.id}>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="btn btn-small" type="submit">
              Přepnout roli
            </button>
          </form>
        )}
        {/* U ukázkové role už jméno ukazuje přepínač, proto se neopakuje. */}
        <span className="account-name">
          {user.signedInWith === "google" ? `${user.name} · ${ROLE_LABELS[user.role]}` : ROLE_LABELS[user.role]}
        </span>
        <form action={signOut}>
          <button className="btn btn-small" type="submit">
            Odhlásit
          </button>
        </form>
      </div>
    </header>
  );
}
