import { randomUUID } from "node:crypto";
import { and, asc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { toDateKey } from "@/lib/time";
import { audit } from "@/server/audit";
import { config, now } from "@/server/config";
import { getDb, queryRows, type Executor } from "@/server/db/client";
import { topicInterests, topics } from "@/server/db/schema";
import { rankTopics, type RankedTopic, type TopicStat } from "@/server/domain/topics";
import { canSeeAudience, isOrganizer, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";

/** Nearchivovaná témata viditelná uživateli se zájmem a historií konání (jen zveřejněné, nezrušené akce). */
export async function listTopics(viewer: Viewer): Promise<RankedTopic[]> {
  const db = await getDb();
  const reference = now().toISOString();
  const rows = await queryRows<{
    id: string;
    name: string;
    audience: string;
    interest_count: number;
    interested: boolean;
    last_held: Date | string | null;
    next_planned: Date | string | null;
  }>(
    db,
    sql`SELECT t.id, t.name, t.audience,
          (SELECT count(*)::int FROM topic_interests i WHERE i.topic_id = t.id) AS interest_count,
          EXISTS (SELECT 1 FROM topic_interests i WHERE i.topic_id = t.id AND i.user_id = ${viewer.id}) AS interested,
          (SELECT max((e.published->>'endsAt')::timestamptz) FROM events e
             WHERE e.published->>'topicId' = t.id AND e.published->>'status' = 'published'
               AND (e.published->>'endsAt')::timestamptz <= ${reference}::timestamptz) AS last_held,
          (SELECT min((e.published->>'startsAt')::timestamptz) FROM events e
             WHERE e.published->>'topicId' = t.id AND e.published->>'status' = 'published'
               AND (e.published->>'startsAt')::timestamptz > ${reference}::timestamptz) AS next_planned
        FROM topics t WHERE t.org_id = ${config.orgId} AND t.archived_at IS NULL`,
  );
  const stats: TopicStat[] = rows
    .filter((r) => canSeeAudience(viewer, r.audience))
    .map((r) => ({
      id: r.id,
      name: r.name,
      audience: r.audience,
      interestCount: r.interest_count,
      interestedByViewer: r.interested,
      lastHeld: r.last_held ? toDateKey(new Date(r.last_held)) : null,
      nextPlanned: r.next_planned ? toDateKey(new Date(r.next_planned)) : null,
    }));
  return rankTopics(stats);
}

async function requireVisibleTopic(db: Executor, viewer: Viewer, topicId: string) {
  const [topic] = await db
    .select()
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.orgId, config.orgId)))
    .limit(1);
  if (!topic || topic.archivedAt || !canSeeAudience(viewer, topic.audience)) throw new DomainError("not_found");
  return topic;
}

/** Jeden uživatel má nejvýš jeden zájem o téma, hlídá to primární klíč. */
export async function setInterest(viewer: Viewer, topicId: string, interested: boolean): Promise<void> {
  const db = await getDb();
  await requireVisibleTopic(db, viewer, topicId);
  if (interested) {
    await db.insert(topicInterests).values({ topicId, userId: viewer.id }).onConflictDoNothing();
  } else {
    await db.delete(topicInterests).where(and(eq(topicInterests.topicId, topicId), eq(topicInterests.userId, viewer.id)));
  }
}

export async function proposeTopic(viewer: Viewer, name: string, audience: string): Promise<string> {
  if (!canSeeAudience(viewer, audience)) throw new DomainError("forbidden");
  const db = await getDb();
  const id = `topic-${randomUUID()}`;
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(topics)
      .values({ id, orgId: config.orgId, name, audience, proposedBy: viewer.id })
      .onConflictDoNothing()
      .returning({ id: topics.id });
    if (!created) throw new DomainError("duplicate");
    await tx.insert(topicInterests).values({ topicId: id, userId: viewer.id });
    await audit(tx, viewer.id, "topic.propose", "topic", id);
  });
  return id;
}

/** Přiřadí akci téma podle názvu, pokud v seznamu existuje (bez ohledu na velikost písmen). */
export async function topicIdByName(db: Executor, name: string | null): Promise<string | null> {
  if (!name) return null;
  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.orgId, config.orgId), isNull(topics.archivedAt), sql`lower(${topics.name}) = lower(${name})`))
    .limit(1);
  return topic?.id ?? null;
}

/** Úprava názvu a skupiny tématu. Akce si vazbu drží přes ID, jejich už zveřejněný název se nemění. */
export async function updateTopic(viewer: Viewer, topicId: string, name: string, audience: string): Promise<void> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [clash] = await tx
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.orgId, config.orgId), ne(topics.id, topicId), sql`lower(${topics.name}) = lower(${name})`))
      .limit(1);
    if (clash) throw new DomainError("duplicate");
    const [updated] = await tx
      .update(topics)
      .set({ name, audience })
      .where(and(eq(topics.id, topicId), eq(topics.orgId, config.orgId)))
      .returning({ id: topics.id });
    if (!updated) throw new DomainError("not_found");
    await audit(tx, viewer.id, "topic.update", "topic", topicId);
  });
}

/**
 * Archivace téma vyřadí z nabídky a doporučení. Řádek zůstává, takže minulé akce na téma dál odkazují
 * a organizátor ho může vrátit.
 */
export async function setTopicArchived(viewer: Viewer, topicId: string, archived: boolean): Promise<void> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  const [updated] = await db
    .update(topics)
    .set({ archivedAt: archived ? now() : null })
    .where(and(eq(topics.id, topicId), eq(topics.orgId, config.orgId)))
    .returning({ id: topics.id });
  if (!updated) throw new DomainError("not_found");
  await audit(db, viewer.id, archived ? "topic.archive" : "topic.restore", "topic", topicId);
}

export async function listArchivedTopics(viewer: Viewer): Promise<Array<{ id: string; name: string; audience: string }>> {
  if (!isOrganizer(viewer)) return [];
  const db = await getDb();
  return db
    .select({ id: topics.id, name: topics.name, audience: topics.audience })
    .from(topics)
    .where(and(eq(topics.orgId, config.orgId), isNotNull(topics.archivedAt)))
    .orderBy(asc(topics.name));
}
