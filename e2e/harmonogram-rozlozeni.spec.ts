import type { Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Regrese z 23. 11. 2026: filtr účasti (Všechny / Povinné / Dobrovolné / Moje) ve sdíleném sloupci lišty
// přetékal přes navigaci a název měsíce (červenec 2027). Test měří skutečnou geometrii, ne třídy.

// Šířky ze zadání a ekvivalenty zoomu 125 / 150 / 200 % (CSS šířka = šířka okna / zoom).
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1660, 1920];
const ZOOMS = [1280, 1440, 1920].flatMap((w) => [1.25, 1.5, 2].map((z) => Math.round(w / z)));

/** Ovládací prvky lišty, které se nesmějí překrývat ani být useknuté. */
async function toolbarProblems(page: Page) {
  return page.evaluate(() => {
    const head = document.querySelector(".plan-head");
    if (!head) return ["lišta Plánu chybí"];
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    // Lišta i řádek filtrů pod ní (filtr účasti, štítky souhrnu, Filtry, Vybrat návrhy).
    const items = [...document.querySelectorAll(".plan-head, .plan-filters")]
      .flatMap((zone) => [...zone.querySelectorAll(".pill, .segment, .btn, .month-title, summary")])
      .filter(visible) as HTMLElement[];
    const name = (el: HTMLElement) => (el.textContent || el.getAttribute("aria-label") || el.className).trim().slice(0, 30);
    const problems: string[] = [];
    items.forEach((first, i) => {
      const a = first.getBoundingClientRect();
      if (first.scrollWidth > first.clientWidth + 1) problems.push(`useknuté: ${name(first)}`);
      if (a.left < -1 || a.right > document.documentElement.clientWidth + 1) problems.push(`mimo obrazovku: ${name(first)}`);
      for (const second of items.slice(i + 1)) {
        if (first.contains(second) || second.contains(first)) continue;
        const b = second.getBoundingClientRect();
        const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        if (overlap) problems.push(`překryv: ${name(first)} × ${name(second)}`);
      }
    });
    return problems;
  });
}

const MONTHS = [
  { label: "prázdný měsíc ze snímku chyby", query: "mesic=2027-07" },
  { label: "zaplněný měsíc", query: "mesic=2026-11" },
  { label: "aktivní filtr a seznam", query: "mesic=2026-11&pohled=seznam&ucast=dobrovolne" },
];

for (const role of ["spravce", "ucastnikFp"] as const) {
  test.describe(`Lišta harmonogramu bez překryvů: ${role} @desktop`, () => {
    test.use({ storageState: authFile(role) });

    for (const month of MONTHS) {
      test(month.label, async ({ page }) => {
        test.setTimeout(120_000);
        await page.goto(`/vzdelavani/harmonogram?${month.query}`);
        await settle(page);
        await expect(page.locator(`[aria-label="Účast v harmonogramu"]`)).toBeVisible();
        for (const width of [...WIDTHS, ...ZOOMS]) {
          await page.setViewportSize({ width, height: 900 });
          await expect.poll(() => toolbarProblems(page), { message: `šířka ${width}px` }).toEqual([]);
          await expectNoHorizontalScroll(page);
        }
      });
    }
  });
}

test.describe("Filtr účasti je vidět i na telefonu", () => {
  test.use({ storageState: authFile("ucastnikRm") });

  test("čtyři volby, aktivní volba přežije obnovení", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&ucast=povinne");
    await settle(page);
    const filter = page.getByRole("navigation", { name: "Účast v harmonogramu" });
    for (const label of ["Všechny", "Povinné", "Dobrovolné", "Moje"]) await expect(filter.getByRole("link", { name: label })).toBeVisible();
    await expect(filter.getByRole("link", { name: "Povinné" })).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(filter.getByRole("link", { name: "Povinné" })).toHaveAttribute("aria-current", "page");
    expect(await toolbarProblems(page)).toEqual([]);
    await expectNoHorizontalScroll(page);
  });
});

test.describe("Záhlaví harmonogramu účastníka @desktop", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("Měsíc/Seznam je segmentový přepínač a Filtry jsou ve stejném řádku jako filtr účasti", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    const view = page.getByRole("group", { name: "Zobrazení" });
    await expect(view.locator(".segment")).toHaveCount(2);
    await expect(view.locator(".segment[aria-current=page]")).toHaveText("Měsíc");
    // Zobrazení nesdílí vzhled s filtrem účasti (pilulky).
    expect(await view.locator(".pill").count()).toBe(0);
    const participation = page.getByRole("navigation", { name: "Účast v harmonogramu" });
    const filters = page.locator(".plan-filters summary", { hasText: "Filtry" });
    await expect(filters).toBeVisible();
    const [a, b] = await Promise.all([participation.boundingBox(), filters.boundingBox()]);
    // Stejný řádek: svislé středy se liší nejvýš o pár pixelů.
    expect(Math.abs(a!.y + a!.height / 2 - (b!.y + b!.height / 2))).toBeLessThan(6);
  });
});
