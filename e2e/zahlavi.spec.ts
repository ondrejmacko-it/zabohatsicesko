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
