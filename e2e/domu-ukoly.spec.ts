import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

test.describe("Úvod: Čeká na vás", () => {
  test.use({ storageState: authFile("spravce") });

  test("úkoly vedle nejbližších akcí, na úzkém displeji první, bez vodorovného posunu", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    const tasks = page.getByRole("region", { name: /Čeká na vás/ });
    const next = page.getByRole("region", { name: "Nejbližší akce" });
    await expect(tasks).toBeVisible();
    // „Celý plán“ jen jednou, u nejbližších akcí. Úvod nemá bloky Moduly ani vypnuté hledání.
    await expect(page.getByRole("link", { name: "Celý plán" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Moduly" })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
    await expect(next.getByRole("link", { name: "Celý plán" })).toBeVisible();
    const [t, n] = [(await tasks.boundingBox())!, (await next.boundingBox())!];
    const width = page.viewportSize()!.width;
    if (width >= 900) {
      expect(t.x).toBeGreaterThan(n.x); // dva sloupce: Nejbližší akce | Čeká na vás
      expect(Math.abs(t.y - n.y)).toBeLessThan(4);
    } else {
      expect(t.y).toBeLessThan(n.y); // pod sebou, úkoly první
    }
    await expectNoHorizontalScroll(page);
  });
});

test.describe("Úvod bez úkolů", () => {
  test.use({ storageState: authFile("ucastnikRm") });

  test("bez úkolů se blok skryje", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await expect(page.getByRole("heading", { name: "Nejbližší akce" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Čeká na vás/ })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
