import { describe, expect, test } from "vitest";
import { isRecommendable, suggestTopics, type RankedTopic } from "@/server/domain/topics";

const topic = (id: string, interestCount: number, nextPlanned: string | null = null): RankedTopic => ({
  id,
  name: id,
  audience: "vsichni",
  interestCount,
  interestedByViewer: false,
  lastHeld: null,
  nextPlanned,
  reason: "",
});

describe("doporučená témata", () => {
  test("doporučí jen nenaplánované téma s aspoň jedním zájemcem", () => {
    expect(isRecommendable(topic("a", 1))).toBe(true);
    expect(isRecommendable(topic("b", 0))).toBe(false);
    expect(isRecommendable(topic("c", 3, "2026-12-01"))).toBe(false);
  });

  test("návrh měsíce nepřiřadí téma bez zájemců", () => {
    const slots = [{ generationKey: "s1", type: "education-fp" as const, audience: "fp" }];
    expect(suggestTopics(slots, [topic("bez-zajmu", 0)], new Set()).size).toBe(0);
    expect(suggestTopics(slots, [topic("bez-zajmu", 0), topic("se-zajmem", 2)], new Set()).get("s1")?.id).toBe("se-zajmem");
  });
});
