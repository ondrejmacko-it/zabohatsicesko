import { describe, expect, test } from "vitest";
import { draftBreakdown, draftHint, isPickable, monthSummary } from "@/features/vzdelavani/status";
import type { EventCard } from "@/server/services/events";

// Jen pole, která rozpad čte; zbytek karty je pro tato pravidla lhostejný.
const card = (id: string, over: Partial<EventCard>): EventCard =>
  ({ id, type: "workshop", planStatus: "draft", startsAt: "2026-12-10T09:00:00.000Z", past: false, revision: 1, topicTitle: "Téma", leadName: "Vedoucí", unpublishedChanges: false, ...over }) as EventCard;

describe("štítek Návrhy: rozpad podle toho, co jde hromadně vybrat a zveřejnit", () => {
  const cards = [
    card("novy", {}),
    card("minuly", { past: true }),
    card("neuplny", { topicTitle: null }),
    card("zmena", { planStatus: "published", unpublishedChanges: true }),
    card("zverejnena", { planStatus: "published" }),
    card("svatek", { type: "holiday" }),
    card("jiny-mesic", { startsAt: "2027-01-05T09:00:00.000Z" }),
  ];

  test("součet sedí se souhrnem měsíce a nové návrhy s hromadným výběrem", () => {
    const b = draftBreakdown(cards, "2026-12");
    expect(b).toEqual({ total: 4, fresh: 3, changes: 1, past: 1, incomplete: 1 });
    expect(b.total).toBe(monthSummary(cards, "2026-12").toPublish);
    expect(cards.filter((c) => c.startsAt.startsWith("2026-12") && isPickable(c)).length).toBe(b.fresh);
  });

  test("nápověda vyjmenuje jen nenulové části", () => {
    expect(draftHint(draftBreakdown(cards, "2026-12"))).toBe(
      "3 nové návrhy, 1 změna zveřejněné akce (zveřejní se v okně akce), 1 v minulosti jde jen smazat, 1 bez tématu nebo vedoucího.",
    );
    expect(draftHint(draftBreakdown([card("a", {})], "2026-12"))).toBe("1 nový návrh.");
  });
});
