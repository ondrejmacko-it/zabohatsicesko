import { expect, test } from "@playwright/test";
import { authFile } from "./support";

// H: hledání v seznamu témat (velký počet témat) a pozastavené řazení během hledání.
test.describe("Témata: hledání @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("hledání bez diakritiky skryje ostatní témata a pozastaví řazení", async ({ page }) => {
    await page.goto("/vzdelavani/temata?filtr=vse");
    const search = page.getByRole("searchbox", { name: "Hledat téma" });
    await search.fill("navaznost");
    await expect(page.locator("[data-topic]")).toHaveCount(1);
    await expect(page.locator("[data-topic]")).toContainText("Návaznost po konzultaci");
    await expect(page.locator(".topic-handle")).toHaveCount(0);
    await search.fill("xyz neexistuje");
    await expect(page.getByRole("status").filter({ hasText: "Žádné téma neodpovídá" })).toBeVisible();
    await search.fill("");
    await expect(page.locator(".topic-handle").first()).toBeVisible();
  });
});
