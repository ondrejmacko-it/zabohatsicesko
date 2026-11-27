import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Screenshoty vlastníka 27. 11. 2026: brouček stál na telefonu nad rychlými akcemi Plánu a oba prvky spolu zakrývaly
// sloupec karet vpravo dole. Brouček má sedět vedle pilulky ve stejném řádku, celý v okně a bez překryvu.
const WIDTHS = [320, 347, 390];

test.describe("Plán na telefonu: brouček vedle rychlých akcí", () => {
  test.use({ storageState: authFile("spravce") });

  for (const width of WIDTHS) {
    test(`šířka ${width} px: jeden řádek, bez překryvu, celé v okně`, async ({ page }, info) => {
      test.skip(info.project.name !== "telefon-390", "šířky prochází jeden telefonní projekt");
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
      await settle(page);
      await page.mouse.wheel(0, 900);
      const quick = page.locator(".quick-actions");
      await expect(quick).toBeVisible();
      const bug = page.locator(".bug-button");
      // Brouček se přeměří po vykreslení lišty v dalším snímku.
      await expect
        .poll(async () => {
          const [b, q] = [await bug.boundingBox(), await quick.boundingBox()];
          return b && q ? b.y < q.y + q.height && b.y + b.height > q.y : false;
        })
        .toBe(true);
      const [b, q] = [(await bug.boundingBox())!, (await quick.boundingBox())!];
      expect(b.x + b.width, "brouček nepřekrývá pilulku").toBeLessThanOrEqual(q.x);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(q.x + q.width).toBeLessThanOrEqual(width);
      expect(Math.max(b.y + b.height, q.y + q.height)).toBeLessThanOrEqual(800);
      expect(b.width).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalScroll(page);
    });
  }
});
