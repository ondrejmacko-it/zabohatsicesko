import { PGlite } from "@electric-sql/pglite";
import { describe, expect, test } from "vitest";
import { migrations } from "@/server/db/migrations";

const statements = (sql: string) => sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
const index = migrations.findIndex((m) => m.id === "0016_event_participation");
const run = (pg: PGlite, sql: string) => pg.transaction(async (tx) => { for (const s of statements(sql)) await tx.exec(s); });

describe("migrace 0016 (individuální účast)", () => {
  test("předchází schválenému rozšíření 0017, vyžaduje schválení a jen přidává", () => {
    expect(migrations[index + 1]?.id).toBe("0017_participation_withdrawn");
    expect(migrations[index]!.approval).toBe(true);
    const code = statements(migrations[index]!.sql).map((s) => s.replace(/^--.*$/gm, "").trim());
    expect(code.every((s) => /^CREATE (UNIQUE INDEX|TABLE|INDEX) IF NOT EXISTS /.test(s))).toBe(true);
  });

  test("0017 rozšíří povolené stavy bez změny starých záznamů", async () => {
    const pg = new PGlite();
    for (const m of migrations.slice(0, index + 1)) await run(pg, m.sql);
    await pg.exec(`INSERT INTO users (id, org_id, name, email, role, groups)
      VALUES ('u1', 'o1', 'A', 'a@example.invalid', 'member', '{fp}')`);
    await pg.exec(`INSERT INTO events (id, org_id, type, label, starts_at, ends_at, all_day, audience, status, revision, updated_by, calendar_intent, origin)
      VALUES ('e1', 'o1', 'training-fp', 'Test', now(), now() + interval '1 hour', false, 'fp', 'published', 1, 'u1', 'none', 'manual')`);
    const next = migrations[index + 1]!;
    expect(next.approval).toBe(true);
    await run(pg, next.sql);
    await pg.exec(`INSERT INTO event_participation(org_id, event_id, user_id, kind)
      VALUES ('o1', 'e1', 'u1', 'withdrawn')`);
    const records = await pg.query<{ kind: string }>(`SELECT kind FROM event_participation`);
    expect(records.rows).toEqual([{ kind: "withdrawn" }]);
  });

  test("0017 nad skutečnými záznamy 0016: přihláška i omluva zůstanou, jde spustit znovu, neznámý stav dál neprojde", async () => {
    const pg = new PGlite();
    for (const m of migrations.slice(0, index + 1)) await run(pg, m.sql);
    await pg.exec(`INSERT INTO users (id, org_id, name, email, role, groups) VALUES
      ('u1', 'o1', 'A', 'a@example.invalid', 'member', '{fp}'), ('u2', 'o1', 'B', 'b@example.invalid', 'member', '{rm}')`);
    await pg.exec(`INSERT INTO events (id, org_id, type, label, starts_at, ends_at, all_day, audience, status, revision, updated_by, calendar_intent, origin)
      VALUES ('e1', 'o1', 'training-fp', 'Test', now(), now() + interval '1 hour', false, 'fp', 'published', 1, 'u1', 'none', 'manual')`);
    await pg.exec(`INSERT INTO event_participation (org_id, event_id, user_id, kind, excuse_reason, excuse_note) VALUES
      ('o1', 'e1', 'u1', 'excused', 'illness', 'poznamka'), ('o1', 'e1', 'u2', 'voluntary_enrolled', NULL, NULL)`);
    const before = await pg.query(`SELECT * FROM event_participation ORDER BY user_id`);
    const next = migrations[index + 1]!;
    await run(pg, next.sql);
    await run(pg, next.sql);
    expect((await pg.query(`SELECT * FROM event_participation ORDER BY user_id`)).rows).toEqual(before.rows);
    // Jediná kontrola stavu (stará se nahradila, nezdvojila) a dál odmítá neznámý stav i důvod u odhlášení.
    const checks = await pg.query<{ conname: string }>(`SELECT conname FROM pg_constraint WHERE conrelid = 'event_participation'::regclass AND conname = 'event_participation_kind_check'`);
    expect(checks.rows).toHaveLength(1);
    await expect(pg.exec(`UPDATE event_participation SET kind = 'neznamy' WHERE user_id = 'u2'`)).rejects.toThrow();
    await expect(pg.exec(`UPDATE event_participation SET kind = 'withdrawn', excuse_reason = 'illness' WHERE user_id = 'u2'`)).rejects.toThrow();
    await pg.exec(`UPDATE event_participation SET kind = 'withdrawn' WHERE user_id = 'u2'`);
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
