import { authFile, expect, settle, test } from "./support";
import type { Page } from "@playwright/test";

// Screenshoty vlastníka 27. 11. 2026 (Android, ~347 px): v okně akce „prosvítal“ Plán. Okno bylo karta s 12px
// okrajem nad 40% závojem a pod patičkou byla vidět stránka. Na telefonu je velké okno přes celou obrazovku.
test.use({ storageState: authFile("spravce") });

async function openEvent(page: Page) {
  await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
  await settle(page);
  // Na desktopu je agenda skrytá za mřížkou měsíce, odkaz akce je ale stejný.
  const href = await page.locator("a[class*=agendaEvent]").first().getAttribute("href");
  await page.goto(href!);
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();
  // Doběhnutí animace otevření (150 ms).
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const d = document.querySelector("dialog[open]")!;
    const box = (el: Element | null) => {
      const r = el!.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width };
    };
    const style = getComputedStyle(d);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      dialog: box(d),
      actions: box(d.querySelector(".dialog-actions")),
      background: style.backgroundColor,
      opacity: style.opacity,
      backdrop: getComputedStyle(d, "::backdrop").backgroundColor,
      bodyOverflow: (() => { const b = d.querySelector(".dialog-body")!; return b.scrollWidth - b.clientWidth; })(),
    };
  });
}

for (const width of [320, 347, 390]) {
  test(`telefon ${width} px: okno akce kryje celou obrazovku, patička dole, nic nepřetéká`, async ({ page }, info) => {
    test.skip(info.project.name !== "telefon-390", "šířky prochází jeden telefonní projekt");
    await page.setViewportSize({ width, height: 740 });
    const r = await openEvent(page);
    expect(r.background).toBe("rgb(255, 255, 255)");
    expect(r.opacity).toBe("1");
    expect(r.dialog.left).toBeLessThanOrEqual(0.5);
    expect(r.dialog.top).toBeLessThanOrEqual(0.5);
    expect(r.dialog.right).toBeGreaterThanOrEqual(r.viewport.width - 0.5);
    expect(r.dialog.bottom).toBeGreaterThanOrEqual(r.viewport.height - 0.5);
    // Patička s akcemi stojí u spodního okraje obrazovky, pod ní žádná stránka.
    expect(Math.abs(r.actions.bottom - r.viewport.height)).toBeLessThanOrEqual(1);
    expect(r.bodyOverflow).toBeLessThanOrEqual(1);
    expect(r.backdrop).toBe("rgba(35, 35, 35, 0.6)");
  });
}

test("desktop: okno akce zůstává kartou uprostřed @desktop", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("windows"), "jen desktop");
  const r = await openEvent(page);
  expect(r.dialog.width).toBeLessThanOrEqual(762);
  expect(r.dialog.left).toBeGreaterThan(100);
  expect(r.backdrop).toBe("rgba(35, 35, 35, 0.4)");
});
