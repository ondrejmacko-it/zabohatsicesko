import { beforeEach, describe, expect, test } from "vitest";
import { listMonth, prepareMonth, publishDrafts } from "@/server/services/events";
import { setInterest } from "@/server/services/topics";
import { admin, lead, organizer, participant, resetDemo } from "./helpers";

// Průvodce „Připravit další měsíc“: první krok doplní termíny a vrátí návrhy s doporučeným tématem.

beforeEach(resetDemo);

const MONTH = "2026-12";

describe("příprava dalšího měsíce", () => {
  test("připravit smí jen správce (obě hodnoty role)", async () => {
    for (const viewer of [lead, participant]) await expect(prepareMonth(viewer, MONTH)).rejects.toMatchObject({ code: "forbidden" });
    expect((await listMonth(admin, MONTH)).filter((c) => c.type !== "holiday" && c.startsAt >= "2026-12-01")).toEqual([]);
    expect((await prepareMonth(organizer, MONTH)).created).toBeGreaterThan(5);
  });

  test("doplní termíny jako návrhy, nic nezveřejní a opakování nic nezdvojí", async () => {
    const first = await prepareMonth(admin, MONTH);
    expect(first.drafts.length).toBeGreaterThan(5);
    expect(first.drafts.every((d) => d.fromTemplate)).toBe(true);
    // Účastník návrhy nevidí: dokud správce nezveřejní, měsíc je pro něj prázdný.
    expect((await listMonth(participant, MONTH)).filter((c) => c.type !== "holiday" && c.startsAt >= "2026-12-01")).toEqual([]);
    const second = await prepareMonth(admin, MONTH);
    expect(second.created).toBe(0);
    expect(second.drafts.map((d) => d.id)).toEqual(first.drafts.map((d) => d.id));
  });

  test("uplynulý měsíc odmítne", async () => {
    await expect(prepareMonth(admin, "2026-10")).rejects.toMatchObject({ code: "invalid_state" });
  });

  test("doporučí téma se zájmem jen návrhu bez tématu a stejné téma nenabídne dvakrát", async () => {
    await setInterest(participant, "topic-preparation", true);
    const prep = await prepareMonth(admin, MONTH);
    const withTopic = prep.drafts.filter((d) => d.topicTitle);
    expect(withTopic.length).toBe(prep.withTopic);
    for (const id of Object.keys(prep.suggestions)) expect(prep.drafts.find((d) => d.id === id)?.topicTitle).toBeNull();
    const names = [...withTopic.map((d) => d.topicTitle), ...Object.values(prep.suggestions).map((s) => s.name)];
    expect(new Set(names).size).toBe(names.length);
    expect(Object.values(prep.suggestions).every((s) => s.interestCount > 0)).toBe(true);
  });

  test("návrhy z průvodce jdou zveřejnit hromadným zveřejněním", async () => {
    const prep = await prepareMonth(admin, MONTH);
    const { published, skipped } = await publishDrafts(admin, MONTH, prep.drafts.map((d) => ({ id: d.id, revision: d.revision, topicTitle: d.topicTitle, leadId: d.leadId })));
    expect(published.length).toBe(prep.drafts.length);
    expect(skipped).toBe(0);
    expect((await prepareMonth(admin, MONTH)).drafts).toEqual([]);
  });
});
