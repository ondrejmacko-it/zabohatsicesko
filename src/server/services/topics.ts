import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, isNotNull, inArray, isNull, ne, sql } from "drizzle-orm";
import { toDateKey } from "@/lib/time";
import type { EventType } from "@/lib/types";
import { audit } from "@/server/audit";
import { config, now } from "@/server/config";
import { getDb, queryRows, type Executor } from "@/server/db/client";
import { events, topicInterests, topics, users } from "@/server/db/schema";
import {
  guaranteedTopics,
  isGuaranteed,
  moveInOrder,
  nextFreePriority,
  otherTopics,
  planCandidates,
  rankTopics,
  type PlanEvent,
  type RankedTopic,
  type TopicStat,
} from "@/server/domain/topics";
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
    next_planned_id: string | null;
    priority_rank: number | null;
    manual_rank: number | null;
  }>(
    db,
    sql`SELECT t.id, t.name, t.audience, t.priority_rank, t.manual_rank,
          (SELECT count(*)::int FROM topic_interests i WHERE i.topic_id = t.id) AS interest_count,
          EXISTS (SELECT 1 FROM topic_interests i WHERE i.topic_id = t.id AND i.user_id = ${viewer.id}) AS interested,
          (SELECT max((e.published->>'endsAt')::timestamptz) FROM events e
             WHERE e.published->>'topicId' = t.id AND e.published->>'status' = 'published'
               AND (e.published->>'endsAt')::timestamptz <= ${reference}::timestamptz) AS last_held,
          (SELECT min((e.published->>'startsAt')::timestamptz) FROM events e
             WHERE e.published->>'topicId' = t.id AND e.published->>'status' = 'published'
               AND (e.published->>'startsAt')::timestamptz > ${reference}::timestamptz) AS next_planned,
          (SELECT e.id FROM events e
             WHERE e.published->>'topicId' = t.id AND e.published->>'status' = 'published'
               AND (e.published->>'startsAt')::timestamptz > ${reference}::timestamptz
             ORDER BY (e.published->>'startsAt')::timestamptz, e.id LIMIT 1) AS next_planned_id
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
      nextPlannedId: r.next_planned_id,
      priorityRank: r.priority_rank,
      manualRank: r.manual_rank,
    }));
  return rankTopics(stats);
}

/**
 * Jména zájemců podle tématu. Vidí je jen správce (kvůli plánování), ostatní znají jen počet:
 * kolega tak nevidí, kdo z jiných si o téma řekl. Jen aktivní účty, abecedně.
 */
export async function listTopicInterested(viewer: Viewer): Promise<Map<string, string[]>> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  const rows = await db
    .select({ topicId: topicInterests.topicId, name: users.name })
    .from(topicInterests)
    .innerJoin(topics, eq(topics.id, topicInterests.topicId))
    .innerJoin(users, eq(users.id, topicInterests.userId))
    .where(and(eq(topics.orgId, config.orgId), eq(users.orgId, config.orgId), eq(users.status, "active")))
    .orderBy(asc(users.name));
  const byTopic = new Map<string, string[]>();
  for (const row of rows) byTopic.set(row.topicId, [...(byTopic.get(row.topicId) ?? []), row.name]);
  return byTopic;
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
 * a správce ho může vrátit.
 */
export async function setTopicArchived(viewer: Viewer, topicId: string, archived: boolean): Promise<void> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  await db.transaction(async (tx) => {
    await lockTopicOrder(tx);
    // Archivace zruší garantovanou prioritu i ruční pořadí: obnovené téma se vrátí mezi ostatní podle zájmu
    // a nezabere pořadí, které mezitím dostalo jiné téma.
    const [updated] = await tx
      .update(topics)
      .set(archived ? { archivedAt: now(), priorityRank: null, manualRank: null } : { archivedAt: null })
      .where(and(eq(topics.id, topicId), eq(topics.orgId, config.orgId)))
      .returning({ id: topics.id });
    if (!updated) throw new DomainError("not_found");
    if (archived) await compactPriorities(tx);
    await audit(tx, viewer.id, archived ? "topic.archive" : "topic.restore", "topic", topicId);
  });
}

// ——— Garantovaná témata a ruční pořadí (jen správce) ———

/**
 * Zápisy pořadí témat jdou za sebou: zámek řádků témat organizace v transakci. Unikátní index
 * `topics_priority_rank_unique` je druhá pojistka, jeho porušení se ukáže jako čitelný konflikt.
 */
async function lockTopicOrder(tx: Executor) {
  await tx.execute(sql`SELECT id FROM topics WHERE org_id = ${config.orgId} FOR UPDATE`);
}

async function activeTopics(tx: Executor) {
  return tx
    .select({ id: topics.id, name: topics.name, priorityRank: topics.priorityRank, manualRank: topics.manualRank })
    .from(topics)
    .where(and(eq(topics.orgId, config.orgId), isNull(topics.archivedAt)));
}

/** Po zrušení nebo archivaci se pořadí garantovaných sesypou na 1..n (vzestupně, takže bez kolize indexu). */
async function compactPriorities(tx: Executor) {
  const ordered = guaranteedTopics((await activeTopics(tx)).map((t) => ({ ...t, interestCount: 0 })));
  for (const [index, topic] of ordered.entries()) {
    if (topic.priorityRank !== index + 1) await tx.update(topics).set({ priorityRank: index + 1 }).where(eq(topics.id, topic.id));
  }
}

function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

/** Transakce pořadí témat: souběh, který by přesto narazil na unikátní index, je běžný konflikt. */
async function orderTransaction(task: (tx: Executor) => Promise<void>): Promise<void> {
  const db = await getDb();
  try {
    await db.transaction(async (tx) => {
      await lockTopicOrder(tx);
      await task(tx);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("conflict");
    throw error;
  }
}

async function requireActiveTopic(tx: Executor, topicId: string) {
  const [topic] = await tx
    .select()
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.orgId, config.orgId), isNull(topics.archivedAt)))
    .limit(1);
  if (!topic) throw new DomainError("not_found");
  return topic;
}

/**
 * Nastaví nebo zruší garantovanou prioritu. Nové garantované téma dostane nejnižší volné pořadí (1–3),
 * čtvrté server odmítne. Zrušení ostatní pořadí sesype. Opakované nastavení nic nemění.
 */
export async function setTopicPriority(viewer: Viewer, topicId: string, guaranteed: boolean): Promise<void> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  await orderTransaction(async (tx) => {
    const topic = await requireActiveTopic(tx, topicId);
    if (guaranteed === isGuaranteed(topic)) return;
    if (guaranteed) {
      const rank = nextFreePriority(await activeTopics(tx));
      if (rank === null) throw new DomainError("priority_full");
      await tx.update(topics).set({ priorityRank: rank }).where(eq(topics.id, topicId));
    } else {
      await tx.update(topics).set({ priorityRank: null }).where(eq(topics.id, topicId));
      await compactPriorities(tx);
    }
    await audit(tx, viewer.id, guaranteed ? "topic.priority_set" : "topic.priority_clear", "topic", topicId);
  });
}

/**
 * Posun o jedno místo: garantované téma mezi garantovanými (výměna priority), ostatní téma mezi
 * ostatními (ruční pořadí). Při prvním ručním posunu se aktuální pořadí podle zájmu uloží celé,
 * aby se ostatní témata nepřeházela. Téma na kraji zůstane, kde je.
 */
/**
 * Posune téma v jeho skupině (garantovaná / ostatní) o jedno místo, nebo na cílovou pozici (přetažení).
 * Skupinu nikdy nemění. `expected` je pořadí skupiny, jak ho viděl správce při přetažení: když se mezitím
 * změnilo (jiný správce, nové téma), server nic nezapíše a vrátí `conflict`, klient vrátí původní pořadí.
 */
export async function moveTopic(viewer: Viewer, topicId: string, target: "up" | "down" | number, expected?: readonly string[]): Promise<void> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  await orderTransaction(async (tx) => {
    const topic = await requireActiveTopic(tx, topicId);
    const all = await activeTopics(tx);
    const guaranteed = isGuaranteed(topic);
    const counts = guaranteed ? null : await interestCounts(tx);
    const order = guaranteed
      ? guaranteedTopics(all.map((t) => ({ ...t, interestCount: 0 })))
      : otherTopics(all.map((t) => ({ ...t, interestCount: counts!.get(t.id) ?? 0 })));
    const ids = order.map((t) => t.id);
    if (expected && (expected.length !== ids.length || expected.some((id, i) => id !== ids[i]))) throw new DomainError("conflict");
    const next = moveInOrder(ids, topicId, target);
    if (!next) return;
    if (guaranteed) {
      // Pořadí 1–3 zůstávají stejná čísla, jen se přeskupí. Nejdřív všechna na prázdnou hodnotu: unikátní
      // index nepovolí ani na okamžik dvě stejná pořadí.
      const ranks = order.map((t) => t.priorityRank!).sort((a, b) => a - b);
      await tx.update(topics).set({ priorityRank: null }).where(inArray(topics.id, ids));
      for (const [index, id] of next.entries()) await tx.update(topics).set({ priorityRank: ranks[index]! }).where(eq(topics.id, id));
    } else {
      for (const [index, id] of next.entries()) {
        const current = order.find((t) => t.id === id)!;
        if (current.manualRank !== index + 1) await tx.update(topics).set({ manualRank: index + 1 }).where(eq(topics.id, id));
      }
    }
    const action = typeof target === "number" ? "topic.move_to" : target === "up" ? "topic.move_up" : "topic.move_down";
    await audit(tx, viewer.id, action, "topic", topicId);
  });
}

/** Zruší ruční pořadí ostatních témat, seznam se znovu řadí podle zájmu. */
export async function resetTopicOrder(viewer: Viewer): Promise<void> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  await orderTransaction(async (tx) => {
    await tx.update(topics).set({ manualRank: null }).where(and(eq(topics.orgId, config.orgId), isNotNull(topics.manualRank)));
    await audit(tx, viewer.id, "topic.order_reset", "org", config.orgId);
  });
}

async function interestCounts(tx: Executor): Promise<Map<string, number>> {
  const rows = await tx
    .select({ topicId: topicInterests.topicId, count: sql<number>`count(*)::int` })
    .from(topicInterests)
    .innerJoin(topics, eq(topics.id, topicInterests.topicId))
    .where(eq(topics.orgId, config.orgId))
    .groupBy(topicInterests.topicId);
  return new Map(rows.map((r) => [r.topicId, Number(r.count)]));
}

export type TopicPlanOptions = {
  topic: { id: string; name: string; audience: string };
  /** Nejbližší budoucí akce, která téma už má (zveřejněná i návrh). */
  scheduled: { id: string; label: string; dateKey: string; draft: boolean } | null;
  candidates: Array<{ id: string; revision: number; label: string; type: EventType; dateKey: string; audience: string; draft: boolean; reason: string }>;
};

/**
 * Podklad okna Naplánovat téma: kam téma zařadit (`planCandidates`) a zda už má budoucí termín.
 * Jen správce, jen nearchivované téma. Čte pracovní verzi akcí (návrhy i rozpracované změny).
 */
export async function topicPlanOptions(viewer: Viewer, topicId: string): Promise<TopicPlanOptions> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  const topic = await requireActiveTopic(db, topicId);
  const upcoming = await db
    .select({
      id: events.id,
      revision: events.revision,
      type: events.type,
      label: events.label,
      audience: events.audience,
      status: events.status,
      startsAt: events.startsAt,
      topicId: events.topicId,
      topicTitle: events.topicTitle,
    })
    .from(events)
    .where(and(eq(events.orgId, config.orgId), ne(events.status, "cancelled"), gt(events.startsAt, now())))
    .orderBy(asc(events.startsAt), asc(events.id));
  const { scheduled, candidates } = planCandidates(topic, upcoming as PlanEvent[]);
  return {
    topic: { id: topic.id, name: topic.name, audience: topic.audience },
    scheduled: scheduled && { id: scheduled.id, label: scheduled.label, dateKey: toDateKey(scheduled.startsAt), draft: scheduled.status === "draft" },
    candidates: candidates.map((c) => ({ id: c.id, revision: c.revision, label: c.label, type: c.type, dateKey: toDateKey(c.startsAt), audience: c.audience, draft: c.draft, reason: c.reason })),
  };
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
