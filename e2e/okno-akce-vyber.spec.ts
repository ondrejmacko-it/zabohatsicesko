import { authFile, chooseOption, expect, settle, test } from "./support";

// Screenshoty vlastníka 27. 11. 2026 (Android): nativní <select> se otevírá přes celou obrazovku a dlouhé
// názvy useká. Vede, Pro koho a Kdo zkontroluje zápis jsou v okně akce Combobox jen z nabídky.
test.use({ storageState: authFile("spravce") });

for (const width of [320, 390]) {
  test(`telefon ${width} px: výběry v okně akce jsou nabídka v okně, ne nativní select`, async ({ page }, info) => {
    test.skip(info.project.name !== "telefon-390", "šířky prochází jeden telefonní projekt");
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-26");
    await settle(page);
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    for (const name of ["leadId", "audience", "reviewerId"]) {
      await expect(dialog.locator(`select[name="${name}"]`)).toHaveCount(0);
      await expect(dialog.locator(`input[type="hidden"][name="${name}"]`)).toHaveCount(1);
    }

    // Pro koho: výběr přepíše zobrazený název i odesílanou hodnotu, nabídka nepřetéká okno ani obrazovku.
    const audience = dialog.getByRole("combobox", { name: /^Pro koho/ });
    await audience.click();
    const panel = dialog.locator(".combobox-panel:visible");
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await audience.click();
    await chooseOption(dialog, /^Pro koho/, { value: "rm" });
    await expect(audience).toHaveValue("Relationship manažeři");
    await expect(dialog.locator('input[type="hidden"][name="audience"]')).toHaveValue("rm");

    // Vede: na telefonu nevyvolá klávesnici (readOnly) a volí se podle jména.
    const lead = dialog.getByRole("combobox", { name: /^Vede/ });
    await expect(lead).toHaveAttribute("readonly", "");
    await chooseOption(dialog, /^Vede/, { label: "Správce ZBC ukázky" });
    await expect(lead).toHaveValue("Správce ZBC ukázky");

    // Kdo zkontroluje zápis: prázdná hodnota má vlastní název „Jen vedoucí“.
    await dialog.locator("summary", { hasText: "Další údaje" }).click();
    const reviewer = dialog.getByRole("combobox", { name: /^Kdo zkontroluje zápis/ });
    await chooseOption(dialog, /^Kdo zkontroluje zápis/, { label: "Správce ZBC ukázky" });
    await expect(reviewer).toHaveValue("Správce ZBC ukázky");
    await chooseOption(dialog, /^Kdo zkontroluje zápis/, { value: "" });
    await expect(reviewer).toHaveValue("Jen vedoucí");
    await expect(dialog.locator('input[type="hidden"][name="reviewerId"]')).toHaveValue("");

    const overflow = await dialog.locator(".dialog-body").evaluate((b) => b.scrollWidth - b.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
