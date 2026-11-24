import { UCAST_PORT } from "./constants.mjs";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// F14 + F15 ve výchozím stavu (bez RECORDING_DEMO): server účasti z e2e/server.mjs má ukázku nahrávky vypnutou.
// Zapisuje do vlastní databáze toho serveru (akce ev-11-10, testy účasti ji nepoužívají), proto jen jeden projekt.
const BASE = `http://localhost:${UCAST_PORT}`;
const EVENT = "ev-11-10";

test.describe("Zápis bez nahrávky a bez jmen klientů @desktop", () => {
  // Oba testy píšou do zápisu stejné akce: souběžně by si přepsaly návrh.
  test.describe.configure({ mode: "serial" });
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

  // Audit P1-Z2: okno zápisu (Zápisy → ?zapis=) rozepsaný text bez dotazu nezahodí, uložený text se za změnu nepočítá.
  test("okno zápisu: rozepsaný text se při zavření ohlásí, po uložení se okno zavře bez dotazu", async ({ page }, info) => {
    test.skip(info.project.name !== "windows-1280", "zápis jen jednou");
    await page.goto(`${BASE}/vzdelavani/zapisy?zapis=${EVENT}`);
    await settle(page);
    const dialog = page.getByRole("dialog", { name: "Action time" });
    const summary = dialog.getByRole("textbox", { name: "Shrnutí", exact: true });
    const manual = dialog.getByRole("button", { name: "Napsat zápis ručně" });
    // Spuštěný samostatně test zápis teprve založí, po předchozím testu už je návrh rozepsaný.
    await expect(summary.or(manual)).toBeVisible({ timeout: 20_000 });
    if (await manual.isVisible()) await manual.click();
    await summary.fill("Rozepsaná změna z okna zápisu");
    await page.keyboard.press("Escape");
    const confirm = page.getByRole("alertdialog", { name: "Neuložené změny" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Pokračovat v úpravách" }).click();
    await expect(summary).toHaveValue("Rozepsaná změna z okna zápisu");

    await dialog.getByRole("button", { name: "Uložit návrh zápisu" }).click();
    await expect(dialog.getByRole("status").filter({ hasText: /uložen/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(confirm).toHaveCount(0);
    await expect(page).toHaveURL(/\/vzdelavani\/zapisy$/);
  });
  // Rozhodnutí vlastníka (audit P1): rozepsaný zápis na stránce detailu se při odchodu odkazem ohlásí, uložený ne.
  test("detail akce: odchod od rozepsaného zápisu se ohlásí, po uložení ne", async ({ page }, info) => {
    test.skip(info.project.name !== "windows-1280", "zápis jen jednou");
    await page.goto(`${BASE}/vzdelavani/akce/${EVENT}#nahravka`);
    await settle(page);
    const section = page.locator("#nahravka");
    const summary = section.getByRole("textbox", { name: "Shrnutí", exact: true });
    const manual = section.getByRole("button", { name: "Napsat zápis ručně" });
    await expect(summary.or(manual)).toBeVisible({ timeout: 20_000 });
    if (await manual.isVisible()) await manual.click();
    await summary.fill("Rozepsáno na detailu akce");
    const away = page.getByRole("link", { name: "Zápisy", exact: true }).first();

    const asked: string[] = [];
    page.once("dialog", (dialog) => {
      asked.push(dialog.message());
      void dialog.dismiss();
    });
    await away.click();
    await expect.poll(() => asked.length).toBe(1);
    expect(asked[0]).toContain("neuložené změny");
    await expect(page).toHaveURL(new RegExp(`/vzdelavani/akce/${EVENT}`));
    await expect(summary).toHaveValue("Rozepsáno na detailu akce");

    await section.getByRole("button", { name: "Uložit návrh zápisu" }).click();
    await expect(section.getByRole("status").filter({ hasText: /uložen/i })).toBeVisible();
    page.on("dialog", (dialog) => {
      asked.push(dialog.message());
      void dialog.dismiss();
    });
    await away.click();
    await expect(page).toHaveURL(/\/vzdelavani\/zapisy/);
    expect(asked).toHaveLength(1);
  });
});
