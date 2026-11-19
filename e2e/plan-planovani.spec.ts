import type { Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Ukázka běží s referenčním časem 12. 11. 2026 9:00, měsíční Plán ukazuje listopad.
const cell = (page: Page, day: string) => page.locator(`td[data-drop-day="${day}"]`);
const addLink = (page: Page, day: string) => cell(page, day).getByRole("link", { name: /^Přidat akci na / });
const block = (page: Page, id: string) => page.locator(`[data-move-id="${id}"]`);

async function openPlan(page: Page) {
  await page.goto("/vzdelavani/harmonogram");
  await settle(page);
}

async function expectAddDialog(page: Page, day: string) {
  const dialog = page.getByRole("dialog", { name: "Přidat akci" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Datum", { exact: true })).toHaveValue(day);
  // Jiná akce nemá výchozí název, pole je nahoře a prázdné.
  await expect(dialog.getByLabel("Název akce", { exact: true })).toHaveValue("");
  await expectNoHorizontalScroll(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/den=/);
}

test.describe("Plán: přidání akce na den @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("„+“ se ukáže při najetí myší a otevře Přidat akci s datem", async ({ page }) => {
    await openPlan(page);
    const plus = addLink(page, "2026-11-18");
    await expect(plus).toHaveCSS("opacity", "0");
    await cell(page, "2026-11-18").hover();
    await expect(plus).toHaveCSS("opacity", "1");
    await expect(plus).toHaveAccessibleName("Přidat akci na středa 18. 11.");
    await plus.click();
    await expectAddDialog(page, "2026-11-18");
  });

  test("„+“ jde ovládat klávesnicí", async ({ page }) => {
    await openPlan(page);
    const plus = addLink(page, "2026-11-19");
    await plus.focus();
    await expect(plus).toHaveCSS("opacity", "1");
    await page.keyboard.press("Enter");
    await expectAddDialog(page, "2026-11-19");
  });

  test("minulé dny „+“ nemají a přesun nepřijmou", async ({ page }) => {
    await openPlan(page);
    await expect(page.locator('td[data-drop-day="2026-11-11"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Přidat akci na .* 11\. 11\.$/ })).toHaveCount(0);
    await expect(block(page, "tr-fp-1111")).toHaveCount(0);
  });

  test("Přesun tažením: Nepřesouvat nic nezmění", async ({ page }) => {
    await openPlan(page);
    await block(page, "ev-11-27").dragTo(cell(page, "2026-11-26"));
    const dialog = page.getByRole("dialog", { name: "Přesunout akci" });
    await expect(dialog).toContainText("Přesunout akci Firemní vzdělávání FP z pá 27. 11. na čt 26. 11.?");
    await expect(dialog).toContainText("uloží jako návrh");
    await dialog.getByRole("button", { name: "Nepřesouvat" }).click();
    await expect(dialog).toBeHidden();
    await expect(cell(page, "2026-11-27").locator('[data-move-id="ev-11-27"]')).toHaveCount(1);
  });

  test("Přesun tažením s potvrzením a zpět v okně akce", async ({ page }, testInfo) => {
    // Zápis do sdílených dat ukázky jen v jednom projektu, ostatní projekty ověří Nepřesouvat.
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    await openPlan(page);
    await block(page, "ev-11-25").dragTo(cell(page, "2026-11-24"));
    const dialog = page.getByRole("dialog", { name: "Přesunout akci" });
    await expect(dialog).toContainText("z st 25. 11. na út 24. 11.?");
    await dialog.getByRole("button", { name: "Potvrdit" }).click();
    await expect(dialog).toBeHidden();
    await expect(cell(page, "2026-11-24").locator('[data-move-id="ev-11-25"]')).toHaveCount(1);

    // Cesta bez myši: okno akce → datum rovnou v poli → Uložit jako návrh. Vrátí akci na původní den.
    await cell(page, "2026-11-24").locator('[data-move-id="ev-11-25"]').click();
    const win = page.getByRole("dialog", { name: "Trénink poradců" });
    await win.getByLabel("Datum", { exact: true }).fill("2026-11-25");
    await win.getByRole("button", { name: "Uložit jako návrh" }).click();
    await expect(win).toBeHidden();
    await page.goto("/vzdelavani/harmonogram");
    await expect(cell(page, "2026-11-25").locator('[data-move-id="ev-11-25"]')).toHaveCount(1);
  });
});

test.describe("Plán: svátek je pevný @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("svátek nejde táhnout a jeho okno nemá úpravy", async ({ page }) => {
    await openPlan(page);
    await expect(block(page, "ev-11-17")).toHaveCount(0);
    await page.goto("/vzdelavani/harmonogram?akce=ev-11-17");
    const win = page.getByRole("dialog", { name: "Státní svátek" });
    await expect(win).toContainText("Jen pro přehled, do Kalendáře se neposílá");
    await expect(win.getByRole("button", { name: /Zveřejnit|Uložit/ })).toHaveCount(0);
    await expect(win.getByRole("button", { name: "Další možnosti" })).toHaveCount(0);
  });
});

test.describe("Plán: „+“ na dotyku @desktop", () => {
  test.use({ storageState: authFile("spravce"), hasTouch: true, isMobile: true, viewport: { width: 1280, height: 800 } });

  test("„+“ je vidět bez najetí a jde na něj ťuknout", async ({ page }) => {
    await openPlan(page);
    const plus = addLink(page, "2026-11-20");
    await expect(plus).toHaveCSS("opacity", "1");
    const box = (await plus.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(24);
    await plus.tap();
    await expectAddDialog(page, "2026-11-20");
  });
});

test.describe("Plán: účastník nepřidává ani nepřesouvá @desktop", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("bez „+“, bez tažení a bez Přesunout", async ({ page }) => {
    await openPlan(page);
    await expect(page.getByRole("link", { name: /^Přidat akci na / })).toHaveCount(0);
    await expect(page.locator("[data-move-id]")).toHaveCount(0);
    await expect(page.locator("[data-drop-day]")).toHaveCount(0);
    // Ani ruční ?den= dialog neotevře.
    await page.goto("/vzdelavani/harmonogram?den=2026-11-18");
    await settle(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("Plán: souhrn měsíce (A-03)", () => {
  test.use({ storageState: authFile("spravce") });

  test("štítky říkají, co čeká, a zúží plán na tyto akce", async ({ page }) => {
    await openPlan(page);
    const group = page.getByRole("group", { name: "Zúžit plán měsíce" }).first();
    const chip = group.getByRole("link", { name: /^Doplnit \d+ akc/ });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("title", /Chybí téma, vedoucí/);
    await expect(group.getByRole("link", { name: /Chybí údaje/ })).toHaveCount(0);
    await expect(group.getByRole("link", { name: /^Návrhy \d+ ke zveřejnění/ })).toBeVisible();
    await chip.click();
    await expect(page).toHaveURL(/stav=doplnit#mesic/);
    await expect(group.getByRole("link", { name: /^Doplnit .*zrušit filtr/ })).toHaveAttribute("aria-current", "true");
  });
});
