// Přechod Kalendáře na organizátora (PR B), viz docs/kalendar-migrace.md.
//   npx tsx scripts/kalendar-migrace.ts inventura                     jen čte, vypíše počty a otisk
//   npx tsx scripts/kalendar-migrace.ts smazat-kalendare              dry-run, nic nemaže
//   npx tsx scripts/kalendar-migrace.ts smazat-kalendare --provest <otisk>
//   npx tsx scripts/kalendar-migrace.ts aktivace-ucasti                jen čte: dopad PARTICIPATION=on na pozvánky
//   npx tsx scripts/kalendar-migrace.ts synchronizovat-ucast [--provest <otisk> [--davka N]]
// Poslední varianta mazání je nevratná a smí se spustit jen se schválením vlastníka a po přepnutí na organizátora.
import { getDb } from "../src/server/db/client";
import { activationInventory, queueActivationSync } from "../src/server/calendar/activation";
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
    else if (result.failed) console.log("Část kalendářů Google smazat odmítl (stav removal_failed). Po nové inventuře lze úklid zopakovat.");
  } else if (command === "aktivace-ucasti") {
    console.log(JSON.stringify(await activationInventory(db), null, 2));
  } else if (command === "synchronizovat-ucast") {
    const args = process.argv.slice(3);
    const at = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
    if (args.some((a) => a.startsWith("--") && a !== "--provest" && a !== "--davka")) throw new Error("Povolené přepínače: --provest <otisk>, --davka N.");
    const batch = at("--davka") ? Number(at("--davka")) : undefined;
    if (batch !== undefined && !Number.isInteger(batch)) throw new Error("--davka vyžaduje celé číslo.");
    const result = await queueActivationSync(db, { approvedFingerprint: at("--provest"), batch });
    console.log(JSON.stringify(result, null, 2));
    if (result.mode === "dry-run") console.log("Dry-run: nic se nezařadilo do fronty.");
  } else {
    throw new Error("Použití: tsx scripts/kalendar-migrace.ts inventura | smazat-kalendare [--provest <otisk>] | aktivace-ucasti | synchronizovat-ucast [--provest <otisk> [--davka N]]");
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Neznámá chyba");
  process.exit(1);
});
