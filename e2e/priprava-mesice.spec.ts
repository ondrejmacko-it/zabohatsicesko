import type { Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

const dialog = (page: Page, title: string | RegExp) => page.getByRole("dialog", { name: title });

async function openPrepare(page: Page) {
  await page.goto("/vzdelavani/harmonogram");
  await settle(page);
  await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
  return dialog(page, /Připravit měsíc:/);
}

// Bez zápisu do databáze: nic se neukládá, okno se zavře bez uložení.
test.describe("Připravit měsíc: přehled a hromadné doplnění vedoucího", () => {
  test.use({ storageState: authFile("spravce") });

  test("přehled stavu ukáže počty a přejde na první dotčený řádek", async ({ page }) => {
    const prepare = await openPrepare(page);
    const overview = prepare.getByRole("list", { name: "Stav návrhů" });
    await expect(overview.getByRole("button")).toHaveCount(5);
    for (const label of ["Připraveno", "Chybí vedoucí", "Chybí téma", "Kolize", "Vybráno"]) {
      await expect(overview.getByRole("button", { name: new RegExp(`^${label}: \\d+`) })).toBeVisible();
    }

    // Prvnímu řádku vedoucího vyprázdníme: přehled to započítá živě a přechod skočí právě na jeho pole.
    const firstLead = prepare.getByLabel(/^Vedoucí: /).first();
    const leadName = (await firstLead.getAttribute("name"))!;
    await firstLead.selectOption("");
    const missingLead = overview.getByRole("button", { name: /^Chybí vedoucí: [1-9]/ });
    await missingLead.click();
    await expect(page.locator(":focus")).toHaveAttribute("name", leadName);

    // Vybráno: fokus na zaškrtávací pole prvního vybraného řádku.
    const picked = overview.getByRole("button", { name: /^Vybráno: / });
    if (await picked.isEnabled()) {
      await picked.click();
      await expect(page.locator(":focus")).toHaveAttribute("name", "pick");
    }
    await expectNoHorizontalScroll(page);
  });

  test("doplnění vedoucího jen do prázdných polí, vyplněná zůstanou", async ({ page }) => {
    const prepare = await openPrepare(page);
    const leads = prepare.getByLabel(/^Vedoucí: /);
    const count = await leads.count();
    expect(count).toBeGreaterThanOrEqual(2);
    const options = await leads.first().locator("option").evaluateAll((list) => list.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    expect(options.length).toBeGreaterThanOrEqual(2);
    const [kept, bulk] = options as [string, string];

    // Výchozí stav: první řádek prázdný, druhý s jiným vedoucím, než se bude doplňovat.
    await leads.nth(0).selectOption("");
    await leads.nth(1).selectOption(kept);
    const before = await leads.evaluateAll((list) => list.map((s) => (s as HTMLSelectElement).value));
    const empty = before.filter((value) => !value).length;

    const fill = prepare.getByRole("button", { name: /^Doplnit do \d+ řádk/ });
    await expect(prepare.getByText(/vyplněné vedoucí se nepřepíšou/)).toBeVisible();
    await prepare.getByLabel("Doplnit vedoucího do prázdných polí").selectOption(bulk);
    await expect(fill).toHaveText(new RegExp(`Doplnit do ${empty} řádk`));
    await fill.click();

    const after = await leads.evaluateAll((list) => list.map((s) => (s as HTMLSelectElement).value));
    after.forEach((value, i) => expect(value).toBe(before[i] || bulk));
    await expect(leads.nth(1)).toHaveValue(kept);
    await expect(prepare.getByRole("status").filter({ hasText: /doplněn do \d+ řádk/ })).toBeVisible();
    await expect(prepare.getByRole("list", { name: "Stav návrhů" }).getByRole("button", { name: /^Chybí vedoucí: 0/ })).toBeDisabled();

    // Doplnění je rozepsaná změna: zavření se zeptá a bez uložení nic nezmění.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog", { name: "Neuložené změny" })).toBeVisible();
    await page.getByRole("button", { name: "Zahodit změny" }).click();
    await expect(prepare).toBeHidden();
  });

  test("samotná volba pro hromadné doplnění není rozepsaná změna", async ({ page }) => {
    const prepare = await openPrepare(page);
    const options = prepare.getByLabel("Doplnit vedoucího do prázdných polí").locator("option");
    const value = await options.nth(1).getAttribute("value");
    await prepare.getByLabel("Doplnit vedoucího do prázdných polí").selectOption(value!);
    await page.keyboard.press("Escape");
    await expect(prepare).toBeHidden();
  });
});

test.describe("okno akce: ochrana neuložených změn", () => {
  test.use({ storageState: authFile("spravce") });

  test("Přidat akci: bez změny zavře hned, se změnou se zeptá, po vrácení hodnoty už ne", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    const open = page.getByRole("button", { name: "Přidat akci", exact: true });
    const add = dialog(page, "Přidat akci");
    const confirm = page.getByRole("alertdialog", { name: "Neuložené změny" });

    await open.click();
    await page.keyboard.press("Escape");
    await expect(add).toBeHidden();
    await expect(confirm).toHaveCount(0);

    await open.click();
    const topic = add.getByLabel(/^Téma/);
    const original = await topic.inputValue();
    await topic.fill("Rozepsané téma");
    await add.getByRole("button", { name: "Zavřít", exact: true }).click();
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Pokračovat v úpravách" }).click();
    await expect(add).toBeVisible();
    await expect(topic).toHaveValue("Rozepsané téma");
    await expect(confirm).toHaveCount(0);

    // Porovnávají se hodnoty: vrácené pole už za změnu nestojí.
    await topic.fill(original);
    // Psaní otevře nabídku témat; první Esc zavře jen ji, druhý okno.
    await page.keyboard.press("Escape");
    await expect(add.getByRole("listbox")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(add).toBeHidden();
  });

  test("okno akce s předvyplněným tématem se při zavření bez úprav neptá", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-24&tema=topic-priority");
    await settle(page);
    const window = page.getByRole("dialog").filter({ hasText: "je předvyplněné" });
    await expect(window.getByLabel(/^Téma/)).toHaveValue("Týmové priority");
    await page.keyboard.press("Escape");
    await expect(window).toBeHidden();
    await expect(page.getByRole("alertdialog", { name: "Neuložené změny" })).toHaveCount(0);
  });

  test("okno akce: změna se při zavření ohlásí, Zahodit změny je zahodí", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-24");
    await settle(page);
    const window = page.getByRole("dialog").filter({ has: page.getByLabel(/^Téma/) });
    await window.getByLabel(/^Téma/).fill("Neuložená změna");
    await page.keyboard.press("Escape");
    const confirm = page.getByRole("alertdialog", { name: "Neuložené změny" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Zahodit změny" }).click();
    await expect(window).toBeHidden();
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-24");
    await settle(page);
    await expect(page.getByRole("dialog").getByLabel(/^Téma/)).toHaveValue("");
  });
});
