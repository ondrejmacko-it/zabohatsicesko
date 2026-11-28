import { describe, expect, it } from "vitest";
import { calendarStatus } from "@/lib/calendar-note";

// Stav Kalendáře v přehledu účasti: problém jen tam, kde se Kalendář rozchází s účastí ve Wiki.
describe("calendarStatus", () => {
  const personal = (link: "none" | "synced" | "pending" | "attention", inCalendar: boolean) => ({ link, inCalendar, personal: true });

  it("zrušená akce a akce, které se člověka netýká, stav nemají", () => {
    expect(calendarStatus("cancelled", personal("synced", false))).toBeNull();
    expect(calendarStatus("optional", personal("synced", false))).toBeNull();
  });

  it("osobní Kalendář: shoda je v pořádku, rozdíl je problém", () => {
    expect(calendarStatus("required", personal("synced", true))).toEqual({ label: "V Kalendáři", problem: false });
    expect(calendarStatus("excused", personal("synced", false))).toEqual({ label: "Mimo Kalendář", problem: false });
    expect(calendarStatus("required", personal("synced", false))).toEqual({ label: "V Kalendáři chybí", problem: true });
    expect(calendarStatus("withdrawn", personal("synced", true))).toEqual({ label: "V Kalendáři přebývá", problem: true });
  });

  it("chyba zápisu a nepropojený kalendář u očekávaného účastníka jsou problém", () => {
    expect(calendarStatus("voluntary_enrolled", personal("attention", false))?.problem).toBe(true);
    expect(calendarStatus("required", personal("none", false))).toEqual({ label: "Nepropojený Kalendář", problem: true });
    expect(calendarStatus("excused", personal("none", false))?.problem).toBe(false);
    expect(calendarStatus("required", personal("pending", false))).toEqual({ label: "Aktualizuje se", problem: false });
  });

  it("pozvánky: ruční host se nehlásí jako problém, neznámý stav také ne", () => {
    expect(calendarStatus("required", { link: "synced", inCalendar: false })).toEqual({ label: "Ručně spravováno", problem: false });
    expect(calendarStatus("required", null)).toEqual({ label: "Nelze ověřit", problem: false });
  });
});
