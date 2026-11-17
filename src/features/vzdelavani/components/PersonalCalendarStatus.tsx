import { formatDayMonth, toDateKey, toTimeKey } from "@/lib/time";
import type { PersonalCalendarState } from "@/server/calendar/personal";

// Stav osobního kalendáře „Vzdělávání ZBC“ (režim `CALENDAR_DELIVERY=personal`): co se děje a nejvýš
// jedna akce k nápravě. Akce vede přes přihlášení Googlem, které o Kalendář požádá znovu.

export const PERSONAL_CONNECT_HREF = "/api/google/prihlaseni?kalendar=osobni";

const RECONNECT = "Připojit Kalendář znovu";

export type PersonalCalendarView = {
  tone: "ok" | "warn" | "alert";
  badge: string;
  text: string;
  action: string | null;
};

const when = (iso: string) => {
  const date = new Date(iso);
  return `${formatDayMonth(toDateKey(date))} v ${toTimeKey(date)}`;
};

/** Text a akce pro daný stav. Samostatně kvůli testům. */
export function personalCalendarView(state: PersonalCalendarState): PersonalCalendarView {
  switch (state.status) {
    case "active":
      if (state.blocked)
        return {
          tone: "warn",
          badge: "Nedaří se zapsat",
          text: "Google zatím nedovolil zapsat akce do kalendáře „Vzdělávání ZBC“. Wiki to zkouší dál. Když to vydrží, propojte Kalendář znovu.",
          action: RECONNECT,
        };
      if (state.retrying)
        return { tone: "warn", badge: "Zkusí se znovu", text: "Poslední změnu se do Kalendáře nepodařilo zapsat. Wiki to zkusí znovu sama, nic dělat nemusíte.", action: null };
      return {
        tone: "ok",
        badge: "Propojeno",
        text: `Akce najdete v kalendáři „Vzdělávání ZBC“ (${state.accountEmail ?? "váš účet Google"}). ${
          state.syncedAt ? `Aktualizováno ${when(state.syncedAt)}.` : "Akce se tam objeví během chvilky."
        } Den před akcí přijde připomínka e-mailem.`,
        action: null,
      };
    case "revoked":
      // Jen skutečné odvolání (Google odmítl obnovit přístup). Jednotlivé odmítnuté zápisy jsou „Nedaří se zapsat“.
      return {
        tone: "alert",
        badge: "Kalendář odpojen",
        text: "Přístup Wiki k vašemu Google Kalendáři skončil (například jste ho odebrali v účtu Google). Nové akce ani změny se tam neobjeví, dokud Kalendář znovu nepřipojíte.",
        action: RECONNECT,
      };
    case "calendar_deleted":
      return { tone: "alert", badge: "Kalendář smazán", text: "Kalendář „Vzdělávání ZBC“ jste v Google Kalendáři smazali, akce se do něj už nezapisují.", action: "Vytvořit znovu" };
    case "declined":
      return { tone: "warn", badge: "Nepropojeno", text: "Při přihlášení jste Kalendář nepovolili. Akce najdete jen tady ve Wiki.", action: "Propojit Kalendář" };
    default:
      return { tone: "warn", badge: "Nepropojeno", text: "Akce můžete mít i ve svém Google Kalendáři. Wiki pro ně založí samostatný kalendář „Vzdělávání ZBC“.", action: "Propojit Kalendář" };
  }
}

/**
 * Řádek pro Úvod a Plán, jen když Kalendář chce zásah (propojit, připojit znovu). Funkční propojení
 * ani opakovaný pokus, který Wiki vyřeší sama, se neukazují. Na náhled očima kolegy se nepoužívá.
 */
export function PersonalCalendarStatus({ state }: { state: PersonalCalendarState }) {
  const view = personalCalendarView(state);
  if (!view.action) return null;
  const toneClass = view.tone === "alert" ? " cal-status-alert" : view.tone === "warn" ? " cal-status-warn" : "";
  return (
    <div className={`cal-status${toneClass}`} role={view.tone === "alert" ? "alert" : "status"} data-testid="osobni-kalendar">
      <span className="cal-status-main">
        <strong>Můj Kalendář</strong>
        <span className={`badge${view.tone === "ok" ? " badge-ok" : view.tone === "alert" ? " badge-danger" : " badge-ochre"}`}>{view.badge}</span>
        <span className="cal-status-rest">{view.text}</span>
      </span>
      {view.action && (
        // Obyčejný odkaz: vede na Google a zpět, klientský přechod by tu nedával smysl.
        <a className="btn btn-primary btn-small" href={PERSONAL_CONNECT_HREF}>
          {view.action}
        </a>
      )}
    </div>
  );
}

/** Krátký stav pro řádek účtu ve Správě. */
export function personalCalendarLabel(state: PersonalCalendarState | undefined): string {
  if (!state || state.status === "none") return "Kalendář: nepropojen";
  const account = state.accountEmail ? ` (${state.accountEmail})` : "";
  if (state.status === "active") {
    if (state.blocked) return `Kalendář: Google zápis odmítá${account}`;
    if (state.retrying) return `Kalendář: zápis se zopakuje${account}`;
    return `Kalendář: propojen${account}${state.syncedAt ? `, aktualizováno ${when(state.syncedAt)}` : ", připravuje se"}`;
  }
  if (state.status === "revoked") return "Kalendář odpojen: přístup v účtu Google skončil, připojí ho znovu sám uživatel";
  if (state.status === "calendar_deleted") return "Kalendář: smazán v Googlu";
  return "Kalendář: nepovolen při přihlášení";
}
