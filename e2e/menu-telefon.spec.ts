import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Audit 347 px (Android vlastníka): položka Zpětná vazba v menu dědila na telefonu oddělovač svislého menu
// (čára, okraj 12 px) a větší písmo, takže spadla pod ostatní položky. V řádku má vypadat jako ostatní sekce.
const WIDTHS = [320, 347, 390];

test.describe("menu na telefonu: Zpětná vazba jako ostatní položky", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  for (const width of WIDTHS) {
    test(`šířka ${width} px: bez oddělovače, stejné písmo, řádek s Domů`, async ({ page }, info) => {
      test.skip(info.project.name !== "telefon-390", "šířky prochází jeden telefonní projekt");
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/vzdelavani/harmonogram");
      await settle(page);
      const feedback = page.locator(".sidebar-feedback");
      const style = await feedback.evaluate((el) => {
        const s = getComputedStyle(el);
        return { border: s.borderTopWidth, padding: s.paddingTop, margin: s.marginTop };
      });
      expect(style).toEqual({ border: "0px", padding: "0px", margin: "0px" });
      const fonts = await page
        .locator(".sidebar .nav-item")
        .evaluateAll((items) => [...new Set(items.map((el) => getComputedStyle(el).fontSize))]);
      expect(fonts, "jedna velikost písma v menu").toHaveLength(1);
      // Na 320 px se celá položka smí zalomit na další řádek (Shell: „zalomí se jen při nedostatku místa“).
      if (width >= 347) {
        const home = (await page.locator(".nav .nav-item").first().boundingBox())!;
        const fb = (await feedback.locator(".nav-item").boundingBox())!;
        expect(Math.abs(fb.y + fb.height / 2 - (home.y + home.height / 2)), "stejný řádek jako Domů").toBeLessThanOrEqual(1);
      }
      await expectNoHorizontalScroll(page);
    });
  }
});
