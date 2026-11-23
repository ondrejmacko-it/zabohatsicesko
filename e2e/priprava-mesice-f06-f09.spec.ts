import type { Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, expectNoSeriousA11y, settle, test } from "./support";

// F06–F09: Plán a okno Připravit měsíc. Jen čtení, nic se neukládá (okna se zavřou bez uložení).
// Listopad 2027 je v ukázce prázdný a žádný test do něj nezapisuje.
const EMPTY = "/vzdelavani/harmonogram?mesic=2027-11";
const dialog = (page: Page) => page.getByRole("dialog", { name: /Připravit měsíc:/ });

test.describe("Prázdný měsíc a průvodce (F06, F07)", () => {
  test.use({ storageState: authFile("spravce") });

  test("F06: jedno hlavní tlačítko Připravit měsíc a prázdný stav jen jednou", async ({ page }) => {
    await page.goto(EMPTY);
    await settle(page);
    const prepare = page.getByRole("button", { name: /^Připravit měsíc/ });
    await expect(prepare).toHaveCount(1);
    await expect(prepare).toHaveClass(/btn-primary/);
    await expect(page.getByText(/V tomto měsíci zatím nejsou žádné akce/)).toHaveCount(1);
    // Přidat akci zůstává, ale jako vedlejší tlačítko.
    await expect(page.getByRole("button", { name: "Přidat akci", exact: true })).not.toHaveClass(/btn-primary/);
    // Dřívější druhé tlačítko pro totéž je pryč.
    await expect(page.getByRole("button", { name: /chybějící termíny/ })).toHaveCount(0);
    // Hlavní (plné) tlačítko je na stránce jediné viditelné.
    await expect(page.locator(".btn-primary").filter({ visible: true })).toHaveCount(1);
    await expectNoHorizontalScroll(page);
  });

  test("F07: průvodce ukáže všechny tři kroky dopředu a Zavřít je jen jedno", async ({ page }) => {
    await page.goto(EMPTY);
    await settle(page);
    await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
    const wizard = dialog(page);
    for (const step of ["1 Doplnit termíny", "2 Zkontrolovat", "3 Zveřejnit"]) {
      await expect(wizard.getByRole("heading", { name: step })).toBeVisible();
    }
    await expect(wizard.getByRole("button", { name: "Doplnit chybějící termíny" })).toHaveClass(/btn-primary/);
    await expect(wizard.getByRole("button", { name: "Zavřít" })).toHaveCount(1);
    // Axe až po doběhnutí animace otevření (průhlednost by zkreslila kontrast).
    await wizard.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    await expectNoSeriousA11y(page);
    await wizard.getByRole("button", { name: "Zavřít" }).click();
    await expect(wizard).toBeHidden();
  });

  test("měsíc s akcemi: Připravit měsíc zůstává vedlejší tlačítko v liště", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    const prepare = page.getByRole("button", { name: /^Připravit měsíc/ });
    await expect(prepare).toHaveCount(1);
    await expect(prepare).not.toHaveClass(/btn-primary/);
    await expect(page.locator(".month-summary-empty")).toHaveCount(0);
  });
});

test.describe("Připravit měsíc s návrhy (F08, F09)", () => {
  test.use({ storageState: authFile("spravce") });

  async function openWithDrafts(page: Page) {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
    const wizard = dialog(page);
    await expect(wizard.getByRole("list", { name: "Stav návrhů" })).toBeVisible();
    return wizard;
  }

  test("F08: hromadně doplnit téma jen do prázdných polí", async ({ page }) => {
    const wizard = await openWithDrafts(page);
    const topics = wizard.getByRole("combobox", { name: /^Téma: / });
    expect(await topics.count()).toBeGreaterThanOrEqual(2);
    await topics.nth(0).fill("");
    await topics.nth(1).fill("Vlastní téma e2e");
    const before = await topics.evaluateAll((list) => list.map((i) => (i as HTMLInputElement).value));
    const empty = before.filter((v) => !v.trim()).length;

    const bulk = wizard.getByLabel("Téma do prázdných polí");
    const value = (await bulk.locator("option").nth(1).getAttribute("value"))!;
    await bulk.selectOption(value);
    await wizard.getByRole("button", { name: new RegExp(`^Doplnit téma do ${empty} řádk`) }).click();
    const after = await topics.evaluateAll((list) => list.map((i) => (i as HTMLInputElement).value));
    after.forEach((v, i) => expect(v).toBe(before[i]!.trim() ? before[i] : value));
    await expect(topics.nth(1)).toHaveValue("Vlastní téma e2e");
    await expect(wizard.getByRole("status").filter({ hasText: /doplněno do \d+ řádk/ })).toBeVisible();
    await expect(wizard.getByRole("button", { name: /^Chybí téma: 0/ })).toBeDisabled();
    await expectNoHorizontalScroll(page);

    // Doplnění je rozepsaná změna: zavření se zeptá a bez uložení nic nezmění.
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Zahodit změny" }).click();
    await expect(wizard).toBeHidden();
  });

  test("F08: klik na Chybí téma vyfiltruje řádky, druhý klik filtr zruší", async ({ page }) => {
    const wizard = await openWithDrafts(page);
    const rows = wizard.locator("li.publish-row");
    const total = await rows.count();
    expect(total).toBeGreaterThanOrEqual(2);
    // Jeden řádek bez tématu, ostatní s tématem.
    const topics = wizard.getByRole("combobox", { name: /^Téma: / });
    for (let i = 0; i < total; i++) await topics.nth(i).fill(i === 1 ? "" : "Téma e2e");
    const target = (await topics.nth(1).getAttribute("name"))!;
    const chip = wizard.getByRole("button", { name: /^Chybí téma: 1/ });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(rows.filter({ visible: true })).toHaveCount(1);
    await expect(page.locator(":focus")).toHaveAttribute("name", target);
    await expect(wizard.getByText(/Zobrazeny jen řádky: Chybí téma/)).toBeVisible();

    // Druhý klik (nebo odkaz) ukáže zase všechny řádky. Skryté řádky zůstaly ve formuláři beze změny.
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await expect(rows.filter({ visible: true })).toHaveCount(total);
    await expect(topics.nth(0)).toHaveValue("Téma e2e");

    await wizard.getByRole("button", { name: /^Chybí téma: 1/ }).click();
    await wizard.getByRole("button", { name: "Zobrazit všechny řádky", exact: true }).click();
    await expect(rows.filter({ visible: true })).toHaveCount(total);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Zahodit změny" }).click();
  });

  test("F09: šedé Zveřejnit říká proč a s potvrzením se odemkne", async ({ page }) => {
    const wizard = await openWithDrafts(page);
    const rows = wizard.locator("li.publish-row");
    const total = await rows.count();
    // Vybrat všechny řádky a všem smazat téma i vedoucího.
    const pickAll = wizard.getByRole("button", { name: "Vybrat vše" });
    while ((await pickAll.count()) > 0) await pickAll.first().click();
    const topics = wizard.getByRole("combobox", { name: /^Téma: / });
    const leads = wizard.getByLabel(/^Vedoucí: /);
    for (let i = 0; i < total; i++) {
      await topics.nth(i).fill("");
      await leads.nth(i).selectOption("");
    }
    const publish = wizard.getByRole("button", { name: /^Zveřejnit \d+/ });
    await expect(publish).toBeDisabled();
    const why = new RegExp(`^Doplň téma a vedoucího u ${total} ${total === 1 ? "akce" : "akcí"}, nebo potvrď`);
    await expect(wizard.getByText(why)).toBeVisible();
    await expect(publish).toHaveAccessibleDescription(why);

    // Vedoucí u všech: zbývá jen téma.
    await wizard.getByLabel("Vedoucí do prázdných polí").selectOption({ index: 1 });
    await wizard.getByRole("button", { name: /^Doplnit do \d+ řádk/ }).click();
    await expect(wizard.getByText(new RegExp(`^Doplň téma u ${total} `))).toBeVisible();

    // Výslovné potvrzení neúplných zveřejnění odemkne a důvod zmizí. Nic se neodešle.
    await wizard.getByRole("checkbox", { name: /^Zveřejnit i \d+ termín/ }).check();
    await expect(publish).toBeEnabled();
    await expect(wizard.locator("#prepare-publish-why")).toHaveCount(0);

    // Bez výběru: důvod je, že není co zveřejnit.
    const unpick = wizard.getByRole("button", { name: "Zrušit výběr" });
    while ((await unpick.count()) > 0) await unpick.first().click();
    await expect(wizard.getByText("Vyber aspoň jeden návrh ke zveřejnění.")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Zahodit změny" }).click();
    await expect(wizard).toBeHidden();
  });
});
