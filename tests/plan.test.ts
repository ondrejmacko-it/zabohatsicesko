import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { SimulatedCalendar, simulateManualEdit } from "@/server/calendar/simulated";
import { pairWithExisting, pairingCandidates, requestNewInvite, requestRetry, syncEvent } from "@/server/calendar/sync";
import { DEMO_CALENDAR_ID } from "@/server/seed";
import { getDb } from "@/server/db/client";
import { calendarLinks, events, simCalendarEvents, simCalendarNotifications, topics } from "@/server/db/schema";
import { snapshotOf } from "@/server/domain/snapshot";
import { formValuesOf } from "@/server/services/detail";
import { DomainError } from "@/server/services/errors";
import {
  cancelEvent,
  createEvent,
  deleteDraft,
  generateMonth,
  listMonth,
  loadEventRow,
  updateEvent,
  type EventInput,
} from "@/server/services/events";
import { monthOf, toDateKey } from "@/lib/time";
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

const simEvents = async () => (await getDb()).select().from(simCalendarEvents);
const notifications = async (externalId: string) =>
  (await getDb()).select().from(simCalendarNotifications).where(eq(simCalendarNotifications.externalEventId, externalId));
const link = async (id: string) => (await (await getDb()).select().from(calendarLinks).where(eq(calendarLinks.eventId, id)))[0];

describe("úprava zveřejněné akce a Kalendář", () => {
  test("návrh změny se neposílá, zveřejnění upraví stejnou pozvánku a zachová hosty", async () => {
    const { revision, ...draft } = await inputOf(PUBLISHED_RM, { topicTitle: "Nové téma tréninku" });
    await updateEvent(organizer, PUBLISHED_RM, revision, draft, "draft");
    let row = (await loadEventRow(await getDb(), PUBLISHED_RM))!;
    expect(row.published?.topicTitle).toBe("Rozbor úvodní konzultace"); // kolegové vidí zveřejněnou verzi
    expect((await link(PUBLISHED_RM))?.syncStatus).toBe("synced");

    await updateEvent(organizer, PUBLISHED_RM, row.revision, draft, "publish");
    expect((await link(PUBLISHED_RM))?.syncStatus).toBe("pending");
    await syncEvent(PUBLISHED_RM);
    await syncEvent(PUBLISHED_RM); // opakování nic nezdvojí

    const all = await simEvents();
    expect(all).toHaveLength(1);
    const invite = all[0]!;
    expect(invite.id).toBe("demo-existing-rm-1112");
    expect(invite.summary).toBe("Trénink RM: Nové téma tréninku");
    expect(invite.attendees).toEqual([{ email: "demo-mimo-skupinu@example.invalid", name: "Účastník RM", responseStatus: "accepted" }]);
    expect(invite.meetingUrl).toBe("https://example.invalid/meeting/demo");
    expect(await notifications(invite.id)).toHaveLength(1);
    row = (await loadEventRow(await getDb(), PUBLISHED_RM))!;
    expect((await link(PUBLISHED_RM))?.syncedRevision).toBe(row.publishedRevision);
  });

  test("souběžná změna se starší revizí neprojde", async () => {
    const { revision, ...input } = await inputOf(PUBLISHED_RM, { topicTitle: "A" });
    await updateEvent(organizer, PUBLISHED_RM, revision, input, "draft");
    await expect(updateEvent(organizer, PUBLISHED_RM, revision, { ...input, topicTitle: "B" }, "draft")).rejects.toMatchObject({ code: "conflict" });
  });

  test("Kalendář dostane vždy nejnovější zveřejněnou revizi", async () => {
    const first = await inputOf(PUBLISHED_RM, { topicTitle: "Starší" });
    await updateEvent(organizer, PUBLISHED_RM, first.revision, first, "publish");
    const second = await inputOf(PUBLISHED_RM, { topicTitle: "Novější" });
    await updateEvent(organizer, PUBLISHED_RM, second.revision, second, "publish");
    await syncEvent(PUBLISHED_RM);
    expect((await simEvents())[0]!.summary).toBe("Trénink RM: Novější");
  });

  test("výpadek nechá změnu uloženou, opakování ji doručí bez duplicity", async () => {
    const db = await getDb();
    await writeSwitch(db, "calendar.outage", true);
    const { revision, ...input } = await inputOf(PUBLISHED_RM, { startTime: "13:00", endTime: "15:30" });
    await updateEvent(organizer, PUBLISHED_RM, revision, input, "publish");
    await syncEvent(PUBLISHED_RM);
    expect(await link(PUBLISHED_RM)).toMatchObject({ syncStatus: "attention", errorCode: "calendar_unavailable", attempts: 3 });
    expect((await loadEventRow(db, PUBLISHED_RM))!.published?.startsAt).toBe("2026-11-12T12:00:00.000Z");

    await writeSwitch(db, "calendar.outage", false);
    await requestRetry(organizer, PUBLISHED_RM);
    await syncEvent(PUBLISHED_RM);
    expect((await link(PUBLISHED_RM))?.syncStatus).toBe("synced");
    expect(await simEvents()).toHaveLength(1);
    expect((await simEvents())[0]!.startsAt.toISOString()).toBe("2026-11-12T12:00:00.000Z");
  });

  test("odvolaný přístup se neopakuje a vyžaduje zásah", async () => {
    await writeSwitch(await getDb(), "calendar.revoked", true);
    const { revision, ...input } = await inputOf(PUBLISHED_RM, { topicTitle: "X" });
    await updateEvent(organizer, PUBLISHED_RM, revision, input, "publish");
    await syncEvent(PUBLISHED_RM);
    expect(await link(PUBLISHED_RM)).toMatchObject({ syncStatus: "attention", errorCode: "calendar_revoked", attempts: 1 });
  });

  test("ruční změna v Kalendáři se ukáže organizátorovi a přepíše se jen s jeho souhlasem", async () => {
    await simulateManualEdit(await getDb(), "demo-existing-rm-1112");
    const { revision, ...input } = await inputOf(PUBLISHED_RM, { topicTitle: "Po konfliktu" });
    await updateEvent(organizer, PUBLISHED_RM, revision, input, "publish");
    await syncEvent(PUBLISHED_RM);
    const conflicted = await link(PUBLISHED_RM);
    expect(conflicted).toMatchObject({ syncStatus: "attention", errorCode: "external_change" });
    expect(conflicted?.conflict?.summary).toContain("(upraveno v Kalendáři)");

    await requestRetry(organizer, PUBLISHED_RM);
    await syncEvent(PUBLISHED_RM, { force: true });
    expect((await simEvents())[0]!.summary).toBe("Trénink RM: Po konfliktu");
  });

  test("nová akce založí právě jednu pozvánku i při souběžné synchronizaci", async () => {
    const id = await createEvent(
      organizer,
      { type: "workshop", label: "AI workshop", date: "2026-11-24", endDate: null, startTime: "13:00", endTime: "15:00", topicTitle: "Nástroje", topicId: null, audience: "fp", leadId: "demo-vedouci", reviewerId: null },
      "publish",
    );
    await Promise.all([syncEvent(id), syncEvent(id)]);
    await syncEvent(id);
    const created = (await simEvents()).filter((e) => e.idempotencyKey?.endsWith(id));
    expect(created).toHaveLength(1);
    expect(created[0]!.attendees.map((a) => a.email).sort()).toEqual(
      ["demo-organizator@example.invalid", "demo-spravce@example.invalid", "demo-ucastnik@example.invalid", "demo-vedouci@example.invalid"],
    );
  });

  test("importovaná akce bez vazby čeká na rozhodnutí, nová pozvánka až na výslovný pokyn", async () => {
    const { revision, ...input } = await inputOf("ev-11-26", { topicTitle: "Změna" });
    await updateEvent(organizer, "ev-11-26", revision, input, "publish");
    expect(await link("ev-11-26")).toBeUndefined();
    await requestNewInvite(organizer, "ev-11-26");
    await syncEvent("ev-11-26");
    expect((await link("ev-11-26"))?.syncStatus).toBe("synced");
  });

  test("spárování s existující pozvánkou zachová hosty a nepřijme pozvánku z jiného dne", async () => {
    const db = await getDb();
    const existing = await new SimulatedCalendar(db).create(
      DEMO_CALENDAR_ID,
      "puvodni-pozvanka-26-11",
      { summary: "Trénink RM", description: "", startsAt: new Date("2026-11-26T11:30:00Z"), endsAt: new Date("2026-11-26T14:00:00Z"), cancelled: false },
      [{ email: "demo-mimo-skupinu@example.invalid", name: "Účastník RM", responseStatus: "tentative" }],
    );
    await expect(pairWithExisting(organizer, "ev-11-19", existing.id)).rejects.toMatchObject({ code: "invalid_state" });
    expect((await pairingCandidates(organizer, "ev-11-26")).map((c) => c.id)).toEqual([existing.id]);

    await pairWithExisting(organizer, "ev-11-26", existing.id);
    await syncEvent("ev-11-26");
    const [invite] = (await simEvents()).filter((e) => e.id === existing.id);
    expect(invite!.summary).toBe("Trénink RM: Příprava na úvodní schůzku");
    expect(invite!.attendees[0]!.responseStatus).toBe("tentative");
    expect((await link("ev-11-26"))?.syncStatus).toBe("synced");
  });

  test("zrušení jedné akce neovlivní ostatní a zůstane ve Wiki viditelné", async () => {
    const before = (await simEvents()).length;
    const row = (await loadEventRow(await getDb(), PUBLISHED_RM))!;
    await cancelEvent(organizer, PUBLISHED_RM, row.revision, "Nemoc vedoucího");
    await syncEvent(PUBLISHED_RM);
    const invite = (await simEvents())[0]!;
    expect(invite.status).toBe("cancelled");
    expect(await notifications(invite.id)).toHaveLength(1);
    expect((await simEvents()).length).toBe(before);
    const card = (await listMonth(outsider, "2026-11")).find((c) => c.id === PUBLISHED_RM);
    expect(card?.planStatus).toBe("cancelled");
  });

  test("organizátorské akce jsou na serveru zamítnuté ostatním rolím", async () => {
    const { revision, ...input } = await inputOf(PUBLISHED_RM);
    await expect(updateEvent(participant, PUBLISHED_RM, revision, input, "publish")).rejects.toBeInstanceOf(DomainError);
    await expect(generateMonth(participant, "2026-12")).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("generování ze šablony", () => {
  test("doplní jen chybějící sloty, svátky a ruční úpravy zachová", async () => {
    expect((await generateMonth(organizer, "2026-11")).created).toBe(0);

    const { created } = await generateMonth(organizer, "2026-12");
    expect(created).toBeGreaterThan(10);
    const december = (await listMonth(organizer, "2026-12")).filter((c) => monthOf(toDateKey(new Date(c.startsAt))) === "2026-12");
    const holidays = december.filter((c) => c.type === "holiday").map((c) => c.startsAt.slice(0, 10));
    expect(holidays).toEqual(expect.arrayContaining(["2026-12-23", "2026-12-24"])); // 24. a 25. 12. v pražském čase
    expect(december.filter((c) => c.type !== "holiday").every((c) => c.planStatus === "draft")).toBe(true);

    const db = await getDb();
    const draft = december.find((c) => c.type === "action" && c.startsAt.startsWith("2026-12-01"))!;
    const { revision, ...input } = await inputOf(draft.id, { startTime: "13:00", endTime: "15:00", topicTitle: "Ruční úprava" });
    await updateEvent(organizer, draft.id, revision, input, "draft");
    const toDelete = december.find((c) => c.type === "action" && c.startsAt.startsWith("2026-12-08"))!;
    await deleteDraft(organizer, toDelete.id, 1);

    expect((await generateMonth(organizer, "2026-12")).created).toBe(0);
    const edited = (await loadEventRow(db, draft.id))!;
    expect(edited.topicTitle).toBe("Ruční úprava");
    expect(await loadEventRow(db, toDelete.id)).toBeNull();
    const all = await db.select().from(events);
    expect(new Set(all.map((e) => e.generationKey).filter(Boolean)).size).toBe(all.filter((e) => e.generationKey).length);
  });

  test("firemnímu vzdělávání předvyplní doporučené téma, každé nejvýš jednou a jen jako návrh", async () => {
    const { withTopic } = await generateMonth(organizer, "2026-12");
    const db = await getDb();
    const generated = (await db.select().from(events)).filter((e) => e.generationKey?.includes(":2026-12-"));
    const suggested = generated.filter((e) => e.topicId !== null);

    expect(withTopic).toBe(suggested.length);
    expect(suggested.length).toBeGreaterThan(0);
    expect(suggested.every((e) => e.type.startsWith("education-") && e.status === "draft" && e.published === null)).toBe(true);
    expect(new Set(suggested.map((e) => e.topicId)).size).toBe(suggested.length);

    const allTopics = await db.select().from(topics);
    for (const event of suggested) {
      const topic = allTopics.find((t) => t.id === event.topicId)!;
      expect(event.topicTitle).toBe(topic.name);
      expect([event.audience, "vsichni"]).toContain(topic.audience);
    }
    // Nejvíc zájemců mezi tématy pro FP má „Otevřené otázky na schůzce“.
    const firstFp = suggested.filter((e) => e.type === "education-fp").sort((a, b) => +a.startsAt - +b.startsAt)[0];
    expect(firstFp?.topicId).toBe("topic-questions");
  });

  test("téma s budoucím termínem v návrhu se podruhé nenavrhne", async () => {
    const { revision, ...input } = await inputOf(PUBLISHED_RM, { topicTitle: "Otevřené otázky na schůzce", topicId: "topic-questions" });
    await updateEvent(organizer, PUBLISHED_RM, revision, input, "draft");
    await generateMonth(organizer, "2026-12");
    const all = await (await getDb()).select().from(events);
    expect(all.filter((e) => e.topicId === "topic-questions").map((e) => e.id)).toEqual([PUBLISHED_RM]);
  });
});
