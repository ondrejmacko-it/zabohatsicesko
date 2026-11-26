import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, test } from "vitest";
import { requeueAttendeeSync } from "@/server/calendar/attendees";
import { markParticipationSchema } from "@/server/config";
import { migrations } from "@/server/db/migrations";
import * as schema from "@/server/db/schema";

// C01: produkční DB má jen 0001–0014. Změna účtu (Správa) nesmí sahat na tabulku `event_participation`
// z migrace 0016, jinak spadne celá transakce uložení účtu.
const statements = (sql: string) => sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
const upTo = migrations.findIndex((m) => m.id === "0015_topic_priority_unlimited");

async function dbBefore0015() {
  const pg = new PGlite();
  for (const m of migrations.slice(0, upTo)) await pg.transaction(async (tx) => { for (const s of statements(m.sql)) await tx.exec(s); });
  await pg.exec(`INSERT INTO users (id, org_id, name, email, role, groups) VALUES ('u1', 'o1', 'A', 'a@example.invalid', 'member', '{fp}')`);
  markParticipationSchema(new Set(migrations.slice(0, upTo).map((m) => m.id)));
  return { pg, db: drizzle(pg, { schema }) };
}

describe("C01: změna účtu bez migrace 0016", () => {
  const flag = process.env.PARTICIPATION;
  afterEach(() => {
    if (flag === undefined) delete process.env.PARTICIPATION;
    else process.env.PARTICIPATION = flag;
    markParticipationSchema(new Set(migrations.map((m) => m.id)));
  });

  test.each([undefined, "on"])("requeueAttendeeSync projde a tabulku účasti nečte (PARTICIPATION=%s)", async (value) => {
    if (value === undefined) delete process.env.PARTICIPATION;
    else process.env.PARTICIPATION = value;
    const { pg, db } = await dbBefore0015();
    expect((await pg.query(`SELECT to_regclass('event_participation') AS t`)).rows).toEqual([{ t: null }]);
    await expect(db.transaction((tx) => requeueAttendeeSync(tx as never, { id: "u1", groups: ["fp"] }))).resolves.toBeUndefined();
  });
});
