import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { syncPublished } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { calendarLinks, simCalendarEvents } from "@/server/db/schema";
import { snapshotOf } from "@/server/domain/snapshot";
import { formValuesOf } from "@/server/services/detail";
import { createEvent, generateMonth, listMonth, listMonthDrafts, loadEventRow, publishDrafts, updateEvent, IncompleteNotConfirmed, type EventInput } from "@/server/services/events";
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
    const items = [
      { id: first!.id, revision: first!.revision, topicTitle: "Doplněné téma", leadId: "demo-vedouci" },
      ...rest.map((d) => ({ id: d.id, revision: d.revision, topicTitle: d.topicTitle, leadId: d.leadId })),
    ];
    const result = await publishDrafts(organizer, MONTH, items, items.filter((i) => !i.topicTitle || !i.leadId).length);
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
    ], 2);
    expect(stale).toEqual({ published: [other!.id], skipped: 1 });
    await expect(publishDrafts(participant, MONTH, [])).rejects.toMatchObject({ code: "forbidden" });
  });

  test("neúplné termíny odejdou jen s potvrzením přesného počtu, i při přímém volání serveru (A04)", async () => {
    await generateMonth(organizer, MONTH);
    const [a, b] = (await listMonthDrafts(organizer, MONTH)).drafts;
    const items = [
      { id: a!.id, revision: a!.revision, topicTitle: null, leadId: "demo-vedouci" },
      { id: b!.id, revision: b!.revision, topicTitle: "Téma", leadId: null },
    ];
    await expect(publishDrafts(organizer, MONTH, items)).rejects.toMatchObject({ count: 2 });
    await expect(publishDrafts(organizer, MONTH, items, 1)).rejects.toBeInstanceOf(IncompleteNotConfirmed);
    expect((await loadEventRow(await getDb(), a!.id))!.published).toBeNull(); // nic se nezveřejnilo

    // Úplné termíny potvrzení nepotřebují.
    const complete = { id: a!.id, revision: a!.revision, topicTitle: "Téma", leadId: "demo-vedouci" };
    expect((await publishDrafts(organizer, MONTH, [complete])).published).toEqual([a!.id]);
    expect((await publishDrafts(organizer, MONTH, [items[1]!], 1)).published).toEqual([b!.id]);
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

  test("ruční datum a skupina: jen ve stejném měsíci a v budoucnu, čas a délka zůstanou (G6)", async () => {
    await generateMonth(organizer, MONTH);
    const db = await getDb();
    const [draft] = (await listMonthDrafts(organizer, MONTH)).drafts;
    const base = { id: draft!.id, revision: draft!.revision, topicTitle: "Téma", leadId: "demo-vedouci" };
    // Mimo připravovaný měsíc ani do minulosti to nejde a nic se nezmění.
    await expect(publishDrafts(organizer, MONTH, [{ ...base, date: "2027-01-05" }], 0, { publish: false })).rejects.toMatchObject({ code: "outside_month" });
    const [november] = (await listMonthDrafts(organizer, "2026-11")).drafts;
    expect(november).toBeDefined();
    await expect(
      publishDrafts(organizer, "2026-11", [{ id: november!.id, revision: november!.revision, topicTitle: null, leadId: null, date: "2026-11-02" }], 0, { publish: false }),
    ).rejects.toMatchObject({ code: "outside_month" });
    expect((await loadEventRow(db, draft!.id))!.revision).toBe(draft!.revision);
    expect((await loadEventRow(db, november!.id))!.revision).toBe(november!.revision);

    const before = (await loadEventRow(db, draft!.id))!;
    const result = await publishDrafts(organizer, MONTH, [{ ...base, date: "2026-12-30", audience: "rm" }]);
    expect(result).toEqual({ published: [draft!.id], skipped: 0 });
    const row = (await loadEventRow(db, draft!.id))!;
    expect(row.published).toMatchObject({ status: "published", audience: "rm" });
    expect(formValuesOf(snapshotOf(row))).toMatchObject({ date: "2026-12-30", startTime: formValuesOf(snapshotOf(before)).startTime, endTime: formValuesOf(snapshotOf(before)).endTime });
    expect(row.endsAt.getTime() - row.startsAt.getTime()).toBe(before.endsAt.getTime() - before.startsAt.getTime());
  });

  test("Uložit změny bez zveřejnění nic nezveřejní ani neodešle a nezměněné návrhy nechá být (G6)", async () => {
    await generateMonth(organizer, MONTH);
    const db = await getDb();
    const [a, b] = (await listMonthDrafts(organizer, MONTH)).drafts;
    await syncPublished(); // seed má zveřejněné akce bez vazby, ty odejdou nezávisle na testu
    const sentBefore = (await db.select().from(simCalendarEvents)).length;
    // Neúplné termíny jde uložit i bez potvrzení počtu.
    const result = await publishDrafts(
      organizer,
      MONTH,
      [
        { id: a!.id, revision: a!.revision, topicTitle: "Uložené téma", leadId: null, audience: "fp" },
        { id: b!.id, revision: b!.revision, topicTitle: b!.topicTitle, leadId: b!.leadId },
      ],
      0,
      { publish: false },
    );
    expect(result).toEqual({ published: [a!.id], skipped: 0 });
    const saved = (await loadEventRow(db, a!.id))!;
    expect(saved).toMatchObject({ status: "draft", topicTitle: "Uložené téma", audience: "fp", revision: a!.revision + 1 });
    expect(saved.published).toBeNull();
    expect((await loadEventRow(db, b!.id))!.revision).toBe(b!.revision); // beze změny, bez nové verze
    await syncPublished();
    expect(await link(a!.id)).toBeUndefined();
    expect((await db.select().from(simCalendarEvents)).length).toBe(sentBefore);
    expect((await listMonth(participant, MONTH)).some((c) => c.id === a!.id)).toBe(false);
  });
});
