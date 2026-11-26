import Link from "next/link";
import { signOut, switchPersona } from "@/app/vstup/actions";
import type { Persona } from "@/server/auth/personas";
import type { CurrentUser } from "@/server/auth/session";
import { ROLE_LABELS } from "@/lib/labels";
import { isLiveWiki } from "@/server/config";
import { PreviewSwitch } from "./PreviewSwitch";

type PreviewMenu = { groups: { key: string; label: string }[]; people: { key: string; label: string }[]; active: string | null };

/** Horní lišta: vlevo značka, vpravo zvlášť „Pohled“ (jen správce) a skutečně přihlášený účet. */
export function Topbar({ user, personas, preview }: { user: CurrentUser; personas: Persona[]; preview: PreviewMenu | null }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-name">Firemní Wiki</span>
        <span className="brand-tagline">Za bohatší Česko – znalosti a procesy na jednom místě</span>
      </Link>
      {preview && <PreviewSwitch groups={preview.groups} people={preview.people} active={preview.active} />}
      <div className={user.signedInWith === "google" ? "account account-google" : "account"} role="group" aria-label="Přihlášený účet">
        {!isLiveWiki() && (
          <span className="demo-badge" title="Fiktivní data a ukázkové režimy integrací">
            Ukázka<span className="demo-badge-detail"> · fiktivní data</span>
          </span>
        )}
        {user.signedInWith === "google" ? (
          <span className="small muted signed-in" title={user.email}>
            Přihlášení účtem Google
          </span>
        ) : (
          <form action={switchPersona} className="row">
            <label className="visually-hidden" htmlFor="persona">
              Přepnout ukázkovou roli
            </label>
            <select id="persona" name="persona" className="select select-small persona-select" defaultValue={user.id}>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="btn btn-small" type="submit">
              {/* Jeden textový uzel: mezera mezi tlačítkovým flexem by se jinak zdvojila. */}
              <span>
                Změnit<span className="persona-btn-detail"> ukázkovou roli</span>
              </span>
            </button>
          </form>
        )}
        {/* U ukázkové role už jméno ukazuje přepínač, proto se neopakuje. */}
        <span className="account-name" title={user.signedInWith === "google" ? `Přihlášení účtem Google: ${user.email}` : undefined}>
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
