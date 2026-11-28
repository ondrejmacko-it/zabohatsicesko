import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ManagedExcuses } from "@/features/vzdelavani/components/ManagedExcuses";
import { ParticipationPanel } from "@/features/vzdelavani/components/ParticipationPanel";

// C03: důvod a poznámka omluvy jsou citlivé. Snímek obrazovky ve zpětné vazbě je musí začernit
// (`data-feedback-redact`), vysvětlující text kolem zůstává čitelný.
const NOTE = "Fiktivní poznámka k omluvě";
// Obsah prvků s `data-feedback-redact` (bez DOM prostředí: komponenty v nich nevnořují stejný tag).
const redacted = (html: string) =>
  [...html.matchAll(/<(\w+)[^>]*data-feedback-redact=""[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2]!.replace(/<[^>]+>/g, ""));

describe("C03: redakce omluv na snímku", () => {
  test("vlastní omluva v panelu účasti", () => {
    const html = renderToStaticMarkup(
      createElement(ParticipationPanel, { eventId: "e1", state: "excused", actions: [], excuse: { reason: "illness", note: NOTE } }),
    );
    const parts = redacted(html);
    expect(parts.some((text) => text.includes(NOTE))).toBe(true);
    expect(parts.join(" ")).not.toContain("Důvod vidíš jen ty");
  });

  test("omluvy lidí pro nadřízeného", () => {
    const html = renderToStaticMarkup(createElement(ManagedExcuses, { excuses: [{ name: "Fiktivní Kolega", reason: "other", note: NOTE }] }));
    const text = redacted(html).join(" ");
    expect(text).toContain("Fiktivní Kolega");
    expect(text).toContain(NOTE);
  });
});
