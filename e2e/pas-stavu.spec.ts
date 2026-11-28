import { authFile, expect, settle, test } from "./support";
import type { Page } from "@playwright/test";

// Screenshoty vlastníka 27. 11. 2026 (~347 px): zelený pás „Zveřejněno“ v okně akce zabíral zbytečně velký blok.
// Finální kolo: místo pásu se štítky jeden kompaktní řádek stavu (tečka + stav + věta) na každé šířce.
test.use({ storageState: authFile("spravce") });

async function measureBand(page: Page) {
  await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
  await settle(page);
  const href = await page.locator("a[class*=agendaEvent]").first().getAttribute("href");
  await page.goto(href!);
  const band = page.locator("dialog[open] .status-line");
  await expect(band).toBeVisible();
  await page.waitForTimeout(300);
  return band.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      height: el.getBoundingClientRect().height,
      overflow: el.scrollWidth - el.clientWidth,
      direction: style.flexDirection,
      spans: el.querySelectorAll(":scope > span:not(.status-dot)").length,
      badges: el.querySelectorAll(".badge").length,
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
    expect(band.badges).toBe(0);
    // Bez doplňujícího textu jeden řádek; s textem nejvýš tři krátké řádky.
    expect(band.height).toBeLessThanOrEqual(band.spans === 0 ? 28 : 72);
  });
}

test("desktop: stav je jeden řádek bez štítků", async ({ page }, info) => {
  test.skip(info.project.name !== "windows-1280", "desktopová kontrola");
  const band = await measureBand(page);
  expect(band.direction).toBe("row");
  expect(band.badges).toBe(0);
  expect(band.height).toBeLessThanOrEqual(band.spans === 0 ? 28 : 48);
});

test("telefon: patička úprav akce má pomocnou řadu a dvě stejně široké akce", async ({ page }, info) => {
  test.skip(info.project.name !== "telefon-360", "telefonní kontrola");
  await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
  await settle(page);
  const href = await page.locator("a[class*=agendaEvent]").first().getAttribute("href");
  await page.goto(`${href}&upravit=1`);
  const actions = page.locator("dialog[open] .event-actions");
  await expect(actions).toBeVisible();
  const box = await actions.evaluate((el) => {
    const buttons = [...el.querySelectorAll(":scope > button")].map((b) => b.getBoundingClientRect());
    const menu = el.querySelector(".event-actions-menu")?.getBoundingClientRect();
    return { buttons: buttons.map((b) => ({ top: b.top, width: b.width, height: b.height })), menuBottom: menu?.bottom ?? 0, overflow: el.scrollWidth - el.clientWidth };
  });
  expect(box.overflow).toBeLessThanOrEqual(0);
  const [draft, publish] = box.buttons;
  expect(box.buttons).toHaveLength(2);
  expect(Math.abs(draft!.top - publish!.top)).toBeLessThan(2);
  expect(Math.abs(draft!.width - publish!.width)).toBeLessThan(2);
  expect(draft!.top).toBeGreaterThanOrEqual(box.menuBottom - 1);
  expect(draft!.height).toBeGreaterThanOrEqual(44);
});
