import { describe, expect, it } from "vitest";
import { greeting } from "@/lib/greeting";
import { normalizeSalutation } from "@/server/services/salutation";

describe("D03: vlastní oslovení", () => {
  it("platné oslovení se očistí, prázdné znamená smazat", () => {
    expect(normalizeSalutation("  Aničko  ")).toBe("Aničko");
    expect(normalizeSalutation("Jan  Pavle")).toBe("Jan Pavle");
    expect(normalizeSalutation("Marie-Terezo")).toBe("Marie-Terezo");
    expect(normalizeSalutation("   ")).toBe("");
  });
  it("odmítne jiný text než jméno a příliš dlouhé oslovení", () => {
    expect(normalizeSalutation("<script>")).toBeNull();
    expect(normalizeSalutation("Ano, klikni sem: http://x")).toBeNull();
    expect(normalizeSalutation("A".repeat(41))).toBeNull();
    expect(normalizeSalutation("-Anno")).toBeNull();
  });
  it("vlastní oslovení má přednost před slovníkem, bez něj platí slovník", () => {
    expect(greeting("Anna Nováková", "Aničko")).toBe("Ahoj, Aničko");
    expect(greeting("Anna Nováková", null)).toBe("Ahoj, Anno");
    expect(greeting("Xaver Novák", null)).toBe("Ahoj");
  });
});
