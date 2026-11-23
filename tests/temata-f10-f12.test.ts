import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { defaultTopicFilter, filterTopics, isTopicForRoles, parseTopicFilter, rankTopics } from "@/server/domain/topics";
import { canSeeTopic } from "@/server/policy";
import { listTopicInterested, listTopics, moveTopic, placeTopic, proposeTopic, resetTopicOrder, setInterest, setTopicPriority } from "@/server/services/topics";
import { DomainError } from "@/server/services/errors";
import { lead, organizer, outsider, participant, resetDemo } from "./helpers";

const code = (p: Promise<unknown>) => p.then(() => "ok", (e: unknown) => (e instanceof DomainError ? e.code : String(e)));

describe("F10 filtr Pro mou roli / Všechna: pravidla", () => {
  const topics = [
    { id: "a", audience: "vsichni" },
    { id: "b", audience: "fp" },
    { id: "c", audience: "rm" },
    { id: "d", audience: "tym-a" },
  ];

  test("téma pro všechny patří každému, jinak rozhoduje pracovní role nebo skupina", () => {
    expect(isTopicForRoles("vsichni", [])).toBe(true);
    expect(isTopicForRoles("fp", ["fp"])).toBe(true);
    expect(isTopicForRoles("rm", ["fp"])).toBe(false);
    expect(isTopicForRoles("tym-a", ["fp", "tym-a"])).toBe(true);
  });

  test("víc rolí = témata všech rolí, bez duplicit a ve stejném pořadí", () => {
    expect(filterTopics(topics, ["fp", "rm", "vedouci-tymu"], "role").map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(filterTopics(topics, ["fp"], "role").map((t) => t.id)).toEqual(["a", "b"]);
    expect(filterTopics(topics, ["fp"], "all").map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
  });

  test("technická role se nepočítá: správce bez pracovní role má v Pro mou roli jen témata pro všechny", () => {
    expect(filterTopics(topics, [], "role").map((t) => t.id)).toEqual(["a"]);
  });

  test("výchozí filtr: kolega Pro mou roli, správce Všechna; neznámá hodnota = výchozí", () => {
    expect(defaultTopicFilter(false)).toBe("role");
    expect(defaultTopicFilter(true)).toBe("all");
    expect(parseTopicFilter(undefined, false)).toBe("role");
    expect(parseTopicFilter("vse", false)).toBe("all");
    expect(parseTopicFilter("role", true)).toBe("role");
    expect(parseTopicFilter(["vse", "role"], false)).toBe("all");
    expect(parseTopicFilter("cokoli", true)).toBe("all");
  });

  test("viditelnost tématu: v režimu všech zveřejněných každý, jinak jen vlastní skupiny", () => {
    expect(canSeeTopic(outsider, "fp", "audience")).toBe(false);
    expect(canSeeTopic(outsider, "rm", "audience")).toBe(true);
    expect(canSeeTopic(outsider, "fp", "all-published")).toBe(true);
    expect(canSeeTopic(organizer, "fp", "audience")).toBe(true);
  });
});

describe("F12 texty", () => {
  test("doporučení už nepíše „zatím neproběhlo“, ostatní údaje zůstávají", () => {
    const [never, held] = rankTopics([
      { id: "x", name: "X", audience: "fp", interestCount: 2, interestedByViewer: false, lastHeld: null, nextPlanned: null },
      { id: "y", name: "Y", audience: "fp", interestCount: 1, interestedByViewer: false, lastHeld: "2026-10-14", nextPlanned: "2026-12-02" },
    ]);
    expect(never!.reason).toBe("2 zájemci");
    expect(held!.reason).toBe("1 zájemce · naposledy 14. 10. · naplánováno na 2. 12.");
  });
});

describe("F10 a F11 na serveru", () => {
  beforeEach(resetDemo);
  afterEach(() => vi.unstubAllEnvs());

  test("v nouzovém audience režimu je zachován původní omezený seznam", async () => {
    vi.stubEnv("EVENT_VISIBILITY", "audience");
    expect((await listTopics(outsider)).some((t) => t.audience === "fp")).toBe(false);
    expect(await code(setInterest(outsider, "topic-questions", true))).toBe("not_found");
  });

  test("režim všech zveřejněných: kolega vidí i cizí témata a může je podpořit, navrhnout jen pro svou skupinu", async () => {
    vi.stubEnv("EVENT_VISIBILITY", "all-published");
    const seen = await listTopics(outsider);
    expect(seen.some((t) => t.audience === "fp")).toBe(true);
    expect(await code(setInterest(outsider, "topic-questions", true))).toBe("ok");
    expect((await listTopics(outsider)).find((t) => t.id === "topic-questions")!.interestedByViewer).toBe(true);
    expect(await code(proposeTopic(outsider, "Cizí skupina", "fp"))).toBe("forbidden");
    // Jména zájemců dál jen správce.
    expect(await code(listTopicInterested(outsider))).toBe("forbidden");
  });

  test("ostrá Wiki sdílí témata všech rolí, ale ne právo je spravovat", async () => {
    vi.stubEnv("EVENT_VISIBILITY", "all-published");
    vi.stubEnv("WIKI_MODE", "production");
    expect((await listTopics(outsider)).some((t) => t.audience === "fp")).toBe(true);
    expect(await code(proposeTopic(outsider, "Cizí role", "fp"))).toBe("forbidden");
  });

  test("F11: pořadí mění jen správce, i v režimu všech zveřejněných a i kolega s více rolemi", async () => {
    vi.stubEnv("EVENT_VISIBILITY", "all-published");
    for (const viewer of [participant, outsider, lead]) {
      expect(await code(moveTopic(viewer, "topic-priority", "up"))).toBe("forbidden");
      expect(await code(placeTopic(viewer, "topic-priority", "guaranteed", 0))).toBe("forbidden");
      expect(await code(setTopicPriority(viewer, "topic-priority", true))).toBe("forbidden");
      expect(await code(resetTopicOrder(viewer))).toBe("forbidden");
    }
    expect(await code(placeTopic(organizer, "topic-questions", "guaranteed", 0))).toBe("ok");
  });
});
