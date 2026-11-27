import type { ParticipationState } from "@/lib/types";

/**
 * Stav vlastní pozvánky v Kalendáři (F04), jak ho Wiki zná ze své vazby na akci:
 * – `link`: vazba akce na pozvánku (`none` = pozvánka zatím nevznikla),
 * – `inCalendar`: adresa člověka je mezi hosty, které do pozvánky přidala Wiki.
 * Odpověď (RSVP) v Googlu se tu nečte ani nemění.
 */
export type OwnCalendar = { link: "none" | "synced" | "pending" | "attention"; inCalendar: boolean };

const FAILED = "Kalendář: synchronizace selhala, Wiki ji zkusí znovu.";
const SYNCED = "Kalendář: synchronizováno.";
const PENDING = "Kalendář: synchronizace čeká.";
const UNKNOWN = "Kalendář: stav neznámý.";

/**
 * Věta o Kalendáři v panelu „Tvoje účast“. Účast se ukládá ve Wiki hned; Kalendář se k ní jen synchronizuje,
 * proto věta říká stav synchronizace (synchronizováno / čeká / selhalo / neznámý), ne slib doručení pozvánky.
 * Povinná a dobrovolně přihlášená akce v Kalendáři má být, omluvená a nepřihlášená ne. Bez vazby (osobní
 * kalendáře, pevný seznam testovacích příjemců, výpadek) Wiki stav nezná a řekne to. Zrušená akce: null.
 *
 * Wiki zná jen hosty, které sama spravuje. Ruční hosty a odpovědi (RSVP) v Googlu nečte, takže věty
 * nikdy netvrdí, že pozvánku nemáš nebo že ji omluva „odmítla“ (O04, O09): říkají jen, co dělá Wiki.
 */
export function calendarNote(state: ParticipationState, calendar: OwnCalendar | null): string | null {
  if (state === "cancelled") return null;
  if (!calendar) return UNKNOWN;
  const { link, inCalendar } = calendar;
  if (link === "attention") return FAILED;
  const guest = state === "required" || state === "voluntary_enrolled";
  if (guest) {
    if (inCalendar && link === "synced") return SYNCED;
    // Odesláno, a přesto mezi spravovanými hosty nejsi: v pozvánce jsi nejspíš ručně, Wiki to neověří.
    if (link === "synced") return "Kalendář: stav neznámý, Wiki tvoji pozvánku nespravuje.";
    return PENDING;
  }
  if (inCalendar) return PENDING;
  if (state === "optional") return "Kalendář: zatím tě Wiki nezve. Po přihlášení se synchronizuje.";
  return "Kalendář: Wiki tě na akci nezve.";
}
