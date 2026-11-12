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
};

export type CalendarErrorCode =
  | "calendar_unavailable"
  | "calendar_revoked"
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
  /** Změní jen spravovaná pole a požádá o oznámení pozvaným. */
  patch(calendarId: string, eventId: string, data: ManagedEventData): Promise<ExternalEvent>;
  /** Kandidáti na spárování v daném dni (pražský čas). */
  listBetween(calendarId: string, from: Date, to: Date): Promise<ExternalEvent[]>;
}
