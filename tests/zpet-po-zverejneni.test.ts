import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { syncEvent, syncPublished } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { calendarLinks, eventRevisions, events, simCalendarEvents } from "@/server/db/schema";
import { createEvent, listMonth, listUndoable, loadEventRow, unpublishEvents, updateEvent, type EventInput } from "@/server/services/events";
import { admin, lead, organizer, participant, resetDemo } from "./helpers";

const input: EventInput = {
  type: "workshop", label: "Workshop", date: "2026-12-10", endDate: null, startTime: "09:00", endTime: "10:00",
  topicTitle: "Zkouška vrácení", topicId: null, audience: "fp", leadId: "demo-vedouci", reviewerId: null,
};

const link = async (id: string) => (await (await getDb()).select().from(calendarLinks).where(eq(calendarLinks.eventId, id)))[0];
const row = async (id: string) => (await loadEventRow(await getDb(), id))!;
const revisions = async (id: string) =>
  (await (await getDb()).select().from(eventRevisions).where(eq(eventRevisions.eventId, id))).sort((a, b) => a.revision - b.revision).map((r) => `${r.revision}:${r.action}`);
/** Posune lhůtu do minulosti, jako by uplynula. */
const expireHold = async (id: string, secondsAgo: number) =>
  (await getDb()).update(events).set({ inviteHoldUntil: new Date(Date.now() - secondsAgo * 1000) }).where(eq(events.id, id));

beforeAll(() => {
  process.env.PUBLISH_UNDO_SEC = "10";
});
afterAll(() => {
  process.env.PUBLISH_UNDO_SEC = "0";
});
beforeEach(resetDemo);

describe("zpět po zveřejnění", () => {
  test("první zveřejnění čeká: fronta pozvánku neodešle, dokud lhůta běží", async () => {
    const id = await createEvent(organizer, input, "publish");
    expect((await row(id)).inviteHoldUntil).not.toBeNull();
    await syncEvent(id);
    await syncPublished();
    expect(await link(id)).toMatchObject({ syncStatus: "pending", externalEventId: null, attempts: 0 });
    expect((await listUndoable(organizer)).map((u) => u.id)).toEqual([id]);

    await expireHold(id, 1);
    await syncPublished();
    expect(await link(id)).toMatchObject({ syncStatus: "synced" });
    expect(await listUndoable(organizer)).toEqual([]);
  });

  test("vrácení udělá z akce návrh, smaže čekající vazbu a přidá revizi na konec", async () => {
    const id = await createEvent(organizer, input, "publish");
    expect((await listMonth(participant, "2026-12")).some((c) => c.id === id)).toBe(true);

    expect(await unpublishEvents(organizer, [id])).toEqual({ reverted: [id], skipped: 0 });
    const after = await row(id);
    expect(after).toMatchObject({ status: "draft", published: null, publishedRevision: null, inviteHoldUntil: null, revision: 2 });
    expect(await link(id)).toBeUndefined();
    expect(await revisions(id)).toEqual(["1:publish", "2:unpublish"]);
    expect((await listMonth(participant, "2026-12")).some((c) => c.id === id)).toBe(false);

    await syncPublished();
    expect(await link(id)).toBeUndefined();
    expect(await (await getDb()).select().from(simCalendarEvents).where(eq(simCalendarEvents.summary, "Workshop: Zkouška vrácení"))).toEqual([]);

    // Návrh jde znovu zveřejnit a lhůta běží znovu.
    await updateEvent(organizer, id, 2, input, "publish");
    expect((await row(id)).inviteHoldUntil).not.toBeNull();
    expect(await revisions(id)).toEqual(["1:publish", "2:unpublish", "3:publish"]);
  });

  test("vrátit smí jen správce a vidí jen vlastní čerstvá zveřejnění", async () => {
    const id = await createEvent(organizer, input, "publish");
    await expect(unpublishEvents(lead, [id])).rejects.toMatchObject({ code: "forbidden" });
    await expect(unpublishEvents(participant, [id])).rejects.toMatchObject({ code: "forbidden" });
    expect(await listUndoable(lead)).toEqual([]);
    expect(await listUndoable(admin)).toEqual([]);
    expect((await row(id)).status).toBe("published");
  });

  test("po odeslání pozvánky, po lhůtě a u běžící synchronizace už vrátit nejde", async () => {
    const sent = await createEvent(organizer, input, "publish");
    await expireHold(sent, 1);
    await syncEvent(sent);
    expect(await unpublishEvents(organizer, [sent])).toEqual({ reverted: [], skipped: 1 });

    const late = await createEvent(organizer, { ...input, date: "2026-12-11" }, "publish");
    await expireHold(late, 30);
    expect(await unpublishEvents(organizer, [late])).toEqual({ reverted: [], skipped: 1 });

    const busy = await createEvent(organizer, { ...input, date: "2026-12-12" }, "publish");
    await (await getDb()).update(calendarLinks).set({ leaseUntil: new Date(Date.now() + 60_000) }).where(eq(calendarLinks.eventId, busy));
    expect(await unpublishEvents(organizer, [busy])).toEqual({ reverted: [], skipped: 1 });
    for (const id of [sent, late, busy]) expect((await row(id)).status).toBe("published");
  });

  test("změna už zveřejněné akce a zrušení lhůtu nemají a vrátit nejdou", async () => {
    const id = await createEvent(organizer, input, "publish");
    await expireHold(id, 1);
    await syncEvent(id);
    await updateEvent(organizer, id, 1, { ...input, startTime: "10:00", endTime: "11:00" }, "publish");
    expect((await row(id)).inviteHoldUntil).toBeNull();
    expect(await listUndoable(organizer)).toEqual([]);
    expect(await unpublishEvents(organizer, [id])).toEqual({ reverted: [], skipped: 1 });
    await syncEvent(id);
    expect(await link(id)).toMatchObject({ syncStatus: "synced", syncedRevision: 2 });
  });
});
