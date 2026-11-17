import { beforeEach, describe, expect, test } from "vitest";
import { snapshotOf } from "@/server/domain/snapshot";
import { formValuesOf } from "@/server/services/detail";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
import { DomainError } from "@/server/services/errors";
import { cancelEvent, createEvent, loadEventRow, planMove, updateEvent, type EventInput } from "@/server/services/events";
import { PAST_FP, PUBLISHED_RM, organizer, resetDemo } from "./helpers";

beforeEach(resetDemo);

const HOLIDAY = "ev-11-17";

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (error: unknown) => (error instanceof DomainError ? error.code : String(error)),
  );

async function inputOf(id: string, change: Partial<EventInput> = {}): Promise<EventInput & { revision: number }> {
  const row = (await loadEventRow(await getDb(), id))!;
  const v = formValuesOf(snapshotOf(row));
  return {
    type: v.type, label: v.label, date: v.date, endDate: v.endDate, startTime: v.startTime, endTime: v.endTime,
    topicTitle: v.topicTitle || null, topicId: null, audience: v.audience, leadId: v.leadId || null, reviewerId: v.reviewerId || null,
    ...change, revision: row.revision,
  };
}

describe("svátek je v plánu pevně", () => {
  test("svátek nejde upravit, přesunout ani zrušit", async () => {
    const { revision, ...input } = await inputOf(HOLIDAY);
    expect(await code(updateEvent(organizer, HOLIDAY, revision, { ...input, label: "Jiný název" }, "publish"))).toBe("holiday_locked");
    expect(await code(planMove(organizer, HOLIDAY, "2026-11-19"))).toBe("holiday_locked");
    expect(await code(cancelEvent(organizer, HOLIDAY, revision, "Nechceme"))).toBe("holiday_locked");
    const after = (await loadEventRow(await getDb(), HOLIDAY))!;
    expect(after.revision).toBe(revision);
  });

  test("svátek nejde ručně založit a akci na svátek změnit nejde", async () => {
    const { revision, ...input } = await inputOf(PUBLISHED_RM);
    expect(await code(createEvent(organizer, { ...input, type: "holiday", date: "2026-11-25" }, "draft"))).toBe("holiday_locked");
    expect(await code(updateEvent(organizer, PUBLISHED_RM, revision, { ...input, type: "holiday" }, "draft"))).toBe("holiday_locked");
  });
});

describe("proběhlá akce má pevný termín", () => {
  test("termín proběhlé akce server odmítne, ostatní údaje opravit jde", async () => {
    const { revision, ...input } = await inputOf(PAST_FP);
    expect(await code(updateEvent(organizer, PAST_FP, revision, { ...input, startTime: "08:00" }, "draft"))).toBe("invalid_state");
    expect(await code(updateEvent(organizer, PAST_FP, revision, { ...input, topicTitle: "Opravené téma" }, "draft"))).toBe("ok");
  });
});

describe("hromadné smazání návrhů", () => {
  test("smaže jen nezveřejněný návrh v aktuální verzi, ostatní přeskočí", async () => {
    const { deleteDrafts } = await import("@/server/services/events");
    const db = await getDb();
    const draft = (await loadEventRow(db, "ev-11-25"))!;
    const pub = (await loadEventRow(db, PUBLISHED_RM))!;
    const holiday = (await loadEventRow(db, HOLIDAY))!;
    const result = await deleteDrafts(organizer, [
      { id: draft.id, revision: draft.revision },
      { id: pub.id, revision: pub.revision },
      { id: holiday.id, revision: holiday.revision },
      { id: "ev-11-13", revision: 999 },
    ]);
    expect(result).toEqual({ deleted: ["ev-11-25"], skipped: 3 });
    expect(await loadEventRow(db, PUBLISHED_RM)).toBeTruthy();
    expect(await loadEventRow(db, "ev-11-13")).toBeTruthy();
  });

  test("souběh: dvě stejná smazání smažou návrh jen jednou, zastaralá verze se přeskočí", async () => {
    const { deleteDrafts } = await import("@/server/services/events");
    const db = await getDb();
    const draft = (await loadEventRow(db, "ev-11-25"))!;
    const item = { id: draft.id, revision: draft.revision };
    const [a, b] = await Promise.all([deleteDrafts(organizer, [item]), deleteDrafts(organizer, [item])]);
    expect([...a.deleted, ...b.deleted]).toEqual(["ev-11-25"]);
    expect(a.skipped + b.skipped).toBe(1);
    const logs = await db.select().from(auditLog).where(and(eq(auditLog.action, "event.delete_draft"), eq(auditLog.entityId, "ev-11-25")));
    expect(logs).toHaveLength(1);

    // Návrh, který mezitím někdo upravil (nová verze), se podle staré verze nesmaže.
    expect((await loadEventRow(db, "ev-11-13"))!.publishedRevision).toBeNull();
    const { revision, ...input } = await inputOf("ev-11-13");
    expect(await code(updateEvent(organizer, "ev-11-13", revision, { ...input, topicTitle: "Změněno mezitím" }, "draft"))).toBe("ok");
    expect(await deleteDrafts(organizer, [{ id: "ev-11-13", revision }])).toEqual({ deleted: [], skipped: 1 });
    expect(await loadEventRow(db, "ev-11-13")).toBeTruthy();
  });

  test("souběh: zveřejnění a smazání téhož návrhu, vyhraje jen jedno", async () => {
    const { deleteDrafts, generateMonth, listMonthDrafts, publishDrafts } = await import("@/server/services/events");
    await generateMonth(organizer, "2026-12");
    const pick = (await listMonthDrafts(organizer, "2026-12")).drafts[0]!;
    const incomplete = pick.topicTitle && pick.leadId ? 0 : 1;
    const [published, removed] = await Promise.all([
      publishDrafts(organizer, "2026-12", [{ id: pick.id, revision: pick.revision, topicTitle: pick.topicTitle, leadId: pick.leadId }], incomplete),
      deleteDrafts(organizer, [{ id: pick.id, revision: pick.revision }]),
    ]);
    expect(published.published.length + removed.deleted.length).toBe(1);
    const row = await loadEventRow(await getDb(), pick.id);
    if (removed.deleted.length) expect(row).toBeFalsy();
    else expect(row?.publishedRevision).not.toBeNull();
  });

  test("účastník hromadně mazat nesmí", async () => {
    const { deleteDrafts } = await import("@/server/services/events");
    const { participant } = await import("./helpers");
    expect(await code(deleteDrafts(participant, [{ id: "ev-11-25", revision: 1 }]))).toBe("forbidden");
  });
});
