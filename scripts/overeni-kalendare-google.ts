// Živé ověření osobních kalendářů (`CALENDAR_DELIVERY=personal`) přímo přes Google Calendar API: pro každého
// propojeného uživatele porovná akce, které podle Wiki mají být v jeho kalendáři „Vzdělávání ZBC“, s tím, co
// tam skutečně je (chybějící, navíc, odlišný název/čas, duplicity). Jen čte. Běží pouze nad izolovanou větví
// Neonu s testovacími účty. Nevypisuje adresy, tokeny ani connection string, jen ID uživatelů a akcí.
//
//   OVERENI_CIL=izolovany-branch CALENDAR_DELIVERY=personal CALENDAR_MODE=google-test PARTICIPATION=on \
//   DATABASE_URL=… TOKEN_ENCRYPTION_KEY=… GOOGLE_OAUTH_CLIENT_ID=… GOOGLE_OAUTH_CLIENT_SECRET=… \
//   npx tsx scripts/overeni-kalendare-google.ts [--sledovat=120]
//
// `--sledovat=N`: kontrola se opakuje co 2 s až N sekund, dokud nejsou všechny kalendáře v souladu, a vypíše
// dobu do souladu. Spusť hned po akci v aplikaci (přihlášení, omluva, změna akce) = latence Wiki → Google.
import { sql } from "drizzle-orm";
import { isLiveWiki, personalDelivery } from "../src/server/config";
import { getDb } from "../src/server/db/client";
import { personalCalendarExpectation } from "../src/server/calendar/personal";

type Report = { userId: string; ok: number; missing: string[]; extra: string[]; different: string[]; duplicates: number };

async function checkUser(db: Awaited<ReturnType<typeof getDb>>, userId: string): Promise<Report | null> {
  const expectation = await personalCalendarExpectation(db, userId);
  if (!expectation) return null;
  const actual = await expectation.api.listEvents(expectation.calendarId);
  const report: Report = { userId, ok: 0, missing: [], extra: [], different: [], duplicates: 0 };
  const seen = new Map<string, number>();
  for (const item of actual) {
    const key = `${item.summary}|${item.start?.dateTime ? Date.parse(item.start.dateTime) : ""}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    const want = expectation.wanted.get(item.id);
    const endsAt = item.end?.dateTime ? Date.parse(item.end.dateTime) : 0;
    if (!want) {
      if (endsAt >= expectation.since.getTime()) report.extra.push(item.id);
      continue;
    }
    const same = item.summary === want.summary && Date.parse(item.start?.dateTime ?? "") === want.startsAt.getTime() && endsAt === want.endsAt.getTime();
    if (same) report.ok += 1;
    else report.different.push(item.id);
  }
  const present = new Set(actual.map((item) => item.id));
  report.missing = [...expectation.wanted.keys()].filter((id) => !present.has(id));
  report.duplicates = [...seen.values()].filter((count) => count > 1).length;
  return report;
}

const consistent = (r: Report) => !r.missing.length && !r.extra.length && !r.different.length && !r.duplicates;

async function main() {
  if (process.env.OVERENI_CIL !== "izolovany-branch") throw new Error("Chybí OVERENI_CIL=izolovany-branch.");
  if (!process.env.DATABASE_URL) throw new Error("Chybí DATABASE_URL (izolovaná větev Neonu).");
  if (isLiveWiki()) throw new Error("Ověření nesmí běžet v ostré Wiki (WIKI_MODE=production).");
  if (!personalDelivery()) throw new Error("Ověření je pro CALENDAR_DELIVERY=personal.");
  const watchArg = process.argv.find((a) => a.startsWith("--sledovat"));
  const limitSec = watchArg ? Number(watchArg.split("=")[1] ?? 120) : 0;

  const db = await getDb();
  const rows = (await db.execute(sql`SELECT user_id FROM personal_calendars WHERE status = 'active' AND calendar_id IS NOT NULL ORDER BY user_id`)) as unknown as { rows: Array<{ user_id: string }> };
  if (!rows.rows.length) throw new Error("Žádný aktivní propojený osobní kalendář.");
  const started = Date.now();
  for (;;) {
    const reports = (await Promise.all(rows.rows.map((r) => checkUser(db, r.user_id)))).filter((r): r is Report => r !== null);
    const done = reports.every(consistent);
    if (done || Date.now() - started >= limitSec * 1000) {
      for (const r of reports) {
        console.log(`${consistent(r) ? "OK   " : "CHYBA"} ${r.userId}: v souladu ${r.ok}, chybí ${r.missing.length}, navíc ${r.extra.length}, odlišné ${r.different.length}, duplicity ${r.duplicates}`);
        for (const [label, ids] of [["chybí", r.missing], ["navíc", r.extra], ["odlišné", r.different]] as const) if (ids.length) console.log(`      ${label}: ${ids.join(", ")}`);
      }
      if (limitSec) console.log(done ? `Soulad po ${((Date.now() - started) / 1000).toFixed(1)} s.` : `Bez souladu ani po ${limitSec} s.`);
      process.exitCode = done ? 0 : 1;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Ověření selhalo.");
  process.exitCode = 1;
});
