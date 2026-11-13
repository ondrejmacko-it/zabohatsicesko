import { beforeEach, describe, expect, test } from "vitest";
import { filterCards, monthSummary, statusAdvice } from "@/features/vzdelavani/status";
import { getDb } from "@/server/db/client";
import { snapshotOf } from "@/server/domain/snapshot";
import { formValuesOf } from "@/server/services/detail";
import { DomainError } from "@/server/services/errors";
import { listMonth, loadEventRow, updateEvent, type EventInput } from "@/server/services/events";
import { cancelImpact } from "@/server/services/impact";
import { processTranscriptionJob, publishMinutes, recordingPanel, uploadRecording, withdrawMinutes } from "@/server/services/recordings";
import { PAST_FP, PUBLISHED_RM, asFile, fixtureWav, lead, organizer, outsider, participant, resetDemo } from "./helpers";

beforeEach(resetDemo);

const code = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "ok";
  } catch (e) {
    return e instanceof DomainError ? e.code : String(e);
  }
};
const row = async (id: string) => (await loadEventRow(await getDb(), id))!;

async function moveDraft(id: string, date: string) {
  const current = await row(id);
  const v = formValuesOf(snapshotOf(current));
  const input: EventInput = {
    type: v.type, label: v.label, date, endDate: v.endDate, startTime: v.startTime, endTime: v.endTime,
    topicTitle: v.topicTitle || null, topicId: null, audience: v.audience, leadId: v.leadId || null, reviewerId: v.reviewerId || null,
  };
  await updateEvent(organizer, id, current.revision, input, "draft");
}

describe("stažení zveřejněného zápisu", () => {
  async function publish() {
    await processTranscriptionJob(await uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "trenink.wav")));
    const panel = await recordingPanel(lead, await row(PAST_FP));
    if (panel.access !== "handler" || !panel.minutes) throw new Error("chybí návrh zápisu");
    await publishMinutes(lead, PAST_FP, panel.minutes.id, panel.minutes.version);
  }

  test("publikum zápis přestane vidět, vedoucí ho má zpět jako návrh a může ho zveřejnit znovu", async () => {
    await publish();
    expect(await recordingPanel(participant, await row(PAST_FP))).toMatchObject({ access: "reader", state: "available" });

    await withdrawMinutes(lead, PAST_FP);
    const reader = await recordingPanel(participant, await row(PAST_FP));
    expect(reader).toMatchObject({ access: "reader", minutes: null });
    const handler = await recordingPanel(lead, await row(PAST_FP));
    if (handler.access !== "handler" || !handler.minutes) throw new Error("chybí zápis");
    expect(handler.publicMinutes).toBe(false);
    expect(handler.minutes.status).toBe("draft");

    await publishMinutes(lead, PAST_FP, handler.minutes.id, handler.minutes.version);
    expect(await recordingPanel(participant, await row(PAST_FP))).toMatchObject({ access: "reader", state: "available" });
  });

  test("stáhnout smí jen ten, kdo s nahrávkou pracuje, a jen zveřejněný zápis", async () => {
    expect(await code(withdrawMinutes(lead, PAST_FP))).toBe("invalid_state");
    await publish();
    expect(await code(withdrawMinutes(participant, PAST_FP))).toBe("forbidden");
    expect(await code(withdrawMinutes(outsider, PAST_FP))).toBe("not_found");
    expect(await recordingPanel(participant, await row(PAST_FP))).toMatchObject({ access: "reader", state: "available" });
  });
});

describe("dopad zrušení", () => {
  test("organizátor vidí skupinu a hosty pozvánky, ostatní nic", async () => {
    const impact = await cancelImpact(organizer, PUBLISHED_RM);
    expect(impact.audience).toBe("Relationship manažeři");
    expect(impact.guests.length).toBeGreaterThan(0);
    expect(await code(cancelImpact(participant, PUBLISHED_RM))).toBe("forbidden");
    expect(await code(cancelImpact(organizer, "neexistuje"))).toBe("not_found");
  });

  test("upozorní, že se zahodí rozpracovaný návrh změny", async () => {
    await moveDraft(PUBLISHED_RM, "2026-11-19");
    expect((await cancelImpact(organizer, PUBLISHED_RM)).notes.join(" ")).toContain("návrh změny se zahodí");
  });
});

describe("stín původního termínu a průvodce měsícem", () => {
  test("přesun v návrhu ukáže organizátorovi původní termín, účastník vidí jen zveřejněný", async () => {
    const before = (await row(PUBLISHED_RM)).published!;
    expect((await listMonth(organizer, "2026-11")).find((c) => c.id === PUBLISHED_RM)?.movedFrom).toBeNull();
    await moveDraft(PUBLISHED_RM, "2026-11-19");

    const mine = (await listMonth(organizer, "2026-11")).find((c) => c.id === PUBLISHED_RM)!;
    expect(mine.startsAt.slice(0, 10)).toBe("2026-11-19");
    expect(mine.movedFrom).toEqual({ startsAt: before.startsAt, endsAt: before.endsAt, allDay: before.allDay });
    const theirs = (await listMonth(outsider, "2026-11")).find((c) => c.id === PUBLISHED_RM)!;
    expect(theirs.startsAt).toBe(before.startsAt);
    expect(theirs.movedFrom).toBeNull();
  });

  test("souhrn měsíce, filtry a rada ke stavu odpovídají plánu", async () => {
    const cards = await listMonth(organizer, "2026-11");
    const summary = monthSummary(cards, "2026-11");
    expect(summary.planned).toBeGreaterThan(0);
    expect(summary.toPublish).toBeGreaterThan(0);
    expect(summary.toComplete).toBeGreaterThan(0);
    expect(monthSummary([], "2027-03")).toEqual({ planned: 0, toPublish: 0, toComplete: 0 });

    const drafts = filterCards(cards, "2026-11", { state: "navrhy" });
    expect(drafts.filter((c) => c.startsAt.startsWith("2026-11"))).toHaveLength(summary.toPublish);
    expect(drafts.every((c) => c.planStatus === "draft" || c.unpublishedChanges)).toBe(true);
    expect(filterCards(cards, "2026-11", { state: "doplnit" })).toHaveLength(summary.toComplete);
    expect(filterCards(cards, "2026-11", { type: "action" }).every((c) => c.type === "action")).toBe(true);
    expect(filterCards(cards, "2026-11", {})).toBe(cards);

    const draft = cards.find((c) => c.planStatus === "draft")!;
    expect(statusAdvice(draft)).toContain("Návrh vidíte jen vy");
    // Účastník nemá u zveřejněné akce žádný úkol organizátora.
    expect((await listMonth(participant, "2026-11")).every((c) => statusAdvice(c) === null)).toBe(true);
  });
});
