import { sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { config, isLiveWiki, markParticipationSchema } from "@/server/config";
import { migrations } from "./migrations";
import * as schema from "./schema";
import { seedDatabase, seedProductionBase } from "@/server/seed";

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

/** ID migrací povolených pro vzdálenou databázi (viz `approval` v migrations.ts). */
function approvedMigrations(): Set<string> {
  return new Set((process.env.APPROVED_MIGRATIONS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
}

/**
 * Aplikuje chybějící migrace a prázdnou databázi naplní: ukázka fiktivním seedem, ostrá Wiki jen
 * pravidelným týdnem. Prázdná znamená bez uživatelů i bez šablony, aby ostrá Wiki po smazání
 * posledního účtu nedostala šablonu podruhé. Běží pod zámkem.
 */
export async function prepareDatabase(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK})`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const applied = await queryRows<{ id: string }>(tx, sql`SELECT id FROM schema_migrations`);
    const done = new Set(applied.map((row) => row.id));
    const approved = approvedMigrations();
    for (const migration of migrations) {
      if (done.has(migration.id)) continue;
      if (migration.approval && config.databaseUrl && !approved.has(migration.id)) {
        console.warn(`[db] migrace ${migration.id} čeká na schválení (APPROVED_MIGRATIONS), další se nespustí`);
        break;
      }
      for (const statement of migration.sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
        await tx.execute(sql.raw(statement));
      }
      await tx.execute(sql`INSERT INTO schema_migrations (id) VALUES (${migration.id})`);
      done.add(migration.id);
    }
    markParticipationSchema(done);
    const [state] = await queryRows<{ users: number; slots: number }>(
      tx,
      sql`SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM template_slots) AS slots`,
    );
    if (state?.users === 0 && state.slots === 0) {
      if (isLiveWiki()) await seedProductionBase(tx);
      else await seedDatabase(tx);
    }
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
