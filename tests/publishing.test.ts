import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { syncEvent } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { calendarLinks, simCalendarEvents, simCalendarNotifications } from "@/server/db/schema";
import { snapshotOf } from "@/server/domain/snapshot";
import { formValuesOf } from "@/server/services/detail";
import { cancelEvent, createEvent, listMonth, loadEventRow, nextEventFor, updateEvent, type EventInput } from "@/server/services/events";
import { ImpactNotConfirmed, assertImpactConfirmed, changeImpact } from "@/server/services/impact";
import { listTopics } from "@/server/services/topics";
import { writeSwitch } from "@/server/settings";
import { PUBLISHED_RM, organizer, outsider, participant, resetDemo } from "./helpers";

beforeEach(resetDemo);

async function inputOf(id: string, change: Partial<EventInput> = {}): Promise<EventInput & { revision: number }> {
  const row = (await loadEventRow(await getDb(), id))!;
  const v = formValuesOf(snapshotOf(row));
  return {
    type: v.type, label: v.label, date: v.date, endDate: v.endDate, startTime: v.startTime, endTime: v.endTime,
    topicTitle: v.topicTitle || null, topicId: null, audience: v.audience, leadId: v.leadId || null, reviewerId: v.reviewerId || null,
    ...change, revision: row.revision,
  };
}
const row = async (id: string) => (await loadEventRow(await getDb(), id))!;
const link = async (id: string) => (await (await getDb()).select().from(calendarLinks).where(eq(calendarLinks.eventId, id)))[0];
const invite = async (externalId: string) =>
  (await (await getDb()).select().from(simCalendarEvents).where(eq(simCalendarEvents.id, externalId)))[0]!;
const INVITE_ID = "demo-existing-rm-1112";

describe("zrušení vychází z poslední zveřejněné verze", () => {
  test("rozpracovaná změna tématu, termínu a publika se do Wiki ani Kalendáře nedostane", async () => {
    const before = (await row(PUBLISHED_RM)).published!;
    const { revision, ...draft } = await inputOf(PUBLISHED_RM, { topicTitle: "Nezveřejněné téma", date: "2026-12-20", audience: "fp" });
    await updateEvent(organizer, PUBLISHED_RM, revision, draft, "draft");
    await cancelEvent(organizer, PUBLISHED_RM, revision + 1, "Vedoucí onemocněl");
    await syncEvent(PUBLISHED_RM);

    const after = await row(PUBLISHED_RM);
    expect(after.published).toEqual({ ...before, status: "cancelled", cancelReason: "Vedoucí onemocněl" });
    expect(after.startsAt.toISOString()).toBe(before.startsAt);
    expect(after.audience).toBe("rm");
    const external = await invite(INVITE_ID);
    expect(external.status).toBe("cancelled");
    expect(external.summary).toBe("Trénink RM: Rozbor úvodní konzultace");
    expect(external.startsAt.toISOString()).toBe(before.startsAt);
    // Účastník RM vidí zrušenou akci v původním termínu, kolega z FP ji nevidí vůbec.
    expect((await listMonth(outsider, "2026-11")).find((c) => c.id === PUBLISHED_RM)?.planStatus).toBe("cancelled");
    expect((await listMonth(participant, "2026-12")).some((c) => c.id === PUBLISHED_RM)).toBe(false);
  });

  test("akce zrušená dřív, než vznikla pozvánka, žádnou pozvánku ani storno nepošle", async () => {
    const db = await getDb();
    await writeSwitch(db, "calendar.outage", true);
    const id = await createEvent(organizer, { ...(await inputOf(PUBLISHED_RM)), date: "2026-11-23", topicTitle: "Nová akce" }, "publish");
    await writeSwitch(db, "calendar.outage", false);
    await cancelEvent(organizer, id, (await row(id)).revision, "Nestihne se");
    await syncEvent(id);
    await syncEvent(id); // opakování nic nezaloží

    expect((await link(id))?.syncStatus).toBe("synced");
    expect((await link(id))?.externalEventId).toBeNull();
    expect(await db.select().from(simCalendarEvents)).toHaveLength(1);
    expect(await db.select().from(simCalendarNotifications)).toHaveLength(0);
  });
});

describe("návrh přesunu účastníkům neschová původní termín", () => {
  test("RM z 12. 11. v návrhu přesunutý na 20. 12. zůstává v listopadu a ve správném pořadí", async () => {
    const { revision, ...draft } = await inputOf(PUBLISHED_RM, { date: "2026-12-20" });
    await updateEvent(organizer, PUBLISHED_RM, revision, draft, "draft");

    const november = await listMonth(outsider, "2026-11");
    const card = november.find((c) => c.id === PUBLISHED_RM)!;
    expect(card.startsAt).toBe("2026-11-12T11:30:00.000Z");
    expect(november.map((c) => c.startsAt)).toEqual([...november.map((c) => c.startsAt)].sort());
    expect((await listMonth(outsider, "2027-01")).some((c) => c.id === PUBLISHED_RM)).toBe(false);
    expect((await nextEventFor(outsider))?.id).toBe(PUBLISHED_RM); // Domov i Přehled
    // Organizátor pracuje s návrhem: akci vidí v prosinci.
    const organizerCard = (await listMonth(organizer, "2026-12")).find((c) => c.id === PUBLISHED_RM)!;
    expect(organizerCard.startsAt.slice(0, 10)).toBe("2026-12-20");
    expect(organizerCard.unpublishedChanges).toBe(true);
  });

  test("historie tématu vychází ze zveřejněných akcí, ne z návrhu", async () => {
    const topic = (await listTopics(organizer))[0]!;
    const { revision, ...draft } = await inputOf(PUBLISHED_RM, { topicTitle: topic.name, topicId: topic.id });
    await updateEvent(organizer, PUBLISHED_RM, revision, draft, "draft");
    expect((await listTopics(organizer)).find((t) => t.id === topic.id)?.nextPlanned).toBe(topic.nextPlanned);
    await updateEvent(organizer, PUBLISHED_RM, revision + 1, draft, "publish");
    expect((await listTopics(organizer)).find((t) => t.id === topic.id)?.nextPlanned).toBe("2026-11-12");
  });
});

describe("potvrzení dopadu změny", () => {
  test("změna jen publika RM → FP ukáže přidané, odebrané a ručně přidané hosty", async () => {
    // Nejdřív Wiki do pozvánky doplní publikum RM, aby měla spravované hosty.
    const first = await inputOf(PUBLISHED_RM, { topicTitle: "Jiné téma" });
    await updateEvent(organizer, PUBLISHED_RM, first.revision, first, "publish");
    await syncEvent(PUBLISHED_RM);
    const sequence = (await invite(INVITE_ID)).sequence;

    const { revision, ...change } = await inputOf(PUBLISHED_RM, { audience: "fp" });
    const impact = (await changeImpact(organizer, PUBLISHED_RM, change))!;
    expect(impact.changes).toEqual([{ field: "Publikum", from: "Relationship manažeři", to: "Finanční poradci" }]);
    expect(impact.guests.add).toEqual(["Účastník FP"]);
    expect(impact.guests.remove).toEqual([]);
    expect(impact.guests.manual).toEqual(["Účastník RM"]); // přidaný ručně v Kalendáři, Wiki ho neodebírá
    expect(impact.notes.join(" ")).toContain("simulaci");

    // Server zveřejnění bez potvrzení odmítne, stejně tak potvrzení jiné změny.
    await expect(assertImpactConfirmed(PUBLISHED_RM, change, null)).rejects.toBeInstanceOf(ImpactNotConfirmed);
    const other = (await changeImpact(organizer, PUBLISHED_RM, { ...change, audience: "tym-a" }))!;
    await expect(assertImpactConfirmed(PUBLISHED_RM, change, other.token)).rejects.toBeInstanceOf(ImpactNotConfirmed);
    await assertImpactConfirmed(PUBLISHED_RM, change, impact.token);

    await updateEvent(organizer, PUBLISHED_RM, revision, change, "publish");
    await syncEvent(PUBLISHED_RM);
    await syncEvent(PUBLISHED_RM); // opakování zápisu nic nezdvojí
    const external = await invite(INVITE_ID);
    expect(external.sequence).toBe(sequence + 1); // stejná pozvánka, jedna změna
    expect(external.attendees.map((a) => a.email.split("@")[0])).toContain("demo-ucastnik");
    expect(external.attendees[0]).toMatchObject({ email: "demo-mimo-skupinu@example.invalid", responseStatus: "accepted" });
    // Staré potvrzení po zveřejnění neplatí pro další změnu.
    await expect(assertImpactConfirmed(PUBLISHED_RM, { ...change, audience: "rm" }, impact.token)).rejects.toBeInstanceOf(ImpactNotConfirmed);
  });

  test("změna, která se pozvaných nedotkne, potvrzení nevyžaduje; neověřený Kalendář dialog přizná", async () => {
    const same: EventInput = await inputOf(PUBLISHED_RM, { reviewerId: "demo-organizator" });
    expect(await changeImpact(organizer, PUBLISHED_RM, same)).toBeNull();
    await assertImpactConfirmed(PUBLISHED_RM, same, null);

    await writeSwitch(await getDb(), "calendar.outage", true);
    const impact = (await changeImpact(organizer, PUBLISHED_RM, { ...same, audience: "fp", date: "2026-11-19" }))!;
    expect(impact.changes.map((c) => c.field)).toEqual(["Termín", "Publikum"]);
    expect(impact.notes.join(" ")).toContain("není ověřený");
    await expect(changeImpact(participant, PUBLISHED_RM, same)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("zahození návrhu změny a zápis po výměně nahrávky", () => {
  test("zahození vrátí zveřejněnou verzi, Kalendář nechá být a bez návrhu ho server odmítne", async () => {
    const { resetDemo, organizer, participant, PUBLISHED_RM } = await import("./helpers");
    const { discardDraftChanges, getEventCard, updateEvent } = await import("@/server/services/events");
    const { formValuesOf } = await import("@/server/services/detail");
    await resetDemo();
    const before = (await getEventCard(organizer, PUBLISHED_RM))!;
    await expect(discardDraftChanges(organizer, PUBLISHED_RM, before.row.revision)).rejects.toMatchObject({ code: "invalid_state" });
    const form = formValuesOf(before.row.published!);
    await updateEvent(organizer, PUBLISHED_RM, before.row.revision, { ...form, audience: "fp", topicId: null, topicTitle: "Jiné téma", leadId: form.leadId || null, reviewerId: form.reviewerId || null }, "draft");
    const draft = (await getEventCard(organizer, PUBLISHED_RM))!;
    expect(draft.card.unpublishedChanges).toBe(true);
    await expect(discardDraftChanges(participant, PUBLISHED_RM, draft.row.revision)).rejects.toMatchObject({ code: "forbidden" });
    await discardDraftChanges(organizer, PUBLISHED_RM, draft.row.revision);
    const after = (await getEventCard(organizer, PUBLISHED_RM))!;
    expect(after.card.unpublishedChanges).toBe(false);
    expect(after.card.audience).toBe("rm");
    expect(after.card.topicTitle).toBe(before.card.topicTitle);
    expect(after.card.syncStatus).toBe(before.card.syncStatus);
    expect(after.row.published).toEqual(before.row.published);
  });

  test("výměna nahrávky nechá publiku zveřejněný zápis", async () => {
    const { resetDemo, lead, participant, asFile, fixtureWav, PAST_FP } = await import("./helpers");
    const { getDb } = await import("@/server/db/client");
    const { events } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const rec = await import("@/server/services/recordings");
    const { listPublishedMinutes } = await import("@/server/services/journey");
    const db = await resetDemo();
    const load = async () => (await db.select().from(events).where(eq(events.id, PAST_FP)))[0]!;
    let panel = await rec.recordingPanel(lead, await load());
    if (panel.access !== "handler") throw new Error("vedoucí musí mít přístup");
    if (!panel.minutes) {
      await rec.processTranscriptionJob(await rec.uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "a.wav")));
      panel = await rec.recordingPanel(lead, await load());
      if (panel.access !== "handler" || !panel.minutes) throw new Error("chybí návrh zápisu");
    }
    if (panel.minutes.status !== "published") await rec.publishMinutes(lead, PAST_FP, panel.minutes.id, panel.minutes.version);
    expect((await listPublishedMinutes(participant)).filter((m) => m.eventId === PAST_FP)).toHaveLength(1);

    await rec.uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "b.wav"));
    const reader = await rec.recordingPanel(participant, await (await getDb()).select().from(events).where(eq(events.id, PAST_FP)).then((r) => r[0]!));
    expect(reader).toMatchObject({ access: "reader", state: "available" });
    expect((await listPublishedMinutes(participant)).filter((m) => m.eventId === PAST_FP)).toHaveLength(1);
  });
});
