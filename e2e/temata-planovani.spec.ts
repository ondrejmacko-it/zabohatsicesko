import type { CDPSession, Locator, Page } from "@playwright/test";
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
    // Stávající termín je nahoře s hlavním odkazem, další termín je vedlejší volba (nejdřív nejvýš tři akce).
    await expect(plan.getByText(/^Naplánováno na 26\. 11\./)).toBeVisible();
    await expect(plan.getByRole("link", { name: "Otevřít stávající akci" })).toHaveClass(/btn-primary/);
    await expect(plan.getByRole("heading", { name: "Další termín" })).toBeVisible();
    await expect(plan.getByRole("link", { name: "Vytvořit novou akci" })).not.toHaveClass(/btn-primary/);
    const items = plan.getByRole("list", { name: "Vhodné akce" }).getByRole("listitem");
    expect(await items.count()).toBeLessThanOrEqual(3);
    await expect(items.first()).toContainText("Firemní vzdělávání FP · 13. 11.");
    await expect(items.first()).toContainText("Finanční poradci · návrh, uloží se jen návrh");
    const more = plan.getByRole("button", { name: /^Zobrazit další/ });
    if (await more.isVisible()) {
      await more.click();
      expect(await items.count()).toBeGreaterThan(3);
    }
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
    await expect(window.getByText("Téma „Týmové priority“ je předvyplněné, zatím nic není uložené ani zveřejněné.")).toBeVisible();
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
  // Oba testy mění stejné sdílené pořadí, nesmí běžet souběžně.
  test.describe.configure({ mode: "serial" });

  test("přetažení pořadí úchytem: myš, klávesnice a prst, jen v rámci skupiny", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    await openTopics(page);
    const others = page.locator(".topic-group").filter({ has: page.getByRole("heading", { name: "Ostatní témata" }) });
    const names = () => others.locator(".item-title > span[id]").allTextContents();
    const handle = (name: string) => page.getByRole("button", { name: `Změnit pořadí: ${name}`, exact: true });
    // Garantovaná: pořadová čísla a úchyty; ostatní řádky bez čísel.
    await expect(page.locator(".topic-guaranteed .topic-rank")).toHaveText(["1", "2"]);
    await expect(others.locator(".topic-rank")).toHaveCount(0);
    await expect(others.locator(".topic-row").first()).toBeVisible();
    const start = await names();
    const [first, second] = start;
    if (!first || !second) throw new Error("test potřebuje aspoň dvě ostatní témata");

    // Myš: první řádek pod druhý.
    const from = await handle(first).boundingBox();
    const over = await rowOf(others, second).boundingBox();
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from!.x + from!.width / 2, over!.y + over!.height * 0.8, { steps: 8 });
    await page.mouse.up();
    await expect(others.getByText("Pořadí upravil správce.")).toBeVisible();
    await page.reload();
    await settle(page);
    expect((await names()).slice(0, 2)).toEqual([second, first]);

    // Klávesnice na úchytu v druhém okně: šipka nahoru vrátí téma na první místo, fokus zůstane na úchytu.
    const other = await page.context().newPage();
    await openTopics(other);
    const otherHandle = other.getByRole("button", { name: `Změnit pořadí: ${first}`, exact: true });
    await otherHandle.focus();
    await other.keyboard.press("ArrowUp");
    await expect(otherHandle).toBeFocused();
    await expect(other.locator("[aria-live=polite]").filter({ hasText: `Téma ${first} je na 1. místě` })).toHaveCount(1);
    await expect(other.locator(".topic-group .item-title > span[id]").filter({ hasText: second })).toBeVisible();
    await other.reload();
    await settle(other);
    await other.close();

    // Souběh: první okno má staré pořadí, jeho změnu server odmítne, okno vrátí a načte aktuální pořadí.
    await handle(first).focus();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("alert").filter({ hasText: "změnil někdo jiný" })).toBeVisible();
    await expect.poll(names).toEqual(start);
    await page.reload();
    await settle(page);
    expect(await names()).toEqual(start);

    // Prst na telefonu (390 px): úchyt prvního tématu pod druhé, stránka se přitom neposune.
    const phone = await browser.newContext({ storageState: authFile("spravce"), viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const mobile = await phone.newPage();
    await openTopics(mobile);
    const mobileOthers = mobile.locator(".topic-group").filter({ has: mobile.getByRole("heading", { name: "Ostatní témata" }) });
    const mobileHandle = mobile.getByRole("button", { name: `Změnit pořadí: ${first}`, exact: true });
    await mobileHandle.scrollIntoViewIfNeeded();
    const cdp: CDPSession = await phone.newCDPSession(mobile);
    const a = (await mobileHandle.boundingBox())!;
    const b = (await rowOf(mobileOthers, second).boundingBox())!;
    const scrollBefore = await mobile.evaluate(() => window.scrollY);
    const x = a.x + a.width / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: a.y + a.height / 2 }] });
    for (let i = 1; i <= 10; i++) {
      const y = a.y + a.height / 2 + ((b.y + b.height * 0.8 - a.y - a.height / 2) * i) / 10;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
      await mobile.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(await mobile.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await expect(mobileOthers.locator(".item-title > span[id]").nth(1)).toHaveText(first);
    await expectNoHorizontalScroll(mobile);
    await phone.close();

    // Úklid: zpět podle zájmu.
    await page.reload();
    await settle(page);
    expect((await names()).slice(0, 2)).toEqual([second, first]);
    await others.getByRole("button", { name: "Seřadit podle zájmu" }).click();
    await expect(others.getByText("Pořadí upravil správce.")).toBeHidden();
    expect(await names()).toEqual(start);
  });

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
    const more = plan.getByRole("button", { name: /^Zobrazit další/ });
    await expect(plan.getByRole("listitem").first()).toBeVisible();
    if (await more.isVisible()) await more.click();
    const item = plan.getByRole("listitem").filter({ hasText: "· 4. 12." });
    await expect(item).toContainText("návrh, uloží se jen návrh");
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
