import { describe, expect, test } from "vitest";
import { groupByMonth } from "@/features/vzdelavani/minutes";
import { fromPragueLocal } from "@/lib/time";

const item = (id: string, date: string, time = "15:30") => ({ id, startsAt: fromPragueLocal(date, time).toISOString() });

describe("zápisy po měsících", () => {
  test("rozdělí zápisy do měsíců od nejnovějšího, i přes přelom roku", () => {
    const months = groupByMonth([item("b", "2026-11-05"), item("d", "2025-12-18"), item("a", "2026-11-12"), item("c", "2026-10-29")]);
    expect(months.map(([month, items]) => [month, items.map((i) => i.id)])).toEqual([
      ["2026-11", ["a", "b"]],
      ["2026-10", ["c"]],
      ["2025-12", ["d"]],
    ]);
  });

  test("měsíc se počítá v pražském čase", () => {
    // 31. 10. 23:30 v Praze je v UTC ještě říjen, 1. 11. 00:30 v Praze je v UTC pořád 31. 10.
    const months = groupByMonth([item("pozde", "2026-10-31", "23:30"), item("brzy", "2026-11-01", "00:30")]);
    expect(months.map(([month, items]) => [month, items.map((i) => i.id)])).toEqual([
      ["2026-11", ["brzy"]],
      ["2026-10", ["pozde"]],
    ]);
  });

  test("prázdný výpis nemá žádný měsíc", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
