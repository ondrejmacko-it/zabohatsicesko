import type { Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Cílené kontroly auditu U03–U08. Testy nic neukládají (sdílená databáze sady), jen čtou a otevírají okna.

/** Tyto testy nastavují vlastní velikost okna, stačí je pustit v jednom projektu. */
const onlyOnce = (projectName: string) => projectName !== "windows-1280";

test.describe("U03 tlačítko zájmu", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("viditelný text je přístupný název, stav nese aria-pressed, téma popis", async ({ page }) => {
    await page.goto("/vzdelavani/temata");
    await settle(page);
    const buttons = page.getByRole("button", { name: "Mám zájem", exact: true });
    expect(await buttons.count()).toBeGreaterThan(0);
    const first = buttons.first();
    await expect(first).toHaveAttribute("aria-pressed", /^(true|false)$/);
    expect(await first.evaluate((node) => node.getAttribute("aria-label"))).toBeNull();
    const describedBy = await first.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).not.toBeEmpty();
  });
});

test.describe("U07 menu @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("menu je disclosure: bez aria-haspopup, Tab projde položky a odchod menu zavře", async ({ page }) => {
    await page.goto("/vzdelavani/temata");
    await settle(page);
    expect(await page.locator("[aria-haspopup]").count()).toBe(0);
    const trigger = page.getByRole("button", { name: /^Možnosti tématu/ }).first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest(".menu-list")));
    expect(inside, "první Tab jde do položek menu").toBe(true);
    // Shift+Tab zpět na tlačítko a ještě jednou ven: menu se zavře.
    await page.keyboard.press("Shift+Tab");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("U05 Plán na telefonu", () => {
  test("účastník vidí nahoře nejbližší akci, prázdný panel úkolů tam není", async ({ browser }, testInfo) => {
    test.skip(onlyOnce(testInfo.project.name));
    const context = await browser.newContext({ storageState: authFile("ucastnikFp"), viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    const next = page.getByRole("region", { name: "Nejbližší akce" });
    await expect(next).toBeVisible();
    await expect(next.getByRole("link")).toHaveCount(1);
    await expect(page.getByRole("region", { name: /Čeká na tebe/ })).toHaveCount(0);
    const nextTop = await next.evaluate((node) => node.getBoundingClientRect().top);
    expect(nextTop, "nejbližší akce bez posunu").toBeLessThan(760);
    await expectNoHorizontalScroll(page);
    await context.close();
  });

  test("správce má stav měsíce jako štítky viditelné bez rozbalení", async ({ browser }, testInfo) => {
    test.skip(onlyOnce(testInfo.project.name));
    const context = await browser.newContext({ storageState: authFile("spravce"), viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    const chips = page.getByRole("group", { name: "Zúžit plán" });
    await expect(chips).toBeVisible();
    const hrefs = await chips.getByRole("link").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? ""));
    expect(hrefs.some((href) => href.includes("stav=")), `stav měsíce v ${hrefs.join(", ")}`).toBe(true);
    const chipsTop = await chips.evaluate((node) => node.getBoundingClientRect().top);
    expect(chipsTop, "štítky bez posunu").toBeLessThan(760);
    await expect(page.getByRole("region", { name: "Nejbližší akce" })).toHaveCount(0);
    await context.close();
  });
});

async function openAddEvent(page: Page) {
  await page.goto("/vzdelavani/harmonogram");
  await settle(page);
  await page.getByRole("button", { name: "Přidat akci" }).click();
  const opened = page.getByRole("dialog", { name: "Přidat akci" });
  await expect(opened).toBeVisible();
  return opened;
}

test.describe("U08 dialog akce", () => {
  test("na 320×256 jde okno projít bez posunu do strany a chyby mají souhrn a fokus", async ({ browser }, testInfo) => {
    test.skip(onlyOnce(testInfo.project.name));
    const context = await browser.newContext({ storageState: authFile("spravce"), viewport: { width: 320, height: 256 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const opened = await openAddEvent(page);
    await expectNoHorizontalScroll(page);
    // Pole jsou na úzkém okně pod sebou (Typ a Datum nejsou vedle sebe).
    const typeBox = await opened.getByLabel("Typ").boundingBox();
    const dateBox = await opened.getByLabel("Datum").boundingBox();
    expect(dateBox!.y, "Datum pod Typem").toBeGreaterThan(typeBox!.y + typeBox!.height - 1);
    // Jiná akce nemá výchozí název; vyplněný název nechá chybu jen na Datu.
    await opened.getByLabel("Název akce", { exact: true }).fill("Návštěva partnera");
    await opened.getByLabel("Datum").fill("");
    const save = opened.getByRole("button", { name: "Uložit jako návrh" });
    await save.scrollIntoViewIfNeeded();
    await save.click();
    const summary = opened.getByRole("alert").filter({ hasText: "Akci zatím nejde uložit" });
    await expect(summary).toContainText("Datum");
    await expect(opened.getByLabel("Datum")).toBeFocused();
    await expectNoHorizontalScroll(page);
    await context.close();
  });

});

test.describe("U08 dialog akce na počítači @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  // Jednotný editor akce: Typ vedle Pro koho, Datum vedle Od a Do (na telefonu pod sebou, viz test výše).
  test("Typ s Pro koho a Datum s časem zůstávají vedle sebe", async ({ page }) => {
    const opened = await openAddEvent(page);
    const typeBox = await opened.getByRole("combobox", { name: "Typ", exact: true }).boundingBox();
    const audienceBox = await opened.getByRole("combobox", { name: /^Pro koho/ }).boundingBox();
    const dateBox = await opened.getByLabel("Datum").boundingBox();
    const fromBox = await opened.getByRole("textbox", { name: "Od", exact: true }).boundingBox();
    expect(Math.abs(audienceBox!.y - typeBox!.y), "Typ a Pro koho na jednom řádku").toBeLessThan(4);
    expect(Math.abs(fromBox!.y - dateBox!.y), "Datum a Od na jednom řádku").toBeLessThan(4);
  });
});
