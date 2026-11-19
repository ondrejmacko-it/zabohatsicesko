import { describe, expect, test } from "vitest";
import { draftGaps, fillEmptyLeads, prepareOverview, rowsMissingLead, type DraftRowState } from "@/features/vzdelavani/prepare-month";

const row = (id: string, over: Partial<DraftRowState> = {}): DraftRowState => ({
  id,
  holiday: false,
  topic: true,
  lead: true,
  clash: false,
  picked: false,
  ...over,
});

describe("stav návrhu v okně Připravit měsíc", () => {
  test("chybějící téma a vedoucí v pořadí textu, svátek nepotřebuje nic", () => {
    expect(draftGaps(row("a", { topic: false, lead: false }))).toEqual(["téma", "vedoucí"]);
    expect(draftGaps(row("a", { lead: false }))).toEqual(["vedoucí"]);
    expect(draftGaps(row("a"))).toEqual([]);
    expect(draftGaps(row("s", { holiday: true, topic: false, lead: false }))).toEqual([]);
  });

  test("přehled počítá kategorie a cílí na první dotčený řádek v pořadí okna", () => {
    const rows = [
      row("a", { picked: true }),
      row("b", { lead: false, picked: true }),
      row("c", { topic: false, lead: false, clash: true }),
      row("d", { clash: true }),
      row("s", { holiday: true, topic: false, lead: false }),
    ];
    const byKey = Object.fromEntries(prepareOverview(rows).map((item) => [item.key, item]));
    expect(byKey.ready).toEqual({ key: "ready", count: 2, firstId: "a" });
    expect(byKey.missingLead).toEqual({ key: "missingLead", count: 2, firstId: "b" });
    expect(byKey.missingTopic).toEqual({ key: "missingTopic", count: 1, firstId: "c" });
    expect(byKey.clash).toEqual({ key: "clash", count: 2, firstId: "c" });
    expect(byKey.picked).toEqual({ key: "picked", count: 2, firstId: "a" });
  });

  test("prázdná kategorie nemá cíl přechodu a pořadí kategorií je pevné", () => {
    const overview = prepareOverview([row("a")]);
    expect(overview.map((item) => item.key)).toEqual(["ready", "missingLead", "missingTopic", "clash", "picked"]);
    expect(overview.find((item) => item.key === "clash")).toEqual({ key: "clash", count: 0, firstId: null });
  });
});

describe("hromadné doplnění vedoucího", () => {
  test("zapíše jen do prázdných polí a vyplněné nikdy nepřepíše", () => {
    const { leads, filled } = fillEmptyLeads({ a: "", b: "u-jana", c: "" }, "u-petr");
    expect(filled).toEqual(["a", "c"]);
    expect(leads).toEqual({ a: "u-petr", b: "u-jana", c: "u-petr" });
  });

  test("svátek přeskočí, bez vybraného vedoucího nic nemění", () => {
    expect(fillEmptyLeads({ a: "", s: "" }, "u-petr", new Set(["s"]))).toEqual({ leads: { a: "u-petr", s: "" }, filled: ["a"] });
    const before = { a: "" };
    expect(fillEmptyLeads(before, "")).toEqual({ leads: before, filled: [] });
  });

  test("počet dotčených řádků odpovídá tomu, co doplnění změní", () => {
    const rows = [row("a", { lead: false }), row("b"), row("s", { holiday: true, lead: false })];
    expect(rowsMissingLead(rows)).toEqual(["a"]);
    expect(fillEmptyLeads({ a: "", b: "u-jana", s: "" }, "u-petr", new Set(["s"])).filled).toEqual(rowsMissingLead(rows));
  });
});
