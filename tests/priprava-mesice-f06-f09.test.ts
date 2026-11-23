import { describe, expect, test } from "vitest";
import { fillEmptyTopics, matchesOverview, publishBlockedReason, rowsMissingTopic, type DraftRowState } from "@/features/vzdelavani/prepare-month";

// F08 a F09: hromadné téma, filtr řádků podle štítku přehledu a důvod šedého „Zveřejnit“.

const row = (id: string, over: Partial<DraftRowState> = {}): DraftRowState => ({
  id,
  holiday: false,
  topic: true,
  lead: true,
  clash: false,
  picked: true,
  ...over,
});

describe("hromadné doplnění tématu (F08)", () => {
  test("zapíše jen do prázdných polí, vyplněné téma nepřepíše, svátek přeskočí", () => {
    const { topics, filled } = fillEmptyTopics({ a: "", b: "Hypotéky", c: "  ", s: "" }, "Pojištění", new Set(["s"]));
    expect(filled).toEqual(["a", "c"]);
    expect(topics).toEqual({ a: "Pojištění", b: "Hypotéky", c: "Pojištění", s: "" });
  });

  test("bez vybraného tématu nic nemění, text se ořízne", () => {
    expect(fillEmptyTopics({ a: "" }, "  ").filled).toEqual([]);
    expect(fillEmptyTopics({ a: "" }, " Investice ").topics.a).toBe("Investice");
  });

  test("počet dotčených řádků odpovídá tomu, co doplnění změní", () => {
    const rows = [row("a", { topic: false }), row("b"), row("s", { holiday: true, topic: false })];
    expect(rowsMissingTopic(rows)).toEqual(["a"]);
  });
});

describe("štítek přehledu filtruje řádky (F08)", () => {
  const rows = [row("a"), row("b", { topic: false }), row("c", { lead: false }), row("d", { clash: true, picked: false }), row("s", { holiday: true, topic: false, lead: false })];
  const ids = (key: Parameters<typeof matchesOverview>[0]) => rows.filter((r) => matchesOverview(key, r)).map((r) => r.id);

  test("Chybí téma ukáže jen řádky bez tématu, svátek ne", () => {
    expect(ids("missingTopic")).toEqual(["b"]);
  });

  test("ostatní štítky mají stejná pravidla jako počty v přehledu", () => {
    expect(ids("missingLead")).toEqual(["c"]);
    expect(ids("clash")).toEqual(["d"]);
    expect(ids("ready")).toEqual(["a", "s"]);
    expect(ids("picked")).toEqual(["a", "b", "c", "s"]);
  });
});

describe("proč je Zveřejnit šedé (F09)", () => {
  test("text ze zadání: téma i vedoucí chybí u všech neúplných", () => {
    const rows = Array.from({ length: 18 }, (_, i) => row(`r${i}`, { topic: false, lead: false }));
    expect(publishBlockedReason(rows, false)).toBe("Doplň téma a vedoucího u 18 akcí, nebo potvrď zveřejnění neúplných termínů.");
  });

  test("jen téma, jen vedoucí, kombinace a jedna akce", () => {
    expect(publishBlockedReason([row("a", { topic: false }), row("b")], false)).toMatch(/^Doplň téma u 1 akce,/);
    expect(publishBlockedReason([row("a", { lead: false }), row("b", { lead: false })], false)).toMatch(/^Doplň vedoucího u 2 akcí,/);
    expect(publishBlockedReason([row("a", { lead: false }), row("b", { topic: false }), row("c", { topic: false, lead: false })], false)).toMatch(
      /^Doplň téma u 2 akcí a vedoucího u 2 akcí,/,
    );
  });

  test("nevybrané a svátky se nepočítají, bez výběru říká, ať správce vybere", () => {
    expect(publishBlockedReason([row("a", { topic: false, picked: false }), row("b")], false)).toBeNull();
    expect(publishBlockedReason([row("s", { holiday: true, topic: false, lead: false })], false)).toBeNull();
    expect(publishBlockedReason([row("a", { picked: false })], false)).toBe("Vyber aspoň jeden návrh ke zveřejnění.");
  });

  test("potvrzení neúplných zveřejnění odemkne", () => {
    expect(publishBlockedReason([row("a", { topic: false })], true)).toBeNull();
    expect(publishBlockedReason([row("a", { picked: false })], true)).not.toBeNull();
  });
});
