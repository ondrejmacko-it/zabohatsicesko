import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// F18: na užším okně (mezi telefonem a širokým monitorem) zůstane účet v liště na jednom řádku: jméno a Odhlásit
// vedle sebe. Lišta se smí zalomit jen po celcích (značka, Pohled, účet). Šířky prochází jeden desktopový projekt,
// telefony mají vlastní testy lišty.

const WIDTHS = [1200, 1100, 1024, 960, 900, 820, 768, 700, 641];

/** Svislé středy viditelných prvků účtu. Odznak ukázky na telefonu visí absolutně, do řádku se nepočítá. */
async function accountRows(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const items = [...document.querySelectorAll<HTMLElement>(".account > *")].filter(
      (el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).position !== "absolute",
    );
    return [...new Set(items.map((el) => Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)))];
  });
}

for (const role of ["spravce", "ucastnikFp"] as const) {
  test.describe(`záhlaví na užším okně: ${role}`, () => {
    test.use({ storageState: authFile(role) });

    test("účet je na jednom řádku a lišta nepřetéká (F18)", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "windows-1280", "šířky prochází jeden projekt");
      await page.goto("/");
      await settle(page);
      const signOut = page.getByRole("button", { name: "Odhlásit" });
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await expect(signOut).toBeVisible();
        expect(await accountRows(page), `řádky účtu při ${width} px`).toHaveLength(1);
        await expectNoHorizontalScroll(page);
      }
    });
  });
}

// Telefon (fotky vlastníka, Android ~347 px): Pohled ani účet se nesmí překrývat se značkou ani spolu, lišta
// nepřeteče a celé jméno s Odhlásit je v menu Účet. Ukázková role i účet Google sdílejí tutéž mřížku
// a menu Účet; e2e se Googlem přihlásit neumí, proto se ověřuje na ukázkovém správci (s Pohledem).
const PHONE_WIDTHS = [320, 347, 360, 390, 430];

type Box = { name: string; left: number; top: number; right: number; bottom: number };
const overlaps = (a: Box, b: Box) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

for (const role of ["spravce", "ucastnikFp"] as const) {
  test.describe(`záhlaví na telefonu: ${role}`, () => {
    test.use({ storageState: authFile(role) });

    test("značka, Pohled a účet se nepřekrývají, jméno a Odhlásit jsou v menu Účet", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "telefon-390", "šířky prochází jeden telefonní projekt");
      await page.goto("/");
      await settle(page);
      for (const width of PHONE_WIDTHS) {
        await page.setViewportSize({ width, height: 760 });
        const boxes: Box[] = await page.evaluate(() =>
          [".brand", ".view-switch", ".account .demo-badge", ".account > form.row", ".account-menu"].flatMap((sel) => {
            const el = document.querySelector<HTMLElement>(sel);
            const r = el?.getBoundingClientRect();
            return r && r.width > 0 ? [{ name: sel, left: r.left, top: r.top, right: r.right, bottom: r.bottom }] : [];
          }),
        );
        if (role === "spravce") expect(boxes.map((b) => b.name), `${width} px`).toContain(".view-switch");
        for (const [i, a] of boxes.entries())
          for (const b of boxes.slice(i + 1)) expect(overlaps(a, b), `${a.name} × ${b.name} při ${width} px`).toBe(false);
        for (const b of boxes) expect(b.right, `${b.name} při ${width} px`).toBeLessThanOrEqual(width);
        await expectNoHorizontalScroll(page);
      }
      await page.getByRole("button", { name: "Účet" }).click();
      const list = page.locator(".account-menu .menu-list");
      await expect(list.locator("strong")).toHaveText(/\S/);
      const fits = await list.locator("strong").evaluate((el) => el.scrollWidth <= el.clientWidth);
      expect(fits, "celé jméno v menu").toBe(true);
      await expect(list.getByRole("button", { name: "Odhlásit" })).toBeVisible();
    });
  });
}
