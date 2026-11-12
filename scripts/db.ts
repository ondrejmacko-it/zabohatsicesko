// Správa databáze dema: `npm run db:migrate` (migrace + seed do prázdné DB), `npm run db:reset`.
import { getDb } from "../src/server/db/client";
import { resetDatabase } from "../src/server/seed";

async function main() {
  const command = process.argv[2];
  const db = await getDb(); // aplikuje migrace a do prázdné databáze nahraje seed
  if (command === "reset") await db.transaction((tx) => resetDatabase(tx));
  else if (command !== "migrate") throw new Error("Použití: tsx scripts/db.ts migrate|reset");
  console.log(command === "reset" ? "Ukázková data obnovena." : "Databáze je připravená.");
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Neznámá chyba");
  process.exit(1);
});
