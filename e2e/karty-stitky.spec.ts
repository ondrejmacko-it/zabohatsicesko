import { authFile, expect, settle, test } from "./support";

// Audit P1 (23. 11. 2026), U-1: štítky účasti z PR #86 („Povinné pro tebe“) vedle „Mimořádná“ v úzkém sloupci
// měsíce (tablet) přetékaly přes pravý okraj karty a mřížka je ořízla. Test měří geometrii, ne třídy.
const WIDTHS = [768, 1024, 1280];

test.describe("Plán: štítky karet se vejdou do karty @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  for (const width of WIDTHS) {
    test(`šířka ${width} px: žádný štítek nepřesahuje kartu`, async ({ page }, info) => {
      test.skip(info.project.name !== "windows-1280", "šířky si test nastaví sám");
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
      await settle(page);
      const badges = page.locator("[data-ucast]");
      await expect(badges.first()).toBeVisible();
      const problems = await page.evaluate(() =>
        [...document.querySelectorAll("[data-ucast]")].flatMap((badge) => {
          const card = badge.closest("[class*=\"_event\"]") ?? badge.closest("li")!;
          const b = badge.getBoundingClientRect();
          const c = card.getBoundingClientRect();
          return b.width > 0 && (b.right > c.right + 1 || b.left < c.left - 1) ? [`${badge.textContent} (${Math.round(b.right)} > ${Math.round(c.right)})`] : [];
        }),
      );
      expect(problems).toEqual([]);
    });
  }
});
