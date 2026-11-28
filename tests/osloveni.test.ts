import { describe, expect, it } from "vitest";
import { greeting, vocativeName } from "@/lib/greeting";

// F17 + D03: oslovení v 5. pádě z jednoho místa, neznámé jméno = neutrální pozdrav.
describe("oslovení jménem", () => {
  it("zná běžná jména v 5. pádě", () => {
    expect(greeting("Anna Nováková")).toBe("Ahoj, Anno");
    expect(greeting("Petr Svoboda")).toBe("Ahoj, Petře");
    expect(greeting("Zdeněk Král")).toBe("Ahoj, Zdeňku");
    expect(greeting("Marek")).toBe("Ahoj, Marku");
    expect(greeting("Lucie Malá")).toBe("Ahoj, Lucie");
    expect(greeting("Jiří Dvořák")).toBe("Ahoj, Jiří");
  });

  it("neznámý tvar nehádá a pozdraví neutrálně", () => {
    expect(greeting("Správce ZBC ukázky")).toBe("Ahoj");
    expect(greeting("Účastník – finanční poradce")).toBe("Ahoj");
    expect(greeting("Xaver Neznámý")).toBe("Ahoj");
    expect(greeting("")).toBe("Ahoj");
    expect(greeting(undefined)).toBe("Ahoj");
    expect(vocativeName("Annabela Nováková")).toBeNull();
  });

  it("vlastní nastavená podoba má přednost a je oříznutá", () => {
    expect(greeting("Anna Nováková", "Aničko")).toBe("Ahoj, Aničko");
    expect(greeting("Xaver Neznámý", "  Xavere ")).toBe("Ahoj, Xavere");
    expect(greeting("Anna Nováková", "   ")).toBe("Ahoj, Anno");
    expect(vocativeName("x", "a".repeat(80))).toHaveLength(40);
  });

  it("jméno pozná bez ohledu na velikost písmen a rozložené znaky, systémové účty neosloví", () => {
    expect(greeting("ANNA NOVÁKOVÁ")).toBe("Ahoj, Anno");
    expect(greeting("šárka Malá")).toBe("Ahoj, Šárko");
    expect(greeting("S\u030Cimon Dlouhý")).toBe("Ahoj, Šimone");
    expect(greeting("Admin")).toBe("Ahoj");
    expect(greeting("info@firma.cz")).toBe("Ahoj");
    expect(greeting("Jan-Křtitel Maria von Habsburg-Lothringen")).toBe("Ahoj");
  });
});
