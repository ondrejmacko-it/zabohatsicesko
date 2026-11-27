import {
  authFile,
  expect,
  expectNoHorizontalScroll,
  lineCount,
  settle,
  test,
} from "./support";

/*
 * Geometrie seznamů: datum a čas se nesmí lámat po znacích, název nesmí být stlačený vedle úzkých sloupců.
 * Testy padají na rozložení, které jsme v tomto kole opravili (např. 5sloupcová mřížka Zápisů k dokončení).
 */

test.describe("Zápisy k dokončení", () => {
  test.use({ storageState: authFile("spravce") });
  test("datum je na jednom řádku a název má šířku", async ({ page }) => {
    await page.goto("/vzdelavani/zapisy");
    await settle(page);
    await page.getByRole("link", { name: /^K dokončení/ }).click();
    const picker = page.getByRole("dialog", { name: "Zápisy k dokončení" });
    await expect(picker).toBeVisible();
    const rows = picker.locator(".missing-row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      expect(
        await lineCount(row.locator(".missing-date")),
        "datum na jednom řádku",
      ).toBe(1);
      expect(
        await lineCount(row.locator(".missing-action")),
        "tlačítko na jednom řádku",
      ).toBe(1);
      expect(
        await lineCount(row.locator(".missing-title")),
        "název nejvýš na 2 řádky",
      ).toBeLessThanOrEqual(2);
    }
    await expect(picker.locator(".missing-summary")).toHaveText(
      /^(\d+ moje · \d+ celkem|Celkem \d+)\./,
    );
    if ((await picker.getByRole("searchbox").count()) > 0) {
      const search = await picker.getByRole("searchbox").boundingBox();
      const state = await picker
        .getByRole("combobox", { name: "Stav" })
        .boundingBox();
      expect(
        Math.abs((search?.y ?? 0) - (state?.y ?? 99)),
        "hledání a Stav v jedné řadě",
      ).toBeLessThan(4);
    }
    await expectNoHorizontalScroll(page);
  });
});

test.describe("Témata: hlavička a lišta", () => {
  test.use({ storageState: authFile("spravce") });
  test("výzva má text a tlačítko v jedné řadě (na telefonu pod sebou), filtr a hledání v jedné liště", async ({
    page,
  }) => {
    await page.goto("/vzdelavani/temata");
    await settle(page);
    const call = page.locator(".page-call");
    const text = (await call.locator(".page-call-text").boundingBox())!;
    const action = (await call.locator(".page-call-action").boundingBox())!;
    const narrow = page.viewportSize()!.width <= 560;
    if (narrow) {
      expect(action.y, "tlačítko pod textem").toBeGreaterThanOrEqual(
        text.y + text.height - 1,
      );
      expect(
        Math.abs(action.width - text.width),
        "tlačítko přes šířku",
      ).toBeLessThan(2);
    } else {
      // Bez diagonály: středy textu a tlačítka na stejné ose.
      expect(
        Math.abs(text.y + text.height / 2 - (action.y + action.height / 2)),
      ).toBeLessThan(4);
      expect(action.x).toBeGreaterThan(text.x + text.width - 1);
    }
    const toolbar = page.locator(".topic-toolbar");
    await expect(toolbar).toHaveCount(1);
    await expect(
      toolbar.getByRole("link", { name: "Všechna", exact: true }),
    ).toBeVisible();
    const search = toolbar.getByRole("searchbox", { name: "Hledat téma" });
    await search.fill("zzz neexistuje");
    await expect(page.getByText(/Žádné téma neodpovídá hledání/)).toBeVisible();
    await expect(page).toHaveURL(/hledat=/);
    await page.getByRole("button", { name: "Zrušit hledání" }).click();
    await expect(search).toHaveValue("");
    await expect(page).not.toHaveURL(/hledat=/);
    await expectNoHorizontalScroll(page);
  });
});

test.describe("Řádek tématu", () => {
  test.use({ storageState: authFile("spravce") });
  test("Mám zájem nemění šířku a spodní řádek správce začíná u levého okraje", async ({
    page,
  }) => {
    await page.goto("/vzdelavani/temata?filtr=vse");
    await settle(page);
    // Řádek se drží podle id: filtr podle stavu tlačítka by po kliknutí ukázal na jiné téma.
    const id = await page
      .locator(".topic-row.topic-has-lead")
      .filter({ has: page.locator(".interest-btn:not(.interest-on)") })
      .first()
      .getAttribute("data-topic");
    const row = page.locator(`.topic-row[data-topic="${id}"]`);
    const button = row.locator(".interest-btn");
    const before = (await button.boundingBox())!;
    await button.click();
    await expect(row.locator(".interest-btn")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const after = (await row.locator(".interest-btn").boundingBox())!;
    expect(
      Math.abs(after.width - before.width),
      "šířka bez skoku",
    ).toBeLessThan(1);
    await row.locator(".interest-btn").click();
    await expect(row.locator(".interest-btn")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    if (page.viewportSize()!.width <= 360) {
      const rowBox = (await row.boundingBox())!;
      const interest = (await row.locator(".topic-interest").boundingBox())!;
      expect(interest.x - rowBox.x, "bez prázdného pruhu vlevo").toBeLessThan(
        20,
      );
    }
  });
});

test.describe("Plán: filtr účasti", () => {
  test.use({ storageState: authFile("spravce") });
  test("čtyři volby v jedné řadě nebo 2 × 2, nikdy 3 + osamocená", async ({
    page,
  }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    const pills = page.locator(".participation-filter .pill");
    await expect(pills).toHaveCount(4);
    for (const width of [
      320, 346, 347, 360, 390, 412, 430, 480, 560, 640, 641, 768, 1024,
    ]) {
      await page.setViewportSize({ width, height: 800 });
      const tops = await pills.evaluateAll((els) =>
        els.map((el) => Math.round(el.getBoundingClientRect().top)),
      );
      const rows = [...new Set(tops)].map(
        (top) => tops.filter((t) => t === top).length,
      );
      expect(
        [[4], [2, 2]],
        `řádky voleb při ${width} px: ${rows.join("+")}`,
      ).toContainEqual(rows);
      for (let i = 0; i < 4; i++)
        expect(
          await lineCount(pills.nth(i)),
          `volba na jednom řádku při ${width} px`,
        ).toBe(1);
      await expectNoHorizontalScroll(page);
    }
  });
});

test.describe("Plán: čas na kartě agendy", () => {
  test.use({ storageState: authFile("spravce") });
  test("jednodenní čas se nezalomí a Dnes je u navigace měsíce", async ({
    page,
  }) => {
    await page.goto("/vzdelavani/harmonogram?pohled=seznam");
    await settle(page);
    const times = page
      .locator("[data-agenda-day] a > span:first-child")
      .filter({ hasText: /^\d{2}:\d{2}–\d{2}:\d{2}$/ });
    const count = await times.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const time = times.nth(i);
      if (await time.isVisible())
        expect(await lineCount(time), "čas na jednom řádku").toBe(1);
    }
    await page.getByRole("link", { name: "Další měsíc" }).click();
    await expect(
      page.locator(".month-nav").getByRole("link", { name: "Dnes" }),
    ).toBeVisible();
  });
});

test.describe("Brouček nepřekrývá ovladače", () => {
  test.use({ storageState: authFile("spravce") });
  const overlaps = async (
    page: import("@playwright/test").Page,
    selector: string,
  ) =>
    page.evaluate((sel) => {
      const bug = document.querySelector<HTMLElement>("[data-testid=broucek]");
      if (!bug || bug.offsetParent === null) return [];
      const b = bug.getBoundingClientRect();
      return Array.from(document.querySelectorAll<HTMLElement>(sel))
        .filter((el) => el.offsetParent !== null)
        .map((el) => el.getBoundingClientRect())
        .filter(
          (r) =>
            r.left < b.right &&
            r.right > b.left &&
            r.top < b.bottom &&
            r.bottom > b.top,
        )
        .map((r) => `${Math.round(r.left)},${Math.round(r.top)}`);
    }, selector);

  test("otevřené menu ⋯ ve Správě", async ({ page }) => {
    await page.goto("/sprava");
    await settle(page);
    await page
      .getByRole("button", { name: /Možnosti účtu/ })
      .last()
      .click();
    await expect(page.locator(".menu-list:not([hidden])")).toBeVisible();
    await page.waitForTimeout(300);
    expect(await overlaps(page, ".menu-list:not([hidden]) .btn")).toEqual([]);
  });

  test("lišta Vybrat návrhy v Plánu", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: "Vybrat návrhy" }).click();
    const bar = page.getByRole("region", { name: "Hromadný výběr návrhů" });
    await expect(bar).toBeVisible();
    await page.waitForTimeout(300);
    expect(
      await overlaps(page, '[aria-label="Hromadný výběr návrhů"] .btn'),
    ).toEqual([]);
  });
});
