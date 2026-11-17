import { describe, expect, test } from "vitest";
import { isRecommendable, mostWantedIds, rankTopics, sortByInterest, suggestTopics, type RankedTopic } from "@/server/domain/topics";

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

describe("pořadí seznamu Témat a štítek Nejžádanější", () => {
  const t = (id: string, name: string, interestCount: number, nextPlanned: string | null = null) => ({ ...topic(id, interestCount, nextPlanned), name });

  test("řadí podle zájmu sestupně, při shodě abecedně a podle ID", () => {
    const sorted = sortByInterest([t("1", "Účetnictví", 2), t("2", "Banky", 5), t("3", "Akcie", 2), t("5", "Akcie", 2), t("4", "Daně", 0)]);
    expect(sorted.map((x) => x.id)).toEqual(["2", "3", "5", "1", "4"]);
  });

  test("pořadí nezávisí na pořadí vstupu", () => {
    const input = [t("a", "Alfa", 1), t("b", "Beta", 1), t("c", "Gama", 3)];
    expect(sortByInterest([...input].reverse()).map((x) => x.id)).toEqual(sortByInterest(input).map((x) => x.id));
  });

  test("Nejžádanější jsou nejvýš tři témata se zájmem a naplánované téma se nevyřazuje", () => {
    const ids = mostWantedIds([t("a", "A", 4, "2026-12-01"), t("b", "B", 3), t("c", "C", 2), t("d", "D", 1), t("e", "E", 0)]);
    expect([...ids]).toEqual(["a", "b", "c"]);
  });

  test("zájem jen u dvou témat označí jen dvě, nulový zájem nikdy", () => {
    expect([...mostWantedIds([t("a", "A", 1), t("b", "B", 2), t("c", "C", 0), t("d", "D", 0)])]).toEqual(["b", "a"]);
    expect(mostWantedIds([t("a", "A", 0), t("b", "B", 0)]).size).toBe(0);
  });

  test("prezentační pořadí nemění plánovací rankTopics", () => {
    const stats = [t("a", "A", 5, "2026-12-01"), t("b", "B", 1)];
    expect(rankTopics(stats).map((x) => x.id)).toEqual(["b", "a"]);
    expect(sortByInterest(stats).map((x) => x.id)).toEqual(["a", "b"]);
  });
});
