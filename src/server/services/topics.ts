import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { toDateKey } from "@/lib/time";
import { audit } from "@/server/audit";
import { config, now } from "@/server/config";
import { getDb, queryRows, type Executor } from "@/server/db/client";
import { topicInterests, topics } from "@/server/db/schema";
import { rankTopics, type RankedTopic, type TopicStat } from "@/server/domain/topics";
import { canSeeAudience, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";

/** Témata viditelná uživateli se zájmem a historií konání (jen zveřejněné, nezrušené akce). */
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
        FROM topics t WHERE t.org_id = ${config.orgId}`,
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
  if (!topic || !canSeeAudience(viewer, topic.audience)) throw new DomainError("not_found");
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
    .where(and(eq(topics.orgId, config.orgId), sql`lower(${topics.name}) = lower(${name})`))
    .limit(1);
  return topic?.id ?? null;
}
