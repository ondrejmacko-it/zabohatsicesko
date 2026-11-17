// CI: plný `npm audit` se schválenými výjimkami. Spuštění: `npx tsx scripts/audit-plny.ts`.
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { evaluateAudit, type AuditException } from "./audit-vyjimky";

const { vyjimky } = JSON.parse(readFileSync(new URL("./audit-vyjimky.json", import.meta.url), "utf8")) as { vyjimky: AuditException[] };
// npm audit vrací nenulový kód i při nálezu, proto se rozhoduje jen podle JSON výstupu.
const run = spawnSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const verdict = run.error ? { ok: false, tolerated: [], errors: [`npm audit nešel spustit: ${run.error.message}`] } : evaluateAudit(run.stdout, vyjimky, new Date().toISOString().slice(0, 10));

const lines = [
  `## Plný npm audit: ${verdict.ok ? "bez neposouzených nálezů" : "ZASTAVENO"}`,
  ...verdict.errors.map((e) => `- ❌ ${e}`),
  ...verdict.tolerated.map((t) => `- ⚠️ Známá výjimka ${t.id} (${t.packageName}, ${t.severity}), viz docs/bezpecnost-zavislosti.md a issue #66`),
];
for (const t of verdict.tolerated) console.log(`::warning title=Známá výjimka npm audit::${t.id} (${t.packageName}, ${t.severity}) je dočasně tolerovaná, viz docs/bezpecnost-zavislosti.md`);
for (const e of verdict.errors) console.log(`::error title=Plný npm audit::${e}`);
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
process.exit(verdict.ok ? 0 : 1);
