import { beforeEach, describe, expect, it } from "vitest";
import { listMissingMinutes } from "@/server/services/journey";
import { listTopicInterested, listTopics, setInterest } from "@/server/services/topics";
import { lead, organizer, outsider as memberRm, participant as memberFp, resetDemo } from "./helpers";

beforeEach(resetDemo);

describe("zájemci o téma", () => {
  it("jména vidí jen organizátor, ostatní dostanou zamítnutí", async () => {
    const [topic] = await listTopics(memberFp);
    await setInterest(memberFp, topic!.id, true);
    const names = await listTopicInterested(organizer);
    expect(names.get(topic!.id)).toContain("Účastník FP");
    await expect(listTopicInterested(memberFp)).rejects.toMatchObject({ code: "forbidden" });
    await expect(listTopicInterested(lead)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("akce bez zápisu pro okno Přidat zápis", () => {
  it("vedoucí vidí své akce a smí je řešit, organizátor vidí přehled bez práva nahrát", async () => {
    const mine = await listMissingMinutes(lead);
    expect(mine.handlesAny).toBe(true);
    expect(mine.items.length).toBeGreaterThan(0);
    expect(mine.items.every((item) => item.canHandle)).toBe(true);

    const overview = await listMissingMinutes(organizer);
    expect(overview.items.length).toBeGreaterThanOrEqual(mine.items.length);
    expect(overview.items.some((item) => item.canHandle)).toBe(false);
  });

  it("účastník bez vedené akce nevidí nic", async () => {
    for (const viewer of [memberFp, memberRm]) {
      const result = await listMissingMinutes(viewer);
      expect(result).toEqual({ items: [], handlesAny: false });
    }
  });
});
