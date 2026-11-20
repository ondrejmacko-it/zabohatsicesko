import { describe, expect, test } from "vitest";
import { comparableText, eventContext, eventTitle } from "@/lib/labels";

describe("D-01: název akce bez opakování", () => {
  test("porovnání ignoruje diakritiku, velikost písmen a interpunkci", () => {
    expect(comparableText("Trénink  PORADCŮ – Q4!")).toBe("trenink poradcu q4");
  });

  test("téma, které obsahuje typ, nahradí celý název", () => {
    expect(eventTitle("Trénink poradců", "trenink poradcu – hypotéky")).toBe("trenink poradcu – hypotéky");
    expect(eventTitle("Trénink poradců", "Trénink poradců")).toBe("Trénink poradců");
  });

  test("název, který už téma obsahuje, se neprodlužuje", () => {
    expect(eventTitle("Workshop Hypotéky 2027", "hypotéky")).toBe("Workshop Hypotéky 2027");
  });

  test("běžný typ a téma se spojí dvojtečkou, bez tématu zůstane typ", () => {
    expect(eventTitle("Trénink poradců", "Hypotéky")).toBe("Trénink poradců: Hypotéky");
    expect(eventTitle("Trénink poradců", null)).toBe("Trénink poradců");
    expect(eventTitle("", "Hypotéky")).toBe("Hypotéky");
  });

  test("shoda jen v části slova se za duplicitu nepovažuje", () => {
    expect(eventTitle("Trénink RM", "Formulář")).toBe("Trénink RM: Formulář");
  });

  test("typ, který je v názvu, se znovu nepíše a skupinu dané už typ neopakuje", () => {
    expect(eventContext("Trénink poradců: Hypotéky", "training-fp", "fp")).toEqual([]);
    expect(eventContext("Trénink RM", "training-rm", "rm")).toEqual([]);
  });

  test("skupina odlišná od typu zůstane, i když je typ v názvu", () => {
    expect(eventContext("Trénink poradců", "training-fp", "vsichni")).toEqual(["Všichni"]);
  });

  test("vlastní název bez typu dostane typ i skupinu", () => {
    expect(eventContext("Hypotéky v praxi", "action", "tym-a")).toEqual(["Action time", "Tým A"]);
    expect(eventContext("Hypotéky v praxi", "training-fp", "fp")).toEqual(["Trénink poradců"]);
  });

  test("Jiná akce typ nemá, skupina v názvu se neopakuje", () => {
    expect(eventContext("Setkání Tým A", "other", "tym-a")).toEqual([]);
    expect(eventContext("Setkání", "other", "vsichni")).toEqual(["Všichni"]);
  });
});
