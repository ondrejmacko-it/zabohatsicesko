import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { syncEvent } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { calendarLinks, simCalendarEvents, users } from "@/server/db/schema";
import { snapshotOf } from "@/server/domain/snapshot";
import { formValuesOf } from "@/server/services/detail";
import { createEvent, loadEventRow, updateEvent, type EventInput } from "@/server/services/events";
import { ImpactNotConfirmed, assertImpactConfirmed, changeImpact } from "@/server/services/impact";
import { changeOwnParticipation } from "@/server/services/participation";
import { updateAccess } from "@/server/services/users";
import { writeSwitch } from "@/server/settings";
import { PUBLISHED_RM, admin, organizer, outsider, participant, resetDemo } from "./helpers";

// Oprava C (finální integrační kolo): náhled dopadu změny zveřejněné akce počítal hosty jen podle skupiny,
// synchronizace už podle individuální účasti. Dialog tak sliboval jiné hosty, než Wiki skutečně pozvala.
// Tady se dopad z náhledu porovnává se skutečným výsledkem synchronizace (simulace Kalendáře, PARTICIPATION=on).

beforeAll(() => vi.stubEnv("PARTICIPATION", "on"));
afterAll(() => vi.unstubAllEnvs());
beforeEach(resetDemo);

/** Budoucí zveřejněná akce RM s pozvánkou založenou frontou (Wiki spravuje všechny její hosty). */
async function futureRm(audience: EventInput["audience"] = "rm"): Promise<string> {
  const row = (await loadEventRow(await getDb(), PUBLISHED_RM))!;
  const v = formValuesOf(snapshotOf(row));
  const id = await createEvent(
    organizer,
    { type: v.type, label: v.label, date: "2026-11-26", endDate: "2026-11-26", startTime: v.startTime, endTime: v.endTime, topicTitle: "Dopad změny", topicId: null, audience, leadId: v.leadId || null, reviewerId: null },
    "publish",
  );
  await syncEvent(id);
  return id;
}

async function inputOf(id: string, change: Partial<EventInput> = {}): Promise<EventInput & { revision: number }> {
  const row = (await loadEventRow(await getDb(), id))!;
  const v = formValuesOf(snapshotOf(row));
  return {
    type: v.type, label: v.label, date: v.date, endDate: v.endDate, startTime: v.startTime, endTime: v.endTime,
    topicTitle: v.topicTitle || null, topicId: null, audience: v.audience, leadId: v.leadId || null, reviewerId: v.reviewerId || null,
    ...change, revision: row.revision,
  };
}

/** Jména hostů skutečné (simulované) pozvánky. */
async function guestNames(id: string): Promise<string[]> {
  const db = await getDb();
  const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, id));
  const [external] = await db.select().from(simCalendarEvents).where(eq(simCalendarEvents.id, link!.externalEventId!));
  const names = new Map((await db.select({ email: users.email, name: users.name }).from(users)).map((u) => [u.email.toLowerCase(), u.name]));
  return external!.attendees.map((a) => names.get(a.email.toLowerCase()) ?? a.email).sort();
}

/** Náhled → zveřejnění s potvrzením → synchronizace. Vrátí náhled a skutečnou změnu hostů. */
async function previewAndPublish(id: string, change: Partial<EventInput>) {
  const before = await guestNames(id);
  const { revision, ...input } = await inputOf(id, change);
  const impact = (await changeImpact(organizer, id, input))!;
  await assertImpactConfirmed(id, input, impact.token);
  await updateEvent(organizer, id, revision, input, "publish");
  await syncEvent(id);
  const after = await guestNames(id);
  return {
    impact,
    added: after.filter((n) => !before.includes(n)).sort(),
    removed: before.filter((n) => !after.includes(n)).sort(),
  };
}

describe("dopad změny zveřejněné akce odpovídá skutečné synchronizaci (oprava C)", () => {
  test("změna termínu: omluvený povinný účastník se do pozvánky nevrací", async () => {
    const id = await futureRm();
    await changeOwnParticipation(outsider, id, { kind: "excuse", excuse: { reason: "vacation", note: null } });
    await syncEvent(id);
    const { impact, added, removed } = await previewAndPublish(id, { date: "2026-11-27" });
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
    expect(impact.guests.add).toEqual(added);
    expect(impact.guests.remove).toEqual(removed);
  });

  test("změna publika RM → FP: dobrovolně přihlášený zůstane, omluvený RM se neobjeví, náhled sedí", async () => {
    const id = await futureRm();
    await changeOwnParticipation(participant, id, { kind: "enroll" });
    await changeOwnParticipation(outsider, id, { kind: "excuse", excuse: { reason: "other", note: null } });
    await syncEvent(id);
    const { impact, added, removed } = await previewAndPublish(id, { audience: "fp" });
    expect(impact.guests.add.sort()).toEqual(added);
    expect(impact.guests.remove.sort()).toEqual(removed);
    expect(added).not.toContain("Účastník – finanční poradce"); // už byl pozvaný jako dobrovolně přihlášený
    // Účast zapnutá = akci vidí všichni, nepravdivé „přestane vidět“ dialog neříká.
    expect(impact.notes.join(" ")).not.toContain("přestane");
    expect(impact.notes.join(" ")).toContain("povinná pro skupinu Finanční poradci");
  });

  test("změna publika RM → Všichni: náhled přidá přesně ty, které synchronizace pozve, nikoho dvakrát", async () => {
    const id = await futureRm();
    const { impact, added, removed } = await previewAndPublish(id, { audience: "vsichni" });
    expect(impact.guests.add.sort()).toEqual(added);
    expect(removed).toEqual([]);
    expect(new Set(await guestNames(id)).size).toBe((await guestNames(id)).length);
    expect(impact.notes.join(" ")).toContain("povinná pro všechny");
  });

  test("přihláška po zobrazení dopadu potvrzení zneplatní, nové potvrzení platí", async () => {
    const id = await futureRm();
    const { revision, ...input } = await inputOf(id, { date: "2026-11-27" });
    const impact = (await changeImpact(organizer, id, input))!;
    await changeOwnParticipation(participant, id, { kind: "enroll" });
    const stale = await assertImpactConfirmed(id, input, impact.token).catch((e: unknown) => e);
    expect(stale).toBeInstanceOf(ImpactNotConfirmed);
    expect((stale as ImpactNotConfirmed).stale).toBe(true);
    const fresh = (await changeImpact(organizer, id, input))!;
    await assertImpactConfirmed(id, input, fresh.token);
    // Opakované potvrzení téže změny po zveřejnění už neplatí (jiná zveřejněná verze).
    await updateEvent(organizer, id, revision, input, "publish");
    await expect(assertImpactConfirmed(id, { ...input, date: "2026-11-28" }, fresh.token)).rejects.toBeInstanceOf(ImpactNotConfirmed);
  });

  test("změna skupiny člověka během potvrzování: potvrzení je zastaralé", async () => {
    const id = await futureRm();
    const input = await inputOf(id, { date: "2026-11-27" });
    const impact = (await changeImpact(organizer, id, input))!;
    await updateAccess(admin, participant.id, { role: "member", groups: ["vsichni", "fp", "rm"], status: "active" });
    await expect(assertImpactConfirmed(id, input, impact.token)).rejects.toBeInstanceOf(ImpactNotConfirmed);
  });

  test("výpadek Kalendáře: náhled neslibuje konkrétní hosty a přizná, že dopad není ověřený", async () => {
    const id = await futureRm();
    await writeSwitch(await getDb(), "calendar.outage", true);
    const input = await inputOf(id, { audience: "fp" });
    const impact = (await changeImpact(organizer, id, input))!;
    expect(impact.guests).toEqual({ add: [], remove: [], manual: [] });
    expect(impact.notes.join(" ")).toContain("není ověřený");
  });
});
