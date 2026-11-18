import type { Locator, Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Ukázka běží s referenčním časem 12. 11. 2026 9:00. Garantovaná témata ze seedu: 1. Otevřené otázky na schůzce,
// 2. Návaznost po konzultaci. Zápisy do sdílených dat dělá jen jeden projekt: vlastní návrh v prosinci 2026
// (jinde se v něm nic nezakládá) a dočasná priorita či pořadí, které test hned vrátí.

const TOPICS = "/vzdelavani/temata";
const menuOf = (page: Page, name: string) => page.getByRole("button", { name: `Možnosti tématu ${name}`, exact: true });
const openMenu = (page: Page) => page.locator(".menu-list:not([hidden])");
const rowOf = (scope: Locator, name: string) => scope.locator(".topic-row").filter({ hasText: name });

async function openTopics(page: Page) {
  await page.goto(TOPICS);
  await settle(page);
}

async function chooseInMenu(page: Page, topic: string, item: string) {
  await menuOf(page, topic).click();
  await openMenu(page).getByRole("button", { name: item, exact: true }).click();
}

test.describe("Témata: garantovaná a ostatní", () => {
  test.use({ storageState: authFile("spravce") });

  test("garantovaná jsou nahoře v pořadí, Nejžádanější zůstává podle zájmu, menu má všechny volby", async ({ page }) => {
    await openTopics(page);
    const guaranteed = page.locator(".topic-group").filter({ has: page.getByRole("heading", { name: "Garantovaná témata" }) });
    await expect(guaranteed.locator(".topic-row .item-title > span[id]")).toHaveText(["Otevřené otázky na schůzce", "Návaznost po konzultaci"]);
    await expect(page.getByRole("heading", { name: "Ostatní témata" })).toBeVisible();
    await expect(rowOf(guaranteed, "Otevřené otázky na schůzce").getByText("Nejžádanější")).toBeVisible();

    await menuOf(page, "Otevřené otázky na schůzce").click();
    await expect(openMenu(page).locator("a, button")).toHaveText(["Naplánovat téma", "Upravit téma", "Zrušit prioritu", "Posunout níž", "Archivovat…"]);
    await expectNoHorizontalScroll(page);
    await page.keyboard.press("Escape");
    // Garantovaná jsou dvě, třetí jde přidat.
    await menuOf(page, "Týmové priority").click();
    await expect(openMenu(page).getByRole("button", { name: "Nastavit prioritu" })).toBeVisible();
  });

  test("Naplánovat téma: termín tématu, vhodné návrhy s vysvětlením a nová akce s předvyplněným tématem", async ({ page }) => {
    await openTopics(page);
    await chooseInMenu(page, "Příprava na úvodní schůzku", "Naplánovat téma");
    const plan = page.getByRole("dialog", { name: "Naplánovat téma" });
    await expect(plan.getByText(/Téma už je naplánované na 26\. 11\./)).toBeVisible();
    const items = plan.getByRole("list", { name: "Vhodné akce" }).getByRole("listitem");
    await expect(items.first()).toContainText("Firemní vzdělávání FP · 13. 11.");
    await expect(items.first()).toContainText("Návrh bez tématu, uloží se jen návrh · typ akce vychází z témat · stejná skupina");
    await expectNoHorizontalScroll(page);

    await plan.getByRole("link", { name: "Vytvořit novou akci" }).click();
    const add = page.getByRole("dialog", { name: "Přidat akci" });
    await expect(add).toBeVisible();
    await expect(add.getByLabel(/^Téma/)).toHaveValue("Příprava na úvodní schůzku");
    await expect(add.getByLabel(/^Typ/)).toHaveValue("education-fp");
    await expect(add.getByLabel(/^Datum/)).toHaveValue("2026-11-13");
    await page.keyboard.press("Escape");
    await expect(add).toBeHidden();
    await expect(page).not.toHaveURL(/tema=/);
  });

  test("zveřejněná akce se otevře s předvyplněným tématem, bez uložení se nic nezmění", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-24&tema=topic-priority");
    await settle(page);
    const window = page.getByRole("dialog").filter({ hasText: "je předvyplněné" });
    await expect(window.getByText("Téma „Týmové priority“ je předvyplněné.")).toBeVisible();
    await expect(window.getByLabel(/^Téma/)).toHaveValue("Týmové priority");
    await expect(window.getByRole("button", { name: "Uložit jako návrh" })).toBeEnabled();
    await page.keyboard.press("Escape");
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-24");
    await settle(page);
    await expect(page.getByRole("dialog").getByLabel(/^Téma/)).toHaveValue("");
  });

  test("doporučení ve formuláři: garantované první se štítkem, upozornění při jiné skupině @desktop", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    await page.getByRole("button", { name: "Přidat akci", exact: true }).click();
    const add = page.getByRole("dialog", { name: "Přidat akci" });
    await add.getByLabel(/^Typ/).selectOption("education-fp");
    const suggestions = add.getByLabel("Doporučená témata").getByRole("button");
    await expect(suggestions.first()).toContainText("Otevřené otázky na schůzce");
    await expect(suggestions.first()).toContainText("Garantované");
    await expect(suggestions.first()).toContainText("2 zájemci");
    await expect(suggestions.nth(1)).toContainText("Doporučené");
    await suggestions.first().click();
    await add.getByLabel(/^Pro koho/).selectOption("rm");
    await expect(add.getByText(/je pro skupinu Finanční poradci, akce je pro Relationship manažeři/)).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe("Témata: zápis priority, pořadí a návrhu @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("nastavit a zrušit prioritu, posunout a vrátit pořadí, přidat téma do návrhu", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    await openTopics(page);
    const guaranteed = () => page.locator(".topic-guaranteed .item-title > span[id]");

    await chooseInMenu(page, "Týmové priority", "Nastavit prioritu");
    await expect(guaranteed()).toHaveText(["Otevřené otázky na schůzce", "Návaznost po konzultaci", "Týmové priority"]);
    await page.keyboard.press("Escape");
    await chooseInMenu(page, "Týmové priority", "Posunout výš");
    await expect(guaranteed()).toHaveText(["Otevřené otázky na schůzce", "Týmové priority", "Návaznost po konzultaci"]);
    await page.keyboard.press("Escape");
    await chooseInMenu(page, "Týmové priority", "Zrušit prioritu");
    await expect(guaranteed()).toHaveText(["Otevřené otázky na schůzce", "Návaznost po konzultaci"]);
    await page.keyboard.press("Escape");

    // Ruční pořadí ostatních: tichá poznámka nad seznamem, Seřadit podle zájmu ho vrátí.
    const others = page.locator(".topic-group").filter({ has: page.getByRole("heading", { name: "Ostatní témata" }) });
    const first = await others.locator(".item-title > span[id]").first().textContent();
    await chooseInMenu(page, first!, "Posunout níž");
    await expect(others.getByText("Pořadí upravil správce.")).toBeVisible();
    await expect(others.locator(".item-title > span[id]").nth(1)).toHaveText(first!);
    await page.keyboard.press("Escape");
    await others.getByRole("button", { name: "Seřadit podle zájmu" }).click();
    await expect(others.getByText("Pořadí upravil správce.")).toBeHidden();
    await expect(others.locator(".item-title > span[id]").first()).toHaveText(first!);

    // Vlastní návrh firemního vzdělávání FP bez tématu v prosinci.
    await page.goto("/vzdelavani/harmonogram?mesic=2026-12");
    await settle(page);
    await page.getByRole("button", { name: "Přidat akci", exact: true }).click();
    const add = page.getByRole("dialog", { name: "Přidat akci" });
    await add.getByLabel(/^Typ/).selectOption("education-fp");
    await add.getByLabel(/^Datum/).fill("2026-12-04");
    await add.getByRole("button", { name: "Uložit jako návrh" }).click();
    await expect(add).toBeHidden();

    await openTopics(page);
    await chooseInMenu(page, "Příprava na úvodní schůzku", "Naplánovat téma");
    const plan = page.getByRole("dialog", { name: "Naplánovat téma" });
    const item = plan.getByRole("listitem").filter({ hasText: "· 4. 12." });
    await expect(item).toContainText("Návrh");
    await item.getByRole("button", { name: /^Přidat do návrhu/ }).click();
    await expect(plan).toBeHidden();
    await expect(page.getByText(/Téma „Příprava na úvodní schůzku“ je v návrhu na 4\. 12\. Kolegové ho zatím nevidí, nic se neodeslalo\./)).toBeVisible();

    // Návrh má téma a zůstal návrhem.
    await page.goto("/vzdelavani/harmonogram?mesic=2026-12");
    await settle(page);
    const card = page.locator("a[data-move-id]").filter({ hasText: "Příprava na úvodní schůzku" });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(/Návrh/);
  });
});

test.describe("Témata očima účastníka", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("vidí garantovaná témata, správu ani výzvu ne", async ({ page }) => {
    await openTopics(page);
    await expect(page.getByRole("heading", { name: "Garantovaná témata" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Možnosti tématu/ })).toHaveCount(0);
    await expect(page.getByText(/Zatím nejsou nastavená garantovaná témata/)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
