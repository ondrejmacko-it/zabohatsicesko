import { beforeEach, describe, expect, test } from "vitest";
import { toDateKey } from "@/lib/time";
import { getDb } from "@/server/db/client";
import { defaultAudience } from "@/server/domain/generation";
import { cancelEvent, createEvent, deleteDraft, generateMonth, listMonth, listMonthDrafts, loadEventRow, publishDrafts, type EventInput } from "@/server/services/events";
import { organizer, resetDemo } from "./helpers";

// Prosinec 2026: úterý 10:00–12:00 je v šabloně akce, 24. a 25. 12. (čt, pá) jsou svátky.
const MONTH = "2026-12";
const TUESDAY = "2026-12-08";
const manual: EventInput = {
  type: "other", label: "Ruční akce", date: TUESDAY, endDate: null, startTime: "10:30", endTime: "11:30",
  topicTitle: null, topicId: null, audience: defaultAudience("action"), leadId: null, reviewerId: null,
};

beforeEach(resetDemo);

const templateDrafts = async () => (await listMonthDrafts(organizer, MONTH)).drafts.filter((d) => d.fromTemplate);
const draftOn = async (day: string) => (await templateDrafts()).find((d) => toDateKey(new Date(d.startsAt)) === day);

describe("doplnění měsíce: svátky, výjimky, přesuny a stav akcí", () => {
  test("ve svátek vznikne jen záznam svátku, ne školení", async () => {
    await generateMonth(organizer, MONTH);
    expect(await draftOn("2026-12-24")).toBeUndefined();
    expect(await draftOn("2026-12-25")).toBeUndefined();
    const cards = await listMonth(organizer, MONTH);
    const onHoliday = cards.filter((c) => toDateKey(new Date(c.startsAt)) === "2026-12-24");
    expect(onHoliday.map((c) => c.type)).toEqual(["holiday"]);
  });

  test("smazaný návrh termínu se při dalším doplnění nevrátí (výjimka)", async () => {
    await generateMonth(organizer, MONTH);
    const draft = (await draftOn(TUESDAY))!;
    await deleteDraft(organizer, draft.id, draft.revision);
    expect((await generateMonth(organizer, MONTH)).created).toBe(0);
    expect(await draftOn(TUESDAY)).toBeUndefined();
  });

  test("termín přesunutý na jiný den se na původním místě znovu nevytvoří", async () => {
    await generateMonth(organizer, MONTH);
    const draft = (await draftOn(TUESDAY))!;
    await publishDrafts(organizer, MONTH, [{ id: draft.id, revision: draft.revision, topicTitle: null, leadId: null, date: "2026-12-10" }], 0, { publish: false });
    expect((await generateMonth(organizer, MONTH)).created).toBe(0);
    expect(await draftOn(TUESDAY)).toBeUndefined();
    expect(toDateKey((await loadEventRow(await getDb(), draft.id))!.startsAt)).toBe("2026-12-10");
  });

  test("zveřejněný termín se nezdvojí a zveřejněná ruční akce stejné skupiny termín obsadí", async () => {
    await createEvent(organizer, { ...manual, date: "2026-12-15" }, "publish");
    const first = await generateMonth(organizer, MONTH);
    expect(first.skipped).toBe(1);
    expect(await draftOn("2026-12-15")).toBeUndefined();
    const draft = (await draftOn(TUESDAY))!;
    await publishDrafts(organizer, MONTH, [{ id: draft.id, revision: draft.revision, topicTitle: "Téma", leadId: "demo-vedouci" }]);
    expect((await generateMonth(organizer, MONTH)).created).toBe(0);
  });

  test("zrušená ruční akce termín neblokuje", async () => {
    const id = await createEvent(organizer, manual, "publish");
    const row = (await loadEventRow(await getDb(), id))!;
    await cancelEvent(organizer, id, row.revision, "Lektor onemocněl");
    const result = await generateMonth(organizer, MONTH);
    expect(result.skipped).toBe(0);
    expect(await draftOn(TUESDAY)).toBeDefined();
  });

  test("souběh vidí správce i u návrhu, který už v plánu je", async () => {
    await generateMonth(organizer, MONTH);
    expect((await draftOn(TUESDAY))!.clash).toBeNull();
    await createEvent(organizer, { ...manual, audience: "vsichni" }, "draft");
    expect((await draftOn(TUESDAY))!.clash).toBe("shared");
    await createEvent(organizer, { ...manual, label: "Duplicita" }, "draft");
    expect((await draftOn(TUESDAY))!.clash).toBe("group");
  });
});
