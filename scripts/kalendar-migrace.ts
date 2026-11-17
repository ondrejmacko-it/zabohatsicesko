// Přechod Kalendáře na organizátora (PR B), viz docs/kalendar-migrace.md.
//   npx tsx scripts/kalendar-migrace.ts inventura                     jen čte, vypíše počty a otisk
//   npx tsx scripts/kalendar-migrace.ts smazat-kalendare              dry-run, nic nemaže
//   npx tsx scripts/kalendar-migrace.ts smazat-kalendare --provest <otisk>
// Poslední varianta je nevratná a smí se spustit jen se schválením vlastníka a po přepnutí na organizátora.
import { getDb } from "../src/server/db/client";
import { migrationInventory, retireWikiCalendars } from "../src/server/calendar/migration";

async function main() {
  const [command, flag, value] = process.argv.slice(2);
  const db = await getDb();
  if (command === "inventura") {
    console.log(JSON.stringify(await migrationInventory(db), null, 2));
  } else if (command === "smazat-kalendare") {
    if (flag && flag !== "--provest") throw new Error("Neznámý přepínač, povolený je jen --provest <otisk>.");
    if (flag && !value) throw new Error("--provest vyžaduje otisk ze schválené inventury.");
    const result = await retireWikiCalendars(db, { approvedFingerprint: value });
    console.log(JSON.stringify(result, null, 2));
    if (result.mode === "dry-run") console.log("Dry-run: nic se nesmazalo.");
  } else {
    throw new Error("Použití: tsx scripts/kalendar-migrace.ts inventura | smazat-kalendare [--provest <otisk>]");
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Neznámá chyba");
  process.exit(1);
});
