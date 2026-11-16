import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { audit, logError } from "@/server/audit";
import { attendeeSource, googleCalendarConfig, personalDelivery } from "@/server/config";
import { getDb } from "@/server/db/client";
import { calendarLinks } from "@/server/db/schema";
import { canManageUsers, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";
import { GoogleCalendar } from "./google";
import { connectionStatus, storedAccessToken, type FetchLike } from "./google-auth";
import { CalendarError } from "./provider";

// Úklid pozvánek, které Wiki dřív zakládala v kalendáři správce (`CALENDAR_DELIVERY=invites`). Po přechodu
// na osobní kalendáře by účastník viděl akci dvakrát: pozvánku a záznam v kalendáři „Vzdělávání ZBC“.
// Maže se jen událost, kterou Wiki prokazatelně založila (soukromá vlastnost `zbcKey`, ověřeno čtením
// přímo z Googlu), a to bez e-mailu hostům. Spárovanou cizí událost (založil ji člověk) Wiki nechá být.

const LEASE_SEC = 120;

export type LegacyCleanupResult = { deleted: number; keptForeign: number; failed: number };

const linkedInvite = isNotNull(calendarLinks.externalEventId);

/** Kolik vazeb ještě ukazuje na událost v kalendáři správce. V jiném režimu než `personal` vždy 0. */
export async function legacyInviteCount(viewer: Viewer): Promise<number> {
  if (!canManageUsers(viewer)) throw new DomainError("forbidden");
  if (!personalDelivery()) return 0;
  const db = await getDb();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(calendarLinks).where(linkedInvite);
  return row?.count ?? 0;
}

/**
 * Projde vazby s událostí v kalendáři správce. Každou nejdřív zamkne (souběžný druhý klik ji přeskočí),
 * ověří ji čtením z Googlu, smaže jen pozvánku Wiki a vazbu přepne na „bez pozvánky“ (`externalEventId`
 * null, synchronizováno). Opakované spuštění je bezpečné: hotové vazby už nemají `externalEventId`.
 * Přechodná chyba Googlu vazbu nechá beze změny, další spuštění ji zkusí znovu.
 */
export async function cleanupLegacyInvites(viewer: Viewer, deps: { fetchImpl?: FetchLike } = {}): Promise<LegacyCleanupResult> {
  if (!canManageUsers(viewer)) throw new DomainError("forbidden");
  if (!personalDelivery()) throw new DomainError("invalid_state");
  const cfg = googleCalendarConfig();
  const db = await getDb();
  if (!cfg || !(await connectionStatus(db))) throw new DomainError("invalid_state");
  const google = new GoogleCalendar({
    tokens: storedAccessToken(db, cfg, deps.fetchImpl),
    allowedCalendarIds: cfg.allowedCalendarIds,
    allowedAttendees: attendeeSource() === "audience" ? null : cfg.allowedAttendees,
    fetchImpl: deps.fetchImpl,
  });

  const claimed = await db
    .update(calendarLinks)
    .set({ leaseUntil: sql`now() + make_interval(secs => ${LEASE_SEC})` })
    .where(and(linkedInvite, or(isNull(calendarLinks.leaseUntil), lt(calendarLinks.leaseUntil, sql`now()`))))
    .returning({ eventId: calendarLinks.eventId, calendarId: calendarLinks.calendarId, externalEventId: calendarLinks.externalEventId });

  const result: LegacyCleanupResult = { deleted: 0, keptForeign: 0, failed: 0 };
  for (const [index, link] of claimed.entries()) {
    try {
      const found = await google.inspect(link.calendarId, link.externalEventId!);
      if (found?.createdByWiki) {
        await google.remove(link.calendarId, link.externalEventId!);
        result.deleted += 1;
      } else if (found) {
        result.keptForeign += 1;
      }
      await db
        .update(calendarLinks)
        .set({ externalEventId: null, recurringEventId: null, originalStartTime: null, managedAttendees: null, syncStatus: "synced", errorCode: null, conflict: null, attempts: 0, leaseUntil: null, updatedAt: new Date() })
        .where(eq(calendarLinks.eventId, link.eventId));
    } catch (error) {
      if (!(error instanceof CalendarError)) throw error;
      result.failed += 1;
      logError("calendar.legacy_cleanup", error.code);
      await db.update(calendarLinks).set({ leaseUntil: null }).where(eq(calendarLinks.eventId, link.eventId));
      // Odvolaný přístup: další volání by selhala stejně, zbytek zůstane na příští pokus.
      if (error.code === "calendar_revoked") {
        const rest = claimed.slice(index + 1).map((l) => l.eventId);
        if (rest.length) await db.update(calendarLinks).set({ leaseUntil: null }).where(inArray(calendarLinks.eventId, rest));
        break;
      }
    }
  }
  await audit(db, viewer.id, "calendar.legacy_cleanup", "calendar", `${result.deleted}/${result.keptForeign}/${result.failed}`);
  return result;
}
