import { authFile, expect, expectNoHorizontalScroll, expectNoSeriousA11y, settle, test } from "./support";

// Zápis bez nahrávky se schválením vedoucím: vložené poznámky → úprava → vedoucí schválí verzi → zveřejněno
// → úprava správcem schválení zruší. Zapisuje do sdílených dat ukázky (akce ev-11-10, kterou jiné testy
// nepoužívají), proto běží jen v jednom projektu. Cesta odpovídá rychlé akci „Doplnit zápis“ (detail #nahravka).
const EVENT = "ev-11-10";
const NOTES = ["Shrnutí: Akce týmu A, rozbor oslovení klientů.", "Hlavní body:", "- Každý si připraví tři kontakty.", "Další kroky:", "- Petr pošle šablonu e-mailu do pátku."].join("\n");

test.describe("Zápisy: schválení vedoucím @desktop", () => {
  test.use({ storageState: authFile("vedouci") });

  test("vložit text → upravit → vedoucí schválí → zveřejněno → úprava schválení zruší", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    await page.goto(`/vzdelavani/akce/${EVENT}#nahravka`);
    await settle(page);
    const section = page.locator("#nahravka");
    await expect(section.getByRole("status").filter({ hasText: "Čeká na zápis" })).toBeVisible();

    await section.getByRole("radio", { name: /Vložit přepis nebo poznámky/ }).check();
    await section.getByLabel("Druh textu").selectOption("notes");
    await expectNoSeriousA11y(page);
    await expectNoHorizontalScroll(page);
    await section.getByLabel("Text přepisu nebo poznámek").fill(NOTES);
    await section.getByRole("button", { name: "Připravit návrh zápisu" }).click();

    await expect(section.getByRole("status").filter({ hasText: "Čeká na schválení" })).toBeVisible();
    await expect(section.getByTestId("stav-verze")).toContainText("Návrh, verze 1");
    await expect(section.getByTestId("stav-verze")).toContainText("vložené poznámky");
    await expect(section.getByLabel("Shrnutí")).toHaveValue("Akce týmu A, rozbor oslovení klientů.");
    await expect(section.getByLabel("Další kroky")).toHaveValue("Petr pošle šablonu e-mailu do pátku.");
    await expectNoSeriousA11y(page);

    await section.getByLabel("Shrnutí").fill("Akce týmu A: rozbor oslovení klientů a tři kontakty na osobu.");
    await section.getByRole("button", { name: "Uložit návrh zápisu" }).click();
    await expect(section.getByTestId("stav-verze")).toContainText("verze 2");

    await section.getByRole("button", { name: "Schválit a zveřejnit" }).click();
    await expect(section.getByRole("status").filter({ hasText: "Zápis zveřejněn" })).toBeVisible();
    await expect(section.getByTestId("stav-verze")).toContainText("Schváleno: verze 2");

    // Správce zápis vidí zveřejněný. Upravit ho smí, schválit ne: úprava schválení zruší.
    const ctx = await browser.newContext({ storageState: authFile("spravce") });
    const admin = await ctx.newPage();
    await admin.goto("/vzdelavani/zapisy");
    await expect(admin.getByRole("main")).toContainText("tři kontakty na osobu");

    await admin.goto(`/vzdelavani/akce/${EVENT}#nahravka`);
    await settle(admin);
    const adminSection = admin.locator("#nahravka");
    await expect(adminSection.getByRole("button", { name: "Schválit a zveřejnit" })).toHaveCount(0);
    await adminSection.getByText("Upravit zápis", { exact: true }).click();
    await adminSection.getByLabel("Shrnutí").fill("Akce týmu A: opraveno správcem.");
    await adminSection.getByRole("button", { name: "Uložit změny" }).click();
    await expect(adminSection.getByRole("status").filter({ hasText: "Čeká na schválení" })).toBeVisible();
    await expect(adminSection.getByTestId("stav-verze")).toContainText("Verze 3 čeká na nové schválení (schválena byla verze 2)");
    await expect(adminSection.getByRole("button", { name: "Schválit a zveřejnit" })).toHaveCount(0);
    await expect(adminSection).toContainText("Zápis zveřejní vedoucí akce");

    await admin.goto("/vzdelavani/zapisy");
    await settle(admin);
    await expect(admin.getByRole("main")).not.toContainText("tři kontakty na osobu");
    await expect(admin.getByRole("main")).not.toContainText("opraveno správcem");
    await ctx.close();

    // Vedoucí znovu schválí aktuální verzi.
    await page.reload();
    await settle(page);
    await expect(section.getByTestId("stav-verze")).toContainText("Verze 3 čeká na nové schválení");
    await section.getByRole("button", { name: "Schválit a zveřejnit" }).click();
    await expect(section.getByTestId("stav-verze")).toContainText("Schváleno: verze 3");
  });
});
