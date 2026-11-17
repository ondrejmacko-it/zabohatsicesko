import { and, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { EventSnapshot } from "@/lib/types";
import { logError } from "@/server/audit";
import { calendarMode, config, now, organizerDelivery } from "@/server/config";
import type { Db } from "@/server/db/client";
import { calendarLinks, calendarResponses, calendarSyncState, events, users, type ResponseStatus } from "@/server/db/schema";
import { calendarSummary } from "@/server/domain/snapshot";
import type { Viewer } from "@/server/policy";
import { connectionStatus } from "./google-auth";
import { CalendarError, type CalendarProvider } from "./provider";
import { targetCalendarId } from "./target";

// Odpovědi pozvaných (RSVP) z kalendáře organizátora. Jen čtení: `events.list` se `syncToken`,
// do Googlu se odtud nikdy nic nezapisuje (žádné pozvánky, žádné změny odpovědí).

const LEASE_SEC = 120;
/** Jak staré odpovědi Úvod ještě ukáže jako ověřené. Starší (nebo po chybě) jsou „stav nelze ověřit“. */
export const RESPONSES_FRESH_MS = 3 * 60 * 60 * 1000;
/** Pojistka proti nekonečnému stránkování při chybě Googlu. */
const MAX_PAGES = 40;

const RESPONSES = new Set<string>(["needsAction", "accepted", "tentative", "declined"]);

export type ResponsesSyncResult = "skipped" | "busy" | "full" | "incremental";

async function claimLease(db: Db, calendarId: string) {
  const [row] = await db
    .insert(calendarSyncState)
    .values({ orgId: config.orgId, calendarId, leaseUntil: sql`now() + make_interval(secs => ${LEASE_SEC})` })
    .onConflictDoUpdate({
      target: [calendarSyncState.orgId, calendarSyncState.calendarId],
      set: { leaseUntil: sql`now() + make_interval(secs => ${LEASE_SEC})` },
      setWhere: or(isNull(calendarSyncState.leaseUntil), lt(calendarSyncState.leaseUntil, sql`now()`)),
    })
    .returning();
  return row ?? null;
}

const stateWhere = (calendarId: string) => and(eq(calendarSyncState.orgId, config.orgId), eq(calendarSyncState.calendarId, calendarId));

/**
 * Načte odpovědi pozvaných. Bez uloženého tokenu (nebo po 410 Gone) úplná synchronizace, jinak jen změny.
 * Odpovědi akce se vždy nahradí celým seznamem hostů z Googlu, zrušená pozvánka odpovědi smaže.
 * Souběžný běh se pozná podle zámku a skončí bez práce (`busy`).
 */
export async function syncResponses(db: Db, provider: CalendarProvider): Promise<ResponsesSyncResult> {
  if (!organizerDelivery()) return "skipped";
  const calendarId = targetCalendarId();
  const state = await claimLease(db, calendarId);
  if (!state) return "busy";
  try {
    let token = state.syncToken;
    for (let restart = 0; ; restart += 1) {
      const outcome = await readAll(db, provider, calendarId, token);
      if (outcome === "expired") {
        // 410 Gone: token propadl. Jednou znovu úplně, druhé 410 po úplném čtení by byla chyba Googlu.
        if (token === null || restart > 0) throw new CalendarError("calendar_unavailable", true, "sync_410_full");
        token = null;
        await db.update(calendarSyncState).set({ syncToken: null }).where(stateWhere(calendarId));
        continue;
      }
      await db
        .update(calendarSyncState)
        .set({
          syncToken: outcome,
          syncedAt: sql`now()`,
          ...(token === null ? { fullSyncAt: sql`now()` } : {}),
          errorCode: null,
          failingSince: null,
        })
        .where(stateWhere(calendarId));
      return token === null ? "full" : "incremental";
    }
  } catch (error) {
    const code = error instanceof CalendarError ? error.code : "responses_failed";
    logError("calendar.responses", code);
    await db
      .update(calendarSyncState)
      .set({ errorCode: code, failingSince: sql`coalesce(${calendarSyncState.failingSince}, now())` })
      .where(stateWhere(calendarId));
    throw error;
  } finally {
    await db.update(calendarSyncState).set({ leaseUntil: null }).where(stateWhere(calendarId));
  }
}

/** Projde všechny stránky. Vrací nový syncToken, nebo `expired` při 410. */
async function readAll(db: Db, provider: CalendarProvider, calendarId: string, syncToken: string | null): Promise<string | "expired"> {
  const linked = await db
    .select({ eventId: calendarLinks.eventId, externalEventId: calendarLinks.externalEventId })
    .from(calendarLinks)
    .where(and(eq(calendarLinks.calendarId, calendarId), isNotNull(calendarLinks.externalEventId)));
  const byExternal = new Map(linked.map((l) => [l.externalEventId!, l.eventId]));
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await provider.listChanges(calendarId, syncToken, pageToken);
    if (!result) return "expired";
    for (const change of result.events) {
      const eventId = byExternal.get(change.id);
      if (!eventId) continue; // Událost mimo Wiki (ruční záznam v kalendáři organizátora).
      const rows = change.cancelled
        ? []
        : change.attendees
            .filter((a) => a.email && RESPONSES.has(a.responseStatus ?? "needsAction"))
            .map((a) => ({ eventId, email: a.email.toLowerCase(), response: (a.responseStatus ?? "needsAction") as ResponseStatus }));
      await db.transaction(async (tx) => {
        await tx.delete(calendarResponses).where(eq(calendarResponses.eventId, eventId));
        if (rows.length) await tx.insert(calendarResponses).values(rows).onConflictDoNothing();
      });
    }
    if (result.nextPageToken) {
      pageToken = result.nextPageToken;
      continue;
    }
    if (!result.nextSyncToken) throw new CalendarError("calendar_unavailable", true, "sync_without_token");
    return result.nextSyncToken;
  }
  throw new CalendarError("calendar_unavailable", true, "sync_too_many_pages");
}

// ——— Pozvánky na Úvodu ———

export type InvitationStatus = ResponseStatus | "unknown";

export type Invitation = {
  eventId: string;
  title: string;
  startsAt: string;
  status: InvitationStatus;
  /** Akce do 7 dní bez odpovědi: jediná, která se zvýrazní červeně. */
  urgent: boolean;
};

export type InvitationsView = {
  items: Invitation[];
  /** Adresa organizátora pro vyhledávání v Gmailu. V simulaci a bez propojení `null`. */
  organizerEmail: string | null;
  /** Odpovědi jsou čerstvé a bez chyby. Jinak se u všech ukáže „stav nelze ověřit“. */
  verified: boolean;
};

const URGENT_MS = 7 * 24 * 60 * 60 * 1000;
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * Pozvánky přihlášeného na budoucí akce, které Wiki skutečně odeslala (je mezi spravovanými hosty).
 * Bez organizátorského režimu `null`, karta se pak neukazuje.
 */
export async function invitationsFor(db: Db, viewer: Viewer): Promise<InvitationsView | null> {
  if (!organizerDelivery()) return null;
  const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, viewer.id)).limit(1);
  const email = account?.email.toLowerCase();
  if (!email) return null;
  const at = now();
  const rows = await db
    .select({ eventId: events.id, published: events.published, managed: calendarLinks.managedAttendees })
    .from(calendarLinks)
    .innerJoin(events, eq(events.id, calendarLinks.eventId))
    .where(
      and(
        eq(events.orgId, config.orgId),
        isNotNull(calendarLinks.externalEventId),
        isNotNull(events.published),
        gt(sql`(${events.published}->>'startsAt')::timestamptz`, sql`${at.toISOString()}::timestamptz`),
      ),
    );
  const invited = rows.filter((r) => (r.managed ?? []).includes(email) && (r.published as EventSnapshot).status !== "cancelled");
  if (!invited.length) return { items: [], organizerEmail: null, verified: true };

  const calendarId = targetCalendarId();
  const [state] = await db.select().from(calendarSyncState).where(stateWhere(calendarId)).limit(1);
  const verified = Boolean(state?.syncedAt && !state.errorCode && Date.now() - state.syncedAt.getTime() < RESPONSES_FRESH_MS);
  const answers = await db
    .select({ eventId: calendarResponses.eventId, response: calendarResponses.response })
    .from(calendarResponses)
    .where(and(eq(calendarResponses.email, email), inArray(calendarResponses.eventId, invited.map((r) => r.eventId))));
  const byEvent = new Map(answers.map((a) => [a.eventId, a.response]));

  const connection = calendarMode() === "simulation" ? null : await connectionStatus(db);
  const organizerEmail = connection && looksLikeEmail(connection.accountEmail) ? connection.accountEmail : null;

  const items = invited
    .map((r): Invitation => {
      const snapshot = r.published as EventSnapshot;
      // Pozvánka odeslaná po posledním čtení ještě odpověď nemá: čeká na odpověď.
      const status: InvitationStatus = verified ? (byEvent.get(r.eventId) ?? "needsAction") : "unknown";
      const startsAt = new Date(snapshot.startsAt);
      return {
        eventId: r.eventId,
        title: calendarSummary(snapshot),
        startsAt: startsAt.toISOString(),
        status,
        urgent: status === "needsAction" && startsAt.getTime() - at.getTime() <= URGENT_MS,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { items, organizerEmail, verified };
}

/** Odkaz do Gmailu: vyhledá zprávy od organizátora všude, včetně Spamu. Nic nevymýšlí o konkrétní zprávě. */
export const gmailSearchHref = (organizerEmail: string) =>
  `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`from:${organizerEmail} in:anywhere`)}`;
