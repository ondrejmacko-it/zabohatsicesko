import { expect, test } from "@playwright/test";
import { authFile } from "./support";

// Bod 10: filtr Pro mou roli / Všechna a hledání v jedné liště; na PC v jednom řádku, na telefonu
// filtr i hledání přes celou šířku. Dřív pravidlo Plánu (.view-toggle) filtr na telefonu skrylo.
test.describe("Témata: lišta filtru a hledání", () => {
  test.use({ storageState: authFile("spravce") });

  test("filtr je vidět a s hledáním tvoří lištu podle šířky", async ({ page }) => {
    await page.goto("/vzdelavani/temata?filtr=vse");
    const role = page.getByRole("link", { name: "Pro mou roli", exact: true });
    const all = page.getByRole("link", { name: "Všechna", exact: true });
    const search = page.getByRole("searchbox", { name: "Hledat téma" });
    await expect(role).toBeVisible();
    await expect(all).toHaveAttribute("aria-current", "page");
    await expect(search).toBeVisible();

    const bar = (await page.locator(".topic-toolbar").boundingBox())!;
    const filter = (await page.locator(".topic-filter").boundingBox())!;
    const field = (await page.locator(".topic-search").boundingBox())!;
    const phone = page.viewportSize()!.width <= 560;
    if (phone) {
      expect(field.y).toBeGreaterThanOrEqual(filter.y + filter.height);
      expect(Math.round(filter.width)).toBeGreaterThanOrEqual(Math.round(bar.width) - 1);
      expect(Math.round(field.width)).toBeGreaterThanOrEqual(Math.round(bar.width) - 1);
    } else {
      expect(Math.abs(field.y + field.height / 2 - (filter.y + filter.height / 2))).toBeLessThan(4);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await role.click();
    await expect(page).toHaveURL(/filtr=role/);
    await expect(page.getByRole("link", { name: "Pro mou roli", exact: true })).toHaveAttribute("aria-current", "page");
  });
});

// Zadání: výchozí filtr témat je „Všechna“ pro všechny role, „Pro mou roli“ je volba.
for (const role of ["spravce", "ucastnikFp"] as const) {
  test.describe(`Témata: výchozí filtr (${role})`, () => {
    test.use({ storageState: authFile(role) });

    test("bez parametru je vybráno Všechna", async ({ page }) => {
      await page.goto("/vzdelavani/temata");
      const all = page.getByRole("link", { name: "Všechna", exact: true });
      await expect(all).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("link", { name: "Pro mou roli", exact: true })).not.toHaveAttribute("aria-current", "page");
    });
  });
}
