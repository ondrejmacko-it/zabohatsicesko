import { authFile, expect, settle, test } from "./support";

// Celý průchod zápisu: akce proběhla → vedoucí nahraje nahrávku → návrh zápisu → kontrola → schválení vedoucím = zveřejnění → účastník vidí.
// Zapisuje do sdílených dat ukázky, proběhne jen v jednom projektu. Přepis je v ukázce jen pro ukázkovou nahrávku.
test.describe("Zápisy: od nahrávky ke zveřejnění @desktop", () => {
  test.use({ storageState: authFile("vedouci") });

  test("vedoucí zveřejní zápis, FP ho najde, RM ne", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    await page.goto("/vzdelavani/zapisy?zapis=tr-fp-1111");
    await settle(page);
    const dialog = page.getByRole("dialog", { name: /Trénink poradců/ });
    await expect(dialog.getByRole("status").filter({ hasText: "Čeká na zápis" })).toBeVisible();
    // UI předem říká, že přepis je jen ukázka, a nabízí ukázkovou nahrávku přímo u nahrávání.
    await expect(dialog).toContainText("Automatický přepis zatím umí jen jednu ukázkovou nahrávku");
    await expect(dialog.getByRole("link", { name: "Stáhnout ukázkovou nahrávku" })).toBeVisible();

    await dialog.getByLabel("Soubor s nahrávkou").setInputFiles("public/demo/testovaci-nahravka.wav");
    await expect(dialog).toContainText("se přiřadí k akci");
    await dialog.getByRole("button", { name: "Nahrát nahrávku" }).click();

    await expect(dialog.getByRole("status").filter({ hasText: "Čeká na schválení" })).toBeVisible({ timeout: 20_000 });
    const summary = dialog.getByLabel("Shrnutí");
    await expect(summary).not.toHaveValue("");
    await summary.fill("Trénink k úvodní schůzce: kontrola podkladů a tři otevřené otázky.");
    await dialog.getByRole("button", { name: "Schválit a zveřejnit" }).click();
    await expect(dialog.getByRole("status").filter({ hasText: "Zápis zveřejněn" })).toBeVisible();

    for (const [role, visible] of [["ucastnikFp", true], ["ucastnikRm", false]] as const) {
      const ctx = await browser.newContext({ storageState: authFile(role) });
      const other = await ctx.newPage();
      await other.goto("/vzdelavani/zapisy");
      const card = other.getByRole("link", { name: /Příprava na úvodní schůzku/ });
      if (visible) {
        await expect(card).toContainText("kontrola podkladů");
        await card.click();
        await expect(other.getByRole("dialog")).toContainText("Trénink k úvodní schůzce");
        // Účastník vidí jen zveřejněný zápis, ne nahrávku ani pracovní přepis.
        await expect(other.getByRole("dialog")).not.toContainText("Pracovní přepis");
      } else {
        await expect(card).toHaveCount(0);
      }
      await ctx.close();
    }
  });
});

// Ukázka má jeden zveřejněný zápis (seed `publishedMinutes`): čtenář ho otevře rovnou z okna akce.
test.describe("Zápisy: čtenář z okna akce", () => {
  test.use({ storageState: authFile("ucastnikRm") });

  test("Zobrazit zápis z okna akce", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-6");
    await settle(page);
    await page.getByRole("dialog").getByRole("link", { name: "Zobrazit zápis" }).click();
    await page.waitForURL(/\/vzdelavani\/zapisy\?zapis=ev-11-6/);
    const reader = page.getByRole("dialog");
    await expect(reader).toContainText("První rozhovor s klientem");
    await expect(reader).toContainText("Tým používá jednotný seznam úvodních otázek.");
    // Čtenář vidí jen zveřejněný zápis, ne nahrávku ani pracovní přepis.
    await expect(reader).not.toContainText("Pracovní přepis");
  });
});
