import { authFile, expect, settle, test } from "./support";
import type { Page } from "@playwright/test";

// Screenshoty vlastníka 27. 11. 2026 (~347 px): zelený pás „Zveřejněno“ v okně akce zabíral zbytečně velký blok.
// Na telefonu jsou štítky a text v jednom toku s menším odsazením; desktop zůstává sloupec.
test.use({ storageState: authFile("spravce") });

async function measureBand(page: Page) {
  await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
  await settle(page);
  const href = await page.locator("a[class*=agendaEvent]").first().getAttribute("href");
  await page.goto(href!);
  const band = page.locator("dialog[open] .status-band");
  await expect(band).toBeVisible();
  await page.waitForTimeout(300);
  return band.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      height: el.getBoundingClientRect().height,
      overflow: el.scrollWidth - el.clientWidth,
      direction: style.flexDirection,
      spans: el.querySelectorAll(":scope > span").length,
    };
  });
}

for (const width of [320, 347, 390]) {
  test(`telefon ${width} px: pás stavu v okně akce je kompaktní a nepřetéká`, async ({ page }, info) => {
    test.skip(info.project.name !== "telefon-390", "šířky prochází jeden telefonní projekt");
    await page.setViewportSize({ width, height: 740 });
    const band = await measureBand(page);
    expect(band.direction).toBe("row");
    expect(band.overflow).toBeLessThanOrEqual(0);
    // Jen štítky bez doplňujícího textu = jeden řádek kolem 36 px; s textem nejvýš dva řádky.
    expect(band.height).toBeLessThanOrEqual(band.spans === 0 ? 48 : 72);
  });
}

test("desktop: pás stavu zůstává sloupec", async ({ page }, info) => {
  test.skip(info.project.name !== "windows-1280", "desktopová kontrola");
  const band = await measureBand(page);
  expect(band.direction).toBe("column");
});
