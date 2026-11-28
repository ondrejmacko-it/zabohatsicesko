// Spustí vizuální regresi (projekt „vizual“, e2e/vizualni.spec.ts) samostatně. Proměnná se nastaví tady,
// ne v package.json, aby skript fungoval stejně na Linuxu, macOS i Windows. Další argumenty se předají
// Playwrightu, například `npm run e2e:vizual -- --update-snapshots`.
import { spawnSync } from "node:child_process";

const cli = "node_modules/@playwright/test/cli.js";
const args = [cli, "test", "--trace", "off", "--project=prihlaseni", "--project=vizual", ...process.argv.slice(2)];
const run = spawnSync(process.execPath, args, { stdio: "inherit", env: { ...process.env, E2E_VIZUAL: "1" } });
process.exit(run.status ?? 1);
