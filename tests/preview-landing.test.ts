import { describe, expect, it } from "vitest";
import { previewLanding } from "@/lib/preview-landing";

describe("previewLanding", () => {
  it("ze Správy a Integrací vede účastníka na Domů", () => {
    expect(previewLanding("/sprava", false)).toBe("/");
    expect(previewLanding("/sprava?q=anna", false)).toBe("/");
    expect(previewLanding("/vzdelavani/integrace", false)).toBe("/");
  });
  it("náhled správce na Správě zůstává", () => {
    expect(previewLanding("/sprava?q=anna", true)).toBe("/sprava?q=anna");
  });
  it("detail akce vede na Plán", () => {
    expect(previewLanding("/vzdelavani/akce/ev-1", false)).toBe("/vzdelavani/harmonogram");
  });
  it("zavře otevřené okno, filtry nechá", () => {
    expect(previewLanding("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-1&typ=trenink", false)).toBe(
      "/vzdelavani/harmonogram?mesic=2026-11&typ=trenink",
    );
    expect(previewLanding("/?akce=ev-1", false)).toBe("/");
    expect(previewLanding("/vzdelavani/temata?tema=t1&hledat=klient", false)).toBe("/vzdelavani/temata?hledat=klient");
  });
  it("podobná cesta není Správa", () => {
    expect(previewLanding("/spravani", false)).toBe("/spravani");
  });
});
