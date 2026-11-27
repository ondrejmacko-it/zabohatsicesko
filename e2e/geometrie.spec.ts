import { authFile, expect, expectNoHorizontalScroll, lineCount, settle, test } from "./support";

/*
 * Geometrie seznamů: datum a čas se nesmí lámat po znacích, název nesmí být stlačený vedle úzkých sloupců.
 * Testy padají na rozložení, které jsme v tomto kole opravili (např. 5sloupcová mřížka Zápisů k dokončení).
 */

test.describe("Zápisy k dokončení", () => {
  test.use({ storageState: authFile("spravce") });
  test("datum je na jednom řádku a název má šířku", async ({ page }) => {
    await page.goto("/vzdelavani/zapisy");
    await settle(page);
    await page.getByRole("link", { name: /^K dokončení/ }).click();
    const picker = page.getByRole("dialog", { name: "Zápisy k dokončení" });
    await expect(picker).toBeVisible();
    const rows = picker.locator(".missing-row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      expect(await lineCount(row.locator(".missing-date")), "datum na jednom řádku").toBe(1);
      expect(await lineCount(row.locator(".missing-action")), "tlačítko na jednom řádku").toBe(1);
      expect(await lineCount(row.locator(".missing-title")), "název nejvýš na 2 řádky").toBeLessThanOrEqual(2);
    }
    await expectNoHorizontalScroll(page);
  });
});
