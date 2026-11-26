import type { Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Kolonky Vede a Téma na kartách harmonogramu (listopad 2026 z ukázky). Na počítači mřížka, na telefonu agenda.
const PLAN = "/vzdelavani/harmonogram?mesic=2026-11";
const card = (page: Page, id: string) => page.locator(`a[href*="akce=${id}"]:visible:not(.brief-link)`).first();
const detail = (page: Page, id: string, label: "Vede" | "Téma") => card(page, id).locator(`[data-detail="${label}"]`);

async function openPlan(page: Page) {
  await page.goto(PLAN);
  await settle(page);
}

test.describe("Harmonogram: kolonky Vede a Téma (správce)", () => {
  test.use({ storageState: authFile("spravce") });

  test("vyplněné, chybějící, svátek, zrušená a Action time", async ({ page }) => {
    await openPlan(page);
    await expect(detail(page, "ev-11-18", "Vede")).toHaveText("Vede: Vedoucí akce");
    await expect(detail(page, "ev-11-18", "Téma")).toHaveText("Téma: Porovnání dvou postupů");
    // Název akce a téma se nezdvojují: téma je jen v kolonce.
    await expect(card(page, "ev-11-18")).toContainText("Portfolio tým");
    await expect(card(page, "ev-11-18").getByText("Porovnání dvou postupů")).toHaveCount(1);
    // Rozpracovaný návrh bez údajů: správce vidí výzvu k doplnění.
    await expect(detail(page, "ev-11-13", "Vede")).toHaveText("Vede: — doplnit");
    await expect(detail(page, "ev-11-13", "Téma")).toHaveText("Téma: — doplnit");
    // Svátek a zrušená akce kolonky nemají.
    await expect(card(page, "ev-11-17").locator("[data-detail]")).toHaveCount(0);
    await expect(card(page, "ev-11-4").locator("[data-detail]")).toHaveCount(0);
    // Action time: vedoucí ano, prázdné téma se nehlásí.
    await expect(detail(page, "ev-11-3", "Vede")).toHaveText("Vede: Vedoucí akce");
    await expect(detail(page, "ev-11-3", "Téma")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("klik na kartu dál otevře detail akce", async ({ page }) => {
    await openPlan(page);
    await card(page, "ev-11-18").click();
    await expect(page).toHaveURL(/akce=ev-11-18/);
    await expect(page.getByRole("dialog", { name: "Portfolio tým" })).toBeVisible();
  });

  test("přesun tažením zůstává na kartě s kolonkami @desktop", async ({ page }) => {
    await openPlan(page);
    const block = page.locator('[data-move-id="ev-11-18"]');
    await expect(block).toHaveAttribute("draggable", "true");
    await expect(block.locator('[data-detail="Vede"]')).toBeVisible();
  });
});

test.describe("Harmonogram: kolonky Vede a Téma (účastník)", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("účastník vidí vyplněné údaje a nikdy výzvu „— doplnit“", async ({ page }) => {
    await openPlan(page);
    await expect(detail(page, "ev-11-18", "Vede")).toHaveText("Vede: Vedoucí akce");
    await expect(detail(page, "ev-11-18", "Téma")).toHaveText("Téma: Porovnání dvou postupů");
    await expect(page.getByText("— doplnit")).toHaveCount(0);
    // Interní návrhy (bez údajů) účastník nevidí vůbec.
    await expect(page.locator('a[href*="akce=ev-11-13"]')).toHaveCount(0);
    await expect(card(page, "ev-11-17").locator("[data-detail]")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
