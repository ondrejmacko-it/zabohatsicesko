import type { Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, lineCount, settle, test } from "./support";

// Zadání vlastníka: na telefonu je hlavní navigace hamburger menu ve stylu Wiki. Tlačítko ukazuje aktuální sekci
// a počet úkolů, rozbalený seznam je svislý (jako na počítači) a zavře se Esc, klepnutím mimo i výběrem položky.
// Tablet (641–900 px) má dál mřížku stejně širokých položek bez osamocené položky.
const PHONE_WIDTHS = [320, 360, 390, 430, 480, 640];
const TABLET_WIDTHS = [641, 768, 900];

const nav = (page: Page) => page.getByRole("complementary", { name: "Hlavní navigace" });
const toggle = (page: Page) => nav(page).getByRole("button", { name: /^Menu/ });

async function openOnPhone(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto("/vzdelavani/harmonogram");
  await settle(page);
}

for (const [role, label, count] of [["ucastnikFp", "účastník", 3], ["spravce", "správce se Správou", 4]] as const) {
  test.describe(`hamburger menu na telefonu: ${label}`, () => {
    test.use({ storageState: authFile(role) });

    for (const width of PHONE_WIDTHS) {
      test(`šířka ${width} px: sbalené, rozbalí se do svislého seznamu`, async ({ page }, info) => {
        test.skip(info.project.name !== "telefon-390", "šířky prochází jeden telefonní projekt");
        await openOnPhone(page, width);
        await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
        await expect(toggle(page)).toContainText("Vzdělávání");
        await expect(nav(page).getByRole("link")).toHaveCount(0);
        const bar = (await nav(page).boundingBox())!;
        expect(bar.height, "sbalené menu je jen jeden řádek").toBeLessThanOrEqual(64);
        expect((await toggle(page).boundingBox())!.height, "dotyková plocha").toBeGreaterThanOrEqual(44);

        await toggle(page).click();
        await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
        const items = nav(page).locator(".nav > li:visible .nav-item");
        await expect(items).toHaveCount(count);
        const boxes = await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: Math.round(r.x), y: r.y, w: Math.round(r.width), h: r.height })));
        expect(new Set(boxes.map((b) => b.x)).size, "jeden sloupec").toBe(1);
        expect(new Set(boxes.map((b) => b.w)).size, "stejná šířka").toBe(1);
        for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.y, "položky pod sebou").toBeGreaterThan(boxes[i - 1]!.y);
        expect(Math.min(...boxes.map((b) => b.h)), "dotyková plocha položky").toBeGreaterThanOrEqual(44);
        const fonts = await items.evaluateAll((els) => [...new Set(els.map((el) => getComputedStyle(el).fontSize))]);
        expect(fonts, "jedna velikost písma v menu").toHaveLength(1);
        await expect(nav(page).getByRole("link", { name: "Vzdělávání" })).toHaveAttribute("aria-current", "page");
        expect(await lineCount(nav(page).locator(".sidebar-feedback .nav-item span")), "Zpětná vazba na jednom řádku").toBe(1);
        if (role === "spravce") expect(await lineCount(nav(page).getByRole("link", { name: "Správa systému" }).locator("span")), "Správa systému na jednom řádku").toBe(1);
        await expectNoHorizontalScroll(page);
      });
    }
  });
}

test.describe("hamburger menu: ovládání", () => {
  test.use({ storageState: authFile("spravce") });
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "telefon-390", "ovládání stačí ověřit na jednom telefonu");
    await openOnPhone(page, 390);
  });

  test("Esc zavře menu a vrátí fokus na tlačítko", async ({ page }) => {
    await toggle(page).focus();
    await page.keyboard.press("Enter");
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(toggle(page)).toHaveAttribute("aria-controls", "hlavni-menu");
    await page.keyboard.press("Tab");
    await expect(nav(page).getByRole("link", { name: "Domů" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(toggle(page)).toBeFocused();
  });

  test("klepnutí mimo menu ho zavře", async ({ page }) => {
    await toggle(page).tap();
    await expect(nav(page).getByRole("link", { name: "Domů" })).toBeVisible();
    await page.locator("main h1").tap();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("výběr položky přejde na stránku a menu zavře", async ({ page }) => {
    await toggle(page).tap();
    await nav(page).getByRole("link", { name: "Domů" }).tap();
    await expect(page).toHaveURL(/\/$/);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(toggle(page)).toContainText("Domů");
  });

  test("Zpětná vazba z menu otevře okno a menu zavře", async ({ page }) => {
    await toggle(page).tap();
    await nav(page).getByRole("button", { name: "Zpětná vazba" }).tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("menu na tabletu", () => {
  test.use({ storageState: authFile("spravce") });

  for (const width of TABLET_WIDTHS) {
    test(`šířka ${width} px: bez tlačítka Menu, mřížka bez osamocené položky`, async ({ page }, info) => {
      test.skip(info.project.name !== "telefon-390", "šířky prochází jeden projekt");
      await openOnPhone(page, width);
      await expect(toggle(page)).toBeHidden();
      const boxes = await nav(page)
        .locator(".nav > li:visible .nav-item")
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), w: Math.round(r.width) })));
      expect(boxes.length).toBeGreaterThanOrEqual(4);
      const rows = [...boxes.reduce((map, b) => map.set(b.top, (map.get(b.top) ?? 0) + 1), new Map<number, number>()).values()];
      expect(rows.length <= 2 && rows.every((n) => n >= 2), `řádky ${rows.join("+")}`).toBe(true);
      expect(Math.max(...boxes.map((b) => b.w)) - Math.min(...boxes.map((b) => b.w)), "stejná šířka").toBeLessThanOrEqual(1);
      await expectNoHorizontalScroll(page);
    });
  }
});
