import { describe, expect, test } from "vitest";
import { todayRecordingTask } from "@/server/services/journey";

// Rozhodnutí vlastníka k otázkám auditu P1 (23. 11. 2026), viz docs/audit-2026-11-23/p1-temata-zapisy-uvod-kalendar.md.
describe("audit P1: úkol nahrávky v ukázce mluví pravdu", () => {
  test("úkol slibuje jen ukázkovou nahrávku, ne automatické zpracování libovolné nahrávky", () => {
    const task = todayRecordingTask("Trénink RM · 12. 11.");
    expect(task.title).toContain("ukázkovou nahrávku");
    expect(task.detail).toContain("přepíše jen ukázkovou nahrávku");
    expect(`${task.title} ${task.detail}`).not.toMatch(/připraví sám|automaticky|\bAI\b/);
  });
});
