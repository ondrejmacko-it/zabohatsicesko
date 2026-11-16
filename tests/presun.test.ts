import { beforeEach, describe, expect, test } from "vitest";
import { syncEvent } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/services/errors";
import { assertImpactConfirmed, changeImpact } from "@/server/services/impact";
import { loadEventRow, planMove, updateEvent } from "@/server/services/events";
import { toDateKey, toTimeKey } from "@/lib/time";
import { PAST_FP, PUBLISHED_RM, admin, lead, organizer, participant, resetDemo } from "./helpers";

beforeEach(resetDemo);

const row = async (id: string) => (await loadEventRow(await getDb(), id))!;
const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (error: unknown) => (error instanceof DomainError ? error.code : String(error)),
  );

describe("přesun akce na jiný den", () => {
  test("návrh se přesune se stejným časem a zůstane návrhem", async () => {
    const before = await row("ev-11-13");
    const plan = await planMove(organizer, "ev-11-13", "2026-11-16");
    expect(plan.mode).toBe("draft");
    expect(plan.from).toBe("2026-11-13");
    await updateEvent(organizer, "ev-11-13", before.revision, plan.input, plan.mode);
    const after = await row("ev-11-13");
    expect(toDateKey(after.startsAt)).toBe("2026-11-16");
    expect(toTimeKey(after.startsAt)).toBe(toTimeKey(before.startsAt));
    expect(toTimeKey(after.endsAt)).toBe(toTimeKey(before.endsAt));
    expect(after.status).toBe("draft");
    expect(after.label).toBe(before.label);
    expect(after.topicTitle).toBe(before.topicTitle);
    expect(after.leadId).toBe(before.leadId);
  });

  test("zveřejněná akce se zveřejní na novém dni a Kalendář dostane změnu", async () => {
    const before = await row(PUBLISHED_RM);
    const plan = await planMove(organizer, PUBLISHED_RM, "2026-11-13");
    expect(plan.mode).toBe("publish");
    const impact = await changeImpact(organizer, PUBLISHED_RM, plan.input);
    expect(impact).not.toBeNull();
    // Bez potvrzeného dopadu server zveřejnění odmítne, stejně jako u úpravy.
    await expect(assertImpactConfirmed(PUBLISHED_RM, plan.input, null)).rejects.toThrow("impact_not_confirmed");
    await assertImpactConfirmed(PUBLISHED_RM, plan.input, impact!.token);
    await updateEvent(organizer, PUBLISHED_RM, before.revision, plan.input, plan.mode);
    const after = await row(PUBLISHED_RM);
    expect(after.published?.startsAt).toBe(new Date("2026-11-13T12:30:00+01:00").toISOString());
    await syncEvent(PUBLISHED_RM);
    const sim = await (await getDb()).query.simCalendarEvents.findFirst();
    expect(sim?.startsAt.toISOString()).toBe(new Date("2026-11-13T12:30:00+01:00").toISOString());
  });

  test("vícedenní akce si zachová počet dní", async () => {
    const plan = await planMove(organizer, "ev-11-20", "2026-11-23");
    expect(plan.input.date).toBe("2026-11-23");
    expect(plan.input.endDate).toBe("2026-11-24");
  });

  test("zveřejněná akce s rozpracovaným návrhem se přesune jen v návrhu", async () => {
    const before = await row(PUBLISHED_RM);
    const draft = await planMove(organizer, PUBLISHED_RM, "2026-11-13");
    await updateEvent(organizer, PUBLISHED_RM, before.revision, { ...draft.input, date: "2026-11-12", topicTitle: "Jiné téma" }, "draft");
    const plan = await planMove(organizer, PUBLISHED_RM, "2026-11-16");
    expect(plan.mode).toBe("draft");
  });

  test("jen správce a organizátor smí přesouvat", async () => {
    expect(await code(planMove(participant, "ev-11-13", "2026-11-16"))).toBe("forbidden");
    expect(await code(planMove(lead, "ev-11-13", "2026-11-16"))).toBe("forbidden");
    expect(await code(planMove(admin, "ev-11-13", "2026-11-16"))).toBe("ok");
    const plan = await planMove(organizer, "ev-11-13", "2026-11-16");
    expect(await code(updateEvent(participant, "ev-11-13", (await row("ev-11-13")).revision, plan.input, "draft"))).toBe("forbidden");
  });

  test("do minulosti, do jiného měsíce ani proběhlou akci přesunout nejde", async () => {
    expect(await code(planMove(organizer, "ev-11-13", "2026-11-10"))).toBe("outside_month");
    expect(await code(planMove(organizer, "ev-11-13", "2026-12-01"))).toBe("outside_month");
    // Dnešek po začátku akce (now = 12. 11. 9:00, akce začíná v 8:30) je také minulost.
    expect(await code(planMove(organizer, "ev-11-13", "2026-11-12"))).toBe("outside_month");
    expect(await code(planMove(organizer, PAST_FP, "2026-11-18"))).toBe("invalid_state");
    expect(await code(planMove(organizer, "ev-11-4", "2026-11-18"))).toBe("cancelled");
    expect(await code(planMove(organizer, "ev-11-13", "2026-11-13"))).toBe("invalid_input");
    expect(await code(planMove(organizer, "neexistuje", "2026-11-18"))).toBe("not_found");
  });

  test("souběh: přesun se starou verzí neprojde a nic nepřepíše", async () => {
    const stale = (await row("ev-11-13")).revision;
    const first = await planMove(organizer, "ev-11-13", "2026-11-16");
    await updateEvent(admin, "ev-11-13", stale, first.input, first.mode);
    const second = await planMove(organizer, "ev-11-13", "2026-11-18");
    expect(await code(updateEvent(organizer, "ev-11-13", stale, second.input, second.mode))).toBe("conflict");
    expect(toDateKey((await row("ev-11-13")).startsAt)).toBe("2026-11-16");
  });
});
