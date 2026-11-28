import type { Page } from "@playwright/test";
import { UCAST_PORT, UCAST_TLS_PORT } from "./constants.mjs";
import { authFile, expect, expectNoHorizontalScroll, expectNoSeriousA11y, settle, test } from "./support";

// Regrese V1 (28. 11. 2026): tabulka Účasti na 768 a 1024 px posouvala celou stránku a přetékala kartu.
// Široká tabulka má posuvný obal (TableScroll): stránka se neposouvá, poslední sloupec jde odkrýt myší,
// dotykem i klávesnicí. Test měří skutečnou geometrii v Chromiu, Firefoxu a WebKitu (E2E_WEBKIT=1).

const PROJECTS = ["windows-1280", "firefox-1280", "webkit-1440"];
const WIDTHS = [768, 1024, 1280];
const VIEWS = [
  { name: "podle akcí", path: "/vzdelavani/ucast", region: "Přehled účasti podle akcí" },
  { name: "podle lidí", path: "/vzdelavani/ucast?pohled=lide", region: "Přehled účasti podle lidí" },
];

test.beforeEach(({}, info) => test.skip(!PROJECTS.includes(info.project.name), "jen desktop Chromium, Firefox a WebKit"));
test.use({ storageState: authFile("spravce") });

const base = (project: string) => (project.startsWith("webkit") ? `https://localhost:${UCAST_TLS_PORT}` : `http://localhost:${UCAST_PORT}`);

/** Obal je uvnitř karty a poslední sloupec po posunu leží celý uvnitř obalu. */
async function scrollGeometry(page: Page, label: string) {
  return page.getByRole("region", { name: label }).evaluate((box) => {
    const card = box.closest(".section")!.getBoundingClientRect();
    const own = box.getBoundingClientRect();
    const head = [...box.querySelectorAll("thead th")];
    box.scrollLeft = box.scrollWidth;
    const last = head[head.length - 1]!.getBoundingClientRect();
    const after = box.getBoundingClientRect();
    const result = {
      insideCard: own.left >= card.left - 1 && own.right <= card.right + 1,
      lastVisible: last.left >= after.left - 1 && last.right <= after.right + 1,
      scrollable: box.scrollWidth > box.clientWidth + 1,
    };
    box.scrollLeft = 0;
    return result;
  });
}

for (const width of WIDTHS) {
  for (const view of VIEWS) {
    test(`Účast ${view.name} na ${width} px: stránka se neposouvá, všechny sloupce dostupné`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base(info.project.name)}${view.path}`);
      await settle(page);
      await expectNoHorizontalScroll(page);
      const geometry = await scrollGeometry(page, view.region);
      expect(geometry.insideCard, "obal tabulky uvnitř karty").toBe(true);
      expect(geometry.lastVisible, "poslední sloupec po posunu viditelný").toBe(true);

      // Klávesnice: obal je v pořadí Tabu a šipka doprava ho posune (jen když je co posouvat).
      if (geometry.scrollable) {
        const region = page.getByRole("region", { name: view.region });
        await region.focus();
        await expect(region).toBeFocused();
        await page.keyboard.press("End");
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      }
      if (width === 768 && info.project.name === "windows-1280") await expectNoSeriousA11y(page);
    });
  }
}

test("Detail akce na 768 px: tabulka lidí bez posunu stránky", async ({ page }, info) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(`${base(info.project.name)}/vzdelavani/ucast`);
  await settle(page);
  await page.getByRole("region", { name: "Přehled účasti podle akcí" }).locator("tbody tr").first().getByRole("link").first().click();
  await page.waitForURL(/akce=/);
  await settle(page);
  await expectNoHorizontalScroll(page);
  const geometry = await scrollGeometry(page, "Účast lidí na akci");
  expect(geometry.insideCard).toBe(true);
  expect(geometry.lastVisible).toBe(true);
});
