import { sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { config } from "@/server/config";
import { migrations } from "./migrations";
import * as schema from "./schema";
import { seedDatabase } from "@/server/seed";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;

/** Surový SQL dotaz s parametry. Oba ovladače vracejí řádky v `rows`. */
export async function queryRows<T>(db: Executor, query: SQL): Promise<T[]> {
  const result = (await db.execute(query)) as unknown as { rows: T[] };
  return result.rows;
}

// Neon i PGlite mají stejné API dotazů (oba jsou PgDatabase), liší se jen ovladačem.
async function connect(): Promise<Db> {
  if (config.databaseUrl) {
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    return drizzle({ client: new Pool({ connectionString: config.databaseUrl }), schema }) as unknown as Db;
  }
  const dir = config.pgliteDir;
  if (!dir.includes("://")) (await import("node:fs")).mkdirSync(dir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  return drizzle({ client: new PGlite(dir), schema }) as unknown as Db;
}

const MIGRATION_LOCK = 724_001;

/** Aplikuje chybějící migrace a do prázdné databáze nahraje fiktivní seed. Běží pod zámkem. */
export async function prepareDatabase(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK})`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const applied = await queryRows<{ id: string }>(tx, sql`SELECT id FROM schema_migrations`);
    const done = new Set(applied.map((row) => row.id));
    for (const migration of migrations) {
      if (done.has(migration.id)) continue;
      for (const statement of migration.sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
        await tx.execute(sql.raw(statement));
      }
      await tx.execute(sql`INSERT INTO schema_migrations (id) VALUES (${migration.id})`);
    }
    const [users] = await queryRows<{ count: number }>(tx, sql`SELECT count(*)::int AS count FROM users`);
    if (users?.count === 0) await seedDatabase(tx);
  });
}

const globalForDb = globalThis as unknown as { __zbcDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  globalForDb.__zbcDb ??= connect()
    .then(async (db) => {
      await prepareDatabase(db);
      return db;
    })
    .catch((error: unknown) => {
      globalForDb.__zbcDb = undefined;
      throw error;
    });
  return globalForDb.__zbcDb;
}
