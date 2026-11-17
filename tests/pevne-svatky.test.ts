import { beforeEach, describe, expect, test } from "vitest";
import { snapshotOf } from "@/server/domain/snapshot";
import { formValuesOf } from "@/server/services/detail";
import { getDb } from "@/server/db/client";
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
