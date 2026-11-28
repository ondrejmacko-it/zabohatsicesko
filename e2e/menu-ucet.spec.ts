import { expect, test } from "@playwright/test";
import { authFile } from "./support";

// Bod 8: panel Účet se drží v okně, nezavře ho vysunutá klávesnice (změna výšky okna), Esc a křížek vrátí
// fokus na tlačítko a rozepsané oslovení přežije zavření.
test.describe("menu Účet: pozice, zavírání a fokus", () => {
  test.use({ storageState: authFile("ucastnikRm") });

  test("panel v okně i s rozbaleným oslovením, resize ho nezavře, Esc a křížek vrátí fokus", async ({ page }) => {
    await page.goto("/");
    const menu = page.locator(".account-menu");
    const trigger = menu.getByRole("button", { name: "Účet", exact: true });
    const panel = menu.locator(".account-panel");
    await trigger.click();
    await expect(panel).toBeVisible();
    await menu.getByText("Upravit oslovení").click();
    const input = panel.getByLabel(/Jak tě máme oslovovat/);
    await input.fill("Rozepsáno");

    const viewport = page.viewportSize()!;
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    const inputBox = (await input.boundingBox())!;
    expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(viewport.width + 0.5);

    // Klávesnice na telefonu zmenší okno: panel musí zůstat otevřený i s textem.
    await page.setViewportSize({ width: viewport.width, height: Math.round(viewport.height * 0.55) });
    await expect(panel).toBeVisible();
    await expect(input).toHaveValue("Rozepsáno");
    await page.setViewportSize(viewport);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(input).toHaveValue("Rozepsáno");
    await panel.getByRole("button", { name: "Zavřít" }).click();
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  // Ukázka nemá osobní kalendáře (CALENDAR_DELIVERY není personal): sekce se nezobrazí ani tlačítko synchronizace.
  test("ukázka bez osobních kalendářů sekci Google Kalendář neukazuje", async ({ page }) => {
    await page.goto("/");
    const menu = page.locator(".account-menu");
    await menu.getByRole("button", { name: "Účet", exact: true }).click();
    await expect(menu.locator(".account-panel")).toBeVisible();
    await expect(menu.getByTestId("ucet-kalendar")).toHaveCount(0);
    await expect(menu.getByRole("button", { name: "Synchronizovat teď" })).toHaveCount(0);
  });
});
