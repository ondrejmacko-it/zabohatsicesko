import { expect, test } from "@playwright/test";
import { authFile } from "./support";

test.describe("D03: vlastní oslovení v menu Účet @desktop", () => {
  test.use({ storageState: authFile("ucastnikRm") });

  test("uložit, odmítnout neplatné a vrátit oslovení podle jména", async ({ page }) => {
    const menu = page.locator(".account-menu");
    const openForm = async () => {
      await menu.getByRole("button", { name: "Účet" }).click();
      await menu.getByText("Upravit oslovení").click();
    };
    await page.goto("/");
    // Na Domů zůstává jen pozdrav, oslovení se mění v menu Účet.
    await expect(page.locator("main").getByText("Upravit oslovení")).toHaveCount(0);
    await openForm();
    await menu.getByLabel(/Jak tě máme oslovovat/).fill("Kolego");
    await menu.getByRole("button", { name: "Uložit" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ahoj, Kolego.");

    await openForm();
    await menu.getByLabel(/Jak tě máme oslovovat/).fill("<b>x</b>");
    await menu.getByRole("button", { name: "Uložit" }).click();
    // Chybné uložení se vrátí na Domů s otevřeným polem a vysvětlením.
    const main = page.locator("main");
    await expect(main.getByText(/Použij jen písmena/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ahoj, Kolego.");

    await main.getByLabel(/Jak tě máme oslovovat/).fill("");
    await main.getByRole("button", { name: "Uložit" }).click();
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/Kolego/);
  });
});
