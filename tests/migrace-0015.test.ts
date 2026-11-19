import { PGlite } from "@electric-sql/pglite";
import { describe, expect, test } from "vitest";
import { migrations } from "@/server/db/migrations";

// Stejné dělení na příkazy jako prepareDatabase (středník na konci řádku).
const statements = (sql: string) => sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
const index = migrations.findIndex((m) => m.id === "0015_topic_priority_unlimited");

async function databaseBefore0015(): Promise<PGlite> {
  const pg = new PGlite();
  for (const migration of migrations.slice(0, index)) {
    for (const statement of statements(migration.sql)) await pg.exec(statement);
  }
  return pg;
}

async function run0015(pg: PGlite): Promise<void> {
  await pg.transaction(async (tx) => {
    for (const statement of statements(migrations[index]!.sql)) await tx.exec(statement);
  });
}

const priorityState = async (pg: PGlite) => {
  const constraints = await pg.query<{ conname: string }>(
    `SELECT conname FROM pg_constraint WHERE conrelid = 'topics'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%priority_rank%' ORDER BY conname`,
  );
  const type = await pg.query<{ type: string }>(
    `SELECT format_type(atttypid, atttypmod) AS type FROM pg_attribute WHERE attrelid = 'topics'::regclass AND attname = 'priority_rank'`,
  );
  return { constraints: constraints.rows.map((r) => r.conname), type: type.rows[0]?.type };
};

describe("migrace 0015 (garantovaná témata bez limitu)", () => {
  test("blok DO zůstane jedním příkazem", () => {
    expect(index).toBeGreaterThan(0);
    expect(statements(migrations[index]!.sql).filter((s) => s.includes("DO $$"))).toHaveLength(1);
  });

  test("s očekávaným omezením z 0013 uvolní limit 3 a ponechá kladné pořadí", async () => {
    const pg = await databaseBefore0015();
    expect(await priorityState(pg)).toEqual({ constraints: ["topics_priority_rank_check"], type: "smallint" });
    await run0015(pg);
    expect(await priorityState(pg)).toEqual({ constraints: ["topics_priority_rank_positive"], type: "integer" });
  });

  test("bez očekávaného omezení selže a schéma nechá beze změny", async () => {
    const pg = await databaseBefore0015();
    await pg.exec("ALTER TABLE topics DROP CONSTRAINT topics_priority_rank_check");
    await expect(run0015(pg)).rejects.toThrow(/chybí očekávané omezení/);
    expect(await priorityState(pg)).toEqual({ constraints: [], type: "smallint" });
  });

  test("s omezením jiného obsahu (např. jiná horní mez) selže", async () => {
    const pg = await databaseBefore0015();
    await pg.exec("ALTER TABLE topics DROP CONSTRAINT topics_priority_rank_check");
    await pg.exec("ALTER TABLE topics ADD CONSTRAINT topics_priority_rank_check CHECK (priority_rank BETWEEN 1 AND 5)");
    await expect(run0015(pg)).rejects.toThrow(/chybí očekávané omezení/);
    expect(await priorityState(pg)).toEqual({ constraints: ["topics_priority_rank_check"], type: "smallint" });
  });
});
