// Ověření účasti (0016–0018) a garantovaných témat (0015) na skutečném Postgresu, typicky na izolovaném
// Neon branchi s fiktivními daty. Zapisuje (omluvy, vazby nadřízených, priority témat), proto běží jen
// s `OVERENI_CIL=izolovany-branch` a nikdy v ostré Wiki. Connection string bere z DATABASE_URL a nevypisuje ho.
//
//   OVERENI_CIL=izolovany-branch PARTICIPATION=on \
//   APPROVED_MIGRATIONS=0016_event_participation,0017_participation_withdrawn,0018_excuse_managers \
//   DATABASE_URL=… npx tsx scripts/overeni-ucasti-db.ts
import { and, eq, sql } from "drizzle-orm";
import { config, excuseManagersEnabled, isLiveWiki, now, participationReadiness } from "../src/server/config";
import { getDb } from "../src/server/db/client";
import { events, topics, users } from "../src/server/db/schema";
import type { Viewer } from "../src/server/policy";
import { managedExcusesAt, setExcuseManagers } from "../src/server/services/excuse-managers";
import { changeOwnParticipation } from "../src/server/services/participation";
import { listTopics, proposeTopic, setTopicPriority } from "../src/server/services/topics";

const results: Array<[string, boolean]> = [];
const check = (name: string, ok: boolean) => {
  results.push([name, ok]);
  console.log(`${ok ? "OK  " : "CHYBA"} ${name}`);
};

async function main() {
  if (process.env.OVERENI_CIL !== "izolovany-branch") throw new Error("Chybí OVERENI_CIL=izolovany-branch.");
  if (!config.databaseUrl) throw new Error("Chybí DATABASE_URL (vzdálená databáze).");
  if (isLiveWiki()) throw new Error("Ověření nesmí běžet v ostré Wiki (WIKI_MODE=production).");

  const db = await getDb();
  const applied = (await db.execute(sql`SELECT id FROM schema_migrations ORDER BY id`)) as unknown as { rows: Array<{ id: string }> };
  const ids = applied.rows.map((r) => r.id);
  console.log(`Migrace: ${ids.length}, poslední ${ids.at(-1)}`);
  check("migrace 0015–0018 provedené", ["0015_topic_priority_unlimited", "0016_event_participation", "0017_participation_withdrawn", "0018_excuse_managers"].every((id) => ids.includes(id)));
  check("účast zapnutá nad schématem", participationReadiness() === "on" && excuseManagersEnabled());

  const people = await db.select({ id: users.id, role: users.role, groups: users.groups, status: users.status }).from(users).where(eq(users.orgId, config.orgId));
  const active = people.filter((p) => p.status === "active").map((p) => ({ id: p.id, role: p.role, groups: p.groups }) as Viewer);
  const admin = active.find((p) => p.role === "admin" || p.role === "organizer");
  const member = active.find((p) => p.role === "member" && p.groups.includes("fp"));
  const manager = active.find((p) => p.role === "member" && p.id !== member?.id);
  if (!admin || !member || !manager) throw new Error("V databázi chybí správce nebo dva aktivní účastníci.");

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, config.orgId), sql`${events.published}->>'audience' = 'fp'`, sql`${events.published}->>'status' = 'published'`, sql`(${events.published}->>'startsAt')::timestamptz > ${now().toISOString()}::timestamptz`))
    .limit(1);
  if (!event) throw new Error("Chybí budoucí zveřejněná FP akce.");

  // Omluva, nadřízený, náhled a odvolání.
  const note = `overeni-${Date.now()}`;
  const excused = await changeOwnParticipation(member, event.id, { kind: "excuse", excuse: { reason: "illness", note } });
  check("omluva z povinné akce", excused.state === "excused");
  await setExcuseManagers(admin, member.id, [manager.id]);
  check("nadřízený vidí důvod", (await managedExcusesAt(manager, event.id, false)).some((e) => e.note === note));
  check("v náhledu důvod není", (await managedExcusesAt(manager, event.id, true)).length === 0);
  check("správce bez vazby důvod nevidí", (await managedExcusesAt(admin, event.id, false)).length === 0);
  check("odvolání omluvy", (await changeOwnParticipation(member, event.id, { kind: "revoke_excuse" })).state === "required");
  await setExcuseManagers(admin, member.id, []);

  // Dobrovolná přihláška se souběhem: dvě stejné žádosti = jeden záznam.
  const [optional] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, config.orgId), sql`${events.published}->>'audience' = 'rm'`, sql`${events.published}->>'status' = 'published'`, sql`(${events.published}->>'startsAt')::timestamptz > ${now().toISOString()}::timestamptz`))
    .limit(1);
  if (optional && !member.groups.includes("rm")) {
    const both = await Promise.all([changeOwnParticipation(member, optional.id, { kind: "enroll" }), changeOwnParticipation(member, optional.id, { kind: "enroll" })]);
    check("souběžná přihláška = jeden stav", both.every((p) => p.state === "voluntary_enrolled"));
    check("odhlášení", (await changeOwnParticipation(member, optional.id, { kind: "withdraw" })).state === "withdrawn");
  }

  // 0015: garantovaných 4, 5, 10 a 20 témat (dřív limit 3).
  let all = await listTopics(admin);
  for (let i = all.length; i < 22; i++) await proposeTopic(admin, `Ověřovací téma ${i + 1}`, "vsichni");
  all = await listTopics(admin);
  const guaranteed = () => db.select({ id: topics.id }).from(topics).where(and(eq(topics.orgId, config.orgId), sql`${topics.priorityRank} IS NOT NULL`, sql`${topics.archivedAt} IS NULL`));
  for (const target of [4, 5, 10, 20]) {
    for (const topic of all) {
      if ((await guaranteed()).length >= target) break;
      await setTopicPriority(admin, topic.id, true);
    }
    check(`garantovaných témat ${target}`, (await guaranteed()).length === target);
  }

  const failed = results.filter(([, ok]) => !ok).length;
  console.log(failed ? `Selhalo: ${failed}` : `Vše v pořádku (${results.length} kontrol).`);
  process.exit(failed ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : `Neznámá chyba: ${String((error as { code?: string })?.code ?? typeof error)}`);
  process.exit(1);
});
