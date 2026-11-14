import { GROUPS, type Group } from "@/lib/types";
import { audienceAttendees, listRecipients } from "@/server/calendar/attendees";
import { connectionStatus, storedAccessToken } from "@/server/calendar/google-auth";
import { CalendarError } from "@/server/calendar/provider";
import { attendeeSource, calendarMode, googleCalendarConfig, googleCalendarConfigProblems, oauthConsentExpiryDays, type AttendeeSource } from "@/server/config";
import { getDb } from "@/server/db/client";
import { canPlan, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";

// Stav Kalendáře na jednom místě pro Plán, Správu a dialog akce: kdo je propojený, kam se zapisuje
// a komu Wiki pošle pozvánky. Jen pro správce. Tokeny ani hodnoty proměnných se nevrací.

export type GroupRecipients = Record<Group, Array<{ email: string; name: string }>>;

export type CalendarStatus = {
  mode: "simulation" | "google";
  /** Propojení s Googlem. V simulaci a při chybějící konfiguraci vždy null. */
  connection: { accountEmail: string; connectedAt: string; /** Den, kdy souhlas v režimu Testing vyprší. */ expiresAt: string | null } | null;
  /** Proč propojení chybí: nikdy nevzniklo nebo ho Google právě odmítl (vypršelo, bylo odvoláno). */
  problem: "not_connected" | "lapsed" | "not_configured" | "unreachable" | null;
  calendarId: string | null;
  attendeeSource: AttendeeSource;
  /** Komu jdou pozvánky teď, podle skupiny akce. */
  recipients: GroupRecipients;
  /** Komu by šly po zapnutí `CALENDAR_ATTENDEES=audience`. Shodné s `recipients`, když už je zapnuto. */
  audienceRecipients: GroupRecipients;
};

/** Jak se zveřejnění propíše do Kalendáře. Určuje jen texty o dopadu, o zápisu rozhoduje synchronizace. */
export type InviteMode = "simulation" | "allowlist" | "audience" | "disconnected";

/** Hosté podle skupiny pro dialogy plánování. */
export type InvitePreview = { mode: InviteMode; recipients: GroupRecipients };

export function inviteModeOf(status: Pick<CalendarStatus, "mode" | "connection" | "attendeeSource">): InviteMode {
  return status.mode !== "google" ? "simulation" : !status.connection ? "disconnected" : status.attendeeSource;
}

const DAY_MS = 24 * 3600 * 1000;

async function loadRecipients(google: boolean) {
  const db = await getDb();
  const cfg = googleCalendarConfig();
  const source: AttendeeSource = google ? attendeeSource() : "audience";
  const people = await listRecipients(db, cfg !== null);
  const byGroup = (list: Array<{ email: string; name: string; groups: string[] }>) =>
    Object.fromEntries(GROUPS.map((g) => [g, list.filter((u) => u.groups.includes(g)).map(({ email, name }) => ({ email, name }))])) as GroupRecipients;
  const audienceRecipients = byGroup(people);
  let recipients = audienceRecipients;
  if (cfg && source === "allowlist") {
    const fixed = (await audienceAttendees(db, "vsichni", "allowlist")).map(({ email, name }) => ({ email, name }));
    recipients = Object.fromEntries(GROUPS.map((g) => [g, fixed])) as GroupRecipients;
  }
  return { attendeeSource: source, recipients, audienceRecipients };
}

/**
 * Komu půjde pozvánka podle skupiny, pro dialog akce. Čte jen databázi: propojení u Googlu neověřuje,
 * takže okno akce nečeká na cizí službu. Vypršelý souhlas ukáže řádek stavu Kalendáře na Plánu.
 */
export async function loadInvitePreview(viewer: Viewer): Promise<InvitePreview> {
  if (!canPlan(viewer)) throw new DomainError("forbidden");
  const google = calendarMode() === "google-test";
  const { attendeeSource: source, recipients } = await loadRecipients(google);
  if (!google) return { mode: "simulation", recipients };
  const cfg = googleCalendarConfig();
  const connected = cfg ? Boolean(await connectionStatus(await getDb())) : false;
  return { mode: connected ? source : "disconnected", recipients };
}

export async function loadCalendarStatus(viewer: Viewer): Promise<CalendarStatus> {
  if (!canPlan(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  const cfg = googleCalendarConfig();
  const google = calendarMode() === "google-test";
  const base = await loadRecipients(google);
  if (!google) return { mode: "simulation", connection: null, problem: null, calendarId: null, ...base };
  if (!cfg) return { mode: "google", connection: null, problem: googleCalendarConfigProblems().length ? "not_configured" : "not_connected", calendarId: null, ...base };

  let problem: CalendarStatus["problem"] = null;
  let stored = await connectionStatus(db);
  if (stored) {
    // Ověření u Googlu: vypršelý nebo odvolaný souhlas se pozná hned, ne až při zveřejnění akce.
    // Přístupový token se drží v paměti, další načtení stránky Google nevolá.
    try {
      await storedAccessToken(db, cfg).get();
    } catch (error) {
      if (error instanceof CalendarError && error.code === "calendar_revoked") {
        stored = null;
        problem = "lapsed";
      } else {
        problem = "unreachable";
      }
    }
  } else {
    problem = "not_connected";
  }
  const days = oauthConsentExpiryDays();
  return {
    mode: "google",
    connection: stored && {
      accountEmail: stored.accountEmail,
      connectedAt: stored.connectedAt.toISOString(),
      expiresAt: days ? new Date(stored.connectedAt.getTime() + days * DAY_MS).toISOString() : null,
    },
    problem,
    calendarId: cfg.calendarId,
    ...base,
  };
}
