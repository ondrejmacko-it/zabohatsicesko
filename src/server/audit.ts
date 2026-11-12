import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { config } from "@/server/config";
import { queryRows, type Executor } from "@/server/db/client";
import { auditLog, rateLimits } from "@/server/db/schema";

/** Kdo a kdy co udělal. Bez obsahu, přepisů, tokenů nebo odkazů. */
export async function audit(
  db: Executor,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  await db.insert(auditLog).values({ orgId: config.orgId, actorId, action, entityType, entityId });
}

/** Provozní log jen s kódem chyby, nikdy s obsahem dat. */
export function logError(scope: string, code: string, error?: unknown): void {
  const kind = error instanceof Error ? error.name : typeof error;
  console.error(JSON.stringify({ scope, code, kind }));
}

export const hashKey = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);

/**
 * Pevné okno četnosti. Vrací true, pokud je požadavek ještě v limitu.
 * Jeden atomický upsert, takže souběžné požadavky limit nepřekročí.
 */
export async function withinRateLimit(db: Executor, key: string, limit: number, windowSec: number): Promise<boolean> {
  const [row] = await queryRows<{ count: number }>(db, sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSec}) THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSec}) THEN now() ELSE rate_limits.window_start END
    RETURNING count`);
  return (row?.count ?? 0) <= limit;
}

export async function clearRateLimit(db: Executor, key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}
