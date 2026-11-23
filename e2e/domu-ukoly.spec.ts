import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

test.describe("Úvod: Čeká na tebe", () => {
  test.use({ storageState: authFile("spravce") });

  test("úkoly vedle nejbližších akcí, na úzkém displeji první, bez vodorovného posunu", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    const tasks = page.getByRole("region", { name: /Čeká na tebe/ });
    const next = page.getByRole("region", { name: "Co tě čeká" });
    await expect(tasks).toBeVisible();
    // „Celý plán“ jen jednou, u nejbližších akcí. Úvod nemá bloky Moduly ani vypnuté hledání.
    await expect(page.getByRole("link", { name: "Celý plán" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Moduly" })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
    await expect(next.getByRole("link", { name: "Celý plán" })).toBeVisible();
    // Akce z Nejbližších se otevře v okně nad Úvodem a Esc vrátí na Úvod.
    await next.getByRole("listitem").first().getByRole("link").click();
    await expect(page).toHaveURL(/\/\?akce=/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
    const [t, n] = [(await tasks.boundingBox())!, (await next.boundingBox())!];
    const width = page.viewportSize()!.width;
    if (width >= 900) {
      expect(t.x).toBeGreaterThan(n.x); // dva sloupce: Co tě čeká | Čeká na tebe
      expect(Math.abs(t.y - n.y)).toBeLessThan(4);
    } else {
      expect(t.y).toBeLessThan(n.y); // pod sebou, úkoly první
    }
    await expectNoHorizontalScroll(page);
  });
});

// Prázdný blok úkolů se nevykreslí (TasksCard vrací null). Účastník RM v ukázce
// nemá vlastní úkoly, jen pozvánky bez odpovědi, a ty jsou jeden souhrnný úkol místo zvláštního bloku.
test.describe("Úvod účastníka", () => {
  test.use({ storageState: authFile("ucastnikRm") });

  test("pozvánky bez odpovědi jsou jediný úkol", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await expect(page.getByRole("heading", { name: "Co tě čeká" })).toBeVisible();
    const tasks = page.locator("section", { has: page.getByRole("heading", { name: /Čeká na tebe/ }) });
    await expect(tasks.getByRole("listitem")).toHaveCount(1);
    await expect(tasks.getByText(/^Odpověz na pozvánk/)).toBeVisible();
    await expect(page.getByText(/Moduly|Kalendář propojen/)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
