import { authFile, expect, expectNoHorizontalScroll, expectNoSeriousA11y, settle, test } from "./support";

// Zápis bez nahrávky se schválením vedoucím: vložené poznámky → úprava → vedoucí schválí verzi → zveřejněno
// → úprava správcem schválení zruší. Zapisuje do sdílených dat ukázky (akce ev-11-10, kterou jiné testy
// nepoužívají), proto běží jen v jednom projektu. Cesta odpovídá rychlé akci „Doplnit zápis“ (detail #nahravka).
const EVENT = "ev-11-10";
const NOTES = ["Shrnutí: Akce týmu A, rozbor oslovení klientů.", "Hlavní body:", "- Každý si připraví tři kontakty.", "Další kroky:", "- Petr pošle šablonu e-mailu do pátku."].join("\n");

test.describe("Zápisy: schválení vedoucím @desktop", () => {
  test.use({ storageState: authFile("vedouci") });

  test("vložit text → upravit → vedoucí schválí → zveřejněno → oprava je nový návrh, schválená verze zůstává", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    await page.goto(`/vzdelavani/akce/${EVENT}#nahravka`);
    await settle(page);
    const section = page.locator("#nahravka");
    await expect(section.getByRole("status").filter({ hasText: "Čeká na zápis" })).toBeVisible();

    // Z-08: prázdná ruční šablona je rozpracovaná, ne „čeká na schválení“. Z-12: bez nahrávky nadpis jen „Zápis“.
    await expect(section.getByRole("heading", { level: 2 })).toHaveText("Zápis");
    // F13: sekce říká, kdo zápis schvaluje. F14: jedno pole a soubor místo voleb.
    await expect(section.getByTestId("schvaluje")).toContainText("Zápis schvaluješ ty jako vedoucí akce");
    await expect(section.getByRole("radio")).toHaveCount(0);
    await expect(section.getByTestId("citliva-data")).toContainText("Text se nepoužívá k trénování AI");
    // Audit P1-Z1: vynechání jmen je heuristika a návrh skládá lokální šablona, text nesmí slibovat víc.
    await expect(section.getByTestId("citliva-data")).toContainText("nepoznají každé jméno");
    await expect(section.getByTestId("citliva-data")).toContainText("text se nikam neposílá");
    await section.getByRole("button", { name: "Napsat zápis ručně" }).click();
    await expect(section.getByRole("status").filter({ hasText: "Rozpracováno" })).toBeVisible();
    await expect(section.getByTestId("stav-verze")).toContainText("Rozpracováno, verze 1");
    await expect(section).not.toContainText("čeká na schválení");

    // Z-10: Změnit zdroj vymění v okně editor za volbu zdroje, rozepsaný text se návratem neztratí.
    await section.getByLabel("Shrnutí", { exact: true }).fill("Rozepsáno");
    await section.getByRole("button", { name: "Změnit zdroj" }).click();
    await expect(section.getByLabel("Shrnutí", { exact: true })).toBeHidden();
    await expect(section.getByLabel("Vlož přepis nebo poznámky")).toBeFocused();
    await section.getByRole("button", { name: "Zpět k zápisu" }).click();
    await expect(section.getByLabel("Shrnutí", { exact: true })).toHaveValue("Rozepsáno");
    await section.getByRole("button", { name: "Změnit zdroj" }).click();

    // Prázdnou šablonu nový zdroj nahradí bez potvrzovacího okna (nic se neztratí).
    await expectNoSeriousA11y(page);
    await expectNoHorizontalScroll(page);
    await expect(section.getByText("nebo nahraj soubor")).toBeVisible();
    await section.getByLabel("Vlož přepis nebo poznámky").fill(NOTES);
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
    await expect(adminSection.getByTestId("schvaluje")).toContainText("Zápis schvaluje vedoucí akce:");
    await adminSection.getByText("Upravit zápis", { exact: true }).click();
    await adminSection.getByLabel("Shrnutí").fill("Akce týmu A: opraveno správcem.");
    await adminSection.getByRole("button", { name: "Uložit změny" }).click();
    await expect(adminSection.getByRole("status").filter({ hasText: "Čeká na schválení" })).toBeVisible();
    await expect(adminSection.getByTestId("stav-verze")).toContainText("Verze 3 čeká na nové schválení (schválena byla verze 2)");
    await expect(adminSection.getByRole("button", { name: "Schválit a zveřejnit" })).toHaveCount(0);
    await expect(adminSection).toContainText("Zápis zveřejní vedoucí akce");

    await admin.goto("/vzdelavani/zapisy");
    await settle(admin);
    // Z-01: rozpracovaná oprava schválený zápis neschová, publikum čte poslední schválenou verzi.
    await expect(admin.getByRole("main")).toContainText("tři kontakty na osobu");
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
