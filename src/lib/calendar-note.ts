import type { ParticipationState } from "@/lib/types";

/**
 * Stav vlastní pozvánky v Kalendáři (F04), jak ho Wiki zná ze své vazby na akci:
 * – `link`: vazba akce na pozvánku (`none` = pozvánka zatím nevznikla),
 * – `inCalendar`: adresa člověka je mezi hosty, které do pozvánky přidala Wiki.
 * Odpověď (RSVP) v Googlu se tu nečte ani nemění.
 */
export type OwnCalendar = { link: "none" | "synced" | "pending" | "attention"; inCalendar: boolean };

const FAILED = "Kalendář se teď nepodařilo upravit, Wiki to zkusí znovu.";

/**
 * Věta o Kalendáři v panelu „Tvoje účast“. Povinná a dobrovolně přihlášená akce v Kalendáři má být,
 * omluvená a nepřihlášená ne. Null = stav Wiki nezná (osobní kalendáře, pevný seznam testovacích
 * příjemců, starší pozvánka bez spravovaných hostů) a panel o Kalendáři nic netvrdí.
 */
export function calendarNote(state: ParticipationState, calendar: OwnCalendar | null): string | null {
  if (!calendar || state === "cancelled") return null;
  const { link, inCalendar } = calendar;
  if (link === "attention") return FAILED;
  const guest = state === "required" || state === "voluntary_enrolled";
  if (guest) return inCalendar && link === "synced" ? "Pozvánku máš v Kalendáři." : "Pozvánka do Kalendáře čeká na odeslání.";
  if (inCalendar) return state === "excused" ? "Omluveno ve Wiki, Kalendář čeká." : "Wiki akci z tvého Kalendáře právě odebírá.";
  if (state === "optional") return "Do Kalendáře se akce přidá, až se přihlásíš.";
  return "Pozvánku v Kalendáři nemáš, omluva ji odmítla.";
}
