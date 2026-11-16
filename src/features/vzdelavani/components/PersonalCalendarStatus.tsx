import { formatDayMonth, toDateKey, toTimeKey } from "@/lib/time";
import type { PersonalCalendarState } from "@/server/calendar/personal";

// Stav osobního kalendáře „Vzdělávání ZBC“ (režim `CALENDAR_DELIVERY=personal`): co se děje a nejvýš
// jedna akce k nápravě. Akce vede přes přihlášení Googlem, které o Kalendář požádá znovu.

export const PERSONAL_CONNECT_HREF = "/api/google/prihlaseni?kalendar=osobni";

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
      if (state.retrying)
        return { tone: "warn", badge: "Zkusí se znovu", text: "Poslední zápis do Kalendáře se nepodařil. Wiki ho zopakuje sama, nic dělat nemusíte.", action: null };
      return {
        tone: "ok",
        badge: "Propojeno",
        text: `Akce se zapisují do kalendáře „Vzdělávání ZBC“ v účtu ${state.accountEmail ?? ""}. ${
          state.syncedAt ? `Naposledy aktualizováno ${when(state.syncedAt)}.` : "Kalendář se právě připravuje."
        } Připomínka chodí e-mailem den před akcí.`,
        action: null,
      };
    case "revoked":
      return { tone: "alert", badge: "Odpojeno", text: "Přístup ke Kalendáři byl u Googlu odvolán. Nové akce ani změny se do Kalendáře nepropíšou.", action: "Propojit znovu" };
    case "calendar_deleted":
      return { tone: "alert", badge: "Kalendář smazán", text: "Kalendář „Vzdělávání ZBC“ byl v Google Kalendáři smazán. Akce se do něj nepropíšou.", action: "Vytvořit kalendář znovu" };
    case "declined":
      return { tone: "warn", badge: "Nepropojeno", text: "Při přihlášení jste přístup ke Kalendáři nepovolili. Akce uvidíte jen ve Wiki.", action: "Propojit Kalendář" };
    default:
      return { tone: "warn", badge: "Nepropojeno", text: "Akce zatím nejsou ve vašem Google Kalendáři. Wiki pro ně založí samostatný kalendář „Vzdělávání ZBC“.", action: "Propojit Kalendář" };
  }
}

/** Řádek se stavem pro Úvod a Plán. Na náhled očima kolegy se nepoužívá. */
export function PersonalCalendarStatus({ state }: { state: PersonalCalendarState }) {
  const view = personalCalendarView(state);
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
  if (!state || state.status === "none") return "Kalendář nepropojen";
  if (state.status === "active") {
    if (state.retrying) return `Kalendář: zápis se zopakuje (${state.accountEmail ?? ""})`;
    return `Kalendář propojen (${state.accountEmail ?? ""})${state.syncedAt ? `, aktualizováno ${when(state.syncedAt)}` : ""}`;
  }
  if (state.status === "revoked") return "Kalendář odpojen u Googlu";
  if (state.status === "calendar_deleted") return "Kalendář „Vzdělávání ZBC“ smazán";
  return "Kalendář odmítnut při přihlášení";
}
