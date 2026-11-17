import { describe, expect, test } from "vitest";
import { slotConflict, type Occupant } from "@/server/domain/generation";

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 11, 1, h, m));
const slot = { start: at(9), end: at(11), audience: "fp", type: "education-fp", dateKey: "2026-12-01" };
const occ = (o: Partial<Occupant>): Occupant => ({ startsAt: at(9), endsAt: at(11), audience: "fp", type: "other", dateKey: "2026-12-01", ...o });

describe("obsazení termínu Pravidelného týdne", () => {
  test("ruční akce na stejném slotu pro stejnou skupinu termín přeskočí", () => {
    expect(slotConflict(slot, [occ({})])).toBe("skip");
  });
  test("akce jiné skupiny ve stejný čas termín neblokuje (paralelní školení)", () => {
    expect(slotConflict(slot, [occ({ audience: "rm" })])).toBeNull();
    expect(slotConflict(slot, [occ({ audience: "rm" }), occ({ audience: "tym-a" })])).toBeNull();
  });
  test("částečný překryv u stejné skupiny přeskočí, navazující čas ne", () => {
    expect(slotConflict(slot, [occ({ startsAt: at(10, 30), endsAt: at(12) })])).toBe("skip");
    expect(slotConflict(slot, [occ({ startsAt: at(11), endsAt: at(12) })])).toBeNull();
  });
  test("akce pro všechny ve stejný čas jen varuje", () => {
    expect(slotConflict(slot, [occ({ audience: "vsichni" })])).toBe("warn");
  });
  test("stejný typ pro stejnou skupinu ve stejný den v jiném čase varuje", () => {
    expect(slotConflict(slot, [occ({ type: "education-fp", startsAt: at(14), endsAt: at(15) })])).toBe("warn");
  });
  test("prázdný měsíc nic neblokuje", () => {
    expect(slotConflict(slot, [])).toBeNull();
  });
});
