import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, test } from "vitest";
import { PARTICIPATION_MIGRATIONS, markParticipationSchema, participationReadiness } from "@/server/config";
import { prepareDatabase } from "@/server/db/client";
import { migrations } from "@/server/db/migrations";
import * as schema from "@/server/db/schema";

// C02: stav schématu pro účast se smí převzít až po commitu migrací. Když transakce `prepareDatabase`
// selže (tady seed), migrace 0016–0018 se vrátí a účast se nesmí zapnout nad chybějící tabulkou.
const statements = (sql: string) => sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
const upTo = migrations.findIndex((m) => m.id === PARTICIPATION_MIGRATIONS[0]);

async function dbBeforeParticipation() {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  for (const m of migrations.slice(0, upTo)) {
    await pg.transaction(async (tx) => {
      for (const s of statements(m.sql)) await tx.exec(s);
      await tx.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [m.id]);
    });
  }
  return pg;
}

describe("C02: schéma účasti až po commitu", () => {
  const flag = process.env.PARTICIPATION;
  afterEach(() => {
    if (flag === undefined) delete process.env.PARTICIPATION;
    else process.env.PARTICIPATION = flag;
    markParticipationSchema(new Set(migrations.map((m) => m.id)));
  });

  test("selhání seedu vrátí migrace a účast zůstane vypnutá", async () => {
    process.env.PARTICIPATION = "on";
    markParticipationSchema(new Set());
    const pg = await dbBeforeParticipation();
    await pg.exec(`CREATE FUNCTION c02_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'c02 seed'; END $$`);
    await pg.exec(`CREATE TRIGGER c02_fail BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION c02_fail()`);
    await expect(prepareDatabase(drizzle(pg, { schema }))).rejects.toThrow();
    expect((await pg.query(`SELECT to_regclass('event_participation') AS t`)).rows).toEqual([{ t: null }]);
    expect(participationReadiness()).toBe("missing-schema");
  });

  test("po úspěšném commitu se účast zapne", async () => {
    process.env.PARTICIPATION = "on";
    markParticipationSchema(new Set());
    await prepareDatabase(drizzle(await dbBeforeParticipation(), { schema }));
    expect(participationReadiness()).toBe("on");
  });
});
