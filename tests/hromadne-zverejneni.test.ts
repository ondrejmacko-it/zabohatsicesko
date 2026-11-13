import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { syncPublished } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { calendarLinks, simCalendarEvents } from "@/server/db/schema";
import { snapshotOf } from "@/server/domain/snapshot";
import { formValuesOf } from "@/server/services/detail";
import { createEvent, generateMonth, listMonth, listMonthDrafts, loadEventRow, publishDrafts, updateEvent, type EventInput } from "@/server/services/events";
import { PUBLISHED_RM, organizer, participant, resetDemo } from "./helpers";

beforeEach(resetDemo);

const MONTH = "2026-12";
const link = async (id: string) => (await (await getDb()).select().from(calendarLinks).where(eq(calendarLinks.eventId, id)))[0];

const extra: EventInput = {
  type: "workshop", label: "AI workshop", date: "2026-12-09", endDate: null, startTime: "14:00", endTime: "16:00",
  topicTitle: null, topicId: null, audience: "vsichni", leadId: null, reviewerId: null,
};

describe("hromadné zveřejnění návrhů měsíce", () => {
  test("nabídne jen nikdy nezveřejněné návrhy a rozliší základ ze šablony od návrhů navíc", async () => {
    await generateMonth(organizer, MONTH);
    const extraId = await createEvent(organizer, extra, "draft");
    const { drafts, changeDrafts } = await listMonthDrafts(organizer, MONTH);
    expect(drafts.length).toBeGreaterThan(5);
    expect(drafts.filter((d) => !d.fromTemplate).map((d) => d.id)).toEqual([extraId]);
    expect(drafts.every((d) => d.type !== "holiday")).toBe(true);
    expect(changeDrafts).toBe(0);
    await expect(listMonthDrafts(participant, MONTH)).rejects.toMatchObject({ code: "forbidden" });
  });

  test("zveřejní vybrané, doplní téma a vedoucího a každá akce dostane pozvánku", async () => {
    await generateMonth(organizer, MONTH);
    const extraId = await createEvent(organizer, extra, "draft");
    const base = (await listMonthDrafts(organizer, MONTH)).drafts.filter((d) => d.fromTemplate);
    const [first, ...rest] = base;
    const result = await publishDrafts(organizer, MONTH, [
      { id: first!.id, revision: first!.revision, topicTitle: "Doplněné téma", leadId: "demo-vedouci" },
      ...rest.map((d) => ({ id: d.id, revision: d.revision, topicTitle: d.topicTitle, leadId: d.leadId })),
    ]);
    expect(result).toEqual({ published: base.map((d) => d.id), skipped: 0 });

    const row = (await loadEventRow(await getDb(), first!.id))!;
    expect(row.published).toMatchObject({ topicTitle: "Doplněné téma", leadId: "demo-vedouci", status: "published" });
    // Návrh navíc nebyl vybraný: zůstává návrhem a účastník ho nevidí.
    expect((await loadEventRow(await getDb(), extraId))!.published).toBeNull();
    expect((await listMonth(participant, MONTH)).some((c) => c.id === extraId)).toBe(false);
    expect((await listMonthDrafts(organizer, MONTH)).drafts.map((d) => d.id)).toEqual([extraId]);

    await syncPublished();
    for (const d of base) expect((await link(d.id))?.syncStatus).toBe("synced");
    expect(await link(extraId)).toBeUndefined();
  });

  test("návrh změny zveřejněné akce, cizí měsíc ani zastaralá verze se hromadně nezveřejní", async () => {
    await generateMonth(organizer, MONTH);
    const db = await getDb();
    // Návrh změny už zveřejněné akce.
    const published = (await loadEventRow(db, PUBLISHED_RM))!;
    const v = formValuesOf(snapshotOf(published));
    await updateEvent(organizer, PUBLISHED_RM, published.revision, {
      type: v.type, label: v.label, date: v.date, endDate: v.endDate, startTime: v.startTime, endTime: v.endTime,
      topicTitle: "Rozpracovaná změna", topicId: null, audience: v.audience, leadId: v.leadId || null, reviewerId: null,
    }, "draft");
    const changed = (await loadEventRow(db, PUBLISHED_RM))!;
    expect((await listMonthDrafts(organizer, "2026-11")).changeDrafts).toBe(1);
    expect((await listMonthDrafts(organizer, "2026-11")).drafts.map((d) => d.id)).not.toContain(PUBLISHED_RM);

    const [draft, other] = (await listMonthDrafts(organizer, MONTH)).drafts;
    const result = await publishDrafts(organizer, "2026-11", [
      { id: PUBLISHED_RM, revision: changed.revision, topicTitle: "Rozpracovaná změna", leadId: null },
      { id: draft!.id, revision: draft!.revision, topicTitle: null, leadId: null }, // patří do prosince
    ]);
    expect(result).toEqual({ published: [], skipped: 2 });
    expect((await loadEventRow(db, PUBLISHED_RM))!.published?.topicTitle).toBe("Rozbor úvodní konzultace");

    // Zastaralá verze: návrh mezitím někdo upravil.
    const stale = await publishDrafts(organizer, MONTH, [
      { id: draft!.id, revision: draft!.revision + 5, topicTitle: null, leadId: null },
      { id: other!.id, revision: other!.revision, topicTitle: null, leadId: null },
    ]);
    expect(stale).toEqual({ published: [other!.id], skipped: 1 });
    await expect(publishDrafts(participant, MONTH, [])).rejects.toMatchObject({ code: "forbidden" });
  });

  test("v simulaci dostanou pozvánku i zveřejněné budoucí akce ze seedu bez vazby", async () => {
    const db = await getDb();
    expect(await link("ev-11-26")).toBeUndefined();
    const before = (await db.select().from(simCalendarEvents)).length;
    await syncPublished();
    expect((await link("ev-11-26"))?.syncStatus).toBe("synced");
    expect(await link("ev-11-3")).toBeUndefined(); // proběhlá
    expect(await link("ev-11-19")).toBeUndefined(); // návrh
    const after = (await db.select().from(simCalendarEvents)).length;
    expect(after).toBeGreaterThan(before);
    await syncPublished();
    expect((await db.select().from(simCalendarEvents)).length).toBe(after);
  });
});
