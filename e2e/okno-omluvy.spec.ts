import type { Page } from "@playwright/test";
import { UCAST_PORT } from "./constants.mjs";
import { authFile, expect, settle, test } from "./support";

// Screenshot vlastníka 27. 11. 2026: v omluvě nativní modré radio 13 px a řádky 23 px, těsné pro prst.
test.use({ storageState: authFile("spravce") });

async function openExcuse(page: Page) {
  // Jen otevře formulář omluvy, nic neodešle; ukázka účasti má referenční čas 12. 11., ev-11-24 je budoucí povinná.
  await page.goto(`http://localhost:${UCAST_PORT}/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-24`);
  await settle(page);
  const dialog = page.locator("dialog[open]").first();
  await expect(dialog).toBeVisible();
  await dialog.locator("[data-ucast-panel]").getByRole("button", { name: "Omluvit se" }).click();
  const excuse = page.getByRole("dialog", { name: "Omluvit se z akce?" });
  await expect(excuse).toBeVisible();
  await page.waitForTimeout(300);
  return excuse;
}

for (const width of [320, 347, 390]) {
  test(`telefon ${width} px: okno omluvy se vejde, volby důvodu 44 px v barvách aplikace`, async ({ page }, info) => {
    test.skip(info.project.name !== "telefon-390", "šířky prochází jeden telefonní projekt");
    await page.setViewportSize({ width, height: 740 });
    const excuse = await openExcuse(page);
    const m = await excuse.evaluate((d) => {
      const box = (el: Element) => el.getBoundingClientRect();
      const dialog = box(d);
      return {
        inside: dialog.left >= 0 && dialog.right <= innerWidth && dialog.top >= 0 && dialog.bottom <= innerHeight,
        overflow: d.scrollWidth - d.clientWidth,
        rows: [...d.querySelectorAll(".excuse-reason")].map((row) => box(row).height),
        radios: [...d.querySelectorAll<HTMLInputElement>("input[type=radio]")].map((r) => ({
          size: box(r).width,
          accent: getComputedStyle(r).accentColor,
          ochre: getComputedStyle(document.documentElement).getPropertyValue("--ochre").trim(),
        })),
      };
    });
    expect(m.inside).toBe(true);
    expect(m.overflow).toBe(0);
    expect(m.rows).toHaveLength(3);
    for (const height of m.rows) expect(height).toBeGreaterThanOrEqual(44);
    for (const radio of m.radios) {
      expect(radio.size).toBeGreaterThanOrEqual(20);
      // Nativní modrá (accent-color: auto) se vlastníkovi na Androidu nehodila k aplikaci.
      expect(radio.accent).not.toBe("auto");
    }
    // Celý řádek volí důvod, ne jen kroužek.
    await excuse.locator(".excuse-reason", { hasText: "Jiné" }).click({ position: { x: 200, y: 10 } });
    await expect(excuse.getByLabel("Jiné")).toBeChecked();
  });
}
