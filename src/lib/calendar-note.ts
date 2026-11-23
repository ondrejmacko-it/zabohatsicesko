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
 *
 * Wiki zná jen hosty, které sama spravuje. Ruční hosty a odpovědi (RSVP) v Googlu nečte, takže věty
 * nikdy netvrdí, že pozvánku nemáš nebo že ji omluva „odmítla“ (O04, O09): říkají jen, co dělá Wiki.
 */
export function calendarNote(state: ParticipationState, calendar: OwnCalendar | null): string | null {
  if (!calendar || state === "cancelled") return null;
  const { link, inCalendar } = calendar;
  if (link === "attention") return FAILED;
  const guest = state === "required" || state === "voluntary_enrolled";
  if (guest) {
    if (inCalendar && link === "synced") return "Pozvánku máš v Kalendáři.";
    // Odesláno, a přesto mezi spravovanými hosty nejsi: v pozvánce jsi nejspíš ručně, Wiki to neověří.
    if (link === "synced") return "Wiki tvoji pozvánku nespravuje. Její stav ověř v Kalendáři.";
    return "Pozvánka do Kalendáře čeká na odeslání.";
  }
  if (inCalendar) return state === "excused" ? "Odebrání z pozvánky v Kalendáři čeká na odeslání." : "Wiki akci z tvého Kalendáře právě odebírá.";
  if (state === "optional") return "Do Kalendáře se akce přidá, až se přihlásíš.";
  return "Wiki tě na tuto akci do Kalendáře nezve.";
}
