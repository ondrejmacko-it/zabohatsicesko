import { sql } from "drizzle-orm";
import { config } from "@/server/config";
import { getDb, queryRows } from "@/server/db/client";
import { isOrganizer, type Viewer } from "@/server/policy";

/**
 * Počet věcí, které na uživatele čekají (odznak u Vzdělávání): správce vidí synchronizace
 * vyžadující pozornost, vedoucí a kontrolor zápisy ke kontrole.
 */
export async function pendingTaskCount(viewer: Viewer): Promise<number> {
  const db = await getDb();
  const [row] = isOrganizer(viewer)
    ? await queryRows<{ count: number }>(
        db,
        sql`SELECT count(*)::int AS count FROM calendar_links l JOIN events e ON e.id = l.event_id
            WHERE e.org_id = ${config.orgId} AND l.sync_status = 'attention'`,
      )
    : await queryRows<{ count: number }>(
        db,
        // Aktuální zápis akce (nejnovější mimo vyměněné nahrávky, i bez nahrávky), který čeká na schválení.
        sql`SELECT count(*)::int AS count FROM (
              SELECT DISTINCT ON (m.event_id) m.event_id, m.status FROM minutes m
              LEFT JOIN recordings r ON r.id = m.recording_id
              WHERE m.org_id = ${config.orgId} AND (m.recording_id IS NULL OR r.superseded_at IS NULL)
              ORDER BY m.event_id, m.created_at DESC, m.id DESC
            ) c
            JOIN events e ON e.id = c.event_id
            WHERE e.org_id = ${config.orgId} AND c.status = 'draft'
              AND (e.published->>'leadId' = ${viewer.id} OR e.published->>'reviewerId' = ${viewer.id})`,
      );
  return row?.count ?? 0;
}
