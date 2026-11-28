import type { Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, lineCount, settle, test } from "./support";

// Zadání vlastníka (bod 2): černé menu na telefonu = stejně široké a stejně vysoké položky v mřížce.
// Tři položky přes celou šířku, čtyři v jedné řadě nebo 2×2; Zpětná vazba nesmí zůstat osamocená na dalším řádku.
// Dřív byla Zpětná vazba mimo seznam a na 320 px spadla sama pod Domů a Vzdělávání.
const WIDTHS = [320, 347, 360, 390, 412, 430, 480, 481, 640, 641, 768, 900];

async function menuRows(page: Page) {
  const boxes = await page.locator(".sidebar .nav > li:visible .nav-item").evaluateAll((items) =>
    items.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width) };
    }),
  );
  const rows = new Map<number, number>();
  for (const box of boxes) rows.set(box.top, (rows.get(box.top) ?? 0) + 1);
  return { boxes, rows: [...rows.values()] };
}

for (const [role, label] of [["ucastnikFp", "3 položky"], ["spravce", "4 položky se Správou"]] as const) {
  test.describe(`menu na telefonu: ${label}`, () => {
    test.use({ storageState: authFile(role) });

    for (const width of WIDTHS) {
      test(`šířka ${width} px: mřížka bez osamocené položky`, async ({ page }, info) => {
        test.skip(info.project.name !== "telefon-390", "šířky prochází jeden telefonní projekt");
        await page.setViewportSize({ width, height: 800 });
        await page.goto("/vzdelavani/harmonogram");
        await settle(page);
        const { boxes, rows } = await menuRows(page);
        expect(new Set(boxes.map((b) => b.height)).size, "stejná výška položek").toBe(1);
        expect(Math.max(...boxes.map((b) => b.width)) - Math.min(...boxes.map((b) => b.width)), "stejná šířka").toBeLessThanOrEqual(1);
        expect(Math.min(...boxes.map((b) => b.height)), "dotyková plocha").toBeGreaterThanOrEqual(40);
        // Žádná položka sama na řádku (2×2, 3+3, 3+2), nejvýš dvě řady.
        expect(rows.length === 1 || rows.every((n) => n >= 2), `řádky ${rows.join("+")}`).toBe(true);
        expect(rows.length).toBeLessThanOrEqual(2);
        expect(Math.max(...rows)).toBeLessThanOrEqual(4);
        const fonts = await page
          .locator(".sidebar .nav-item")
          .evaluateAll((items) => [...new Set(items.map((el) => getComputedStyle(el).fontSize))]);
        expect(fonts, "jedna velikost písma v menu").toHaveLength(1);
        expect(await lineCount(page.locator(".sidebar-feedback .nav-item span")), "Zpětná vazba na jednom řádku").toBe(1);
        await expectNoHorizontalScroll(page);
      });
    }
  });
}
