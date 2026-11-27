import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Bod 4 auditu: Pohled v liště je vlastní nabídka místo nativního <select> (ten na Androidu zakryl celou
// obrazovku). Pole nejde přepsat (bez klávesnice na telefonu), nabídka má skupiny a vejde se do okna.

const bar = (page: import("@playwright/test").Page) => page.getByTestId("pruh-nahledu");

test.describe("Pohled v liště: výběr z nabídky", () => {
  test.use({ storageState: authFile("spravce") });

  for (const width of [320, 347, 390]) {
    test(`telefon ${width} px: nabídka se skupinami v okně, výběr přepne pohled`, async ({ page }, testInfo) => {
      test.skip(!testInfo.project.name.startsWith("telefon-390"), "šířky prochází jeden telefonní projekt");
      await page.setViewportSize({ width, height: 740 });
      await page.goto("/vzdelavani/harmonogram");
      await settle(page);
      const field = page.getByRole("combobox", { name: "Pohled" });
      await expect(field).toHaveValue("Můj pohled");
      await expect(field).toHaveJSProperty("readOnly", true);
      await expect(page.locator("select#pohled")).toHaveCount(0);

      await field.click();
      const list = page.getByRole("listbox", { name: "Pohledy" });
      await expect(list).toBeVisible();
      await expect(list.getByRole("group", { name: "Skupina" })).toBeVisible();
      await expect(list.getByRole("group", { name: "Kolega" })).toBeAttached();
      const panel = await page.locator(".view-switch .combobox-panel").boundingBox();
      expect(panel!.x).toBeGreaterThanOrEqual(0);
      expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
      expect(panel!.y + panel!.height).toBeLessThanOrEqual(740);
      await expectNoHorizontalScroll(page);

      await list.locator('[data-value="skupina-fp"]').click();
      await expect(bar(page)).toContainText("Finanční poradci");
      await expect(page).toHaveURL(/\/vzdelavani\/harmonogram/);
      await expect(page.getByRole("combobox", { name: "Pohled" })).not.toHaveValue("Můj pohled");
      await bar(page).getByRole("button", { name: "Ukončit pohled" }).click();
      await expect(bar(page)).toHaveCount(0);
    });
  }

  test("klávesnice: Enter otevře, šipka vybere, Esc zavře jen nabídku", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "windows-1280", "klávesnice na počítači");
    await page.goto("/");
    await settle(page);
    const field = page.getByRole("combobox", { name: "Pohled" });
    await field.focus();
    await page.keyboard.press("Enter");
    const list = page.getByRole("listbox", { name: "Pohledy" });
    await expect(list).toBeVisible();
    await expect(field).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await expect(bar(page)).toHaveCount(0);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(bar(page)).toBeVisible();
    await bar(page).getByRole("button", { name: "Ukončit pohled" }).click();
    await expect(bar(page)).toHaveCount(0);
  });
});
