import { UCAST_PORT } from "./constants.mjs";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// F14 + F15 ve výchozím stavu (bez RECORDING_DEMO): server účasti z e2e/server.mjs má ukázku nahrávky vypnutou.
// Zapisuje do vlastní databáze toho serveru (akce ev-11-10, testy účasti ji nepoužívají), proto jen jeden projekt.
const BASE = `http://localhost:${UCAST_PORT}`;
const EVENT = "ev-11-10";

test.describe("Zápis bez nahrávky a bez jmen klientů @desktop", () => {
  test.use({ storageState: authFile("vedouci") });

  test("nahrávka se nenabízí, jedno pole, jména a kontakty klientů v návrhu nejsou", async ({ page }, info) => {
    test.skip(info.project.name !== "windows-1280", "zápis jen jednou");
    await page.goto(`${BASE}/vzdelavani/akce/${EVENT}#nahravka`);
    await settle(page);
    const section = page.locator("#nahravka");
    await expect(section.getByLabel("Vlož přepis nebo poznámky")).toBeVisible();
    await expect(section.getByRole("button", { name: /Nahrávka/ })).toHaveCount(0);
    await expect(section).not.toContainText("Nahrávka (ukázka)");
    await expectNoHorizontalScroll(page);

    await section
      .getByLabel("Vlož přepis nebo poznámky")
      .fill("Shrnutí: Rozbor schůzky, klientka Jana Nová, tel. 603 123 456.\nDalší kroky:\n- Petr pošle šablonu do pátku.");
    await section.getByRole("button", { name: "Připravit návrh zápisu" }).click();
    const summary = section.getByLabel("Shrnutí");
    await expect(summary).toHaveValue("Rozbor schůzky, klientka [jméno], tel. [telefon].");
    await expect(section.getByLabel("Další kroky")).toHaveValue("Petr pošle šablonu do pátku.");
    await expect(section).not.toContainText("Jana Nová");
  });
});
