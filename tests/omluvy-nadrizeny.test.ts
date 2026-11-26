import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { PARTICIPATION_MIGRATIONS, markParticipationSchema, now } from "@/server/config";
import { getDb } from "@/server/db/client";
import { auditLog, events, users } from "@/server/db/schema";
import { DomainError } from "@/server/services/errors";
import { listExcuseManagers, managedExcusesAt, setExcuseManagers } from "@/server/services/excuse-managers";
import { changeOwnParticipation } from "@/server/services/participation";
import { admin, lead, organizer, outsider, participant, resetDemo } from "./helpers";

// F03/D01: důvod omluvy vidí omluvený a výslovně určený nadřízený (migrace 0018). Nikdo jiný, ani v náhledu.

const code = (promise: Promise<unknown>) => promise.then(() => "ok", (e: unknown) => (e instanceof DomainError ? e.code : String(e)));
const NOTE = "soukroma-poznamka-nadrizeny";
const schema = globalThis as unknown as { __zbcAppliedMigrations?: ReadonlySet<string> };

async function futureFp(): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        sql`${events.published}->>'audience' = 'fp'`,
        sql`${events.published}->>'status' = 'published'`,
        sql`(${events.published}->>'startsAt')::timestamptz > ${now().toISOString()}::timestamptz`,
        sql`${events.type} <> 'holiday'`,
      ),
    )
    .limit(1);
  if (!row) throw new Error("v seedu chybí budoucí zveřejněná FP akce");
  return row.id;
}

describe("nadřízený pro omluvy (0018)", () => {
  let applied: ReadonlySet<string> | undefined;
  beforeAll(async () => {
    await getDb();
    applied = schema.__zbcAppliedMigrations;
  });
  beforeEach(async () => {
    vi.stubEnv("PARTICIPATION", "on");
    await resetDemo();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    if (applied) markParticipationSchema(applied);
  });

  test("určený nadřízený vidí důvod i poznámku, kolega, správce ani náhled ne", async () => {
    const id = await futureFp();
    await changeOwnParticipation(participant, id, { kind: "excuse", excuse: { reason: "illness", note: NOTE } });
    await setExcuseManagers(admin, participant.id, [lead.id]);

    const seen = await managedExcusesAt(lead, id, false);
    expect(seen).toEqual([expect.objectContaining({ reason: "illness", note: NOTE })]);
    // Náhled za nadřízeného důvod neukáže, ani správci, který se dívá jeho očima.
    expect(await managedExcusesAt(lead, id, true)).toEqual([]);
    expect(await managedExcusesAt(outsider, id, false)).toEqual([]);
    expect(await managedExcusesAt(admin, id, false)).toEqual([]);
    expect(await managedExcusesAt(organizer, id, false)).toEqual([]);

    const map = await listExcuseManagers(admin);
    expect(map?.get(participant.id)).toEqual([lead.id]);
    // Audit říká jen kdo koho změnil, nic o omluvě.
    const audits = JSON.stringify(await (await getDb()).select().from(auditLog));
    expect(audits).toContain("excuse_managers.changed");
    expect(audits).not.toContain(NOTE);
  });

  test("odebraný nadřízený přestane důvod vidět", async () => {
    const id = await futureFp();
    await changeOwnParticipation(participant, id, { kind: "excuse", excuse: { reason: "other", note: null } });
    await setExcuseManagers(admin, participant.id, [lead.id]);
    await setExcuseManagers(admin, participant.id, []);
    expect(await managedExcusesAt(lead, id, false)).toEqual([]);
  });

  test("historický záznam omluvy (zrušení, deaktivace, zánik povinnosti) se nadřízenému neukáže", async () => {
    const id = await futureFp();
    const db = await getDb();
    await changeOwnParticipation(participant, id, { kind: "excuse", excuse: { reason: "illness", note: NOTE } });
    await setExcuseManagers(admin, participant.id, [lead.id]);
    expect(await managedExcusesAt(lead, id, false)).toHaveLength(1);
    const [row] = await db.select({ published: events.published }).from(events).where(eq(events.id, id));
    const setPublished = (patch: object) =>
      db.update(events).set({ published: { ...row.published!, ...patch } }).where(eq(events.id, id));

    // Změna rolí: povinnost zanikne, záznam zůstane, ale neplatí. Po návratu role platí znovu.
    await db.update(users).set({ groups: ["vsichni", "rm"] }).where(eq(users.id, participant.id));
    expect(await managedExcusesAt(lead, id, false)).toEqual([]);
    await db.update(users).set({ groups: ["vsichni", "fp"] }).where(eq(users.id, participant.id));
    expect(await managedExcusesAt(lead, id, false)).toHaveLength(1);

    await setPublished({ audience: "rm" });
    expect(await managedExcusesAt(lead, id, false)).toEqual([]);
    await setPublished({ status: "cancelled" });
    expect(await managedExcusesAt(lead, id, false)).toEqual([]);
    await setPublished({});

    await db.update(users).set({ status: "disabled" }).where(eq(users.id, participant.id));
    expect(await managedExcusesAt(lead, id, false)).toEqual([]);
  });

  test("zrušená omluva zmizí i nadřízenému", async () => {
    const id = await futureFp();
    await changeOwnParticipation(participant, id, { kind: "excuse", excuse: { reason: "illness", note: null } });
    await setExcuseManagers(admin, participant.id, [lead.id, organizer.id]);
    expect(await managedExcusesAt(organizer, id, false)).toHaveLength(1);
    await changeOwnParticipation(participant, id, { kind: "revoke_excuse" });
    expect(await managedExcusesAt(lead, id, false)).toEqual([]);
    expect(await managedExcusesAt(organizer, id, false)).toEqual([]);
  });

  test("nastavovat smí jen správce, s platnými aktivními účty", async () => {
    expect(await code(setExcuseManagers(lead, participant.id, [lead.id]))).toBe("forbidden");
    expect(await code(listExcuseManagers(participant))).toBe("forbidden");
    expect(await code(setExcuseManagers(admin, participant.id, [participant.id]))).toBe("invalid_input");
    expect(await code(setExcuseManagers(admin, participant.id, ["neexistuje"]))).toBe("invalid_input");
    expect(await code(setExcuseManagers(admin, "neexistuje", [lead.id]))).toBe("not_found");
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(await code(setExcuseManagers(admin, participant.id, six))).toBe("invalid_input");
    const db = await getDb();
    await db.update(users).set({ status: "disabled" }).where(sql`${users.id} = ${lead.id}`);
    expect(await code(setExcuseManagers(admin, participant.id, [lead.id]))).toBe("invalid_input");
  });

  test("bez migrace 0018 se vazby nečtou ani neukládají", async () => {
    const id = await futureFp();
    await changeOwnParticipation(participant, id, { kind: "excuse", excuse: { reason: "illness", note: null } });
    await setExcuseManagers(admin, participant.id, [lead.id]);
    markParticipationSchema(new Set(PARTICIPATION_MIGRATIONS));
    expect(await managedExcusesAt(lead, id, false)).toEqual([]);
    expect(await listExcuseManagers(admin)).toBeNull();
    expect(await code(setExcuseManagers(admin, participant.id, [lead.id]))).toBe("forbidden");
  });

  test("bez PARTICIPATION=on nadřízený nic nevidí", async () => {
    const id = await futureFp();
    await changeOwnParticipation(participant, id, { kind: "excuse", excuse: { reason: "illness", note: null } });
    await setExcuseManagers(admin, participant.id, [lead.id]);
    vi.stubEnv("PARTICIPATION", "");
    expect(await managedExcusesAt(lead, id, false)).toEqual([]);
  });
});
