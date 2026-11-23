import { PGlite } from "@electric-sql/pglite";
import { describe, expect, test } from "vitest";
import { migrations } from "@/server/db/migrations";

const statements = (sql: string) => sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
const index = migrations.findIndex((m) => m.id === "0016_event_participation");
const run = (pg: PGlite, sql: string) => pg.transaction(async (tx) => { for (const s of statements(sql)) await tx.exec(s); });

describe("migrace 0016 (individuální účast)", () => {
  test("je poslední, vyžaduje schválení a jen přidává", () => {
    expect(index).toBe(migrations.length - 1);
    expect(migrations[index]!.approval).toBe(true);
    const code = statements(migrations[index]!.sql).map((s) => s.replace(/^--.*$/gm, "").trim());
    expect(code.every((s) => /^CREATE (UNIQUE INDEX|TABLE|INDEX) IF NOT EXISTS /.test(s))).toBe(true);
  });

  test("projde nad stávajícími daty, data nemění a jde spustit znovu", async () => {
    const pg = new PGlite();
    for (const m of migrations.slice(0, index)) await run(pg, m.sql);
    await pg.exec(`INSERT INTO users (id, org_id, name, email, role, groups) VALUES ('u1', 'o1', 'A', 'a@example.invalid', 'member', '{fp}')`);
    const before = await pg.query(`SELECT * FROM users`);
    await run(pg, migrations[index]!.sql);
    await run(pg, migrations[index]!.sql);
    expect((await pg.query(`SELECT * FROM users`)).rows).toEqual(before.rows);
    const fks = await pg.query<{ conname: string }>(`SELECT conname FROM pg_constraint WHERE conrelid = 'event_participation'::regclass AND contype = 'f' ORDER BY conname`);
    expect(fks.rows.map((r) => r.conname)).toEqual(["event_participation_event_fk", "event_participation_user_fk"]);
  });
});
