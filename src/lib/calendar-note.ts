import type { ParticipationState } from "@/lib/types";

/**
 * Stav vlastní pozvánky v Kalendáři (F04), jak ho Wiki zná ze své vazby na akci:
 * – `link`: vazba akce na pozvánku (`none` = pozvánka zatím nevznikla),
 * – `inCalendar`: adresa člověka je mezi hosty, které do pozvánky přidala Wiki.
 * Odpověď (RSVP) v Googlu se tu nečte ani nemění.
 */
export type OwnCalendar = {
  link: "none" | "synced" | "pending" | "attention";
  inCalendar: boolean;
  /**
   * Osobní kalendář „Vzdělávání ZBC“ (`CALENDAR_DELIVERY=personal`): `link` je stav synchronizace kalendáře
   * člověka, `inCalendar` = Wiki do něj akci zapsala, `link: "none"` = kalendář nemá propojený.
   */
  personal?: boolean;
};

const FAILED = "Kalendář: zápis se nepodařil, Wiki to zkusí znovu.";
const SYNCED = "Kalendář: pozvánka potvrzena systémem.";
const PENDING = "Kalendář: aktualizuje se.";
const UNKNOWN = "Kalendář: stav nelze ověřit.";

/**
 * Věta o Kalendáři v panelu „Tvoje účast“. Účast se ukládá ve Wiki hned; Kalendář se k ní jen synchronizuje,
 * proto věta říká stav synchronizace (potvrzeno systémem / aktualizuje se / nepodařilo se / nelze ověřit / ručně spravovaná), ne slib doručení pozvánky.
 * Povinná a dobrovolně přihlášená akce v Kalendáři má být, omluvená a nepřihlášená ne. Bez vazby (osobní
 * kalendáře, pevný seznam testovacích příjemců, výpadek) Wiki stav nezná a řekne to. Zrušená akce: null.
 *
 * Wiki zná jen hosty, které sama spravuje. Ruční hosty a odpovědi (RSVP) v Googlu nečte, takže věty
 * nikdy netvrdí, že pozvánku nemáš nebo že ji omluva „odmítla“ (O04, O09): říkají jen, co dělá Wiki.
 */
export function calendarNote(state: ParticipationState, calendar: OwnCalendar | null): string | null {
  if (state === "cancelled") return null;
  if (!calendar) return UNKNOWN;
  if (calendar.personal) return personalNote(state, calendar);
  const { link, inCalendar } = calendar;
  if (link === "attention") return FAILED;
  const guest = state === "required" || state === "voluntary_enrolled";
  if (guest) {
    if (inCalendar && link === "synced") return SYNCED;
    // Odesláno, a přesto mezi spravovanými hosty nejsi: v pozvánce jsi nejspíš ručně, Wiki to neověří.
    if (link === "synced") return "Kalendář: ručně spravovaná pozvánka, Wiki ji neověřuje.";
    return PENDING;
  }
  if (inCalendar) return PENDING;
  if (state === "optional") return "Kalendář: po přihlášení se pozvánka zapíše.";
  return "Kalendář: Wiki tě na akci nezve.";
}

/** Osobní kalendář: nejde o pozvánku, Wiki akci sama zapisuje do kalendáře „Vzdělávání ZBC“ v účtu člověka. */
function personalNote(state: ParticipationState, { link, inCalendar }: OwnCalendar): string {
  if (link === "none") return "Kalendář: osobní Kalendář Google nemáš propojený, propojíš ho na Úvodu.";
  if (link === "attention") return FAILED;
  const guest = state === "required" || state === "voluntary_enrolled";
  if (link === "synced" && guest === inCalendar) {
    if (guest) return "Kalendář: akce je zapsaná ve tvém kalendáři „Vzdělávání ZBC“.";
    return state === "optional" ? "Kalendář: po přihlášení se akce zapíše do tvého kalendáře." : "Kalendář: akce ve tvém kalendáři není.";
  }
  return PENDING;
}

/**
 * Krátký stav Kalendáře člověka pro přehled účasti (správce, nadřízený). `problem` = akce v Kalendáři chybí,
 * přebývá, zápis selhal nebo osobní kalendář není propojený, ač by v něm akce být měla. Null = zrušená akce
 * nebo se akce člověka netýká.
 */
export function calendarStatus(state: ParticipationState, calendar: OwnCalendar | null): { label: string; problem: boolean } | null {
  if (state === "cancelled" || state === "optional") return null;
  if (!calendar) return { label: "Nelze ověřit", problem: false };
  const guest = state === "required" || state === "voluntary_enrolled";
  if (calendar.link === "attention") return { label: "Zápis selhal", problem: true };
  if (calendar.link === "none") return calendar.personal ? { label: "Nepropojený Kalendář", problem: guest } : { label: "Pozvánka nevznikla", problem: guest };
  if (calendar.link === "pending") return { label: "Aktualizuje se", problem: false };
  if (guest === calendar.inCalendar) return { label: guest ? "V Kalendáři" : "Mimo Kalendář", problem: false };
  // Odeslaná pozvánka bez spravovaného hosta: u pozvánek může jít o ručního hosta, Wiki to neověří.
  if (!calendar.personal && guest) return { label: "Ručně spravováno", problem: false };
  return { label: guest ? "V Kalendáři chybí" : "V Kalendáři přebývá", problem: true };
}
