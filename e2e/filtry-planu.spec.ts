import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Screenshoty vlastníka 27. 11. 2026 (Android, ~347 px): filtry Plánu zabraly čtyři řádky pilulek a pilulky účasti
// měly jen 41 px. Test měří geometrii řádku filtrů: filtr účasti na jednom řádku (na 320 px smí 2 × 2, šířka
// na čtyři pilulky nestačí), správce nejvýš tři řádky, každý prvek aspoň 44 px a nic nepřesahuje řádek ani okno.
const WIDTHS = [320, 347, 360, 390];

test.describe("Plán na telefonu: filtry", () => {
  for (const [role, maxRows] of [["spravce", 3], ["ucastnikFp", 2]] as const) {
    test.describe(role, () => {
      test.use({ storageState: authFile(role) });

      for (const width of WIDTHS) {
        test(`šířka ${width} px: účast na jednom řádku, nejvýš ${maxRows + (width < 347 ? 1 : 0)} řádky, prvky 44 px`, async ({ page }, info) => {
          test.skip(info.project.name !== "telefon-390", "šířky prochází jeden telefonní projekt");
          await page.setViewportSize({ width, height: 800 });
          await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
          await settle(page);
          await expect(page.locator(".plan-filters")).toBeVisible();
          await expectNoHorizontalScroll(page);
          const report = await page.evaluate(() => {
            const row = document.querySelector<HTMLElement>(".plan-filters")!;
            const box = row.getBoundingClientRect();
            const visible = (el: Element) => el.getBoundingClientRect().width > 0;
            const lead = [...row.querySelectorAll(".participation-filter .pill")].filter(visible);
            const rest = [...row.querySelectorAll(".plan-filters-start > *, .plan-filters-end > *")].filter(visible);
            const tops: number[] = [];
            const problems: string[] = [];
            for (const el of [...lead, ...rest]) {
              const r = el.getBoundingClientRect();
              const label = el.textContent?.trim() ?? "";
              if (!tops.some((t) => Math.abs(t - r.top) < 6)) tops.push(r.top);
              if (r.height < 44) problems.push(`nízké (${Math.round(r.height)} px): ${label}`);
              if (r.left < box.left - 1 || r.right > box.right + 1) problems.push(`přesahuje řádek: ${label}`);
              if (el.scrollWidth > el.clientWidth + 1) problems.push(`text přetéká: ${label}`);
            }
            const leadTops = new Set(lead.map((el) => Math.round(el.getBoundingClientRect().top)));
            return { rows: tops.length, leadRows: leadTops.size, leadCount: lead.length, problems };
          });
          expect(report.leadCount).toBe(4);
          const narrow = width < 347 ? 1 : 0;
          expect(report.leadRows, "filtr účasti na jednom řádku").toBeLessThanOrEqual(1 + narrow);
          expect(report.rows, "počet řádků filtrů").toBeLessThanOrEqual(maxRows + narrow);
          expect(report.problems).toEqual([]);
        });
      }
    });
  }
});
