import { UCAST_PORT } from "./constants.mjs";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Trvalá vizuální regrese (malá sada): důležité stránky ve třech šířkách proti referenčním snímkům.
// Deterministická data: čistý seed ukázky s účastí (PARTICIPATION=on), serverový čas = referenceNow ze seedu,
// prohlížeč má pevné hodiny, fonty jsou v balíčku (@fontsource). Reference jsou pro Linux a Chromium,
// generují se `npm run e2e:vizual -- --update-snapshots` (postup v README, oddíl Vizuální regrese).
// Běží jen ve vlastním projektu „vizual“, aby ostatní testy současně neměnily data.

const REFERENCE_NOW = new Date("2026-11-12T09:00:00+01:00");
const WIDTHS = [390, 1024, 1440];
const PAGES = [
  { name: "uvod", path: "/" },
  { name: "plan", path: "/vzdelavani/harmonogram" },
  { name: "temata", path: "/vzdelavani/temata" },
  { name: "akce", path: "/vzdelavani/akce/ev-11-5" },
  { name: "ucast", path: "/vzdelavani/ucast" },
];

test.use({ storageState: authFile("spravce"), baseURL: `http://localhost:${UCAST_PORT}` });

for (const width of WIDTHS) {
  for (const target of PAGES) {
    test(`${target.name} ${width} px`, async ({ page }) => {
      await page.clock.setFixedTime(REFERENCE_NOW);
      await page.setViewportSize({ width, height: width < 600 ? 800 : 900 });
      await page.goto(target.path);
      await settle(page);
      await page.evaluate(() => document.fonts.ready);
      await expectNoHorizontalScroll(page);
      await expect(page).toHaveScreenshot(`${target.name}-${width}.png`, { fullPage: true });
    });
  }
}
