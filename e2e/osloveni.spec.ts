import { expect, test } from "@playwright/test";
import { authFile } from "./support";

test.describe("D03: vlastní oslovení na Domů @desktop", () => {
  test.use({ storageState: authFile("ucastnikRm") });

  test("uložit, odmítnout neplatné a vrátit oslovení podle jména", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Upravit oslovení").click();
    await page.getByLabel(/Jak tě máme oslovovat/).fill("Kolego");
    await page.getByRole("button", { name: "Uložit" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ahoj, Kolego.");

    await page.getByText("Upravit oslovení").click();
    await page.getByLabel(/Jak tě máme oslovovat/).fill("<b>x</b>");
    await page.getByRole("button", { name: "Uložit" }).click();
    await expect(page.getByText(/Použij jen písmena/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ahoj, Kolego.");

    await page.getByLabel(/Jak tě máme oslovovat/).fill("");
    await page.getByRole("button", { name: "Uložit" }).click();
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/Kolego/);
  });
});
