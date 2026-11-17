import type { SimAttendee } from "@/lib/types";

/** Pole, která Wiki v pozvánce spravuje. Hosté, RSVP a odkaz na schůzku zůstávají beze změny. */
export type ManagedEventData = {
  summary: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  cancelled: boolean;
};

export type ExternalEvent = ManagedEventData & {
  id: string;
  attendees: SimAttendee[];
  meetingUrl: string | null;
  /** Vyplněné u jednoho výskytu opakované události. Cílem změny je vždy tento výskyt, ne série. */
  recurringEventId?: string | null;
  originalStartTime?: Date | null;
  /** Pozvánku založila tato Wiki (nese její klíč). Taková nikdy není „cizí“ kandidát na duplicitu. */
  createdByWiki?: boolean;
  /** Pozvánka má nastavené soukromí hostů (`GUEST_PRIVACY`). Neznámé u simulace = bráno jako nastavené. */
  guestsPrivate?: boolean;
};

export type GuestChange = { add: SimAttendee[]; remove: readonly string[] };

/** Jedna stránka změn z `events.list`. Hosté nesou odpověď (RSVP). */
export type ChangePage = {
  events: Array<{ id: string; cancelled: boolean; attendees: SimAttendee[] }>;
  nextPageToken: string | null;
  /** Vyplněný na poslední stránce. Uloží se pro příští přírůstkovou synchronizaci. */
  nextSyncToken: string | null;
};

export type CalendarErrorCode =
  | "calendar_unavailable"
  | "calendar_revoked"
  /** Google jednu operaci odmítl (403 bez odvolání přístupu). Token i kalendář zůstávají platné. */
  | "calendar_forbidden"
  /** Připojený účet nemá přístup ke kalendáři, do kterého Wiki zapisuje (Google vrací 404). */
  | "calendar_no_access"
  | "calendar_missing"
  | "attendee_not_allowed"
  /** Kalendář není na serverovém seznamu povolených. */
  | "calendar_not_allowed"
  /** Cílem by byla celá opakovaná série. Tu Wiki bez samostatného postupu nemění. */
  | "calendar_series_master"
  /** Originál pozvánky vlastní jiný účet, zápis by se nepropsal pozvaným. */
  | "calendar_not_organizer"
  /** Testovací režim je zapnutý, ale chybí konfigurace na serveru. */
  | "calendar_not_configured";

export class CalendarError extends Error {
  constructor(
    readonly code: CalendarErrorCode,
    /** Přechodnou chybu má smysl zopakovat, trvalou musí vyřešit člověk. */
    readonly transient: boolean,
    /** Strojový důvod od Googlu (např. `insufficientPermissions`) pro log a diagnostiku. Bez obsahu dat. */
    readonly reason?: string,
  ) {
    super(code);
    this.name = "CalendarError";
  }
}

/**
 * Rozhraní ke kalendáři. Simulace i adaptér Google Calendar API (events.get/insert/patch
 * se sendUpdates=all) implementují totéž, synchronizace se o režimu nerozhoduje.
 */
export interface CalendarProvider {
  get(calendarId: string, eventId: string): Promise<ExternalEvent | null>;
  /** Hledá událost podle stabilního klíče vytvoření. Chrání před duplicitou po nejasném výsledku. */
  findByKey(calendarId: string, key: string): Promise<ExternalEvent | null>;
  create(calendarId: string, key: string, data: ManagedEventData, attendees: SimAttendee[]): Promise<ExternalEvent>;
  /**
   * Změní jen spravovaná pole a požádá o oznámení pozvaným. Hosty mění jen podle `guests`:
   * přidá chybějící a odebere vyjmenované adresy, ostatní hosté a jejich odpovědi zůstanou.
   */
  patch(calendarId: string, eventId: string, data: ManagedEventData, guests?: GuestChange): Promise<ExternalEvent>;
  /** Kandidáti na spárování v daném dni (pražský čas). */
  listBetween(calendarId: string, from: Date, to: Date): Promise<ExternalEvent[]>;
  /**
   * Změny událostí pro čtení odpovědí. Bez `syncToken` úplný výpis, jinak jen změny od minula.
   * Jen čtení. Neplatný token (Google 410) hlásí `null`, volající pak spustí úplnou synchronizaci.
   */
  listChanges(calendarId: string, syncToken: string | null, pageToken: string | null): Promise<ChangePage | null>;
}
