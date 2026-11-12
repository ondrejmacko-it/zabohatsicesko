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
};

export type CalendarErrorCode = "calendar_unavailable" | "calendar_revoked" | "calendar_missing" | "attendee_not_allowed";

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
 * Rozhraní ke kalendáři. Simulace i budoucí adaptér Google Calendar API (events.get/insert/patch
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
